/* SERRA · scheda gruppo — le quattro azioni, e la storia di questo gruppo. */
import * as O from '../operazioni.js';
import { S, registra, vai, rendi, ricarica, gruppo, classe, lotto, qta, costo, perPianta, nomeGruppo,
         tipoInt, lavorazioni } from '../stato.js';
import { $, e, eur, num, dataIT, disegna, testa, vaso, etichette, nascondiBarra, chiedi, brindisi } from '../ui.js';

/* La storia si legge per operazioni: un rinvaso scrive una perdita, un
   trasferimento e una lavorazione, e sono una cosa sola. Si annulla
   tutta insieme o niente. Le righe scritte prima che esistessero le
   operazioni fanno operazione da sole. */
function storia(g){
  const righe = [
    ...S.movimenti.filter(m => m.gruppo === g.id || m.gruppoDa === g.id || m.gruppoA === g.id)
      .map(m => ({ data: m.data, ord: m.creato, op: m.operazione || 'm:' + m.id,
        chiave: m.operazione ? 'op:' + m.operazione : 'm:' + m.id,
        storno: m.storna != null, annullata: S.stornati.has('m' + m.id),
        segno: m.gruppoDa === g.id ? (m.qta < 0 ? '+' : '−') : m.gruppoA === g.id ? (m.qta < 0 ? '−' : '+') : m.qta > 0 ? '+' : m.qta < 0 ? '−' : '·',
        classe: (m.qta < 0) !== (m.gruppoDa === g.id) ? 'meno' : 'piu',
        tag: m.tipo,
        txt: m.tipo === 'trasferimento'
          ? `<b>${Math.abs(m.qta)}</b> piante ${(m.gruppoDa === g.id) !== (m.qta < 0) ? 'uscite' : 'entrate'}` +
            (m.costo ? ` · ${eur(Math.abs(m.costo))} di costo` : '')
          : `<b>${m.qta > 0 ? '+' : ''}${m.qta}</b> piante` +
            (m.valore ? ` · incasso ${m.valore < 0 ? 'restituito ' : ''}${eur(Math.abs(m.valore))}` : '') })),
    ...S.eventi.filter(x => x.gruppo === g.id).map(x => ({
      data: x.data, ord: x.creato, op: x.operazione || 'e:' + x.id,
      chiave: x.operazione ? 'op:' + x.operazione : 'e:' + x.id,
      storno: x.storna != null, annullata: S.stornati.has('e' + x.id),
      segno: '●', classe: '', tag: (tipoInt(x.tipo) || { nome: x.tipo }).nome,
      txt: `${x.piante || ''} piante · ${num(x.ore)} h · ${eur((x.costoMateriali || 0) + (x.ore || 0) * (x.tariffa ?? 0))}` })),
  ].sort((a, b) => (b.ord || '').localeCompare(a.ord || ''));
  if (!righe.length) return '';

  /* raggruppate per operazione, nell'ordine in cui sono avvenute */
  const ops = [];
  for (const r of righe){
    let o = ops.find(x => x.op === r.op);
    if (!o){ o = { op: r.op, chiave: r.chiave, data: r.data, righe: [] }; ops.push(o); }
    o.righe.push(r);
  }

  return `<div class="eyebrow" style="margin-top:26px">storia del gruppo</div>
    ${ops.map(o => {
      const storno = o.righe.some(r => r.storno), annullata = o.righe.every(r => r.annullata);
      const azione = storno ? '<span class="pill gri">storno</span>'
        : annullata ? '<span class="pill no">annullata</span>'
        : `<button class="mini" data-annulla="${e(o.chiave)}">annulla</button>`;
      return `<div class="storia operazione ${storno || annullata ? 'spenta' : ''}">
        <div class="op-testa"><span class="data">${dataIT(o.data)}</span>${azione}</div>
        ${o.righe.map(r => `<div class="voce">
          <span class="segno ${r.classe}">${r.segno}</span>
          <span class="txt"><span class="tag">${r.storno ? 'storno · ' : ''}${e(r.tag)}</span>${r.txt}</span></div>`).join('')}
      </div>`;
    }).join('')}`;
}

