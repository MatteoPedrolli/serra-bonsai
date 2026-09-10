/* VIVAIO · home — da qui si parte per tutto il resto.
   Nursery e produzione sono due posti diversi, anche se il modello dati
   non ha bisogno di saperlo: lo dice il vaso. § 11 */
import { registra, vai, aperti, qta, esiste } from '../stato.js';
import { disegna, testa, nascondiBarra } from '../ui.js';

registra('home', () => {
  const tutti = aperti();
  const nursery = tutti.filter(g => g.classe === 'VAS');
  const produzione = tutti.filter(g => g.classe !== 'VAS');
  const piante = l => l.reduce((s, g) => s + qta(g), 0);
  const nLotti = l => new Set(l.map(g => g.lotto)).size;

  testa({ titolo: 'Vivaio', nuovo: true, contatore: `${piante(tutti)} piante` });
  nascondiBarra();

  disegna(`<div class="scheda home">
    <div class="azioni">
      <button class="azione zona" data-v="nursery"><i>🌱</i>
        <span class="z-t">Nursery<u>${nursery.length} vaschette · ${nLotti(nursery)} lotti</u></span>
        <b class="z-n">${piante(nursery)}<small>talee</small></b></button>
      <button class="azione zona" data-v="produzione"><i>🌳</i>
        <span class="z-t">Produzione<u>${produzione.length} gruppi · ${nLotti(produzione)} lotti</u></span>
        <b class="z-n">${piante(produzione)}<small>piante</small></b></button>
      ${esiste('intervento') ? '<button class="azione" data-v="intervento"><i>✂️</i>Intervento<u>su un gruppo o su tutti</u></button>' : ''}
      ${esiste('inventario') ? '<button class="azione" data-v="inventario"><i>📋</i>Inventario<u>conta e convalida</u></button>' : ''}
      <button class="azione" data-v="analisi"><i>📊</i>Analisi<u>rese, costi, margini</u></button>
      <button class="azione" data-v="lotti"><i>🏷️</i>Lotti<u>anche quelli finiti</u></button>
      <button class="azione" data-v="config"><i>⚙️</i>Impostazioni<u>costi, miscele, copie</u></button>
    </div>
  </div>`);

  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    const v = b.dataset.v;
    if (v === 'nursery' || v === 'produzione') return vai('elenco', { zona: v });
    vai(v);
  });
});
