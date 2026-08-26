/* SERRA · Analisi · § 6.4 — le cinque interrogazioni.
   Dove il confronto non è valido l'app lo dice, invece di restituire un
   numero che sembra una risposta. § 6.1 */
import * as C from '../calcoli.js';
import { S, registra, rendi, classe, lotto, qta, costo, materiale, tipoInt } from '../stato.js';
import { e, eur, num, disegna, testa, nascondiBarra } from '../ui.js';

const SEZIONI = [['resa', 'Resa'], ['costo', 'Costo'], ['margine', 'Margine'],
                 ['materiali', 'Materiali'], ['ore', 'Ore']];
let sez = 'resa', variabileScelta = null, specieScelta = '', annoScelto = '';

/* Piante entrate in un insieme di gruppi, contate una volta sola: un
   rinvaso interno all'insieme non è un ingresso, è la stessa pianta che
   cambia vaso portandosi dietro l'etichetta. § 6.2 */
function entrate(gruppi){
  const dentro = new Set(gruppi.map(g => g.id));
  return S.movimenti.reduce((s, m) => {
    if (m.gruppoDa != null)
      return s + (dentro.has(m.gruppoA) && !dentro.has(m.gruppoDa) ? m.qta : 0);
    return s + (dentro.has(m.gruppo) && m.qta > 0 ? m.qta : 0);
  }, 0);
}
const ultimoVigore = id => S.conteggi.filter(c => c.gruppo === id && c.vigore).pop()?.vigore || null;
const anni = () => [...new Set(S.lotti.map(l => l.anno))].sort();
const specie = () => [...new Set(S.lotti.map(l => l.specie))].sort();

const filtro = g => {
  const L = lotto(g.lotto);
  return (!specieScelta || L.specie === specieScelta) && (!annoScelto || L.anno === annoScelto);
};

registra('analisi', () => {
  testa({ titolo: 'Analisi', indietro: true });
  nascondiBarra();
  const corpo = { resa: aResa, costo: aCosto, margine: aMargine,
                  materiali: aMateriali, ore: aOre }[sez]();
  disegna(`<div class="sezioni">${SEZIONI.map(([k, n]) =>
      `<button class="mini ${sez === k ? 'on' : ''}" data-sez="${k}">${n}</button>`).join('')}</div>
    <div class="cfg">${corpo}</div>`);
  document.querySelectorAll('[data-sez]').forEach(b => b.onclick = () => { sez = b.dataset.sez; rendi(); });
  document.querySelectorAll('[data-var]').forEach(b => b.onclick = () => { variabileScelta = b.dataset.var; rendi(); });
  const fs = document.getElementById('f-specie'), fa = document.getElementById('f-anno');
  if (fs) fs.onchange = ev => { specieScelta = ev.target.value; rendi(); };
  if (fa) fa.onchange = ev => { annoScelto = ev.target.value; rendi(); };
});

const filtri = () => `<div class="strumenti" style="padding:0 0 12px">
  <select class="ordina" id="f-specie" style="flex:1">
    <option value="">tutte le specie</option>
    ${specie().map(s => `<option${specieScelta === s ? ' selected' : ''}>${e(s)}</option>`).join('')}</select>
  <select class="ordina" id="f-anno">
    <option value="">ogni anno</option>
    ${anni().map(a => `<option${annoScelto === a ? ' selected' : ''}>${e(a)}</option>`).join('')}</select></div>`;

