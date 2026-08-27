/* ============================================================
   SERRA · app.js — avvio, intestazione, promemoria di backup
   ============================================================ */
import { apri } from './db.js';
import * as B from './backup.js';
import { S, ricarica, radice, vai, torna, nav, imp } from './stato.js';
import { $, e, brindisi } from './ui.js';

import './viste/elenco.js';
import './viste/gruppo.js';
import './viste/lotto.js';
import './viste/lotti.js';
import './viste/flusso.js';
import './viste/nuovoLotto.js';
import './viste/config.js';
import './viste/analisi.js';
import { indietroPasso } from './viste/flusso.js';

$('btn-indietro').onclick = () => {
  if (nav.nome === 'flusso' && indietroPasso()) return;
  torna();
};
$('btn-cfg').onclick   = () => vai('config');
$('btn-nuovo').onclick = () => vai('nuovoLotto');

/* ---- promemoria · § 8: l'export non è un accessorio ----
   Due avvisi diversi: lo spazio che il telefono può ripulire, e le righe
   scritte che non hanno ancora una copia fuori di qui. */
export let spazio = { stato: 'ignoto' };

async function promemoria(){
  const box = $('promemoria');
  let h = '';

  if (spazio.stato === 'a rischio')
    h += `<div class="promemoria rosso">
      <span><b>Lo spazio non è protetto.</b> Il telefono può cancellare l'archivio per fare
      posto. Installa l'app dalla schermata Home: di solito basta quello.</span></div>`;

  const av = await B.backupScaduto(imp('giorniPromemoriaBackup'));
  if (av){
    const quanto = av.mai ? 'Non hai mai salvato una copia fuori da qui'
      : av.righe ? `${av.righe} righe scritte dall'ultima copia`
      : `Ultima copia ${av.giorni} giorni fa`;
    h += `<div class="promemoria"><span>${e(quanto)}.</span>
      <button id="pm-exp">Salva copia</button></div>`;
  }

  box.innerHTML = h;
  const b = $('pm-exp');
  if (b) b.onclick = async () => {
    const r = await B.condividi();
    if (r.via !== 'annullato') brindisi(`${r.righe} righe · ${r.nome}`);
    promemoria();
  };
}

/* ---- avvio ---- */
try {
  await apri();
  /* prima di tutto: chiedere al browser di non buttare via l'archivio */
  spazio = await B.proteggiSpazio();
  await ricarica();
  radice('elenco');
  await B.istantaneaGiornaliera();
  await promemoria();
  window.addEventListener('serra:scritto', promemoria);
} catch (err){
  document.getElementById('main').innerHTML =
    `<div class="corpo"><div class="avviso rosso"><b>Non riesco ad aprire l'archivio.</b><br>
     ${e(err.message)}<br><br>Se stai aprendo il file con doppio clic, servono un server locale
     o GitHub Pages: IndexedDB non funziona da <i>file://</i>.</div></div>`;
  console.error(err);
}

/* ---- PWA: in serra la rete non c'è ---- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('sw.js').catch(() => {});
