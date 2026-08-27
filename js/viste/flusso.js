/* ============================================================
   SERRA · i quattro flussi · § 5.3 → § 5.6
   Ogni passo disegna, l'ultimo mostra il piano e lo esegue.
   ============================================================ */
import { db, oggi } from '../db.js';
import * as O from '../operazioni.js';
import * as C from '../calcoli.js';
import { S, registra, vai, torna, radice, rendi, ricarica, gruppo, classe, lotto,
         qta, costo, perPianta, imp, aperti, nomeGruppo } from '../stato.js';
import { $, e, eur, num, dataIT, disegna, testa, vaso, barraTasti, brindisi, campoNum } from '../ui.js';

const PASSI  = { rinvaso: 4, conteggio: 2, vendita: 2, intervento: 2 };
const TITOLI = { rinvaso: 'Rinvaso', conteggio: 'Conteggio', vendita: 'Vendita', intervento: 'Intervento' };

let f = null, passo = 1;
let ultimaMiscela = null, ultimeQuote = null, ultimeOre = 0;

const attive = () => S.cfg.classi.filter(c => c.attiva);
const prossimaClasse = c => {
  const l = attive(), i = l.findIndex(x => x.id === c);
  return l[Math.min(i + 1, l.length - 1)]?.id || c;
};
const smistate = () => Object.values(f.dest).reduce((s, n) => s + n, 0);
const resto = () => f.contate - smistate();
const miscelaCorrente = () => S.cfg.miscele.find(m => m.id === f.miscelaId) || null;

/* ---------- avvio ---------- */
registra('flusso', ({ id, tipo }) => {
  const g = gruppo(id);
  if (!g) return radice('elenco');
  if (!f || f.gruppo.id !== id || f.tipo !== tipo || f.finito) avvia(g, tipo);
  disegnaPasso();
});

function avvia(g, tipo){
  const n = qta(g);
  const mis = S.cfg.miscele.find(m => m.id === ultimaMiscela) || S.cfg.miscele[0];
  f = { tipo, gruppo: g, attese: n, contate: n, dest: {},
        miscelaId: mis?.id || null, quote: { ...(ultimeQuote || mis?.quote || {}) },
        costoVasi: 0, ore: ultimeOre || 0, note: '', vigore: 0,
        prezzo: 0, vend: n, tipoInt: S.cfg.tipiIntervento[0]?.id, scelta: null,
        oreTocco: false, matTocco: false, materiali: 0, unisci: {}, data: oggi() };
  if (tipo === 'rinvaso') f.dest[prossimaClasse(g.classe)] = n;
  if (tipo === 'intervento') f.scelta = tipoDi()?.opzioni?.[0]?.k || null;
  passo = 1;
}

const tipoDi = () => S.cfg.tipiIntervento.find(t => t.id === f.tipoInt);

function disegnaPasso(){
  testa({ titolo: TITOLI[f.tipo], indietro: true, contatore: `passo ${passo}/${PASSI[f.tipo]}` });
  let t = '<div class="passi">';
  for (let i = 1; i <= PASSI[f.tipo]; i++) t += `<div class="tacca ${i <= passo ? 'on' : ''}"></div>`;
  t += '</div>';
  const corpo = { rinvaso: passoRinvaso, conteggio: passoConteggio,
                  vendita: passoVendita, intervento: passoIntervento }[f.tipo]();
  disegna(t + '<div class="corpo">' + corpo + '</div>');
  collega();
}

/* delega gli eventi dichiarati con data-az="nome:argomento" */
const AZIONI = {};
function collega(){
  document.querySelectorAll('[data-az]').forEach(el => {
    const [nome, arg] = el.dataset.az.split(':');
    const fn = AZIONI[nome];
    if (!fn) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      el.onchange = ev => fn(arg, ev.target.value, ev.target);
    else el.onclick = () => fn(arg);
  });
}
const rid = () => disegnaPasso();

