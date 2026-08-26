/* ============================================================
   SERRA · operazioni.js — i quattro flussi, § 5
   Ogni flusso si costruisce come *piano*: l'elenco esplicito delle
   scritture. Il passo di conferma mostra il piano, il salvataggio lo
   esegue. Una sola verità, due usi.
   ============================================================ */
import { db, adesso } from './db.js';
import * as C from './calcoli.js';

const r2 = n => Math.round((+n || 0) * 100) / 100;

/* ---------- 1 · CONTEGGIO ---------- */
/* La differenza fra attese e contate diventa un movimento. La perdita
   non porta via costo: quello resta sulle sopravvissute. § 4.2 */
function movimentoDifferenza(gruppo, attese, contate, data, note){
  const d = contate - attese;
  if (d === 0) return null;
  return { data, tipo: d < 0 ? 'perdita' : 'rettifica', lotto: gruppo.lotto,
           gruppo: gruppo.id, qta: d, costo: 0, note: note || '', creato: adesso() };
}

export function pianoConteggio({ gruppo, attese, contate, vigore, data, note }){
  const mov = movimentoDifferenza(gruppo, attese, contate, data, note);
  return {
    tipo: 'conteggio', gruppo,
    movimenti: mov ? [mov] : [],
    eventi: [],
    conteggi: [{ data, gruppo: gruppo.id, attese, contate, vigore: vigore || null,
                 note: note || '', creato: adesso() }],
    destinazioni: [],
    chiudi: contate === 0 ? [gruppo.id] : [],
    giacenzaDopo: contate,
  };
}

/* ---------- 2 · RINVASO ---------- */
export function pianoRinvaso(p){
  const { gruppo, attese, contate, costo, destinazioni, miscela, quote,
          materiali, classi, costoVasi = 0, ore = 0, tariffa, data, note = '' } = p;

  const movimenti = [], eventi = [], dest = [];
  const mv = movimentoDifferenza(gruppo, attese, contate, data, note);
  if (mv) movimenti.push(mv);

  const spostate = destinazioni.reduce((s, d) => s + d.piante, 0);
  const resto = contate - spostate;

  /* substrato: litri per destinazione, poi per materiale · § 4.4 */
  const cl = id => classi.find(c => c.id === id);
  const litriDi = d => C.litriDestinazione(d.piante, cl(d.classe));
  const litriTot = destinazioni.reduce((s, d) => s + litriDi(d), 0);
  const litriMat = C.litriPerMateriale(quote, litriTot);
  const costoSub = C.costoSubstrato(litriMat, materiali);

  /* La quota di costo che parte con le piante si calcola sulla giacenza
     dopo il conteggio: le morte hanno già lasciato qui il loro costo. */
  const quotaUnitaria = contate > 0 ? costo / contate : 0;

  destinazioni.forEach((d, i) => {
    const fraPiante = spostate > 0 ? d.piante / spostate : 0;
    /* substrato per litri, ore e vasi per numero di piante · § 4.3 */
    const fraLitri  = litriTot > 0 ? litriDi(d) / litriTot : fraPiante;
    const subD   = costoSub * fraLitri;
    const vasiD  = costoVasi * fraPiante;
    const oreD   = ore * fraPiante;
    const quotaD = quotaUnitaria * d.piante;
    const consumi = {};
    for (const [k, L] of Object.entries(litriMat)) consumi[k] = r2(L * fraLitri);

    const descrittore = {
      i, lotto: gruppo.lotto, classe: d.classe, suffisso: d.suffisso || '',
      piante: d.piante,
      prove: miscela && miscela.sperimentale ? [{ variabile: 'Substrato', valore: miscela.nome }] : [],
      storicoProve: [...(gruppo.storicoProve || []), ...(gruppo.prove || [])],
      costoOperazione: r2(subD + vasiD + oreD * tariffa),
      quotaCosto: r2(quotaD),
      litri: r2(litriDi(d)),
    };
    descrittore.costoPianta = d.piante > 0
      ? (descrittore.quotaCosto + descrittore.costoOperazione) / d.piante : 0;
    dest.push(descrittore);

    movimenti.push({ data, tipo: 'trasferimento', lotto: gruppo.lotto,
                     gruppoDa: gruppo.id, destIndex: i, qta: d.piante,
                     costo: r2(quotaD), note: '', creato: adesso() });

    eventi.push({ data, tipo: 'rinvaso', destIndex: i, lotto: gruppo.lotto,
                  piante: d.piante, ore: r2(oreD), costoMateriali: r2(subD + vasiD),
                  tariffa,
                  dettagli: { classeDa: gruppo.classe, classeA: d.classe,
                              miscela: miscela ? miscela.id : null, quote: { ...quote },
                              litriTotali: r2(litriDi(d)), consumi, costoVasi: r2(vasiD) },
                  note, creato: adesso() });
  });

  return {
    tipo: 'rinvaso', gruppo, movimenti, eventi,
    conteggi: [{ data, gruppo: gruppo.id, attese, contate, vigore: null, note: '', creato: adesso() }],
    destinazioni: dest,
    chiudi: resto === 0 ? [gruppo.id] : [],
    resto, spostate, litriTot: r2(litriTot), litriMat, costoSubstrato: r2(costoSub),
    costoOperazione: r2(costoSub + costoVasi + ore * tariffa),
    giacenzaDopo: resto,
  };
}

