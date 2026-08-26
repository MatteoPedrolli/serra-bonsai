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

/* ---- promemoria · § 8: l'export non è un accessorio ---- */
async function promemoria(){
  const av = await B.backupScaduto(imp('giorniPromemoriaBackup'));
  const box = $('promemoria');
  if (!av){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="promemoria">
    <span>${av.mai ? 'Non hai mai esportato: i dati stanno solo qui.'
      : `Ultimo backup ${av.giorni} giorni fa.`}</span>
    <button id="pm-exp">Esporta</button></div>`;
  $('pm-exp').onclick = async () => {
    const { testo, nome, righe } = await B.esporta();
    const url = URL.createObjectURL(new Blob([testo], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    brindisi(`Esportate ${righe} righe`);
    promemoria();
  };
}

/* ---- avvio ---- */
try {
  await apri();
  await ricarica();
  radice('elenco');
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