/* Il tasto Indietro torna al passo precedente, non alla scheda. */
export function indietroPasso(){
  if (f && passo > 1){ passo--; disegnaPasso(); return true; }
  return false;
}

/* ---------- blocco conteggio, riusato da rinvaso e conteggio ---------- */
function bloccoConta(){
  const d = f.contate - f.attese;
  const esito = d < 0 ? `<div class="esito perdita">− ${-d} perdita · registrata da sola</div>`
    : d > 0 ? `<div class="esito perdita">+ ${d} in più delle attese · verifica</div>`
    : `<div class="esito pari">Nessuna perdita</div>`;
  return `<div class="eyebrow">Passo ${passo} — quante ce ne sono</div>
    <div class="domanda">Contale davvero,<br>prima di toccarle.</div>
    <div class="conta"><div class="att">attese<b>${f.attese}</b></div><div class="freccia">›</div>
      <input class="numerone" type="number" inputmode="numeric" min="0" value="${f.contate}"
        data-az="conta:"></div>
    ${esito}
    <div class="passo-tasti">
      <button class="mini" data-az="conta:${f.attese}">tutte ${f.attese}</button>
      <button class="mini" data-az="conta:${Math.max(0, f.contate - 1)}">−1</button>
      <button class="mini" data-az="conta:${f.contate + 1}">+1</button></div>`;
}
AZIONI.conta = (arg, val) => {
  f.contate = Math.max(0, +(arg !== '' ? arg : val) || 0);
  if (f.tipo === 'rinvaso'){
    const k = Object.keys(f.dest);
    if (k.length === 1) f.dest[k[0]] = Math.min(f.dest[k[0]], f.contate);
    while (resto() < 0){
      const u = Object.keys(f.dest).pop();
      f.dest[u] = Math.max(0, f.dest[u] + resto());
      if (f.dest[u] === 0) delete f.dest[u];
    }
  }
  rid();
};

/* ---------- campo data, in coda a ogni conferma ---------- */
const campoData = () => `<div class="campo" style="margin-top:14px">
  <label for="i-data">Data della registrazione</label>
  <input id="i-data" type="date" value="${f.data}" data-az="data:"
    style="width:100%;font-family:var(--mono);font-size:16px;border:1px solid var(--linea);
    border-radius:2px;padding:10px;background:var(--carta);color:inherit"></div>`;
AZIONI.data = (_, v) => { f.data = v || oggi(); rid(); };
AZIONI.note = (_, v) => { f.note = v; };

/* ============================================================
   RINVASO
   ============================================================ */