/* ---------- 1 · resa per valore di variabile ---------- */
function aResa(){
  const usate = [...new Set(S.gruppi.flatMap(g => C.tutteLeProve(g).map(p => p.variabile)))];
  if (!usate.length) return filtri() + `<div class="vuoto">Nessuna prova ancora etichettata.
    Le prove nascono creando un lotto con due variabili, o rinvasando in una miscela 🔬.</div>`;
  if (!usate.includes(variabileScelta)) variabileScelta = usate[0];

  const gruppi = S.gruppi.filter(g => filtro(g) && C.etichetta(g, variabileScelta) != null);
  const valori = [...new Set(gruppi.map(g => C.etichetta(g, variabileScelta)))];
  const stato = C.leggibilita(gruppi, variabileScelta);

  const righe = valori.map(v => {
    const gg = gruppi.filter(x => C.etichetta(x, variabileScelta) === v);
    const ids = new Set(gg.map(g => g.id));
    const ent = entrate(gg);
    const viv = gg.reduce((s, g) => s + qta(g), 0);
    /* una pianta venduta non è una perdita: conta fra le riuscite */
    const ven = S.movimenti.reduce((s, m) =>
      s + (m.tipo === 'vendita' && ids.has(m.gruppo) ? -m.qta : 0), 0);
    const vig = gg.map(g => ultimoVigore(g.id)).filter(Boolean);
    const p = ent ? (viv + ven) / ent : 0;
    return `<div class="trg"><span class="et">${e(v)}
        <span class="sub">${gg.length} gruppi · ${ent} entrate</span>
        <span class="barrina"><i style="width:${Math.round(p * 100)}%"></i></span></span>
      <span class="vl">${Math.round(p * 100)}%<span class="sub">${viv} vive${ven ? ' · ' + ven + ' vendute' : ''}${
        vig.length ? ' · vigore ' + num(vig.reduce((s, x) => s + x, 0) / vig.length) : ''}</span></span></div>`;
  }).join('');

  const marchio = stato.esito === 'leggibile'
    ? '<span class="pill ok">confronto leggibile</span>'
    : stato.esito === 'confuso'
      ? `<span class="pill no">confuso · ${e(stato.motivo)}</span>`
      : `<span class="pill gri">${e(stato.motivo)}</span>`;

  return filtri()
    + `<div class="scelte">${usate.map(v =>
        `<button class="mini ${v === variabileScelta ? 'on' : ''}" data-var="${e(v)}">${e(v)}</button>`).join('')}</div>
      <div style="margin:2px 0 10px">${marchio}</div>
      <div class="tabella">${righe || '<div class="vuoto">Nessun gruppo con questo filtro.</div>'}</div>
      <div class="nota">La resa confronta le piante vive di oggi con quelle entrate nel gruppo:
      non è solo attecchimento, è sopravvivenza a distanza. Le etichette seguono le piante
      attraverso i rinvasi, per anni. § 6.2</div>`;
}

/* ---------- 2 · costo per pianta ---------- */
function aCosto(){
  const gruppi = S.gruppi.filter(g => filtro(g) && qta(g) > 0);
  const per = (chiave, etich) => {
    const m = new Map();
    gruppi.forEach(g => {
      const k = chiave(g);
      const r = m.get(k) || { q: 0, c: 0 };
      r.q += qta(g); r.c += costo(g); m.set(k, r);
    });
    return [...m.entries()].sort((a, b) => b[1].c / b[1].q - a[1].c / a[1].q).map(([k, r]) =>
      `<div class="trg"><span class="et">${e(k)}<span class="sub">${r.q} piante · ${eur(r.c)}</span></span>
        <span class="vl">${eur(r.c / r.q)}<span class="sub">a pianta</span></span></div>`).join('')
      || `<div class="vuoto">Niente da mostrare.</div>`;
  };
  const molt = S.cfg.impostazioni.moltiplicatorePrezzo;
  return filtri()
    + `<div class="cfgtit">per lotto</div><div class="tabella">${per(g => g.lotto)}</div>
       <div class="cfgtit" style="margin-top:18px">per classe di vaso</div>
       <div class="tabella">${per(g => 'Vaso ' + classe(g.classe).etichetta)}</div>
       <div class="cfgtit" style="margin-top:18px">per specie</div>
       <div class="tabella">${per(g => lotto(g.lotto).specie)}</div>
       <div class="nota">Il costo per pianta sale quando muoiono delle piante: quel costo è già
       stato sostenuto e resta sulle sopravvissute. È il numero corretto su cui fare il prezzo —
       moltiplicatore attuale ×${num(molt)}.</div>`;
}

