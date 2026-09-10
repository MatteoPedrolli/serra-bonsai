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

/* ---------- unione di due gruppi dello stesso lotto ----------
   Nel vaso c'è scritto solo il codice lotto: due piante rinvasate nella
   stessa classe e messe sullo stesso bancale non sono più distinguibili.
   Se le unisci, un gruppo tiene solo le etichette vere di *tutte* le sue
   piante: quelle che le dividevano cadono. Quello che è già stato
   contato resta nei movimenti e nei conteggi, e l'Analisi continua a
   leggerlo. § 6.2 */
const chiaveProva = p => p.variabile + '=' + p.valore;

function unisci(descrittore, esistente){
  const entranti = [...descrittore.storicoProve, ...descrittore.prove];
  const gia      = [...(esistente.storicoProve || []), ...(esistente.prove || [])];
  const kEntranti = new Set(entranti.map(chiaveProva));
  const kGia      = new Set(gia.map(chiaveProva));

  const viste = new Set();
  const comuni = entranti.filter(p => kGia.has(chiaveProva(p))
    && !viste.has(chiaveProva(p)) && viste.add(chiaveProva(p)));

  descrittore.unisciA = esistente.id;
  descrittore.etichettePerse = [
    ...entranti.filter(p => !kGia.has(chiaveProva(p))),
    ...gia.filter(p => !kEntranti.has(chiaveProva(p))),
  ];
  descrittore.prove = [];
  descrittore.storicoProve = comuni;
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
    if (d.unisci) unisci(descrittore, d.unisci);
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
                              litriTotali: r2(litriDi(d)), consumi, costoVasi: r2(vasiD),
                              unione: !!d.unisci },
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
  /* unione chiesta esplicitamente: le etichette in conflitto cadono */
  if (d.unisciA != null){
    await db.gruppi.update(d.unisciA, { prove: [], storicoProve: d.storicoProve || [] });
    return d.unisciA;
  }
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

/* Ogni salvataggio è un'operazione: tutte le righe che scrive portano lo
   stesso codice. È quello che permette di annullarla tutta insieme — un
   rinvaso tocca tre gruppi e scrive sei righe, e annullarne mezzo sarebbe
   peggio che non annullarlo. */
export const nuovaOperazione = () =>
  'op' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function esegui(piano){
  const operazione = piano.operazione || nuovaOperazione();
  return db.transaction('rw', db.gruppi, db.movimenti, db.eventi, db.conteggi, async () => {
    const idDest = [];
    for (const d of piano.destinazioni) idDest[d.i] = await trovaOCrea(d);

    for (const m of piano.movimenti){
      const { destIndex, ...riga } = m;
      if (destIndex != null) riga.gruppoA = idDest[destIndex];
      await db.movimenti.add({ ...riga, operazione });
    }
    for (const e of piano.eventi){
      const { destIndex, ...riga } = e;
      if (destIndex != null) riga.gruppo = idDest[destIndex];
      await db.eventi.add({ ...riga, operazione });
    }
    for (const c of piano.conteggi) await db.conteggi.add({ ...c, operazione });
    /* un gruppo che torna ad avere piante, dopo uno storno, si riapre */
    for (const id of piano.riapri || []) await db.gruppi.update(id, { aperto: true });
    for (const id of piano.chiudi) await db.gruppi.update(id, { aperto: false });

    /* Rimasto solo, un gruppo non ha più bisogno del suffisso: torna a
       chiamarsi come il lotto. È il «riunirle nel lotto». */
    for (const d of piano.destinazioni){
      if (d.unisciA == null) continue;
      const g = await db.gruppi.get(d.unisciA);
      if (!g || !g.suffisso) continue;
      const fratelli = (await db.gruppi.where({ lotto: g.lotto, classe: g.classe }).toArray())
        .filter(x => x.aperto && x.id !== g.id);
      if (!fratelli.length) await db.gruppi.update(g.id, { suffisso: '' });
    }
    return { idDest, operazione };
  });
}

