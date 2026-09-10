/* ============================================================
   VIVAIO · Intervento dalla home
   Prima che cosa, poi su che cosa. Un gruppo solo passa ai flussi di
   sempre; un lotto, una zona o tutto il vivaio diventano una lavorazione
   per gruppo, con materiali e ore divisi come vuole il § 4.3: i
   materiali dal preset di ogni gruppo, le ore in proporzione alle piante.
   ============================================================ */
import { oggi } from '../db.js';
import * as O from '../operazioni.js';
import { S, registra, vai, radice, ricarica, aperti, classe, lotto, qta, imp, nomeGruppo } from '../stato.js';
import { $, e, eur, num, disegna, testa, vaso, barraTasti, nascondiBarra, brindisi, campoNum } from '../ui.js';

const RINVASO = { id: 'rinvaso', nome: 'Rinvaso', chiede: 'rinvaso' };
let st = null;

const tipi = () => [...S.cfg.tipiIntervento, RINVASO];
const tipo = () => tipi().find(t => t.id === st.tipo);

const AMBITI = {
  nursery:    { nome: 'Tutta la nursery',    dentro: g => g.classe === 'VAS' },
  produzione: { nome: 'Tutta la produzione', dentro: g => g.classe !== 'VAS' },
  tutto:      { nome: 'Tutto il vivaio',     dentro: () => true },
};

function nuovo(){
  st = { passo: 1, tipo: null, ambito: null, lotto: null, cerca: '',
         scelta: null, mat: null, ore: null, note: '', data: oggi() };
}

/* i gruppi su cui cade l'intervento */
function bersaglio(){
  if (!st.ambito) return [];
  if (st.ambito === 'lotto') return aperti().filter(g => g.lotto === st.lotto);
  return aperti().filter(AMBITI[st.ambito].dentro);
}

/* ---------- quanto: preset per gruppo, poi eventuale correzione ---------- */
function preset(g){
  const t = tipo(), n = qta(g);
  if (t.chiede === 'ore') return { mat: 0, ore: 0 };
  const p = t.chiede === 'scelta' ? (t.opzioni || []).find(o => o.k === st.scelta) || {} : t;
  const matPianta = t.filoPerClasse ? (classe(g.classe).filoPerPianta ?? p.matPerPianta ?? 0) : (p.matPerPianta || 0);
  return { mat: matPianta * n, ore: (p.orePerPianta || 0) * n };
}

/* Se correggi il totale, ogni gruppo si prende la sua parte del totale
   corretto nella stessa proporzione del preset — o delle piante, se il
   preset era zero. */
function ripartisci(gruppi){
  const N = gruppi.reduce((s, g) => s + qta(g), 0) || 1;
  const base = gruppi.map(g => ({ g, n: qta(g), ...preset(g) }));
  const M = base.reduce((s, x) => s + x.mat, 0), H = base.reduce((s, x) => s + x.ore, 0);
  const totMat = st.mat != null ? st.mat : M, totOre = st.ore != null ? st.ore : H;
  return base.map(x => ({
    g: x.g, n: x.n,
    mat: M > 0 ? totMat * x.mat / M : totMat * x.n / N,
    ore: H > 0 ? totOre * x.ore / H : totOre * x.n / N,
  }));
}

/* ---------- vista ---------- */
registra('intervento', (par = {}) => {
  if (!st || par.nuovo) nuovo();
  disegnaPasso();
});

export function indietroIntervento(){
  if (!st || st.passo <= 1) return false;
  if (st.passo === 2 && st.sotto){ st.sotto = null; disegnaPasso(); return true; }
  st.passo--; disegnaPasso(); return true;
}

function disegnaPasso(){
  testa({ titolo: 'Intervento', indietro: true, contatore: `passo ${st.passo}/4` });
  let h = '<div class="passi">' + [1, 2, 3, 4].map(i =>
    `<div class="tacca ${i <= st.passo ? 'on' : ''}"></div>`).join('') + '</div><div class="corpo">';
  h += [null, passoCosa, passoDove, passoQuanto, passoConferma][st.passo]();
  disegna(h + '</div>');
  collega();
}

const AZ = {};
function collega(){
  document.querySelectorAll('[data-az]').forEach(el => {
    const [nome, arg] = el.dataset.az.split(':');
    const fn = AZ[nome]; if (!fn) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) el.onchange = ev => fn(arg, ev.target.value);
    else el.onclick = () => fn(arg);
  });
  const c = $('i-cerca');
  if (c) c.oninput = ev => {
    st.cerca = ev.target.value; const p = ev.target.selectionStart;
    disegnaPasso(); const n = $('i-cerca'); n.focus(); n.setSelectionRange(p, p);
  };
}
const rid = () => disegnaPasso();