function passoRinvaso(){
  const g = f.gruppo, cl = classe(g.classe);

  if (passo === 1){ barraTasti('Avanti', () => { passo = 2; rid(); }); return bloccoConta(); }

  if (passo === 2){
    barraTasti('Avanti', () => { passo = 3; rid(); }, null, null, smistate() > 0 && resto() >= 0);
    let righe = '';
    Object.entries(f.dest).forEach(([c, n]) => {
      righe += `<div class="dest">${vaso(classe(c), 40)}
        <button class="tondino" data-az="dest-:${c}">−</button>
        <input class="n" type="number" inputmode="numeric" min="0" value="${n}" data-az="dest=:${c}">
        <button class="tondino" data-az="dest+:${c}">+</button>
        <button class="tondino" data-az="dest×:${c}">×</button></div>`;
      righe += bloccoUnione(c);
    });
    let scala = '<div class="scala">';
    S.cfg.classi.filter(c => c.attiva || f.dest[c.id] !== undefined).forEach(c => {
      const w = (58 * (c.mm / 240) * .62 + 58 * .38) | 0;
      scala += `<button class="gradino ${c.tondo ? 'tondo' : ''} ${f.dest[c.id] !== undefined ? 'on' : ''}
        ${c.id === g.classe ? 'attuale' : ''}" style="width:${w}px;height:${w}px"
        data-az="nuovadest:${c.id}">${e(c.id)}</button>`;
    });
    scala += '</div>';
    const r = resto();
    return `<div class="eyebrow">Passo 2 — smistamento</div>
      <div class="domanda">Le grandi da una parte,<br>le piccole restano.</div>
      <div class="dasmist"><b>${f.contate}</b><span>piante contate</span></div>
      ${righe || '<div class="vuoto">Tocca una classe di vaso qui sotto.</div>'}
      ${r > 0 ? `<div class="resto"><b>${r}</b> restano in vaso ${e(cl.etichetta)}.</div>`
        : r < 0 ? `<div class="resto rosso">Ne hai smistate ${-r} più di quante ne hai contate.</div>`
        : `<div class="resto">Il gruppo ${e(g.classe)} si chiude: passano tutte.</div>`}
      <div class="scala-eti"><span class="eyebrow">aggiungi destinazione</span>
        <span class="eyebrow">tocca una classe</span></div>${scala}`;
  }

  if (passo === 3){
    barraTasti('Avanti', () => { passo = 4; rid(); });
    const litriTot = Object.entries(f.dest).reduce((s, [c, n]) => s + n * classe(c).litriPerVaso, 0);
    const litriMat = C.litriPerMateriale(f.quote, litriTot);
    let righe = '', costoT = 0;
    Object.keys(f.quote).forEach(k => {
      const m = S.cfg.materiali.find(x => x.id === k) || { nome: k, prezzoLitro: 0 };
      const L = litriMat[k] || 0; costoT += L * m.prezzoLitro;
      righe += `<div class="mixriga"><label>${e(m.nome)}</label>
        <span class="pz">${num(L)} L</span>
        <input class="quota" type="number" step="5" min="0" value="${+f.quote[k] || 0}" data-az="quota:${k}">
        <button class="tondino" data-az="togli-mat:${k}" title="togli">×</button></div>`;
    });
    const disponibili = S.cfg.materiali.filter(m => m.attivo && f.quote[m.id] === undefined);
    const aggiunte = disponibili.length ? `<div class="passo-tasti">${disponibili.map(m =>
      `<button class="mini" data-az="agg-mat:${m.id}">+ ${e(m.nome)}</button>`).join('')}</div>` : '';
    const bott = S.cfg.miscele.map(m =>
      `<button class="mini ${f.miscelaId === m.id ? 'on' : ''}" data-az="miscela:${m.id}">${e(m.nome)}</button>`).join('');
    const vasi = Object.entries(f.dest).map(([c, n]) => `${n}×${e(c)}`).join(' + ');
    const mis = miscelaCorrente();
    return `<div class="eyebrow">Passo 3 — substrato e ore</div>
      <div class="domanda">Quello che hai messo<br>oggi, non il preset.</div>
      <div class="ricette">${bott}</div>
      <div class="mix">${righe || '<div class="vuoto" style="padding:14px">Nessun materiale in questa miscela.</div>'}
        <div class="totmix"><span>${vasi} · ${num(litriTot)} L</span><b>${eur(costoT)}</b></div></div>
      ${aggiunte}
      <div class="passo-tasti"><button class="mini" data-az="salva-miscela:">salva come miscela</button></div>
      ${mis?.sperimentale ? `<div class="avviso">Nasce l'etichetta <b>Substrato = ${e(mis.nome)}</b>
        sui gruppi di destinazione. Ti seguirà attraverso i prossimi rinvasi.</div>` : ''}
      <div class="duecampi">
        ${campoNum('i-vasi', 'Vasi e altro €', f.costoVasi, 0.10, 'data-az="vasi:"')}
        ${campoNum('i-ore', 'Ore', f.ore, 0.25, 'data-az="ore:"')}</div>`;
  }

  /* --- passo 4 · conferma --- */
  const piano = costruisciPiano();
  barraTasti('Salva', () => salva(piano, false), 'Salva e ripeti', () => salva(piano, true));
  let voci = '';
  piano.movimenti.forEach(m => {
    if (m.tipo === 'trasferimento'){
      const d = piano.destinazioni[m.destIndex];
      voci += voce('', '↔', 'Trasferimento',
        `<b>${m.qta}</b> piante da <b>${e(g.classe)}</b> a <b>${e(d.classe)}</b> · ${eur(m.costo)} di costo`);
    } else {
      voci += voce(m.qta < 0 ? 'meno' : 'piu', (m.qta < 0 ? '−' : '+') + Math.abs(m.qta),
        m.tipo === 'perdita' ? 'Perdita' : 'Rettifica', `${Math.abs(m.qta)} piante su ${e(nomeGruppo(g))}`);
    }
  });
  piano.eventi.forEach(ev => {
    const d = piano.destinazioni[ev.destIndex];
    voci += voce('', '●', 'Rinvaso · ' + e(d.classe),
      `${eur(ev.costoMateriali)} materiali · ${num(ev.ore)} h (${eur(ev.ore * ev.tariffa)}) · ${num(ev.dettagli.litriTotali)} L`);
  });
  piano.destinazioni.filter(d => d.unisciA).forEach(d => {
    const t = gruppo(d.unisciA);
    voci += voce('', '⧉', 'Unione',
      `entrano in <b>${e(nomeGruppo(t))}</b>` + (d.etichettePerse.length
        ? ` · cade l'etichetta <b>${d.etichettePerse.map(p => e(p.variabile + ' ' + p.valore)).join('</b>, <b>')}</b>`
        : ''));
  });
  if (piano.resto > 0) voci += voce('', '=', 'Resta', `<b>${piano.resto}</b> piante in vaso ${e(classe(g.classe).etichetta)}`);
  else voci += voce('', '✕', 'Chiusura', `Il gruppo ${e(nomeGruppo(g))} si svuota e si chiude`);

  const molt = imp('moltiplicatorePrezzo');
  const risultato = piano.destinazioni.map(d =>
    `<div class="trg"><span class="et">Vaso ${e(classe(d.classe).etichetta)} · ${d.piante} piante</span>
      <span class="vl">${eur(d.costoPianta)}<span class="sub">×${num(molt)} = ${eur(d.costoPianta * molt)}</span></span></div>`).join('');

  return `<div class="eyebrow">Passo 4 — conferma</div>
    <div class="domanda">Ecco cosa<br>viene scritto.</div>
    <div class="registro">${voci}</div>
    <div class="eyebrow" style="margin-top:22px">costo a pianta dopo il rinvaso</div>
    <div class="tabella">${risultato}</div>
    ${campoData()}
    <div class="campo" style="margin-top:14px"><label for="i-note">Note</label>
      <textarea id="i-note" data-az="note:" placeholder="andamento, radici, osservazioni…">${e(f.note)}</textarea></div>`;
}

