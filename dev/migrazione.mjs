/* ============================================================
   Migrazione una tantum dal foglio «Bonsai Inventario DB» · § 9
   node dev/migrazione.mjs  →  serra-backup-migrato.json
   Da importare in Config → Dati → Importa backup.

   Tutto ciò che è opinabile sta in cima, in tabella: si corregge
   una riga e si rilancia lo script.
   ============================================================ */
import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync } from 'node:fs';
import { SEMI, SCHEMA } from '../js/db.js';

const V = JSON.parse(readFileSync(new URL('./dati-vecchi.json', import.meta.url), 'utf8'));

/* ---------- 1 · le stringhe libere diventano variabile + valore · § 9.2 ----------
   È l'unico lavoro davvero manuale, ed è la ragione per cui finora le
   sperimentazioni non erano confrontabili. */
const RICODIFICA = {
  'ITO-25-009-A': [],                                            // nessuna prova: è il lotto intero
  'ITO-25-010-A': [{ variabile:'Giorni al buio', valore:'0' }],
  'ITO-25-010-B': [{ variabile:'Giorni al buio', valore:'2' }],
  'ITO-25-010-C': [{ variabile:'Giorni al buio', valore:'2' },
                   { variabile:'Diametro talea', valore:'piccole' }],   // due variabili insieme
  'ITO-25-010-D': [{ variabile:'Giorni al buio', valore:'7' }],
  'ITO-25-010-E': [{ variabile:'Giorni al buio', valore:'14' }],
  'KYS-25-011-A': [{ variabile:'Antitraspirante', valore:'sì' }],
  'KYS-25-011-B': [{ variabile:'Antitraspirante', valore:'no' }],
  'ITO-26-016-A': [{ variabile:'Diametro talea', valore:'grandi' }],
  'ITO-26-016-B': [{ variabile:'Diametro talea', valore:'piccole' }],
  'ITO-26-019-A': [{ variabile:'Substrato di radicazione', valore:'solo sfagno' }],
  'ITO-26-019-B': [{ variabile:'Substrato di radicazione', valore:'solo acqua' }],
};

/* ---------- 2 · quantità corrette a mano ----------
   Il tab Lotti e il tab Sperimentazione non erano d'accordo. */
const TALEE = {
  'ITO-26-016-A': 30,   // il foglio Lotti dice 60 in tutto, non 80: 30 e 30
  'ITO-26-016-B': 30,   // da verificare col primo conteggio davanti ai bancali
};

/* ---------- 3 · lotti divisi che non hanno righe di variante ----------
   La divisione stava solo nelle note. Una riga qui = una vaschetta. */
const DIVISIONI = {
  'Fic-26-014': [
    { suffisso:'A', piante:15, prove:[{ variabile:'Specie', valore:'Ficus retusa' }] },
    { suffisso:'B', piante:15, prove:[{ variabile:'Specie', valore:'Ficus microphylla' }] },
  ],
  /* ITO-26-017 · le medie sono 25, non 20: il totale vero è 61, non 56.
     I 4 grandi non hanno distinzione di cima. */
  'ITO-26-017': [
    { suffisso:'A', piante: 4,  prove:[{ variabile:'Diametro talea', valore:'grandi' }] },
    { suffisso:'B', piante:10,  prove:[{ variabile:'Diametro talea', valore:'medie' },
                                       { variabile:'Cima', valore:'senza cima' }] },
    { suffisso:'C', piante:15,  prove:[{ variabile:'Diametro talea', valore:'medie' },
                                       { variabile:'Cima', valore:'con cima' }] },
    { suffisso:'D', piante:12,  prove:[{ variabile:'Diametro talea', valore:'piccole' },
                                       { variabile:'Cima', valore:'senza cima' }] },
    { suffisso:'E', piante:20,  prove:[{ variabile:'Diametro talea', valore:'piccole' },
                                       { variabile:'Cima', valore:'con cima' }] },
  ],
};

