/* VIVAIO · modifica dell'anagrafica di un lotto
   Specie, provenienza, date e note si correggono qui, e si riscrivono: sono
   descrizioni, non quantità. Il codice no — è scritto sulle etichette nei
   vasi — e nemmeno le piante: quelle si correggono contando. § 1 */
import { db } from '../db.js';
import { S, registra, torna, ricarica, lotto } from '../stato.js';
import { e, disegna, testa, barraTasti, brindisi, campoNum } from '../ui.js';

const ORIGINI = ['talea', 'seme', 'acquisto', 'raccolta', 'margotta'];
let bozza = null;

registra('modificaLotto', ({ codice }) => {
  const L = lotto(codice);
  if (!bozza || bozza.id !== codice)
    bozza = { ...L, condizioni: { tempMin: '', tempMax: '', umidMin: '', umidMax: '', ...(L.condizioni || {}) } };

  testa({ titolo: 'Modifica lotto', indietro: true });
  barraTasti('Salva', salva, null, null, !!(bozza.specie || '').trim());

  const testo = (id, et, k, ph = '') => `<div class="campo" style="margin-top:14px"><label for="${id}">${et}</label>
    <input id="${id}" type="text" value="${e(bozza[k] || '')}" data-k="${k}" placeholder="${e(ph)}"
      style="font-family:var(--sans);font-size:16px"></div>`;

  disegna(`<div class="corpo">
    <div class="eyebrow">codice</div>
    <div class="anteprima">${e(codice)}</div>
    <div class="nota" style="margin-top:0">Il codice non si cambia: è scritto sulle etichette nei vasi.
      Le quantità nemmeno — se non tornano, si correggono con un conteggio.</div>

    ${testo('m-specie', 'Specie', 'specie', 'Acer palmatum')}
    ${testo('m-bot', 'Nome botanico', 'nomeBotanico', 'facoltativo')}
    <div class="duecampi" style="margin-top:14px">
      <div class="campo"><label for="m-orig">Origine</label>
        <select id="m-orig" data-k="origine">${ORIGINI.map(o =>
          `<option value="${o}"${bozza.origine === o ? ' selected' : ''}>${o}</option>`).join('')}</select></div>
      <div class="campo"><label for="m-data">Data d'ingresso</label>
        <input id="m-data" type="date" value="${e(bozza.dataIngresso || '')}" data-k="dataIngresso"
          style="font-family:var(--mono);font-size:16px"></div></div>
    ${testo('m-prov', 'Provenienza', 'provenienza', 'pianta madre, vivaio, luogo')}

    <div class="eyebrow" style="margin-top:24px">condizioni · facoltative</div>
    <div class="duecampi">
      ${campoNum('m-tmin', 'Temp. min °C', bozza.condizioni.tempMin, 1, 'data-c="tempMin"')}
      ${campoNum('m-tmax', 'Temp. max °C', bozza.condizioni.tempMax, 1, 'data-c="tempMax"')}</div>
    <div class="duecampi" style="margin-top:12px">
      ${campoNum('m-umin', 'Umidità min %', bozza.condizioni.umidMin, 1, 'data-c="umidMin"')}
      ${campoNum('m-umax', 'Umidità max %', bozza.condizioni.umidMax, 1, 'data-c="umidMax"')}</div>

    <div class="campo" style="margin-top:14px"><label for="m-note">Note</label>
      <textarea id="m-note" data-k="note">${e(bozza.note || '')}</textarea></div>
  </div>`);

  document.querySelectorAll('[data-k]').forEach(el =>
    el.onchange = ev => { bozza[el.dataset.k] = ev.target.value; });
  document.querySelectorAll('[data-c]').forEach(el =>
    el.onchange = ev => { bozza.condizioni[el.dataset.c] = ev.target.value === '' ? '' : +ev.target.value; });
});

async function salva(){
  /* i campi non ancora usciti dal fuoco si leggono adesso */
  document.querySelectorAll('[data-k]').forEach(el => { bozza[el.dataset.k] = el.value; });
  const cond = Object.fromEntries(Object.entries(bozza.condizioni)
    .filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, +v]));
  await db.lotti.update(bozza.id, {
    specie: bozza.specie.trim(), nomeBotanico: bozza.nomeBotanico || '', origine: bozza.origine,
    dataIngresso: bozza.dataIngresso, provenienza: bozza.provenienza || '', note: bozza.note || '',
    condizioni: Object.keys(cond).length ? cond : undefined,
  });
  bozza = null;
  await ricarica();
  brindisi('Lotto aggiornato');
  torna();
}