/* ---- annullare: prima si dice tutto quello che l'operazione ha toccato ---- */
async function annulla(chiave){
  const [tipo, id] = [chiave.slice(0, chiave.indexOf(':')), chiave.slice(chiave.indexOf(':') + 1)];
  const arg = tipo === 'op' ? { operazione: id } : tipo === 'm' ? { movimento: +id } : { evento: +id };
  const righe = await O.righeOperazione(arg);

  const toccati = new Set();
  righe.movimenti.forEach(m => [m.gruppo, m.gruppoDa, m.gruppoA].forEach(x => x != null && toccati.add(x)));
  righe.eventi.forEach(x => toccati.add(x.gruppo));
  const nomi = [...toccati].map(x => gruppo(x)).filter(Boolean)
    .map(x => `${nomeGruppo(x)} · ${x.classe}`);
  const cosa = [
    ...righe.movimenti.map(m => m.tipo === 'trasferimento' ? `trasferimento di ${m.qta} piante`
      : `${m.tipo} di ${Math.abs(m.qta)} piante${m.valore ? ' (incasso ' + eur(m.valore) + ')' : ''}`),
    ...righe.eventi.map(x => `${(tipoInt(x.tipo) || { nome: x.tipo }).nome} · ${eur((x.costoMateriali || 0) + (x.ore || 0) * (x.tariffa ?? 0))}`),
  ];
  const unione = righe.eventi.some(x => x.dettagli && x.dettagli.unione);

  const ok = await chiedi('Annullare questa operazione?',
    `<b>${cosa.map(e).join('<br>')}</b><br><br>
     ${nomi.length > 1 ? `Tocca ${nomi.length} gruppi: ${nomi.map(e).join(', ')}. Si annulla su tutti.<br><br>` : ''}
     ${unione ? 'Le piante tornano al gruppo da cui venivano, ma le etichette cadute con l’unione non tornano.<br><br>' : ''}
     Niente si cancella: accanto a ogni riga ne scrivo una uguale e contraria, e nella storia
     restano tutte e due.`, 'Annulla operazione');
  if (!ok) return;
  try {
    await O.storna(arg);
    await ricarica();
    brindisi('Operazione annullata');
    rendi();
  } catch (err){ brindisi(err.message); }
}

registra('gruppo', ({ id }) => {
  const g = gruppo(id);
  if (!g) return vai('home');
  const cl = classe(g.classe), L = lotto(g.lotto), n = qta(g);

  testa({ titolo: g.aperto ? 'Gruppo' : 'Gruppo chiuso', indietro: true });
  nascondiBarra();

  const azioni = g.aperto ? `<div class="azioni">
      <button class="azione" data-a="rinvaso"><i>🌳</i>Rinvaso<u>conta, smista, registra</u></button>
      <button class="azione" data-a="conteggio"><i>🔢</i>Conteggio<u>aggiorna la giacenza</u></button>
      <button class="azione" data-a="vendita"><i>💰</i>Vendita<u>quantità e prezzo</u></button>
      <button class="azione" data-a="intervento"><i>✂️</i>Intervento<u>potatura, concime, filo…</u></button></div>`
    : `<div class="avviso">Questo gruppo è vuoto e chiuso. La sua storia resta leggibile
       e i movimenti continuano a puntarci.</div>`;

  disegna(`<div class="scheda">
    <div style="display:flex;align-items:center;gap:14px">
      ${vaso(cl, 58, ';font-size:13px')}
      <div><div class="titolone">${e(nomeGruppo(g))}</div>
        <div class="specie">${e(L.specie)} · vaso ${e(cl.etichetta)}</div>
        ${etichette(g)}</div></div>
    <div class="cifre">
      <div class="cifra"><b>${n}</b><span>in questo vaso</span></div>
      <div class="cifra"><b>${lavorazioni(g.id)}</b><span>lavorazioni</span></div>
      <div class="cifra"><b>${eur(perPianta(g))}</b><span>costo/pianta</span></div></div>
    ${azioni}
    <button class="linkotto" id="v-lotto">Vedi tutto il lotto ›</button>
    ${storia(g)}
    <div class="piede">Costo accumulato ${eur(costo(g))}.
      La perdita non lo scarica: resta sulle sopravvissute.</div>
  </div>`);

  document.querySelectorAll('.azione[data-a]').forEach(b =>
    b.onclick = () => vai('flusso', { id: g.id, tipo: b.dataset.a }));
  $('v-lotto').onclick = () => vai('lotto', { codice: g.lotto });
  document.querySelectorAll('[data-annulla]').forEach(b => b.onclick = () => annulla(b.dataset.annulla));
});