/* ---------- 4 · dove stanno adesso le piante ----------
   Il foglio non registra il vaso: i rinvasi non sono mai stati scritti.
   Sperimentale → vaschetta. Produzione → NA, da sistemare davanti ai
   bancali con un conteggio. § 9.1 */
const CLASSE_LOTTO = {
  'TAX-23-006': '14',        // la nota del foglio dice «vaso 14»
};
const classeDi = l => CLASSE_LOTTO[l.Codice] || (l.Stato === 'Sperimentale' ? 'VAS' : 'NA');

/* ---------- 5 · correzioni di date palesemente sbagliate ----------
   B e C partono «2026-03-31» ma si concludono il 2026-03-19, e le sorelle
   della stessa serie partono nel 2025: è un anno digitato male. */
const CORREGGI_DATA = {
  'ITO-25-010-B': { DataInizio: '2025-03-31' },
  'ITO-25-010-C': { DataInizio: '2025-03-31' },
};

/* ---------- 6 · listino ---------- */
const MATERIALI = { 'Akadama':'akadama', 'Pomice':'pomice', 'Terriccio 2ª Mano':'seconda' };

const TARIFFA = 25;            // nessun evento da valorizzare: i tab lavorazioni sono vuoti
const oggi = new Date().toISOString();
const segnala = [];

/* ============================================================ */

const corretta = (s, campo) => (CORREGGI_DATA[s.VarianteLotto]?.[campo]) || s[campo] || '';

/* Varianti, divisioni a mano o lotto intero: tre origini, una forma sola. */
function righeDi(l){
  const vs = V.sperimentazione.filter(s => s.Lotto === l.Codice);
  if (vs.length) return vs.map(s => {
    const prove = RICODIFICA[s.VarianteLotto] ?? null;
    if (prove === null) segnala.push(`${s.VarianteLotto}: manca la ricodifica, entra senza etichette.`);
    return {
      suffisso: vs.length > 1 ? s.VarianteLotto.split('-').pop() : '',
      piante: TALEE[s.VarianteLotto] ?? s.TaleeInserite,
      prove: prove || [],
      data: corretta(s, 'DataInizio') || l.DataIngresso,
      note: s.Descrizione,
      conteggio: s.DataFine
        ? { data: s.DataFine, contate: s.TaleeAttecchite, note: s.Conclusioni || '' } : null,
    };
  });

  const div = DIVISIONI[l.Codice];
  if (div) return div.map(x => ({ suffisso: x.suffisso, piante: x.piante, prove: x.prove,
    data: l.DataIngresso, note:'', conteggio: null }));

  return [{ suffisso:'', piante: l.Quantita, prove: [], data: l.DataIngresso, note:'', conteggio: null }];
}

const lotti = [], gruppi = [], movimenti = [], conteggi = [];
let idGruppo = 1;

for (const l of V.lotti){
  const righe = righeDi(l);
  const inserite = righe.reduce((s, r) => s + r.piante, 0);
  const contate = righe.some(r => r.conteggio);

  if (!contate && inserite !== l.Quantita)
    segnala.push(`${l.Codice}: il tab Lotti dice ${l.Quantita}, le righe ne sommano ${inserite}.`);

  lotti.push({
    id: l.Codice,
    specie: l.Specie,
    nomeBotanico: '',
    sigla: l.Codice.split('-')[0].toUpperCase(),
    anno: l.Anno,
    progressivo: String(l.Progressivo).padStart(3, '0'),
    origine: /sem/i.test(l.Provenienza) ? 'seme' : /piantin/i.test(l.Provenienza) ? 'acquisto' : 'talea',
    dataIngresso: l.DataIngresso,
    provenienza: l.Provenienza,
    inserite,
    note: [l.Note, l.Stato === 'Produzione' ? '(era “Produzione” nel vecchio foglio)' : '']
      .filter(Boolean).join(' · '),
    creato: oggi,
  });

  const classe = classeDi(l);

  for (const r of righe){
    const id = idGruppo++;
    gruppi.push({ id, lotto: l.Codice, classe, suffisso: r.suffisso,
      prove: r.prove, storicoProve: [], aperto: true, creato: oggi });

    movimenti.push({ id: movimenti.length + 1, data: r.data, tipo:'apertura', lotto: l.Codice,
      gruppo: id, qta: r.piante, costo: 0, note: r.note, creato: oggi });

    /* Il conteggio c'è stato solo se la prova è stata chiusa: allora la
       differenza è una perdita vera, datata quel giorno. */
    if (r.conteggio){
      const perse = r.piante - r.conteggio.contate;
      if (perse > 0)
        movimenti.push({ id: movimenti.length + 1, data: r.conteggio.data, tipo:'perdita',
          lotto: l.Codice, gruppo: id, qta: -perse, costo: 0,
          note:'attecchimento verificato', creato: oggi });
      conteggi.push({ id: conteggi.length + 1, data: r.conteggio.data, gruppo: id,
        attese: r.piante, contate: r.conteggio.contate, vigore: null,
        note: r.conteggio.note, creato: oggi });
    }
  }
}

