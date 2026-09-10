/* ============================================================
   VIVAIO · Inventario — contare tutto, una volta ogni tanto
   Le perdite emergono dal conteggio (§ 1). Il rinvaso le fa emergere
   gruppo per gruppo; l'inventario le fa emergere tutte insieme, dove un
   gruppo non è stato toccato da mesi.

   Il giro segue l'ordine dei bancali — zona, vaso, lotto — e si può
   interrompere: ogni numero resta salvato. Non scrive niente finché non
   confermi alla fine, e prima di scrivere mette da parte un'istantanea.
   ============================================================ */
import { db, adesso } from '../db.js';
import * as O from '../operazioni.js';
import * as B from '../backup.js';
import { S, registra, radice, ricarica, aperti, gruppo, classe, lotto, qta, ordineCl, nomeGruppo } from '../stato.js';
import { $, e, disegna, testa, vaso, etichette, barraTasti, nascondiBarra, brindisi, chiedi, dataIT } from '../ui.js';

const ZONE = {
  nursery:    { nome: 'Nursery',         dentro: g => g.classe === 'VAS' },
  produzione: { nome: 'Produzione',      dentro: g => g.classe !== 'VAS' },
  tutto:      { nome: 'Tutto il vivaio', dentro: () => true },
};

let giro = null;          /* la sessione: { zona, ids, conte: {id: {contate, vigore, attese}}, pos } */
let schermo = 'inizio';

/* la home deve sapere che c'è un giro aperto senza rileggere tutto l'archivio */
const salvaGiro = () => { S.inventarioInCorso = giro; return db.meta.put({ chiave: 'inventario', valore: giro }); };
const leggiGiro = async () => { const r = await db.meta.get('inventario'); return r ? r.valore : null; };

/* l'ordine del giro: prima la nursery, poi i vasi dal più piccolo, poi il lotto */
function ordina(gruppi){
  return gruppi.slice().sort((a, b) =>
    (a.classe === 'VAS' ? 0 : 1) - (b.classe === 'VAS' ? 0 : 1)
    || ordineCl(a.classe) - ordineCl(b.classe)
    || a.lotto.localeCompare(b.lotto)
    || (a.suffisso || '').localeCompare(b.suffisso || ''));
}

const contati = () => giro ? Object.keys(giro.conte).length : 0;
/* i gruppi del giro ancora aperti: uno venduto a metà inventario esce dal conto */
const vivi = () => giro ? giro.ids.filter(id => { const g = gruppo(id); return g && g.aperto; }) : [];

registra('inventario', async () => {
  giro = await leggiGiro();
  schermo = 'inizio';
  disegnaSchermo();
});

export function indietroInventario(){
  if (schermo === 'giro' && giro && giro.pos > 0){ giro.pos--; salvaGiro(); disegnaSchermo(); return true; }
  if (schermo === 'giro' || schermo === 'riepilogo'){ schermo = 'inizio'; disegnaSchermo(); return true; }
  return false;
}

function disegnaSchermo(){
  ({ inizio, giro: passoGiro, riepilogo })[schermo]();
  collega();
}

const AZ = {};
function collega(){
  document.querySelectorAll('[data-az]').forEach(el => {
    const [nome, arg] = el.dataset.az.split(':');
    const fn = AZ[nome]; if (!fn) return;
    if (el.tagName === 'INPUT') el.onchange = ev => fn(arg, ev.target.value);
    else el.onclick = () => fn(arg);
  });
}

/* ---------- inizio ---------- */
function inizio(){
  testa({ titolo: 'Inventario', indietro: true });
  nascondiBarra();
  const ultimo = S.ultimoInventario;
  let h = `<div class="corpo">
    <div class="eyebrow">ultimo inventario</div>
    <div class="domanda">${ultimo ? dataIT(ultimo.slice(0, 10)) : 'Mai fatto.'}</div>`;

  if (giro){
    const n = vivi().length;
    h += `<div class="elenco" style="padding:0">
      <button class="riga" data-az="riprendi:">
        <span class="id"><span class="codice" style="font-family:var(--sans)">Riprendi il giro</span>
          <span class="sotto">${e(ZONE[giro.zona].nome)} · iniziato il ${dataIT(giro.avviato.slice(0, 10))}</span></span>
        <span class="qta">${contati()}<small>di ${n}</small></span></button>
      <button class="riga" data-az="riepilogo:">
        <span class="id"><span class="codice" style="font-family:var(--sans)">Vedi il riepilogo e chiudi</span>
          <span class="sotto">le differenze trovate finora</span></span><span class="qta">›</span></button>
      </div>
      <button class="aggiungi" data-az="butta:">Butta via questo giro e ricomincia</button>`;
  } else {
    h += `<div class="eyebrow" style="margin-top:8px">che cosa conti</div><div class="elenco" style="padding:0">`;
    for (const [k, z] of Object.entries(ZONE)){
      const l = aperti().filter(z.dentro);
      if (!l.length) continue;
      h += `<button class="riga" data-az="inizia:${k}">
        <span class="id"><span class="codice" style="font-family:var(--sans)">${e(z.nome)}</span>
          <span class="sotto">${l.length} gruppi</span></span>
        <span class="qta">${l.reduce((s, g) => s + qta(g), 0)}<small>piante</small></span></button>`;
    }
    h += `</div>`;
  }

  h += `<div class="nota">Si passa gruppo per gruppo nell'ordine dei bancali: prima le vaschette,
    poi i vasi dal più piccolo. Per ognuno confermi il numero o lo correggi. Puoi fermarti e
    riprendere quando vuoi: i numeri restano salvati. <b>Niente viene scritto</b> finché non
    confermi alla fine, e prima di scrivere l'app mette da parte un'istantanea.</div></div>`;
  disegna(h);
}