/* ---------- 1 · che cosa ---------- */
function passoCosa(){
  nascondiBarra();
  const descr = t => t.chiede === 'rinvaso' ? 'conta, smista, registra · un gruppo alla volta'
    : t.chiede === 'ore' ? 'chiede solo le ore'
    : t.chiede === 'scelta' ? (t.opzioni || []).map(o => o.k).join(' o ')
    : t.filoPerClasse ? 'filo a seconda del vaso' : 'preset per pianta';
  return `<div class="eyebrow">Passo 1 — che cosa hai fatto</div>
    <div class="domanda">Scegli la lavorazione.</div>
    <div class="elenco" style="padding:0">${tipi().map(t => `
      <button class="riga" data-az="tipo:${e(t.id)}">
        <span class="id"><span class="codice" style="font-family:var(--sans)">${e(t.nome)}</span>
          <span class="sotto">${e(descr(t))}</span></span>
        <span class="qta">›</span></button>`).join('')}</div>`;
}
AZ.tipo = id => {
  st.tipo = id; st.ambito = null; st.sotto = null; st.mat = null; st.ore = null;
  st.scelta = tipo().opzioni?.[0]?.k || null;
  st.passo = 2; rid();
};

/* ---------- 2 · su che cosa ---------- */
function passoDove(){
  nascondiBarra();
  const t = tipo();
  if (st.sotto === 'gruppo') return sceltaGruppo();
  if (st.sotto === 'lotto') return sceltaLotto();

  const conta = f => { const l = aperti().filter(f); return { n: l.length, p: l.reduce((s, g) => s + qta(g), 0) }; };
  const riga = (az, nome, sotto, destra = '›') => `<button class="riga" data-az="${az}">
      <span class="id"><span class="codice" style="font-family:var(--sans)">${nome}</span>
        <span class="sotto">${sotto}</span></span><span class="qta">${destra}</span></button>`;

  let h = `<div class="eyebrow">Passo 2 — su che cosa</div>
    <div class="domanda">${e(t.nome)}:<br>dove l'hai fatta?</div><div class="elenco" style="padding:0">`;
  h += riga('sotto:gruppo', 'Un gruppo solo', 'scegli dalla lista');
  if (t.chiede !== 'rinvaso'){
    h += riga('sotto:lotto', 'Un lotto intero', 'tutti i suoi gruppi, in qualunque vaso');
    for (const [k, a] of Object.entries(AMBITI)){
      const c = conta(a.dentro);
      if (c.n) h += riga(`ambito:${k}`, a.nome, `${c.n} gruppi · ${c.p} piante`);
    }
  }
  h += '</div>';
  if (t.chiede === 'rinvaso') h += `<div class="nota">Il rinvaso si fa un gruppo alla volta:
    ognuno va contato e smistato. Col tasto <i>Salva e ripeti</i> passi subito al successivo.</div>`;
  return h;
}
AZ.sotto = v => { st.sotto = v; st.cerca = ''; rid(); };
AZ.ambito = k => { st.ambito = k; st.lotto = null; st.passo = 3; rid(); };

function sceltaLotto(){
  const lotti = [...new Set(aperti().map(g => g.lotto))].sort();
  return `<div class="eyebrow">Passo 2 — quale lotto</div>
    <div class="domanda">${e(tipo().nome)}<br>su tutto il lotto.</div>
    <div class="elenco" style="padding:0">${lotti.map(id => {
      const gg = aperti().filter(g => g.lotto === id);
      return `<button class="riga" data-az="lotto:${e(id)}">
        <span class="id"><span class="codice">${e(id)}</span>
          <span class="sotto">${e(lotto(id).specie)} · ${gg.length} gruppi</span></span>
        <span class="qta">${gg.reduce((s, g) => s + qta(g), 0)}<small>piante</small></span></button>`;
    }).join('')}</div>`;
}
AZ.lotto = id => { st.ambito = 'lotto'; st.lotto = id; st.sotto = null; st.passo = 3; rid(); };

