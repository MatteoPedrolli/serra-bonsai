/* SERRA · elenco dei lotti — anche quelli senza più piante in serra. */
import { S, registra, vai, qta, costo } from '../stato.js';
import { e, eur, dataIT, disegna, testa, nascondiBarra } from '../ui.js';

registra('lotti', () => {
  testa({ titolo: 'Lotti', indietro: true, contatore: S.lotti.length + ' lotti' });
  nascondiBarra();
  const righe = S.lotti.slice().sort((a, b) => b.id.localeCompare(a.id)).map(L => {
    const gr = S.gruppi.filter(g => g.lotto === L.id);
    const vive = gr.reduce((s, g) => s + qta(g), 0);
    const c = gr.reduce((s, g) => s + costo(g), 0);
    return `<button class="riga" data-l="${e(L.id)}">
      <span class="id"><span class="codice">${e(L.id)}</span>
        <span class="sotto">${e(L.specie)} · ${e(L.origine || '')} ${dataIT(L.dataIngresso)}</span></span>
      <span class="qta">${vive}<small>di ${L.inserite || '?'}</small></span></button>`;
  }).join('');
  disegna(`<div class="elenco">${righe || '<div class="vuoto">Nessun lotto.</div>'}</div>`);
  document.querySelectorAll('[data-l]').forEach(b =>
    b.onclick = () => vai('lotto', { codice: b.dataset.l }));
});