AZ.inizia = async zona => {
  const ids = ordina(aperti().filter(ZONE[zona].dentro)).map(g => g.id);
  giro = { zona, ids, conte: {}, pos: 0, avviato: adesso() };
  await salvaGiro();
  schermo = 'giro'; disegnaSchermo();
};
AZ.riprendi = () => {
  /* si riparte dal primo gruppo non ancora contato */
  const l = vivi(), i = l.findIndex(id => !giro.conte[id]);
  giro.pos = i < 0 ? Math.max(0, l.length - 1) : i;
  schermo = 'giro'; disegnaSchermo();
};
AZ.riepilogo = () => { schermo = 'riepilogo'; disegnaSchermo(); };
AZ.butta = async () => {
  const ok = await chiedi('Buttare via il giro?',
    `Hai contato ${contati()} gruppi. Niente è ancora stato scritto: quei numeri si perdono e
     l'archivio resta com'era.`, 'Butta via');
  if (!ok) return;
  giro = null; S.inventarioInCorso = null; await db.meta.delete('inventario');
  schermo = 'inizio'; disegnaSchermo();
};

/* ---------- il giro, un gruppo alla volta ---------- */
function passoGiro(){
  const l = vivi();
  if (!l.length){ schermo = 'riepilogo'; return riepilogo(); }
  giro.pos = Math.min(giro.pos, l.length - 1);
  const g = gruppo(l[giro.pos]), cl = classe(g.classe), attese = qta(g);
  const c = giro.conte[g.id];
  const contate = c ? c.contate : attese;
  const d = contate - attese;

  testa({ titolo: 'Inventario', indietro: true, contatore: `${giro.pos + 1} di ${l.length}` });
  barraTasti(giro.pos + 1 < l.length ? 'Avanti' : 'Fine giro', AZ.avanti, 'Salta', AZ.salta);

  const esito = d < 0 ? `<div class="esito perdita">− ${-d} · diventeranno una perdita</div>`
    : d > 0 ? `<div class="esito perdita">+ ${d} in più delle attese · verifica</div>`
    : `<div class="esito pari">Tornano</div>`;

  disegna(`<div class="passi"><div class="tacca on" style="flex:none;width:${
      Math.round(contati() / l.length * 100)}%"></div><div class="tacca" style="flex:1"></div></div>
    <div class="corpo">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        ${vaso(cl, 56, ';font-size:12px')}
        <div style="min-width:0"><div class="titolone" style="font-size:22px">${e(nomeGruppo(g))}</div>
          <div class="specie">${e(lotto(g.lotto).specie)} · vaso ${e(cl.etichetta)}</div>
          ${etichette(g)}</div></div>
      <div class="conta"><div class="att">attese<b>${attese}</b></div><div class="freccia">›</div>
        <input class="numerone" id="i-conta" type="number" inputmode="numeric" min="0" value="${contate}"
          data-az="conta:"></div>
      ${esito}
      <div class="passo-tasti">
        <button class="mini" data-az="conta:${attese}">tutte ${attese}</button>
        <button class="mini" data-az="conta:${Math.max(0, contate - 1)}">−1</button>
        <button class="mini" data-az="conta:${contate + 1}">+1</button></div>
      <div class="eyebrow" style="margin-top:22px">vigore · se ti va</div>
      <div class="passo-tasti">${[1, 2, 3, 4, 5].map(v =>
        `<button class="mini ${c && c.vigore === v ? 'on' : ''}" data-az="vigore:${v}">${v}</button>`).join('')}</div>
      ${c ? '' : '<div class="nota">Non ancora contato: Avanti conferma il numero che vedi.</div>'}
    </div>`);
}

function registraConta(v){
  const g = gruppo(vivi()[giro.pos]);
  const c = giro.conte[g.id] || {};
  giro.conte[g.id] = { ...c, contate: Math.max(0, v), attese: qta(g), quando: adesso() };
  salvaGiro();
}
AZ.conta = (arg, val) => { registraConta(+(arg !== '' ? arg : val) || 0); disegnaSchermo(); };
AZ.vigore = v => {
  const g = gruppo(vivi()[giro.pos]);
  if (!giro.conte[g.id]) registraConta(qta(g));
  giro.conte[g.id].vigore = giro.conte[g.id].vigore === +v ? null : +v;
  salvaGiro(); disegnaSchermo();
};
AZ.avanti = () => {
  const campo = $('i-conta');
  registraConta(+(campo && campo.value) || 0);
  const l = vivi();
  if (giro.pos + 1 >= l.length){ schermo = 'riepilogo'; return disegnaSchermo(); }
  giro.pos++; salvaGiro(); disegnaSchermo();
};
AZ.salta = () => {
  const l = vivi();
  if (giro.pos + 1 >= l.length){ schermo = 'riepilogo'; return disegnaSchermo(); }
  giro.pos++; salvaGiro(); disegnaSchermo();
};