/* ---- unione con un gruppo già aperto nella classe di destinazione ----
   Compare solo quando la situazione esiste davvero: stesso lotto, stessa
   classe, etichette diverse. Il valore predefinito è tenerle separate:
   unire è una scelta, non un effetto collaterale. */
function candidati(c){
  const g = f.gruppo;
  const mio = C.profilo({ prove: g.prove, storicoProve: g.storicoProve });
  return aperti().filter(x => x.lotto === g.lotto && x.classe === c && x.id !== g.id
    && C.profilo(x) !== mio);
}

function bloccoUnione(c){
  const lista = candidati(c);
  if (!lista.length) return '';
  const scelto = f.unisci[c];
  return `<div class="unione">
    <span>In vaso ${e(classe(c).etichetta)} c'è già ${lista.length > 1 ? 'un gruppo' : ''}
      <b>${e(nomeGruppo(lista[0]))}</b> con etichette diverse.</span>
    <div class="passo-tasti" style="margin-top:8px">
      <button class="mini ${!scelto ? 'on' : ''}" data-az="unisci:${c}|">tieni separate</button>
      ${lista.map(x => `<button class="mini ${scelto === x.id ? 'on' : ''}"
        data-az="unisci:${c}|${x.id}">unisci a ${e(nomeGruppo(x))}</button>`).join('')}</div>
    ${scelto ? `<div class="nota" style="margin:8px 0 0">Le etichette che le dividevano cadono:
      da qui in poi sono un mucchio solo, come sul bancale. Quello che hai già contato resta
      in Analisi.</div>` : ''}</div>`;
}
AZIONI['unisci'] = arg => {
  const [c, id] = arg.split('|');
  if (id) f.unisci[c] = +id; else delete f.unisci[c];
  rid();
};