/* ============================================================
   STORNO — correggere senza cancellare · § 1
   Nessuna riga si riscrive. Annullare un'operazione vuol dire scriverne
   un'altra uguale e contraria: stesso tipo, quantità e costi col segno
   rovesciato, e il riferimento a quella che annulla. Le somme tornano
   come prima, e nella storia restano tutte e due: l'errore e la sua
   correzione.
   ============================================================ */
export function pianoStorno({ movimenti = [], eventi = [], data, motivo = '' }){
  const nota = 'storno' + (motivo ? ' · ' + motivo : '');
  const neg = v => (v == null ? v : -v);
  const consumi = c => c ? Object.fromEntries(Object.entries(c).map(([k, v]) => [k, -v])) : c;
  return {
    tipo: 'storno', destinazioni: [], conteggi: [], chiudi: [],
    movimenti: movimenti.map(m => {
      const { id, operazione, creato, ...r } = m;
      return { ...r, data, qta: -m.qta, costo: neg(m.costo || 0), valore: neg(m.valore),
               storna: id, note: nota, creato: adesso() };
    }),
    eventi: eventi.map(e => {
      const { id, operazione, creato, ...r } = e;
      return { ...r, data, ore: neg(e.ore || 0), costoMateriali: neg(e.costoMateriali || 0),
               piante: e.piante, storna: id, note: nota, creato: adesso(),
               dettagli: { ...(e.dettagli || {}), consumi: consumi(e.dettagli && e.dettagli.consumi),
                           costoVasi: neg(e.dettagli && e.dettagli.costoVasi) } };
    }),
  };
}

/* Le righe di un'operazione: tutte quelle col suo codice. Le righe scritte
   prima che esistessero i codici si annullano una alla volta. */
export async function righeOperazione({ operazione, movimento, evento }){
  if (operazione) return {
    movimenti: await db.movimenti.filter(m => m.operazione === operazione).toArray(),
    eventi: await db.eventi.filter(e => e.operazione === operazione).toArray(),
  };
  return {
    movimenti: movimento != null ? [await db.movimenti.get(movimento)].filter(Boolean) : [],
    eventi: evento != null ? [await db.eventi.get(evento)].filter(Boolean) : [],
  };
}

export async function storna(chiave, { data, motivo } = {}){
  const righe = await righeOperazione(chiave);
  if (!righe.movimenti.length && !righe.eventi.length) throw new Error('Operazione non trovata.');
  if ([...righe.movimenti, ...righe.eventi].some(r => r.storna != null))
    throw new Error('Uno storno non si storna: se serve, si riscrive l’operazione giusta.');
  const gia = new Set([
    ...(await db.movimenti.filter(m => m.storna != null).toArray()).map(m => 'm' + m.storna),
    ...(await db.eventi.filter(e => e.storna != null).toArray()).map(e => 'e' + e.storna),
  ]);
  if (righe.movimenti.some(m => gia.has('m' + m.id)) || righe.eventi.some(e => gia.has('e' + e.id)))
    throw new Error('Questa operazione è già stata annullata.');

  const piano = pianoStorno({ ...righe, data: data || new Date().toISOString().slice(0, 10), motivo });
  /* i gruppi che l'operazione aveva chiuso tornano ad avere piante: si riaprono */
  piano.riapri = [...new Set(righe.movimenti.flatMap(m => [m.gruppo, m.gruppoDa]).filter(x => x != null))];
  return esegui(piano);
}

/* ---------- NUOVO LOTTO · § 5.7 ---------- */
/* Un solo form: il lotto, le sue vaschette, il movimento di apertura.
   Con due variabili × due valori nascono quattro vaschette incrociate. */
export async function creaLotto({ lotto, inserite, prove = [], costoIniziale = 0, data }){
  const operazione = nuovaOperazione();
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
        qta: n, costo: r2(costoIniziale * n / Math.max(inserite, 1)), note: '', creato: adesso(), operazione });
      ids.push(id);
    }
    return ids;
  });
}