/* ---------- riepilogo e scrittura ---------- */
function righeRiepilogo(){
  return vivi().filter(id => giro.conte[id]).map(id => {
    const g = gruppo(id), c = giro.conte[id], ora = qta(g);
    return { g, c, ora, diff: c.contate - ora,
             /* il gruppo è cambiato dopo il conteggio: una vendita, un rinvaso */
             cambiato: c.attese !== ora };
  });
}

function riepilogo(){
  const righe = righeRiepilogo(), l = vivi();
  const perse = righe.filter(r => r.diff < 0).reduce((s, r) => s - r.diff, 0);
  const trovate = righe.filter(r => r.diff > 0).reduce((s, r) => s + r.diff, 0);
  const cambiati = righe.filter(r => r.cambiato);
  const diverse = righe.filter(r => r.diff !== 0);

  testa({ titolo: 'Inventario', indietro: true, contatore: `${righe.length} di ${l.length}` });
  if (righe.length) barraTasti('Conferma inventario', AZ.conferma, 'Continua a contare', AZ.continua);
  else nascondiBarra();

  disegna(`<div class="corpo">
    <div class="eyebrow">riepilogo</div>
    <div class="domanda">${righe.length} gruppi contati${l.length > righe.length
      ? `,<br>${l.length - righe.length} saltati` : ''}.</div>
    <div class="cifre">
      <div class="cifra"><b>${righe.length - diverse.length}</b><span>tornano</span></div>
      <div class="cifra"><b>−${perse}</b><span>perse</span></div>
      <div class="cifra"><b>+${trovate}</b><span>in più</span></div></div>
    ${cambiati.length ? `<div class="avviso giallo">${cambiati.length === 1 ? 'Un gruppo è cambiato' : cambiati.length + ' gruppi sono cambiati'}
      da quando li hai contati — una vendita, un rinvaso. Il confronto si fa con la giacenza di adesso:
      se non ti torna, ricontali.</div>` : ''}
    ${diverse.length ? `<div class="eyebrow" style="margin-top:18px">le differenze</div>
      <div class="tabella">${diverse.map(r => `<div class="trg">
        <span class="et">${e(nomeGruppo(r.g))} · ${e(r.g.classe)}<span class="sub">${r.ora} → ${r.c.contate}${
          r.c.vigore ? ' · vigore ' + r.c.vigore : ''}${r.cambiato ? ' · cambiato' : ''}</span></span>
        <span class="vl" style="color:${r.diff < 0 ? 'var(--ruggine)' : 'var(--germoglio)'}">${r.diff > 0 ? '+' : ''}${r.diff}</span></div>`).join('')}
      </div>` : righe.length ? '<div class="avviso">Tutti i numeri tornano.</div>' : ''}
    <div class="nota">Confermando, ogni differenza diventa una perdita o una rettifica, e ogni
      gruppo contato riceve il suo conteggio — anche quelli che tornano: è la prova che li hai
      guardati. I gruppi saltati restano come sono. Il costo delle piante perse resta sulle vive.</div>
  </div>`);
}
AZ.continua = () => { AZ.riprendi(); };

AZ.conferma = async () => {
  const righe = righeRiepilogo();
  const diverse = righe.filter(r => r.diff !== 0).length;
  const ok = await chiedi('Confermare l\'inventario?',
    `${righe.length} conteggi${diverse ? `, ${diverse} con una differenza` : ''}. Prima di scrivere
     prendo un'istantanea: se qualcosa non va, torni indietro da Impostazioni → Dati.`, 'Conferma');
  if (!ok) return;

  await B.istantanea('prima di un inventario');
  const data = adesso().slice(0, 10);
  const piani = righe.map(r => O.pianoConteggio({ gruppo: r.g, attese: r.ora, contate: r.c.contate,
    vigore: r.c.vigore || null, data, note: 'inventario' }));
  await O.esegui({
    tipo: 'inventario', eventi: [], destinazioni: [],
    movimenti: piani.flatMap(p => p.movimenti),
    conteggi: piani.flatMap(p => p.conteggi),
    chiudi: piani.flatMap(p => p.chiudi),
  });
  await db.meta.put({ chiave: 'ultimoInventario', valore: adesso() });
  await db.meta.delete('inventario');
  giro = null;
  await ricarica();
  brindisi(`Inventario chiuso · ${righe.length} gruppi, ${diverse === 1 ? 'una differenza' : diverse + ' differenze'}`);
  radice('home');
};