function costruisciPiano(){
  const g = f.gruppo;
  return O.pianoRinvaso({
    gruppo: g, attese: f.attese, contate: f.contate, costo: costo(g),
    destinazioni: Object.entries(f.dest).filter(([, n]) => n > 0).map(([c, n]) => ({
      classe: c, piante: n,
      unisci: f.unisci[c] ? gruppo(f.unisci[c]) : null })),
    miscela: miscelaCorrente(), quote: f.quote,
    materiali: S.cfg.materiali, classi: S.cfg.classi,
    costoVasi: f.costoVasi, ore: f.ore, tariffa: imp('tariffaOraria'),
    data: f.data, note: f.note,
  });
}

const voce = (s, sim, tag, txt) => `<div class="voce"><span class="segno ${s}">${sim}</span>
  <span class="txt"><span class="tag">${tag}</span>${txt}</span></div>`;

AZIONI['nuovadest'] = c => {
  if (f.dest[c] !== undefined) delete f.dest[c]; else f.dest[c] = Math.max(0, resto());
  rid();
};
AZIONI['dest+'] = c => { f.dest[c]++; rid(); };
AZIONI['dest-'] = c => { f.dest[c] = Math.max(0, f.dest[c] - 1); rid(); };
AZIONI['dest×'] = c => { delete f.dest[c]; rid(); };
AZIONI['dest='] = (c, v) => { f.dest[c] = Math.max(0, +v || 0); rid(); };
AZIONI['miscela'] = id => { f.miscelaId = id; f.quote = { ...(S.cfg.miscele.find(m => m.id === id)?.quote || {}) }; rid(); };
AZIONI['quota'] = (k, v) => { f.quote[k] = Math.max(0, +v || 0); rid(); };
AZIONI['agg-mat'] = id => { f.quote[id] = 0; rid(); };
AZIONI['togli-mat'] = id => { delete f.quote[id]; rid(); };
AZIONI['vasi'] = (_, v) => { f.costoVasi = +v || 0; rid(); };
AZIONI['ore'] = (_, v) => { f.ore = +v || 0; f.oreTocco = true; rid(); };
AZIONI['salva-miscela'] = async () => {
  const nome = prompt('Nome della miscela', 'Miscela ' + (S.cfg.miscele.length + 1));
  if (!nome) return;
  const id = 'mix' + Date.now();
  await db.miscele.add({ id, nome, quote: { ...f.quote }, sperimentale: false });
  await ricarica();
  f.miscelaId = id;
  brindisi('Salvata come ' + nome);
  rid();
};

/* ============================================================
   CONTEGGIO · § 5.4
   ============================================================ */
