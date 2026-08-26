/* SERRA · vista Serra — cosa ho davanti adesso. § 5.2
   Una riga per gruppo, non per lotto: lo stesso lotto compare più volte
   se le sue piante stanno in classi diverse. Non è un errore, è il punto. */
import { S, registra, vai, rendi, aperti, classe, lotto, qta, ordineCl, nomeGruppo } from '../stato.js';
import { $, e, disegna, testa, vaso, etichette, nascondiBarra } from '../ui.js';

let ordine = 'vaso', filtro = '';

function lavorazioni(id){ return S.eventi.filter(x => x.gruppo === id).length; }

registra('elenco', () => {
  const lista = aperti().filter(g => {
    const t = (g.lotto + ' ' + lotto(g.lotto).specie + ' ' + g.classe + ' ' + (g.suffisso || '')).toLowerCase();
    return t.includes(filtro.toLowerCase());
  });
  if (ordine === 'vaso')  lista.sort((a, b) => ordineCl(a.classe) - ordineCl(b.classe) || a.lotto.localeCompare(b.lotto));
  if (ordine === 'lotto') lista.sort((a, b) => a.lotto.localeCompare(b.lotto) || ordineCl(a.classe) - ordineCl(b.classe));
  if (ordine === 'qta')   lista.sort((a, b) => qta(b) - qta(a));

  testa({ titolo: 'Serra', config: true, nuovo: true,
    contatore: lista.length + ' gruppi · ' + lista.reduce((s, g) => s + qta(g), 0) + ' piante' });
  nascondiBarra();

  let h = `<div class="strumenti">
    <input class="cerca" id="cerca" placeholder="lotto o specie…" value="${e(filtro)}">
    <select class="ordina" id="ord">
      <option value="vaso"${ordine === 'vaso' ? ' selected' : ''}>Vaso</option>
      <option value="lotto"${ordine === 'lotto' ? ' selected' : ''}>Lotto</option>
      <option value="qta"${ordine === 'qta' ? ' selected' : ''}>Quantità</option>
    </select></div><div class="elenco">`;

  if (!lista.length) h += S.gruppi.length
    ? `<div class="vuoto">Nessun gruppo con questo filtro.</div>`
    : `<div class="vuoto">La serra è vuota.<br>Il primo lotto si crea con ＋ qui sopra.</div>`;

  let ultima = null;
  lista.forEach(g => {
    const cl = classe(g.classe);
    if (ordine === 'vaso' && g.classe !== ultima){
      ultima = g.classe;
      const n = lista.filter(x => x.classe === g.classe).reduce((s, x) => s + qta(x), 0);
      h += `<div class="sep"><span>Vaso ${e(cl.etichetta)}</span><span>${n} piante</span></div>`;
    }
    if (ordine === 'lotto' && g.lotto !== ultima){
      ultima = g.lotto;
      const n = aperti().filter(x => x.lotto === g.lotto).reduce((s, x) => s + qta(x), 0);
      h += `<div class="sep"><span>${e(g.lotto)}</span><span>${n} piante in tutto</span></div>`;
    }
    h += `<button class="riga" data-g="${g.id}">
      ${vaso(cl, 38)}
      <span class="id"><span class="codice">${e(nomeGruppo(g))}</span>
        <span class="sotto">${e(lotto(g.lotto).specie)} · ${lavorazioni(g.id)} lav.</span>
        ${etichette(g)}</span>
      <span class="qta">${qta(g)}<small>piante</small></span></button>`;
  });

  h += `</div><div class="scheda" style="padding-top:0">
    <button class="linkotto" id="v-lotti">Tutti i lotti ›</button>
    <button class="linkotto" id="v-analisi" style="margin-left:18px">Analisi ›</button>
    <div class="piede">Una riga per gruppo: lo stesso lotto compare più volte se le sue piante
      stanno in classi di vaso diverse.</div></div>`;

  disegna(h);
  $('v-lotti').onclick = () => vai('lotti');
  $('v-analisi').onclick = () => vai('analisi');
  $('cerca').oninput = ev => {
    filtro = ev.target.value;
    const p = ev.target.selectionStart;
    rendi();
    const n = $('cerca'); n.focus(); n.setSelectionRange(p, p);
  };
  $('ord').onchange = ev => { ordine = ev.target.value; rendi(); };
  document.querySelectorAll('.riga[data-g]').forEach(b =>
    b.onclick = () => vai('gruppo', { id: +b.dataset.g }));
});

