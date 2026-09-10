/* ============================================================
   SERRA · calcoli.js — § 4 della specifica
   Funzioni pure: nessuna scrittura, nessun accesso al db.
   Le quantità non si scrivono, si calcolano.
   ============================================================ */

/* ---------- saldi ---------- */

/* giacenza(G) = Σ qta dove gruppo o gruppoA = G  −  Σ qta dove gruppoDa = G */
export function giacenza(movimenti, id){
  let s = 0;
  for (const m of movimenti){
    if (m.gruppoDa === id) s -= m.qta;
    else if (m.gruppo === id || m.gruppoA === id) s += m.qta;
  }
  return s;
}

/* Tutti i saldi in una passata sola: l'elenco Serra ne chiede uno per gruppo. */
export function saldi(movimenti){
  const m = new Map();
  const add = (id, q) => { if (id != null) m.set(id, (m.get(id) || 0) + q); };
  for (const x of movimenti){
    if (x.gruppoDa != null){ add(x.gruppoDa, -x.qta); add(x.gruppoA, x.qta); }
    else add(x.gruppo, x.qta);
  }
  return m;
}

/* ---------- costi ---------- */

/* Il costo del lavoro è congelato sull'evento: la tariffa del giorno resta
   quella, anche se in Config cambia. Vale la stessa regola dei materiali. */
export function costoTotaleEvento(ev, tariffaCorrente = 0){
  const t = ev.tariffa != null ? ev.tariffa : tariffaCorrente;
  return (ev.costoMateriali || 0) + (ev.ore || 0) * t;
}

export function costi(movimenti, eventi, tariffaCorrente = 0){
  const m = new Map();
  const add = (id, c) => { if (id != null) m.set(id, (m.get(id) || 0) + c); };
  for (const x of movimenti){
    if (x.gruppoDa != null){ add(x.gruppoDa, -(x.costo || 0)); add(x.gruppoA, x.costo || 0); }
    else add(x.gruppo, x.costo || 0);
  }
  for (const e of eventi) add(e.gruppo, costoTotaleEvento(e, tariffaCorrente));
  return m;
}

export const costoPianta   = (costo, qta) => qta > 0 ? costo / qta : 0;
export const prezzoSuggerito = (costo, qta, moltiplicatore) => costoPianta(costo, qta) * (moltiplicatore || 0);

/* ---------- substrato · § 4.4 ---------- */

export const litriDestinazione = (piante, classe) => piante * (classe?.litriPerVaso || 0);

/* quote in parti → litri per materiale, per un volume totale dato */
export function litriPerMateriale(quote, litriTotali){
  const somma = Object.values(quote).reduce((s,v) => s + (+v || 0), 0);
  const out = {};
  for (const [k,v] of Object.entries(quote))
    out[k] = somma > 0 ? litriTotali * (+v || 0) / somma : 0;
  return out;
}

export function costoSubstrato(litriMat, materiali){
  let c = 0;
  for (const [id, L] of Object.entries(litriMat)){
    const m = materiali.find(x => x.id === id);
    c += L * (m?.prezzoLitro || 0);
  }
  return c;
}

/* ---------- fase lunare · § 6.3, calcolata mai inserita ---------- */
const FASI = ['Nuova','Crescente','Primo quarto','Gibbosa crescente',
              'Piena','Gibbosa calante','Ultimo quarto','Calante'];
export function faseLunare(data){
  const t = (new Date(data + 'T12:00:00Z')).getTime();
  const nuova = Date.UTC(2000,0,6,18,14) ;           // luna nuova di riferimento
  const sin = 29.53058867 * 86400000;
  let eta = (((t - nuova) % sin) + sin) % sin;
  return FASI[Math.floor(eta / sin * 8 + 0.5) % 8];
}

/* ---------- prove · § 6.1 ---------- */

/* Profilo di un gruppo: etichette proprie + ereditate, in forma confrontabile. */
export const profilo = g => JSON.stringify([...(g.storicoProve||[]), ...(g.prove||[])]
  .map(p => p.variabile + '=' + p.valore).sort());

/* Un confronto è leggibile solo se ogni valore della variabile compare
   con la stessa distribuzione delle altre variabili presenti. § 6.1 */
export function leggibilita(gruppi, variabile){
  const rilevanti = gruppi.filter(g => etichetta(g, variabile) != null);
  const valori = new Set(rilevanti.map(g => etichetta(g, variabile)));
  if (valori.size < 2) return { esito:'insufficiente', motivo:'un solo valore a confronto' };
  /* le altre variabili presenti nei gruppi confrontati */
  const altre = new Set();
  rilevanti.forEach(g => tutteLeProve(g).forEach(p => { if (p.variabile !== variabile) altre.add(p.variabile); }));
  for (const a of altre){
    const mappa = new Map();
    for (const g of rilevanti){
      const v = etichetta(g, variabile), o = etichetta(g, a) ?? '—';
      if (!mappa.has(v)) mappa.set(v, new Set());
      mappa.get(v).add(o);
    }
    const insiemi = [...mappa.values()].map(s => [...s].sort().join('|'));
    if (new Set(insiemi).size > 1)
      return { esito:'confuso', motivo:`«${a}» non è distribuita allo stesso modo` };
  }
  return { esito:'leggibile' };
}

/* Resa di un insieme di gruppi che condividono un valore di variabile.
   Le tre cose che contano, e che a occhio si sbagliano tutte:
   · un rinvaso interno all'insieme non è un ingresso, è la stessa pianta
   · una pianta venduta è riuscita, non persa
   · una pianta che esce verso un gruppo senza quell'etichetta — perché
     le prove sono state unite — è viva: la prova finisce lì, non muore. */
export function resa(gruppi, movimenti, saldi){
  const dentro = new Set(gruppi.map(g => g.id));
  let entrate = 0, uscite = 0, vendute = 0;
  for (const m of movimenti){
    if (m.gruppoDa != null){
      if (dentro.has(m.gruppoA) && !dentro.has(m.gruppoDa)) entrate += m.qta;
      else if (dentro.has(m.gruppoDa) && !dentro.has(m.gruppoA)) uscite += m.qta;
    } else if (dentro.has(m.gruppo)){
      /* per tipo, non per segno: lo storno di una perdita ha qta positiva ma
         non è un ingresso, e quello di una rettifica deve toglierla */
      if (m.tipo === 'vendita' || m.tipo === 'ceduto') vendute -= m.qta;
      else if (m.tipo === 'perdita') { /* resta nei saldi: le vive calano da sole */ }
      else entrate += m.qta;
    }
  }
  const vive = gruppi.reduce((s, g) => s + (saldi.get(g.id) || 0), 0);
  const riuscite = vive + vendute + uscite;
  return { entrate, vive, vendute, uscite, riuscite,
           quota: entrate > 0 ? riuscite / entrate : 0 };
}

export const tutteLeProve = g => [...(g.storicoProve||[]), ...(g.prove||[])];
export const etichetta = (g, variabile) => {
  const p = tutteLeProve(g).filter(x => x.variabile === variabile).pop();
  return p ? p.valore : null;
};