function passoConteggio(){
  const g = f.gruppo;
  if (passo === 1){
    barraTasti('Avanti', () => { passo = 2; rid(); });
    return bloccoConta() + `
      <div class="eyebrow" style="margin-top:24px">vigore · facoltativo</div>
      <div class="passo-tasti">${[1,2,3,4,5].map(v =>
        `<button class="mini ${f.vigore === v ? 'on' : ''}" data-az="vigore:${v}">${v}</button>`).join('')}
        <button class="mini ${!f.vigore ? 'on' : ''}" data-az="vigore:0">non rilevato</button></div>
      <div class="nota">1 stentate · 3 normali · 5 vigorose. Non si deduce dai saldi:
        se non lo scrivi ora, quell'informazione non esiste.</div>`;
  }
  const piano = O.pianoConteggio({ gruppo: g, attese: f.attese, contate: f.contate,
    vigore: f.vigore, data: f.data, note: f.note });
  barraTasti('Salva', () => salva(piano, false));
  const d = f.contate - f.attese;
  return `<div class="eyebrow">Passo 2 — conferma</div>
    <div class="domanda">Ecco cosa<br>viene scritto.</div>
    <div class="registro">
      ${d === 0 ? voce('', '=', 'Nessun movimento', `Giacenza confermata a <b>${f.attese}</b> piante`)
        : voce(d < 0 ? 'meno' : 'piu', (d < 0 ? '−' : '+') + Math.abs(d),
            d < 0 ? 'Perdita' : 'Rettifica', `${Math.abs(d)} piante su ${e(nomeGruppo(g))}`)}
      ${voce('', '◆', 'Conteggio', `attese ${f.attese} → contate <b>${f.contate}</b>` +
        (f.vigore ? ` · vigore ${f.vigore}/5` : ''))}</div>
    ${d < 0 && costo(g) > 0 ? `<div class="avviso giallo">Il costo per pianta sale da <b>${eur(perPianta(g))}</b>
      a <b>${eur(C.costoPianta(costo(g), f.contate))}</b>: il costo delle perdute resta sulle vive.</div>` : ''}
    ${campoData()}`;
}
AZIONI['vigore'] = v => { f.vigore = +v; rid(); };

/* ============================================================
   VENDITA · § 5.5
   ============================================================ */
