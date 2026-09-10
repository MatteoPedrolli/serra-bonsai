/* ============================================================
   SERRA · backup.js — § 8
   Non è una funzione accessoria: è l'unica copia dei dati.

   Tre difese, in ordine di forza:
   1. lo spazio protetto  — il telefono non può ripulire l'archivio
   2. le istantanee       — si torna indietro da un import sbagliato
   3. il file su Drive    — l'unica che sopravvive al telefono
   Le prime due riducono gli incidenti. Solo la terza è un backup.
   ============================================================ */
import { db, SCHEMA, TABELLE_DATI, TABELLE_CONFIG, adesso, normalizzaConfig } from './db.js';

/* ---------- 1 · spazio protetto ----------
   Senza questo, il browser considera l'archivio «cache» e può buttarlo
   quando lo spazio scarseggia. Su Android il permesso arriva da solo se
   l'app è installata dalla schermata Home; su iPhone Safari cancella
   tutto dopo qualche settimana di inattività se non è installata. */
export async function proteggiSpazio(){
  if (!navigator.storage || !navigator.storage.persist) return { stato: 'ignoto' };
  try {
    const gia = await navigator.storage.persisted();
    const ok = gia || await navigator.storage.persist();
    const s = navigator.storage.estimate ? await navigator.storage.estimate() : {};
    return { stato: ok ? 'protetto' : 'a rischio', usati: s.usage || 0, spazio: s.quota || 0 };
  } catch { return { stato: 'ignoto' }; }
}

/* ---------- il dump ---------- */
export async function costruisciExport(){
  const dati = {};
  for (const t of TABELLE_DATI) dati[t] = await db[t].toArray();
  const config = {};
  for (const t of TABELLE_CONFIG) config[t] = await db[t].toArray();
  /* le impostazioni viaggiano come oggetto: più leggibile a occhio */
  config.impostazioni = Object.fromEntries(config.impostazioni.map(r => [r.chiave, r.valore]));
  return { schema: SCHEMA, esportato: adesso(), ...dati, config };
}

export const conta = d => TABELLE_DATI.reduce((s, t) => s + ((d && d[t]) ? d[t].length : 0), 0);
export const contaPerTabella = d => Object.fromEntries(
  TABELLE_DATI.map(t => [t, (d && d[t]) ? d[t].length : 0]));

export function nomeFile(){
  return 'serra-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
}

/* ---------- 2 · istantanee locali ----------
   Una copia dentro l'archivio stesso. Non protegge dalla cancellazione
   dei dati del sito — muore insieme al resto — ma riporta indietro da un
   import sbagliato, che è l'incidente più facile da fare. */
const MAX_ISTANTANEE = 12;

export async function istantanea(motivo){
  const dump = await costruisciExport();
  const righe = conta(dump);
  await db.istantanee.add({ data: adesso(), motivo, righe, dump: JSON.stringify(dump) });
  const tutte = await db.istantanee.orderBy('id').toArray();
  const troppe = tutte.length - MAX_ISTANTANEE;
  if (troppe > 0) await db.istantanee.bulkDelete(tutte.slice(0, troppe).map(x => x.id));
  return righe;
}

export const elencoIstantanee = () =>
  db.istantanee.orderBy('id').reverse().toArray()
    .then(l => l.map(({ dump, ...resto }) => resto));

export async function istantaneaGiornaliera(){
  if ((await db.movimenti.count()) === 0) return null;
  const ultima = await db.istantanee.orderBy('id').last();
  if (ultima && Date.now() - new Date(ultima.data).getTime() < 20 * 3600 * 1000) return null;
  return istantanea('automatica');
}

export async function ripristina(id){
  const riga = await db.istantanee.get(id);
  if (!riga) throw new Error('Istantanea non trovata.');
  await istantanea('prima di un ripristino');
  return applica(JSON.parse(riga.dump));
}

/* ---------- 3 · export ---------- */
/* La copia si prepara *prima* del tocco: `navigator.share` vuole essere
   chiamata mentre il tocco è ancora fresco, e leggere tutto l'archivio in
   mezzo può bastare a farlo scadere. */
export async function preparaCopia(){
  const dump = await costruisciExport();
  return { testo: JSON.stringify(dump, null, 1), nome: nomeFile(), righe: conta(dump) };
}

export async function segnaCopia(righe){
  await db.meta.put({ chiave: 'ultimoExport', valore: adesso() });
  await db.meta.put({ chiave: 'righeUltimoExport', valore: righe });
}

export async function esporta(){
  const copia = await preparaCopia();
  await segnaCopia(copia.righe);
  return copia;
}

