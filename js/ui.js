/* ============================================================
   SERRA · ui.js — mattoni comuni dell'interfaccia
   La grafica è quella del prototipo v3: portata, non ridisegnata.
   ============================================================ */

export const $ = id => document.getElementById(id);

/* Tutto ciò che viene dall'utente passa di qui prima di finire in una
   stringa di markup: specie, note e nomi di miscela contengono apostrofi. */
export const e = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export const eur = n => (+n || 0).toLocaleString('it-IT',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const num = n => (+n || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
export const pct = n => Math.round((+n || 0) * 100) + '%';
export const dataIT = d => d ? d.split('-').reverse().join('/') : '';

/* ---- il vaso disegnato in scala · la misura racconta la classe ---- */
export const dim = (classe, base) => Math.round(base * ((classe?.mm || 60) / 240) * .62 + base * .38);
export function vaso(classe, base, extra = ''){
  const d = dim(classe, base);
  return `<span class="vaso ${classe?.tondo ? 'tondo' : ''}"
    style="width:${d}px;height:${d}px${extra}">${e(classe?.id || '?')}</span>`;
}

/* ---- etichette di prova · § 6.2 ---- */
export function etichette(g){
  const p = (g.prove || []).map(x => `<b>${e(x.variabile)} ${e(x.valore)}</b>`);
  const s = (g.storicoProve || []).map(x => `<b class="ered">${e(x.variabile)} ${e(x.valore)}</b>`);
  return p.length || s.length ? `<span class="eti">${s.join('')}${p.join('')}</span>` : '';
}

export function brindisi(t){
  const b = $('brindisi');
  b.textContent = t;
  b.classList.add('on');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('on'), 2600);
}

export function barraTasti(et, az, et2, az2, attivo = true){
  const b = $('barra');
  b.classList.remove('nascosto');
  b.innerHTML = `${et2 ? `<button class="secondaria" id="b2">${e(et2)}</button>` : ''}
    <button class="principale" id="b1" ${attivo ? '' : 'disabled'}>${e(et)}</button>`;
  $('b1').onclick = az;
  if (et2) $('b2').onclick = az2;
}
export const nascondiBarra = () => $('barra').classList.add('nascosto');

/* ---- dialogo di conferma: le cose irreversibili si chiedono ---- */
export function chiedi(titolo, testo, ok = 'Conferma'){
  return new Promise(res => {
    const d = $('dialogo');
    d.innerHTML = `<div class="dialogo"><div>
      <h3>${e(titolo)}</h3><p>${testo}</p>
      <div class="fila"><button class="secondaria" id="d-no">Annulla</button>
        <button class="principale" id="d-si">${e(ok)}</button></div></div></div>`;
    const via = v => { d.innerHTML = ''; res(v); };
    $('d-si').onclick = () => via(true);
    $('d-no').onclick = () => via(false);
    d.firstElementChild.onclick = ev => { if (ev.target === d.firstElementChild) via(false); };
  });
}

/* ---- intestazione ---- */
export function testa({ titolo, indietro = false, contatore = '', config = false, nuovo = false }){
  $('marchio').textContent = titolo;
  $('contatore').textContent = contatore;
  $('btn-indietro').classList.toggle('nascosto', !indietro);
  $('btn-cfg').classList.toggle('nascosto', !config);
  $('btn-nuovo').classList.toggle('nascosto', !nuovo);
}

export function disegna(html){
  const m = $('main');
  m.className = 'schermo';
  m.innerHTML = html;
  return m;
}

/* Campo numerico: sul telefono la tastiera giusta cambia tutto.
   Il valore va scritto col punto: `value="0,45"` un input number lo rifiuta. */
export const valNum = n => (n === '' || n == null) ? '' : String(+n || 0);
export const campoNum = (id, et, val, passo = 1, extra = '') =>
  `<div class="campo"><label for="${id}">${e(et)}</label>
    <input id="${id}" type="number" inputmode="${passo < 1 ? 'decimal' : 'numeric'}"
      step="${passo}" min="0" value="${valNum(val)}" ${extra}></div>`;