function sceltaGruppo(){
  const q = st.cerca.toLowerCase();
  const lista = aperti().filter(g =>
    (g.lotto + ' ' + lotto(g.lotto).specie + ' ' + g.classe + ' ' + (g.suffisso || '')).toLowerCase().includes(q))
    .sort((a, b) => a.lotto.localeCompare(b.lotto) || (a.suffisso || '').localeCompare(b.suffisso || ''));
  return `<div class="eyebrow">Passo 2 — quale gruppo</div>
    <div class="strumenti" style="padding:0 0 10px">
      <input class="cerca" id="i-cerca" placeholder="lotto o specie…" value="${e(st.cerca)}"></div>
    <div class="elenco" style="padding:0">${lista.map(g => `
      <button class="riga" data-az="gruppo:${g.id}">${vaso(classe(g.classe), 34)}
        <span class="id"><span class="codice">${e(nomeGruppo(g))}</span>
          <span class="sotto">${e(lotto(g.lotto).specie)}</span></span>
        <span class="qta">${qta(g)}<small>piante</small></span></button>`).join('')
      || '<div class="vuoto">Nessun gruppo con questo filtro.</div>'}</div>`;
}
/* un gruppo solo: si passa ai flussi di sempre, già sulla lavorazione giusta */
AZ.gruppo = id => {
  const t = tipo();
  nuovo();
  if (t.chiede === 'rinvaso') return vai('flusso', { id: +id, tipo: 'rinvaso' });
  vai('flusso', { id: +id, tipo: 'intervento', tipoInt: t.id });
};

/* ---------- 3 · quanto ---------- */
function passoQuanto(){
  const t = tipo(), gruppi = bersaglio();
  if (!gruppi.length){ nascondiBarra(); return '<div class="vuoto">Nessun gruppo aperto qui.</div>'; }
  barraTasti('Avanti', () => { st.passo = 4; rid(); }, null, null,
    t.chiede !== 'ore' || (st.ore || 0) > 0);

  const parti = ripartisci(gruppi);
  const N = parti.reduce((s, x) => s + x.n, 0);
  const totMat = parti.reduce((s, x) => s + x.mat, 0), totOre = parti.reduce((s, x) => s + x.ore, 0);
  const dove = st.ambito === 'lotto' ? st.lotto : AMBITI[st.ambito].nome.toLowerCase();

  const scelta = t.chiede === 'scelta' ? `<div class="scala-eti"><span class="eyebrow">${e(t.etichetta || 'scelta')}</span></div>
    <div class="passo-tasti" style="margin-top:0">${(t.opzioni || []).map(o =>
      `<button class="mini ${st.scelta === o.k ? 'on' : ''}" data-az="scelta:${e(o.k)}">${e(o.k)}</button>`).join('')}</div>` : '';

  const campi = t.chiede === 'ore'
    ? `<div class="duecampi" style="margin-top:16px">
        ${campoNum('i-ore', 'Ore in tutto', st.ore ?? 0, 0.25, 'data-az="ore:"')}
        <div class="campo"><label>Costo</label><input value="${eur(totOre * imp('tariffaOraria'))}" readonly></div></div>
       <div class="nota">Le ore si dividono fra i gruppi in proporzione alle piante.</div>`
    : `<div class="avviso" style="margin-top:16px">Precompilato dai preset su <b>${N}</b> piante.
         Se oggi è andata diversamente, correggi i totali: ogni gruppo si prende la sua parte.</div>
       <div class="duecampi">
        ${campoNum('i-mat', 'Materiali € in tutto', +totMat.toFixed(2), 0.10, 'data-az="mat:"')}
        ${campoNum('i-ore', 'Ore in tutto', +totOre.toFixed(2), 0.25, 'data-az="ore:"')}</div>`;

  const mostra = parti.slice(0, 8);
  const tabella = `<div class="eyebrow" style="margin-top:22px">come si divide</div>
    <div class="tabella">${mostra.map(x => `<div class="trg">
      <span class="et">${e(nomeGruppo(x.g))} · ${e(x.g.classe)}<span class="sub">${x.n} piante</span></span>
      <span class="vl">${eur(x.mat + x.ore * imp('tariffaOraria'))}<span class="sub">${num(x.ore)} h</span></span></div>`).join('')}
      ${parti.length > mostra.length ? `<div class="trg"><span class="et">… e altri ${parti.length - mostra.length} gruppi</span></div>` : ''}
    </div>`;

  return `<div class="eyebrow">Passo 3 — quanto</div>
    <div class="domanda">${e(t.nome)}<br>su ${e(dove)}.</div>
    <div class="dasmist"><b>${parti.length}</b><span>gruppi · ${N} piante</span></div>
    ${scelta}${campi}${tabella}`;
}
AZ.scelta = k => { st.scelta = k; st.mat = null; st.ore = null; rid(); };
AZ.mat = (_, v) => { st.mat = Math.max(0, +v || 0); rid(); };
AZ.ore = (_, v) => { st.ore = Math.max(0, +v || 0); rid(); };