/* Un tocco e finisce su Drive, in posta, dove vuoi.

   Chromium consente di condividere solo certi tipi di file, e
   `application/json` non è fra quelli: sul telefono il primo tentativo
   viene rifiutato, e senza il secondo il tasto si limitava a scaricare
   senza spiegare perché. Il gemello .txt ha lo stesso contenuto — è JSON
   dentro — e passa. */
const varianti = (testo, nome) => [
  new File([testo], nome, { type: 'application/json' }),
  new File([testo], nome.replace(/\.json$/, '') + '.txt', { type: 'text/plain' }),
];

const accettato = file => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); }
  catch { return false; }
};

/* Serve all'interfaccia per non promettere quello che non può mantenere. */
export function condivisioneDisponibile(){
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  return varianti('{}', 'prova.json').some(accettato);
}

export async function condividi(copia){
  const { testo, nome, righe } = copia || await preparaCopia();
  const etichetta = `Vivaio · ${righe} righe · ${new Date().toLocaleDateString('it-IT')}`;
  let intoppo = null;

  if (navigator.share && navigator.canShare){
    /* prima il .txt: è il tipo che la lista di Chromium accetta di sicuro */
    for (const file of varianti(testo, nome).reverse()){
      if (!accettato(file)){ intoppo = intoppo || `tipo ${file.type} rifiutato`; continue; }
      try {
        await navigator.share({ files: [file], title: file.name, text: etichetta });
        await segnaCopia(righe);
        return { via: 'condivisione', nome: file.name, righe };
      } catch (err){
        if (err && err.name === 'AbortError') return { via: 'annullato', nome, righe };
        intoppo = (err && err.name) || 'errore sconosciuto';
      }
    }
  } else intoppo = 'questo dispositivo non ha la condivisione';

  scarica(testo, nome);
  await segnaCopia(righe);
  return { via: 'scaricamento', nome, righe, motivo: intoppo };
}

/* ---------- che versione dell'app sta girando davvero ----------
   Il nome della cache è la verità: è da lì che arrivano i file. */
export async function versioneInUso(){
  try {
    const chiavi = await caches.keys();
    return chiavi.find(k => k.startsWith('serra-')) || 'nessuna (rete diretta)';
  } catch { return 'sconosciuta'; }
}

/* Cerca una versione nuova e la mette in servizio senza aspettare la
   seconda riapertura. */
export async function aggiornaApp(){
  const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
  if (!reg) return 'niente da aggiornare';
  await reg.update();
  const pronto = reg.waiting || reg.installing;
  if (!pronto) return 'già aggiornata';
  if (reg.waiting) reg.waiting.postMessage('salta-attesa');
  return 'in arrivo';
}

export function scarica(testo, nome){
  const url = URL.createObjectURL(new Blob([testo], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- 4 · import ----------
   Legge il file e dice cosa succederebbe, *prima* di toccare niente. */
export async function esamina(testo){
  const d = JSON.parse(testo);
  if (!d || !d.schema) throw new Error('File non riconosciuto: manca il numero di schema.');
  if (String(d.schema).split('.')[0] !== SCHEMA.split('.')[0])
    throw new Error(`Schema ${d.schema} incompatibile con questa versione (${SCHEMA}).`);
  const adesso_ = conta(await costruisciExport());
  const nuove = conta(d);
  return { dump: d, righeFile: nuove, righeOra: adesso_,
           perTabella: contaPerTabella(d), esportato: d.esportato,
           perdita: Math.max(0, adesso_ - nuove) };
}

/* Sostituzione integrale. Prima di sostituire, mette da parte com'era. */
export async function importa(testo){
  const { dump } = await esamina(testo);
  if ((await db.movimenti.count()) > 0) await istantanea('prima di un import');
  return applica(dump);
}

async function applica(d){
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
  /* un backup di una versione vecchia deve entrare senza buchi */
  await normalizzaConfig();
  return conta(d);
}

/* ---------- promemoria · § 8 ---------- */
export async function giorniDallUltimoExport(){
  const r = await db.meta.get('ultimoExport');
  if (!r) return null;
  return Math.floor((Date.now() - new Date(r.valore).getTime()) / 86400000);
}

/* Quante righe hai scritto da quando hai fatto l'ultima copia. È il
   numero che dice davvero quanto rischi. */
export async function righeNonSalvate(){
  const r = await db.meta.get('righeUltimoExport');
  const ora = conta(await costruisciExport());
  return Math.max(0, ora - (r ? r.valore : 0));
}

export async function backupScaduto(giorniLimite){
  if ((await db.movimenti.count()) === 0) return null;
  const g = await giorniDallUltimoExport();
  if (g === null) return { giorni: null, mai: true, righe: await righeNonSalvate() };
  const righe = await righeNonSalvate();
  if (g >= giorniLimite || righe > 0) return { giorni: g, mai: false, righe };
  return null;
}