function passoVendita(){
  const g = f.gruppo, n = qta(g), cpp = perPianta(g);
  if (passo === 1){
    barraTasti('Avanti', () => { passo = 2; rid(); }, null, null, f.vend > 0 && f.prezzo > 0);
    const sugg = cpp * imp('moltiplicatorePrezzo');
    return `<div class="eyebrow">Passo 1 — quante e a quanto</div>
      <div class="domanda">La vendita<br>si registra subito.</div>
      <div class="conta">
        <input class="numerone" type="number" inputmode="numeric" min="1" max="${n}"
          value="${f.vend}" data-az="vend:">
        <div class="att">di<b>${n}</b></div></div>
      <div class="duecampi">
        ${campoNum('i-prezzo', 'Prezzo a pianta €', f.prezzo, 0.50, 'data-az="prezzo:"')}
        <div class="campo"><label>Costo a pianta</label>
          <input value="${eur(cpp)}" readonly></div></div>
      <div class="passo-tasti">
        <button class="mini" data-az="prezzo-sugg:${sugg.toFixed(2)}">suggerito ${eur(sugg)}</button></div>
      ${f.prezzo > 0 && f.prezzo < cpp
        ? `<div class="avviso giallo">Sotto costo di <b>${eur(cpp - f.prezzo)}</b> a pianta.
           L'app avvisa, non blocca.</div>` : ''}`;
  }
  const piano = O.pianoVendita({ gruppo: g, giacenza: n, costo: costo(g),
    quantita: f.vend, prezzo: f.prezzo, data: f.data, note: f.note });
  barraTasti('Salva', () => salva(piano, false));
  return `<div class="eyebrow">Passo 2 — conferma</div>
    <div class="domanda">Ecco cosa<br>viene scritto.</div>
    <div class="registro">
      ${voce('meno', '−' + f.vend, 'Vendita',
        `${f.vend} piante di ${e(nomeGruppo(g))} · ${e(g.classe)} a <b>${eur(f.prezzo)}</b> l'una`)}
      ${voce('', '€', 'Incasso', `<b>${eur(piano.incasso)}</b> a fronte di ${eur(piano.costoCeduto)} di costo accumulato`)}
      ${voce(piano.margine >= 0 ? 'piu' : 'meno', 'Δ', 'Margine', `<b>${eur(piano.margine)}</b>`)}
      ${piano.chiudi.length ? voce('', '✕', 'Chiusura', 'Il gruppo si svuota e si chiude') : ''}</div>
    ${campoData()}`;
}
AZIONI['vend'] = (_, v) => { f.vend = Math.max(0, Math.min(qta(f.gruppo), +v || 0)); rid(); };
AZIONI['prezzo'] = (_, v) => { f.prezzo = +v || 0; rid(); };
AZIONI['prezzo-sugg'] = v => { f.prezzo = +v; rid(); };

/* ============================================================
   INTERVENTO · § 5.6 — la scheda dipende dal modello configurato
   ============================================================ */
function valoriIntervento(){
  const g = f.gruppo, t = tipoDi(), n = qta(g);
  if (!t) return { ore: 0, mat: 0 };
  if (t.chiede === 'ore') return { ore: f.ore, mat: 0 };
  const p = t.chiede === 'scelta' ? (t.opzioni || []).find(o => o.k === f.scelta) || {} : t;
  return { ore: f.oreTocco ? f.ore : +((p.orePerPianta || 0) * n).toFixed(2),
           mat: f.matTocco ? f.materiali : +((p.matPerPianta || 0) * n).toFixed(2) };
}

function passoIntervento(){
  const g = f.gruppo, t = tipoDi(), v = valoriIntervento(), n = qta(g);
  if (passo === 1){
    barraTasti('Avanti', () => { passo = 2; rid(); }, null, null, !!t);
    const chip = S.cfg.tipiIntervento.map(x =>
      `<button class="mini ${f.tipoInt === x.id ? 'on' : ''}" data-az="tipo-int:${x.id}">${e(x.nome)}</button>`).join('');
    let corpo = '';
    if (t?.chiede === 'ore'){
      corpo = `<div class="duecampi" style="margin-top:18px">
        ${campoNum('i-o', 'Ore', v.ore, 0.25, 'data-az="ore:"')}
        <div class="campo"><label>Costo</label><input value="${eur(v.ore * imp('tariffaOraria'))}" readonly></div></div>`;
    } else if (t){
      const sc = t.chiede === 'scelta'
        ? `<div class="scala-eti"><span class="eyebrow">${e(t.etichetta || 'scelta')}</span></div>
           <div class="passo-tasti" style="margin-top:0">${(t.opzioni || []).map(o =>
             `<button class="mini ${f.scelta === o.k ? 'on' : ''}" data-az="scelta:${e(o.k)}">${e(o.k)}</button>`).join('')}</div>`
        : '';
      corpo = `${sc}
        <div class="avviso" style="margin-top:18px">Precompilato dal config su <b>${n}</b> piante.
          Correggi se oggi è andata diversamente.</div>
        <div class="duecampi">
          ${campoNum('i-m', 'Materiali €', v.mat, 0.10, 'data-az="materiali:"')}
          ${campoNum('i-o', 'Ore', v.ore, 0.25, 'data-az="ore:"')}</div>`;
    }
    return `<div class="eyebrow">Passo 1 — che cosa hai fatto</div>
      <div class="domanda">Ogni tipo<br>ha la sua scheda.</div>
      <div class="passo-tasti" style="margin-top:0">${chip}</div>
      ${corpo}
      <div class="campo" style="margin-top:14px"><label for="i-note">Note</label>
        <textarea id="i-note" data-az="note:" placeholder="rami eliminati, impostazione…">${e(f.note)}</textarea></div>`;
  }
  const dettagli = t.chiede === 'scelta' ? { scelta: f.scelta }
    : t.chiede === 'fisso' ? { preset: { matPerPianta: t.matPerPianta, orePerPianta: t.orePerPianta } } : {};
  const piano = O.pianoIntervento({ gruppo: g, piante: n, tipo: t.id, dettagli,
    ore: v.ore, costoMateriali: v.mat, tariffa: imp('tariffaOraria'), data: f.data, note: f.note });
  barraTasti('Salva', () => salva(piano, false), 'Salva e ripeti', () => salva(piano, true));
  return `<div class="eyebrow">Passo 2 — conferma</div>
    <div class="domanda">Ecco cosa<br>viene scritto.</div>
    <div class="registro">
      ${voce('', '●', 'Intervento',
        `<b>${e(t.nome)}${t.chiede === 'scelta' ? ' · ' + e(f.scelta) : ''}</b> su ${e(nomeGruppo(g))} · ${e(g.classe)} (${n} piante)`)}
      ${voce('', '€', 'Costo',
        `${eur(v.mat)} materiali + ${num(v.ore)} h × ${eur(imp('tariffaOraria'))} = <b>${eur(piano.costoTotale)}</b>`)}
      ${f.note ? voce('', '✎', 'Note', e(f.note)) : ''}</div>
    <div class="avviso">Il costo per pianta passa a
      <b>${eur(C.costoPianta(costo(g) + piano.costoTotale, n))}</b>.</div>
    ${campoData()}`;
}
AZIONI['tipo-int'] = id => {
  f.tipoInt = id; f.oreTocco = false; f.matTocco = false; f.ore = 0; f.materiali = 0;
  f.scelta = tipoDi()?.opzioni?.[0]?.k || null; rid();
};
AZIONI['scelta'] = k => { f.scelta = k; f.oreTocco = false; f.matTocco = false; rid(); };
AZIONI['materiali'] = (_, v) => { f.materiali = +v || 0; f.matTocco = true; rid(); };

/* ============================================================
   SALVATAGGIO
   ============================================================ */
async function salva(piano, ripeti){
  const g = f.gruppo, tipo = f.tipo;
  const classeOrigine = g.classe;
  await O.esegui(piano);
  if (tipo === 'rinvaso'){
    ultimaMiscela = f.miscelaId; ultimeQuote = { ...f.quote }; ultimeOre = f.ore;
    brindisi(`Smistate ${piano.spostate} piante`);
  } else if (tipo === 'vendita') brindisi(`Vendute ${f.vend} · ${eur(piano.incasso)}`);
  else if (tipo === 'intervento') brindisi(`${tipoDi().nome} registrato`);
  else brindisi(f.contate < f.attese ? `Registrate ${f.attese - f.contate} perdite` : 'Giacenza confermata');

  const destClassi = Object.keys(f.dest);
  const oreRipeti = f.ore, miscRipeti = f.miscelaId, tipoIntRipeti = f.tipoInt, sceltaRipeti = f.scelta;
  f.finito = true;
  await ricarica();

  if (ripeti){
    /* quando si rinvasa, si rinvasa in serie: stesso vaso, gruppo successivo */
    /* prima le sorelle dello stesso lotto: quando si rinvasa una prova,
       si finisce la prova, non si passa a un altro lotto */
    const succ = aperti().filter(x => x.id !== g.id && x.classe === classeOrigine)
      .sort((a, b) => (a.lotto === g.lotto ? 0 : 1) - (b.lotto === g.lotto ? 0 : 1)
        || a.lotto.localeCompare(b.lotto)
        || (a.suffisso || '').localeCompare(b.suffisso || ''))[0];
    if (succ){
      avvia(succ, tipo);
      if (tipo === 'rinvaso'){
        f.dest = {}; destClassi.forEach((c, i) => f.dest[c] = i === 0 ? f.contate : 0);
        f.miscelaId = miscRipeti; f.quote = { ...ultimeQuote }; f.ore = oreRipeti;
      } else { f.tipoInt = tipoIntRipeti; f.scelta = sceltaRipeti; }
      brindisi('Stessi valori · gruppo successivo');
      return radice('flusso', { id: succ.id, tipo });
    }
    brindisi('Non ci sono altri gruppi in questo vaso');
  }
  radice('elenco');
}
