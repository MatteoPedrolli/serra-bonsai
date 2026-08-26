/* SERRA · vista Lotto — come sta andando questa coorte. § 5.1 */
import { S, registra, vai, classe, lotto, qta, costo, ordineCl, nomeGruppo } from '../stato.js';
import { $, e, eur, num, dataIT, disegna, testa, etichette, nascondiBarra } from '../ui.js';

const COL = ['#3F7D20', '#5B9A38', '#7CB55B', '#9CCF83', '#BCE3AA', '#6E8F5A'];

registra('lotto', ({ codice }) => {
  const L = lotto(codice);
  const gr = S.gruppi.filter(g => g.lotto === codice)
    .sort((a, b) => ordineCl(a.classe) - ordineCl(b.classe) || (a.suffisso || '').localeCompare(b.suffisso || ''));
  const vivi = gr.filter(g => qta(g) > 0);
  const mov = S.movimenti.filter(m => m.lotto === codice);

  const vive    = vivi.reduce((s, g) => s + qta(g), 0);
  const vendute = mov.filter(m => m.tipo === 'vendita').reduce((s, m) => s - m.qta, 0);
  const perse   = mov.filter(m => m.tipo === 'perdita').reduce((s, m) => s - m.qta, 0);
  const incasso = mov.reduce((s, m) => s + (m.valore || 0), 0);
  const inserite = L.inserite || mov.filter(m => m.tipo === 'apertura').reduce((s, m) => s + m.qta, 0);
  const costoTot = gr.reduce((s, g) => s + costo(g), 0);
  const ore = S.eventi.filter(x => x.lotto === codice).reduce((s, x) => s + (x.ore || 0), 0);
  const tot = Math.max(inserite, vive + perse + vendute) || 1;

  testa({ titolo: 'Lotto', indietro: true });
  nascondiBarra();

  const barre = vivi.map((g, i) =>
      `<div class="fetta" style="flex:${qta(g)};background:${COL[i % COL.length]}">${qta(g) / tot > .07 ? e(g.classe) : ''}</div>`).join('')
    + (vendute ? `<div class="fetta" style="flex:${vendute};background:var(--fumo)"></div>` : '')
    + (perse ? `<div class="fetta" style="flex:${perse};background:var(--ruggine-tenue)"></div>` : '');

  const righe = vivi.map((g, i) =>
      `<button class="trg" data-g="${g.id}" style="width:100%;text-align:left;background:none;border:0;font:inherit;cursor:pointer">
        <span class="pallino" style="background:${COL[i % COL.length]}"></span>
        <span class="et">Vaso ${e(classe(g.classe).etichetta)}${g.suffisso ? ' · ' + e(g.suffisso) : ''}
          ${etichette(g)}</span>
        <span class="vl">${qta(g)}</span></button>`).join('')
    + (vendute ? `<div class="trg"><span class="pallino" style="background:var(--fumo)"></span>
        <span class="et">Vendute</span><span class="vl">${vendute}</span></div>` : '')
    + (perse ? `<div class="trg"><span class="pallino" style="background:var(--ruggine)"></span>
        <span class="et">Perse</span><span class="vl">${perse}</span></div>` : '');

  const chiusi = gr.filter(g => qta(g) <= 0);
  const elencoChiusi = chiusi.length ? `<div class="eyebrow" style="margin-top:24px">gruppi chiusi</div>
    <div class="tabella">${chiusi.map(g =>
      `<button class="trg" data-g="${g.id}" style="width:100%;text-align:left;background:none;border:0;font:inherit;cursor:pointer;opacity:.6">
        <span class="et">Vaso ${e(classe(g.classe).etichetta)}${g.suffisso ? ' · ' + e(g.suffisso) : ''}</span>
        <span class="vl">${eur(costo(g))}<span class="sub">costo rimasto</span></span></button>`).join('')}</div>` : '';

  disegna(`<div class="scheda">
    <div class="titolone">${e(codice)}</div>
    <div class="specie">${e(L.specie)}${L.nomeBotanico ? ' · ' + e(L.nomeBotanico) : ''}
      ${L.origine ? ' · ' + e(L.origine) : ''}${L.dataIngresso ? ' · ' + dataIT(L.dataIngresso) : ''}</div>
    <div class="cifre">
      <div class="cifra"><b>${inserite}</b><span>inserite</span></div>
      <div class="cifra"><b>${vive}</b><span>oggi</span></div>
      <div class="cifra"><b>${inserite ? Math.round(vive / inserite * 100) : 0}%</b><span>sopravvivenza</span></div></div>
    <div class="eyebrow">dove sono finite</div>
    <div class="barretta">${barre || '<div class="fetta" style="flex:1;background:var(--linea)"></div>'}</div>
    <div class="tabella">${righe || '<div class="vuoto">Nessun gruppo.</div>'}</div>
    <div class="avviso">Costo accumulato sul lotto: <b>${eur(costoTot)}</b> ·
      media <b>${eur(vive ? costoTot / vive : 0)}</b> a pianta viva · ${num(ore)} h di lavoro.
      ${incasso ? `Incassato finora <b>${eur(incasso)}</b>.` : ''}</div>
    ${L.provenienza ? `<div class="nota">Provenienza: ${e(L.provenienza)}</div>` : ''}
    ${L.condizioni && (L.condizioni.tempMin || L.condizioni.umidMin)
      ? `<div class="nota">Condizioni registrate: ${e(JSON.stringify(L.condizioni))} — servono a
         confrontare annate diverse, non a dividere le prove. § 6.3</div>` : ''}
    ${L.note ? `<div class="nota">${e(L.note)}</div>` : ''}
    ${elencoChiusi}
  </div>`);

  document.querySelectorAll('[data-g]').forEach(b =>
    b.onclick = () => vai('gruppo', { id: +b.dataset.g }));
});