/* ---------- 3 · VENDITA ---------- */
export function pianoVendita({ gruppo, giacenza, costo, quantita, prezzo, data, note = '' }){
  const quota = giacenza > 0 ? costo * quantita / giacenza : 0;
  return {
    tipo: 'vendita', gruppo,
    movimenti: [{ data, tipo: 'vendita', lotto: gruppo.lotto, gruppo: gruppo.id,
                  qta: -quantita, costo: -r2(quota), valore: r2(quantita * prezzo),
                  note, creato: adesso() }],
    eventi: [], conteggi: [], destinazioni: [],
    chiudi: giacenza - quantita === 0 ? [gruppo.id] : [],
    incasso: r2(quantita * prezzo), costoCeduto: r2(quota),
    margine: r2(quantita * prezzo - quota),
    giacenzaDopo: giacenza - quantita,
  };
}

/* ---------- 4 · INTERVENTO ---------- */
export function pianoIntervento({ gruppo, piante, tipo, dettagli = {}, ore, costoMateriali,
                                  tariffa, data, note = '' }){
  return {
    tipo: 'intervento', gruppo,
    movimenti: [], conteggi: [], destinazioni: [],
    eventi: [{ data, tipo, gruppo: gruppo.id, lotto: gruppo.lotto, piante,
               ore: r2(ore), costoMateriali: r2(costoMateriali), tariffa,
               dettagli, note, creato: adesso() }],
    chiudi: [],
    costoTotale: r2(costoMateriali + ore * tariffa),
  };
}

/* ============================================================
   ESECUZIONE — l'unica funzione che scrive
   ============================================================ */

/* Un gruppo di destinazione esiste già se è aperto, stessa chiave e
   stesso profilo di prove: fondere due profili diversi cancellerebbe la
   prova. In quel caso nasce un gruppo con un suffisso nuovo. */
async function trovaOCrea(d){
  const candidati = await db.gruppi.where({ lotto: d.lotto, classe: d.classe }).toArray();
  const aperti = candidati.filter(g => g.aperto);
  const cercato = C.profilo({ prove: d.prove, storicoProve: d.storicoProve });
  const uguale = aperti.find(g => (g.suffisso || '') === (d.suffisso || '') && C.profilo(g) === cercato);
  if (uguale) return uguale.id;
  let suffisso = d.suffisso || '';
  if (aperti.some(g => (g.suffisso || '') === suffisso)){
    const usati = new Set(candidati.map(g => g.suffisso || ''));
    for (const s of 'BCDEFGHIJKLMNOPQRSTUVWXYZ'){ if (!usati.has(s)){ suffisso = s; break; } }
  }
  return await db.gruppi.add({
    lotto: d.lotto, classe: d.classe, suffisso,
    prove: d.prove || [], storicoProve: d.storicoProve || [],
    aperto: true, creato: adesso(),
  });
}

export async function esegui(piano){
  return db.transaction('rw', db.gruppi, db.movimenti, db.eventi, db.conteggi, async () => {
    const idDest = [];
    for (const d of piano.destinazioni) idDest[d.i] = await trovaOCrea(d);

    for (const m of piano.movimenti){
      const { destIndex, ...riga } = m;
      if (destIndex != null) riga.gruppoA = idDest[destIndex];
      await db.movimenti.add(riga);
    }
    for (const e of piano.eventi){
      const { destIndex, ...riga } = e;
      if (destIndex != null) riga.gruppo = idDest[destIndex];
      await db.eventi.add(riga);
    }
    for (const c of piano.conteggi) await db.conteggi.add(c);
    for (const id of piano.chiudi) await db.gruppi.update(id, { aperto: false });
    return idDest;
  });
}

/* ---------- NUOVO LOTTO · § 5.7 ---------- */
/* Un solo form: il lotto, le sue vaschette, il movimento di apertura.
   Con due variabili × due valori nascono quattro vaschette incrociate. */
export async function creaLotto({ lotto, inserite, prove = [], costoIniziale = 0, data }){
  return db.transaction('rw', db.lotti, db.gruppi, db.movimenti, async () => {
    await db.lotti.add({ ...lotto, inserite, creato: adesso() });

    /* combinazioni: [] → una vaschetta; [v1] → n vaschette; [v1,v2] → incrocio */
    let combinazioni = [[]];
    for (const pr of prove)
      combinazioni = combinazioni.flatMap(c => pr.valori.map(v => [...c, { variabile: pr.variabile, valore: v }]));

    const quota = Math.floor(inserite / combinazioni.length);
    const resto = inserite - quota * combinazioni.length;
    const ids = [];
    for (let k = 0; k < combinazioni.length; k++){
      const n = quota + (k < resto ? 1 : 0);
      const suffisso = combinazioni.length > 1 ? 'ABCDEFGH'[k] : '';
      const id = await db.gruppi.add({ lotto: lotto.id, classe: 'VAS', suffisso,
        prove: combinazioni[k], storicoProve: [], aperto: true, creato: adesso() });
      await db.movimenti.add({ data, tipo: 'apertura', lotto: lotto.id, gruppo: id,
        qta: n, costo: r2(costoIniziale * n / Math.max(inserite, 1)), note: '', creato: adesso() });
      ids.push(id);
    }
    return ids;
  });
}