/* ---------- 3 · margine sulle vendite ---------- */
function aMargine(){
  const vend = S.movimenti.filter(m => m.tipo === 'vendita');
  if (!vend.length) return '<div class="vuoto">Nessuna vendita registrata.</div>';
  const m = new Map();
  vend.forEach(v => {
    const L = lotto(v.lotto);
    if (specieScelta && L.specie !== specieScelta) return;
    if (annoScelto && L.anno !== annoScelto) return;
    const r = m.get(v.lotto) || { n: 0, inc: 0, cst: 0 };
    r.n += -v.qta; r.inc += v.valore || 0; r.cst += -(v.costo || 0);
    m.set(v.lotto, r);
  });
  const tot = [...m.values()].reduce((s, r) => ({ n: s.n + r.n, inc: s.inc + r.inc, cst: s.cst + r.cst }),
    { n: 0, inc: 0, cst: 0 });
  return filtri()
    + `<div class="cifre"><div class="cifra"><b>${tot.n}</b><span>piante vendute</span></div>
        <div class="cifra"><b>${eur(tot.inc)}</b><span>incasso</span></div>
        <div class="cifra"><b>${eur(tot.inc - tot.cst)}</b><span>margine</span></div></div>
      <div class="tabella">${[...m.entries()].map(([k, r]) =>
        `<div class="trg"><span class="et">${e(k)}<span class="sub">${r.n} piante · costo ${eur(r.cst)}</span></span>
          <span class="vl">${eur(r.inc - r.cst)}<span class="sub">${eur(r.inc / r.n)} a pianta</span></span></div>`).join('')}</div>
      <div class="nota">Il costo qui è quello accumulato dalle piante vendute, scaricato pro-quota
      al momento della vendita. § 4.2</div>`;
}

/* ---------- 4 · consumo materiali per stagione ---------- */
function aMateriali(){
  const perAnno = new Map();
  S.eventi.forEach(ev => {
    const consumi = ev.dettagli?.consumi;
    if (!consumi) return;
    const a = (ev.data || '').slice(0, 4);
    if (!perAnno.has(a)) perAnno.set(a, new Map());
    const m = perAnno.get(a);
    for (const [k, L] of Object.entries(consumi)) m.set(k, (m.get(k) || 0) + L);
  });
  if (!perAnno.size) return '<div class="vuoto">Nessun rinvaso registrato: niente consumi da sommare.</div>';
  return [...perAnno.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([a, m]) => {
    const tot = [...m.entries()].reduce((s, [k, L]) => s + L * materiale(k).prezzoLitro, 0);
    return `<div class="cfgtit">stagione ${e(a)} · ${eur(tot)}</div>
      <div class="tabella">${[...m.entries()].sort((x, y) => y[1] - x[1]).map(([k, L]) =>
        `<div class="trg"><span class="et">${e(materiale(k).nome)}</span>
          <span class="vl">${num(L)} L<span class="sub">${eur(L * materiale(k).prezzoLitro)}</span></span></div>`).join('')}</div>`;
  }).join('') + `<div class="nota">Litri effettivamente usati, presi dai consumi salvati su ogni
    rinvaso: è il numero da guardare prima di ordinare la pomice per la prossima stagione.</div>`;
}

/* ---------- 5 · ore per specie e per tipo ---------- */
function aOre(){
  const perSpecie = new Map(), perTipo = new Map();
  S.eventi.forEach(ev => {
    const L = lotto(ev.lotto);
    if (specieScelta && L.specie !== specieScelta) return;
    if (annoScelto && L.anno !== annoScelto) return;
    perSpecie.set(L.specie, (perSpecie.get(L.specie) || 0) + (ev.ore || 0));
    const nome = ev.tipo === 'rinvaso' ? 'Rinvaso' : (tipoInt(ev.tipo)?.nome || ev.tipo);
    perTipo.set(nome, (perTipo.get(nome) || 0) + (ev.ore || 0));
  });
  if (!perSpecie.size) return filtri() + '<div class="vuoto">Nessuna lavorazione registrata.</div>';
  const tar = S.cfg.impostazioni.tariffaOraria;
  const tab = m => `<div class="tabella">${[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, o]) =>
    `<div class="trg"><span class="et">${e(k)}</span>
      <span class="vl">${num(o)} h<span class="sub">${eur(o * tar)}</span></span></div>`).join('')}</div>`;
  return filtri() + `<div class="cfgtit">per specie</div>${tab(perSpecie)}
    <div class="cfgtit" style="margin-top:18px">per tipo di intervento</div>${tab(perTipo)}
    <div class="nota">Le ore sono valorizzate alla tariffa attuale (${eur(tar)}/h) solo in questa
    schermata: ogni evento conserva la tariffa del giorno.</div>`;
}
