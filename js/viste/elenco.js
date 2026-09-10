/* VIVAIO · elenco di una zona — cosa ho davanti adesso. § 5.2
   Nursery: le vaschette. Produzione: tutto quello che sta in vaso.
   Una riga per gruppo, non per lotto: lo stesso lotto compare più volte
   se le sue piante stanno in classi diverse. Non è un errore, è il punto. */
import { S, registra, vai, rendi, aperti, classe, lotto, qta, ordineCl, nomeGruppo } from '../stato.js';
import { $, e, disegna, testa, vaso, etichette, nascondiBarra } from '../ui.js';

const ZONE = {
  nursery:    { titolo: 'Nursery',    dentro: g => g.classe === 'VAS', unita: 'talee',
                vuoto: 'Nessuna vaschetta.<br>Il primo lotto si crea con ＋ qui sopra.' },
  produzione: { titolo: 'Produzione', dentro: g => g.classe !== 'VAS', unita: 'piante',
                vuoto: 'Niente in vaso, per ora.<br>Le piante arrivano qui col primo rinvaso dalla nursery.' },
};
/* in vaschetta la classe è una sola: ordinare per vaso non direbbe niente */
const ordine = { nursery: 'lotto', produzione: 'vaso' };
let filtro = '';

const lavorazioni = id => S.eventi.filter(x => x.gruppo === id).length;

registra('elenco', ({ zona = 'produzione' } = {}) => {
  const Z = ZONE[zona] || ZONE.produzione;
  const ord = ordine[zona];
  const lista = aperti().filter(Z.dentro).filter(g => {
    const t = (g.lotto + ' ' + lotto(g.lotto).specie + ' ' + g.classe + ' ' + (g.suffisso || '')).toLowerCase();
    return t.includes(filtro.toLowerCase());
  });
  if (ord === 'vaso')  lista.sort((a, b) => ordineCl(a.classe) - ordineCl(b.classe) || a.lotto.localeCompare(b.lotto));
  if (ord === 'lotto') lista.sort((a, b) => a.lotto.localeCompare(b.lotto) || ordineCl(a.classe) - ordineCl(b.classe)
                                         || (a.suffisso || '').localeCompare(b.suffisso || ''));
  if (ord === 'qta')   lista.sort((a, b) => qta(b) - qta(a));

  testa({ titolo: Z.titolo, indietro: true, nuovo: zona === 'nursery',
    contatore: lista.length + ' gruppi · ' + lista.reduce((s, g) => s + qta(g), 0) + ' ' + Z.unita });
  nascondiBarra();

  let h = `<div class="strumenti">
    <input class="cerca" id="cerca" placeholder="lotto o specie…" value="${e(filtro)}">
    <select class="ordina" id="ord">
      ${zona === 'produzione' ? `<option value="vaso"${ord === 'vaso' ? ' selected' : ''}>Vaso</option>` : ''}
      <option value="lotto"${ord === 'lotto' ? ' selected' : ''}>Lotto</option>
      <option value="qta"${ord === 'qta' ? ' selected' : ''}>Quantità</option>
    </select></div><div class="elenco">`;

  if (!lista.length) h += filtro
    ? `<div class="vuoto">Nessun gruppo con questo filtro.</div>`
    : `<div class="vuoto">${Z.vuoto}</div>`;

  let ultima = null;
  lista.forEach(g => {
    const cl = classe(g.classe);
    if (ord === 'vaso' && g.classe !== ultima){
      ultima = g.classe;
      const n = lista.filter(x => x.classe === g.classe).reduce((s, x) => s + qta(x), 0);
      h += `<div class="sep"><span>Vaso ${e(cl.etichetta)}</span><span>${n} piante</span></div>`;
    }
    if (ord === 'lotto' && g.lotto !== ultima){
      ultima = g.lotto;
      const n = lista.filter(x => x.lotto === g.lotto).reduce((s, x) => s + qta(x), 0);
      h += `<div class="sep"><span>${e(g.lotto)} · ${e(lotto(g.lotto).specie)}</span><span>${n} ${Z.unita}</span></div>`;
    }
    h += `<button class="riga" data-g="${g.id}">
      ${vaso(cl, 38)}
      <span class="id"><span class="codice">${e(nomeGruppo(g))}</span>
        <span class="sotto">${e(lotto(g.lotto).specie)} · ${lavorazioni(g.id)} lav.</span>
        ${etichette(g)}</span>
      <span class="qta">${qta(g)}<small>${Z.unita}</small></span></button>`;
  });

  disegna(h + '</div>');
  $('cerca').oninput = ev => {
    filtro = ev.target.value;
    const p = ev.target.selectionStart;
    rendi();
    const n = $('cerca'); n.focus(); n.setSelectionRange(p, p);
  };
  $('ord').onchange = ev => { ordine[zona] = ev.target.value; rendi(); };
  document.querySelectorAll('.riga[data-g]').forEach(b =>
    b.onclick = () => vai('gruppo', { id: +b.dataset.g }));
});
