/* SERRA · scheda gruppo — le quattro azioni, e la storia di questo gruppo. */
import { S, registra, vai, gruppo, classe, lotto, qta, costo, perPianta, nomeGruppo } from '../stato.js';
import { $, e, eur, num, dataIT, disegna, testa, vaso, etichette, nascondiBarra } from '../ui.js';

const SEGNI = { apertura:'+', attecchimento:'+', rettifica:'+', perdita:'−',
                vendita:'−', ceduto:'−', trasferimento:'↔' };

function storia(g){
  const righe = [
    ...S.movimenti.filter(m => m.gruppo === g.id || m.gruppoDa === g.id || m.gruppoA === g.id)
      .map(m => ({ data: m.data, ord: m.creato,
        segno: m.gruppoDa === g.id ? '−' : m.gruppoA === g.id ? '+' : SEGNI[m.tipo] || '·',
        classe: (m.qta < 0 || m.gruppoDa === g.id) ? 'meno' : 'piu',
        tag: m.tipo,
        txt: m.tipo === 'trasferimento'
          ? `<b>${m.qta}</b> piante ${m.gruppoDa === g.id ? 'uscite' : 'entrate'}` +
            (m.costo ? ` · ${eur(m.gruppoDa === g.id ? -m.costo : m.costo)} di costo` : '')
          : `<b>${m.qta > 0 ? '+' : ''}${m.qta}</b> piante` +
            (m.valore ? ` · incasso ${eur(m.valore)}` : '') })),
    ...S.eventi.filter(x => x.gruppo === g.id).map(x => ({
      data: x.data, ord: x.creato, segno: '●', classe: '', tag: x.tipo,
      txt: `${x.piante || ''} piante · ${num(x.ore)} h · ${eur((x.costoMateriali || 0) + (x.ore || 0) * (x.tariffa ?? 0))}` })),
  ].sort((a, b) => (b.ord || '').localeCompare(a.ord || ''));

  if (!righe.length) return '';
  return `<div class="eyebrow" style="margin-top:26px">storia del gruppo</div>
    <div class="storia">${righe.map(r => `<div class="voce">
      <span class="segno ${r.classe}">${r.segno}</span>
      <span class="txt"><span class="tag">${e(r.tag)}</span>
        <span class="data">${dataIT(r.data)}</span>${r.txt}</span></div>`).join('')}</div>`;
}

registra('gruppo', ({ id }) => {
  const g = gruppo(id);
  if (!g) return vai('elenco');
  const cl = classe(g.classe), L = lotto(g.lotto), n = qta(g);

  testa({ titolo: g.aperto ? 'Gruppo' : 'Gruppo chiuso', indietro: true });
  nascondiBarra();

  const azioni = g.aperto ? `<div class="azioni">
      <button class="azione" data-a="rinvaso"><i>🪴</i>Rinvaso<u>conta, smista, registra</u></button>
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
      <div class="cifra"><b>${S.eventi.filter(x => x.gruppo === g.id).length}</b><span>lavorazioni</span></div>
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
});