/* ---------- configurazione ---------- */
const classi = [...SEMI.classi,
  { id:'NA', etichetta:'non assegnato', mm:120, tondo:false, litriPerVaso:0, attiva:false, ordine:999 }];

const materiali = SEMI.materiali.map(m => {
  const riga = V.materiali.find(x => MATERIALI[x.Nome] === m.id);
  return riga ? { ...m, nome: riga.Nome, prezzoLitro: riga.PrezzoLitro } : m;
});

/* le variabili nascono dalle etichette usate davvero, non da quelle immaginate */
const daEtichette = new Map();
const raccogli = prove => (prove || []).forEach(p => {
  if (!daEtichette.has(p.variabile)) daEtichette.set(p.variabile, new Set());
  daEtichette.get(p.variabile).add(p.valore);
});
Object.values(RICODIFICA).forEach(raccogli);
Object.values(DIVISIONI).forEach(d => d.forEach(x => raccogli(x.prove)));

const variabili = SEMI.variabili.filter(v => v.ambito === 'condizione' || v.tipo === 'auto');
for (const [nome, valori] of daEtichette)
  variabili.push({ id: nome.toLowerCase().replace(/[^a-z]+/g, '-'), nome,
    ambito: /diametro|specie|vigor/i.test(nome) ? 'selezione' : 'prova',
    tipo:'lista', valori: [...valori] });

const dump = {
  schema: SCHEMA,
  esportato: oggi,
  lotti, gruppi, movimenti, eventi: [], conteggi,
  config: {
    classi, materiali,
    miscele: SEMI.miscele,
    tipiIntervento: SEMI.tipiIntervento,
    variabili,
    impostazioni: { tariffaOraria: TARIFFA, moltiplicatorePrezzo: 3, giorniPromemoriaBackup: 14 },
  },
};

writeFileSync('serra-backup-migrato.json', JSON.stringify(dump, null, 1));

/* ---------- resoconto ---------- */
const saldo = id => movimenti.filter(m => m.gruppo === id).reduce((s, m) => s + m.qta, 0);
console.log('\nLOTTO         GRUPPI  INSERITE  VIVE  CLASSE   PROVE');
for (const l of lotti){
  const gg = gruppi.filter(g => g.lotto === l.id);
  const vive = gg.reduce((s, g) => s + saldo(g.id), 0);
  const et = [...new Set(gg.flatMap(g => g.prove.map(p => p.variabile)))].join(' × ') || '—';
  console.log(`${l.id.padEnd(13)} ${String(gg.length).padStart(4)}  ${String(l.inserite).padStart(8)}  ${String(vive).padStart(4)}  ${gg[0].classe.padEnd(7)}  ${et}`);
}
console.log(`\n${lotti.length} lotti · ${gruppi.length} gruppi · ${movimenti.length} movimenti · ${conteggi.length} conteggi`);
console.log(`vive in tutto: ${gruppi.reduce((s, g) => s + saldo(g.id), 0)}`);
if (segnala.length){
  console.log('\nDA GUARDARE:');
  segnala.forEach(s => console.log(' · ' + s));
}