/* ---------- 4 · conferma ---------- */

/* Arrotondare ogni gruppo al centesimo per conto suo fa sbagliare il
   totale: scrivi 30 € e la conferma dice 30,02. I centesimi avanzati
   vanno a chi aveva la parte decimale più grossa, e il totale torna
   esattamente quello scritto. */
export function arrotonda(valori, totale){
  const cent = valori.map(v => Math.floor(v * 100 + 1e-9));
  let resto = Math.round(totale * 100) - cent.reduce((s, x) => s + x, 0);
  const ordine = valori.map((v, i) => [v * 100 - Math.floor(v * 100 + 1e-9), i]).sort((p, q) => q[0] - p[0]);
  for (let k = 0; resto > 0 && k < ordine.length; k++, resto--) cent[ordine[k][1]]++;
  return cent.map(c => c / 100);
}

function costruisciPiano(){
  const t = tipo(), parti = ripartisci(bersaglio());
  const dettagli = t.chiede === 'scelta' ? { scelta: st.scelta } : {};
  const somma = k => parti.reduce((acc, x) => acc + x[k], 0);
  const mats = arrotonda(parti.map(x => x.mat), somma('mat'));
  const ores = arrotonda(parti.map(x => x.ore), somma('ore'));
  const piani = parti.map((x, i) => O.pianoIntervento({ gruppo: x.g, piante: x.n, tipo: t.id,
    dettagli: { ...dettagli, globale: true }, ore: ores[i], costoMateriali: mats[i],
    tariffa: imp('tariffaOraria'), data: st.data, note: st.note }));
  return {
    tipo: 'intervento', movimenti: [], conteggi: [], destinazioni: [], chiudi: [],
    eventi: piani.flatMap(p => p.eventi),
    costoTotale: piani.reduce((s, p) => s + p.costoTotale, 0),
  };
}

function passoConferma(){
  const t = tipo(), piano = costruisciPiano();
  const mat = piano.eventi.reduce((s, x) => s + x.costoMateriali, 0);
  const ore = piano.eventi.reduce((s, x) => s + x.ore, 0);
  const piante = piano.eventi.reduce((s, x) => s + (x.piante || 0), 0);
  barraTasti('Salva', () => salva(piano));
  const voce = (sim, tag, txt) => `<div class="voce"><span class="segno">${sim}</span>
    <span class="txt"><span class="tag">${tag}</span>${txt}</span></div>`;
  return `<div class="eyebrow">Passo 4 — conferma</div>
    <div class="domanda">Ecco cosa<br>viene scritto.</div>
    <div class="registro">
      ${voce('●', 'Intervento', `<b>${e(t.nome)}${st.scelta ? ' · ' + e(st.scelta) : ''}</b>
        su ${piano.eventi.length} gruppi · ${piante} piante`)}
      ${voce('€', 'Costo', `${eur(mat)} materiali + ${num(ore)} h × ${eur(imp('tariffaOraria'))}
        = <b>${eur(piano.costoTotale)}</b>`)}
      ${voce('↳', 'Come', `una lavorazione per gruppo: ognuno si porta il suo costo`)}</div>
    <div class="campo" style="margin-top:14px"><label for="i-data">Data</label>
      <input id="i-data" type="date" value="${st.data}" data-az="data:"
        style="width:100%;font-family:var(--mono);font-size:16px;border:1px solid var(--linea);
        border-radius:10px;padding:10px;background:var(--carta);color:inherit"></div>
    <div class="campo" style="margin-top:14px"><label for="i-note">Note</label>
      <textarea id="i-note" data-az="note:" placeholder="prodotto, dose, osservazioni…">${e(st.note)}</textarea></div>`;
}
AZ.data = (_, v) => { st.data = v || oggi(); rid(); };
AZ.note = (_, v) => { st.note = v; };

async function salva(piano){
  await O.esegui(piano);
  const t = tipo();
  brindisi(`${t.nome} registrata su ${piano.eventi.length} gruppi`);
  nuovo();
  await ricarica();
  radice('home');
}
