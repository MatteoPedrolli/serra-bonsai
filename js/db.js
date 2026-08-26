/* ============================================================
   SERRA · db.js — archivi e semi di configurazione
   Schema 1.0 · § 3 della specifica
   ============================================================ */
import Dexie from './vendor/dexie.mjs';

export const SCHEMA = '1.0';

export const db = new Dexie('serra');

db.version(1).stores({
  /* --- operativi --- */
  lotti:     'id, specie, anno, origine',
  gruppi:    '++id, lotto, classe, aperto, [lotto+classe+suffisso]',
  movimenti: '++id, gruppo, gruppoDa, gruppoA, lotto, data, tipo',
  eventi:    '++id, gruppo, lotto, data, tipo',
  conteggi:  '++id, gruppo, data',
  meta:      'chiave',
  /* --- configurazione --- */
  classi:         'id, ordine',
  materiali:      'id',
  miscele:        'id',
  tipiIntervento: 'id',
  variabili:      'id',
  impostazioni:   'chiave',
});

/* Le sei tabelle di configurazione, nell'ordine in cui finiscono nell'export. */
export const TABELLE_CONFIG = ['classi','materiali','miscele','tipiIntervento','variabili','impostazioni'];
export const TABELLE_DATI   = ['lotti','gruppi','movimenti','eventi','conteggi'];

/* ================= SEMI =================
   Valori iniziali § 7. Tutto modificabile da Config: quello che sta qui
   è solo il primo avvio, mai un vincolo. */

export const SEMI = {
  classi: [
    { id:'VAS', etichetta:'vaschetta', mm: 60, tondo:false, litriPerVaso:0.10, attiva:true, ordine: 0 },
    { id:'10T', etichetta:'10 tondo',  mm:100, tondo:true,  litriPerVaso:0.35, attiva:true, ordine:10 },
    { id:'10Q', etichetta:'10 quadro', mm:100, tondo:false, litriPerVaso:0.45, attiva:true, ordine:20 },
    { id:'12',  etichetta:'12',        mm:120, tondo:false, litriPerVaso:0.75, attiva:true, ordine:30 },
    { id:'14',  etichetta:'14',        mm:140, tondo:false, litriPerVaso:1.15, attiva:true, ordine:40 },
    { id:'16',  etichetta:'16',        mm:160, tondo:false, litriPerVaso:1.70, attiva:true, ordine:50 },
    { id:'18',  etichetta:'18',        mm:180, tondo:false, litriPerVaso:2.40, attiva:true, ordine:60 },
    { id:'20',  etichetta:'20',        mm:200, tondo:false, litriPerVaso:3.30, attiva:true, ordine:70 },
    { id:'22',  etichetta:'22',        mm:220, tondo:false, litriPerVaso:4.40, attiva:true, ordine:80 },
    { id:'24',  etichetta:'24',        mm:240, tondo:false, litriPerVaso:5.70, attiva:true, ordine:90 },
  ],
  materiali: [
    { id:'pomice',  nome:'Pomice',        prezzoLitro:0.45, attivo:true },
    { id:'seconda', nome:'Terra 2ª mano', prezzoLitro:0.20, attivo:true },
    { id:'akadama', nome:'Akadama',       prezzoLitro:1.20, attivo:true },
    { id:'kiryu',   nome:'Kiryu',         prezzoLitro:1.10, attivo:true },
    { id:'lapillo', nome:'Lapillo',       prezzoLitro:0.55, attivo:false },
  ],
  miscele: [
    { id:'produzione', nome:'Produzione',   quote:{ pomice:60, seconda:30, akadama:10 },            sperimentale:false },
    { id:'sperim',     nome:'Sperimentale', quote:{ pomice:40, seconda:20, akadama:20, kiryu:20 },  sperimentale:true  },
    { id:'radicazione',nome:'Radicazione',  quote:{ pomice:70, seconda:30 },                        sperimentale:false },
  ],
  tipiIntervento: [
    { id:'pot-pul', nome:'Potatura di pulizia', chiede:'ore' },
    { id:'pot-sti', nome:'Potatura stilistica', chiede:'ore' },
    { id:'pinz',    nome:'Pinzatura',           chiede:'ore' },
    { id:'conc',    nome:'Concimazione',        chiede:'scelta', etichetta:'Tipo di concime',
      opzioni:[ { k:'Organico', matPerPianta:0.15, orePerPianta:0.020 },
                { k:'Chimico',  matPerPianta:0.10, orePerPianta:0.015 } ] },
    { id:'leg',     nome:'Legatura',            chiede:'fisso', matPerPianta:0.80, orePerPianta:0.25 },
    { id:'tratt',   nome:'Trattamento',         chiede:'fisso', matPerPianta:0.06, orePerPianta:0.01 },
  ],
  variabili: [
    { id:'substrato', nome:'Substrato',   ambito:'prova',      tipo:'lista',  valori:['Torba','Pomice+torba','Perlite'] },
    { id:'ormone',    nome:'Ormone',      ambito:'prova',      tipo:'lista',  valori:['Nessuno','IBA','AIB'] },
    { id:'buio',      nome:'Giorni buio', ambito:'prova',      tipo:'numero' },
    { id:'lunare',    nome:'Fase lunare', ambito:'prova',      tipo:'auto' },
    { id:'diametro',  nome:'Diametro talea', ambito:'selezione', tipo:'classi', soglie:[3,5] },
    { id:'vigoria',   nome:'Vigoria di partenza', ambito:'selezione', tipo:'scala' },
    { id:'tempMin',   nome:'Temperatura minima', ambito:'condizione', tipo:'numero' },
    { id:'umidita',   nome:'Umidità',            ambito:'condizione', tipo:'numero' },
  ],
  impostazioni: [
    { chiave:'tariffaOraria',          valore:25 },
    { chiave:'moltiplicatorePrezzo',   valore:3 },
    { chiave:'giorniPromemoriaBackup', valore:14 },
  ],
};

/* Riempie le tabelle di configurazione vuote. Non tocca quelle già scritte:
   un seme non deve mai sovrascrivere una scelta dell'utente. */
export async function seminaConfig(){
  for (const t of TABELLE_CONFIG){
    if (await db[t].count() === 0) await db[t].bulkPut(SEMI[t]);
  }
  if (!(await db.meta.get('schema'))) await db.meta.put({ chiave:'schema', valore:SCHEMA });
}

export async function apri(){
  await db.open();
  await seminaConfig();
  return db;
}

/* ---- letture di configurazione, in blocco ---- */
export async function leggiConfig(){
  const [classi, materiali, miscele, tipiIntervento, variabili, imp] = await Promise.all(
    TABELLE_CONFIG.map(t => db[t].toArray()));
  const impostazioni = Object.fromEntries(imp.map(r => [r.chiave, r.valore]));
  classi.sort((a,b) => (a.ordine ?? 0) - (b.ordine ?? 0));
  return { classi, materiali, miscele, tipiIntervento, variabili, impostazioni };
}

export const oggi = () => new Date().toISOString().slice(0,10);
export const adesso = () => new Date().toISOString();
