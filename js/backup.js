/* ============================================================
   SERRA · backup.js — § 8
   Non è una funzione accessoria: è l'unica copia dei dati.
   ============================================================ */
import { db, SCHEMA, TABELLE_DATI, TABELLE_CONFIG, adesso } from './db.js';

export async function costruisciExport(){
  const dati = {};
  for (const t of TABELLE_DATI) dati[t] = await db[t].toArray();
  const config = {};
  for (const t of TABELLE_CONFIG) config[t] = await db[t].toArray();
  /* le impostazioni viaggiano come oggetto: più leggibile a occhio */
  config.impostazioni = Object.fromEntries(config.impostazioni.map(r => [r.chiave, r.valore]));
  return { schema: SCHEMA, esportato: adesso(), ...dati, config };
}

export function nomeFile(){
  return 'serra-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
}

export async function esporta(){
  const dump = await costruisciExport();
  const testo = JSON.stringify(dump, null, 1);
  await db.meta.put({ chiave: 'ultimoExport', valore: adesso() });
  return { testo, nome: nomeFile(),
           righe: TABELLE_DATI.reduce((s, t) => s + dump[t].length, 0) };
}

/* Sostituzione integrale, previa conferma esplicita di chi chiama. */
export async function importa(testo){
  const d = JSON.parse(testo);
  if (!d || !d.schema) throw new Error('File non riconosciuto: manca il numero di schema.');
  if (d.schema.split('.')[0] !== SCHEMA.split('.')[0])
    throw new Error(`Schema ${d.schema} incompatibile con questa versione (${SCHEMA}).`);

  const config = d.config || {};
  const impostazioni = Array.isArray(config.impostazioni)
    ? config.impostazioni
    : Object.entries(config.impostazioni || {}).map(([chiave, valore]) => ({ chiave, valore }));

  const tabelle = [...TABELLE_DATI, ...TABELLE_CONFIG].map(t => db[t]);
  await db.transaction('rw', [...tabelle, db.meta], async () => {
    for (const t of TABELLE_DATI){ await db[t].clear(); await db[t].bulkPut(d[t] || []); }
    for (const t of TABELLE_CONFIG.filter(x => x !== 'impostazioni')){
      await db[t].clear(); await db[t].bulkPut(config[t] || []);
    }
    await db.impostazioni.clear();
    await db.impostazioni.bulkPut(impostazioni);
    await db.meta.put({ chiave: 'schema', valore: d.schema });
    await db.meta.put({ chiave: 'ultimoImport', valore: adesso() });
  });
  return TABELLE_DATI.reduce((s, t) => s + (d[t] || []).length, 0);
}

/* Promemoria: se l'ultimo export ha più di N giorni, l'app lo dice. */
export async function giorniDallUltimoExport(){
  const r = await db.meta.get('ultimoExport');
  if (!r) return null;
  return Math.floor((Date.now() - new Date(r.valore).getTime()) / 86400000);
}

export async function backupScaduto(giorniLimite){
  const g = await giorniDallUltimoExport();
  const vuoto = (await db.movimenti.count()) === 0;
  if (vuoto) return null;
  if (g === null) return { giorni: null, mai: true };
  return g >= giorniLimite ? { giorni: g, mai: false } : null;
}
