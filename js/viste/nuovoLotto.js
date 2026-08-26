/* SERRA · nuovo lotto · § 5.7
   Un solo form che crea il lotto e la sua prima vaschetta. Con due
   variabili a due valori nascono quattro vaschette già etichettate. */
import { oggi } from '../db.js';
import { creaLotto } from '../operazioni.js';
import { faseLunare } from '../calcoli.js';
import { S, registra, radice, rendi, aggiornaE, vai } from '../stato.js';
import { $, e, disegna, testa, barraTasti, brindisi, campoNum, num } from '../ui.js';

const ORIGINI = ['talea', 'seme', 'acquisto', 'raccolta', 'margotta'];
let n = null;

function vuoto(){
  return { specie: '', nomeBotanico: '', sigla: '', anno: String(new Date().getFullYear()).slice(2),
           progressivo: '', origine: 'talea', dataIngresso: oggi(), provenienza: '',
           inserite: 0, costoIniziale: 0, note: '',
           condizioni: { tempMin: '', tempMax: '', umidMin: '', umidMax: '' },
           prove: [ { variabile: '', valori: [] }, { variabile: '', valori: [] } ] };
}

const siglaDa = s => (s || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();

function prossimoProgressivo(sigla, anno){
  const pre = `${sigla}-${anno}-`;
  const usati = S.lotti.filter(l => l.id.startsWith(pre))
    .map(l => parseInt(l.id.slice(pre.length), 10)).filter(x => !isNaN(x));
  return String((usati.length ? Math.max(...usati) : 0) + 1).padStart(3, '0');
}

const codice = () => {
  const sigla = n.sigla || siglaDa(n.specie) || '???';
  const prog = n.progressivo || prossimoProgressivo(sigla, n.anno);
  return `${sigla}-${n.anno}-${prog}`;
};

const proveAttive = () => n.prove.filter(p => p.variabile && p.valori.length);
const combinazioni = () => proveAttive().reduce((s, p) => s * p.valori.length, 1);

registra('nuovoLotto', () => {
  if (!n) n = vuoto();
  testa({ titolo: 'Nuovo lotto', indietro: true });

  const comb = combinazioni(), quota = Math.floor((n.inserite || 0) / comb);
  const valido = !!(n.specie.trim() && n.inserite > 0 && !S.lotti.some(l => l.id === codice()));

  const variabili = S.cfg.variabili.filter(v => v.ambito === 'prova' || v.ambito === 'selezione');
  const slotProva = (p, i) => {
    const v = variabili.find(x => x.nome === p.variabile);
    const valori = v?.tipo === 'lista' ? v.valori : (p.valori.length ? p.valori : []);
    return `<div class="campo" style="margin-top:12px">
      <label>Variabile ${i + 1}</label>
      <select data-az="prova-var:${i}">
        <option value="">— nessuna —</option>
        ${variabili.map(x => `<option value="${e(x.nome)}"${p.variabile === x.nome ? ' selected' : ''}>${e(x.nome)}</option>`).join('')}
      </select>
      ${p.variabile ? `<div class="passo-tasti">
        ${valori.map(val => `<button class="mini ${p.valori.includes(val) ? 'on' : ''}"
            data-az="prova-val:${i}|${e(val)}">${e(val)}</button>`).join('')}
        <button class="mini" data-az="prova-agg:${i}">+ valore</button></div>` : ''}</div>`;
  };

  const griglia = () => {
    const [a, b] = proveAttive();
    if (!a) return '';
    if (!b) return `<div class="avviso">${a.valori.length} vaschette da ${quota} talee,
      una per valore di <b>${e(a.variabile)}</b>.</div>`;
    let g = `<div class="griglia4" style="grid-template-columns:auto repeat(${b.valori.length},1fr)">
      <div class="tst"></div>${b.valori.map(v => `<div class="tst">${e(v)}</div>`).join('')}`;
    a.valori.forEach(va => {
      g += `<div class="tst">${e(va)}</div>` + b.valori.map(() => `<div>${quota}</div>`).join('');
    });
    g += '</div>';
    return g + `<div class="avviso">${combinazioni()} vaschette incrociate: il confronto resta
      leggibile su entrambe le variabili. § 6.1</div>`;
  };

  disegna(`<div class="corpo">
    <div class="eyebrow">codice del lotto</div>
    <div class="anteprima">${e(codice())}</div>
    <div class="nota" style="margin-top:0">È quello che scrivi sull'etichetta della vaschetta.
      Si trasferisce nel vaso singolo e non cambia più.</div>

    <div class="campo"><label for="i-specie">Specie</label>
      <input id="i-specie" type="text" value="${e(n.specie)}" data-az="campo:specie"
        placeholder="Acer palmatum" style="font-family:var(--sans);font-size:16px"></div>
    <div class="duecampi" style="margin-top:14px">
      <div class="campo"><label for="i-sigla">Sigla</label>
        <input id="i-sigla" type="text" value="${e(n.sigla || siglaDa(n.specie))}" data-az="campo:sigla" maxlength="4"></div>
      <div class="campo"><label for="i-anno">Anno</label>
        <input id="i-anno" type="text" value="${e(n.anno)}" data-az="campo:anno" maxlength="2"></div></div>
    <div class="duecampi" style="margin-top:14px">
      <div class="campo"><label for="i-prog">Progressivo</label>
        <input id="i-prog" type="text" value="${e(n.progressivo || prossimoProgressivo(n.sigla || siglaDa(n.specie), n.anno))}"
          data-az="campo:progressivo" maxlength="4"></div>
      <div class="campo"><label for="i-origine">Origine</label>
        <select id="i-origine" data-az="campo:origine">
          ${ORIGINI.map(o => `<option value="${o}"${n.origine === o ? ' selected' : ''}>${o}</option>`).join('')}
        </select></div></div>
    <div class="duecampi" style="margin-top:14px">
      <div class="campo"><label for="i-data">Data d'ingresso</label>
        <input id="i-data" type="date" value="${n.dataIngresso}" data-az="campo:dataIngresso"
          style="font-family:var(--mono);font-size:16px"></div>
      ${campoNum('i-ins', 'Inserite', n.inserite, 1, 'data-az="campo:inserite"')}</div>
    <div class="nota">Fase lunare del ${n.dataIngresso.split('-').reverse().join('/')}:
      <b>${faseLunare(n.dataIngresso)}</b> — calcolata dalla data, mai inserita a mano. § 6.3</div>

    <div class="campo"><label for="i-prov">Provenienza</label>
      <input id="i-prov" type="text" value="${e(n.provenienza)}" data-az="campo:provenienza"
        placeholder="pianta madre, vivaio, luogo" style="font-family:var(--sans);font-size:15px"></div>

    <div class="eyebrow" style="margin-top:26px">prove · fino a due variabili</div>
    <div class="nota" style="margin-top:4px">Se scegli due variabili con due valori ciascuna,
      nascono quattro vaschette incrociate e le talee si dividono in parti uguali.</div>
    ${slotProva(n.prove[0], 0)}
    ${n.prove[0].variabile ? slotProva(n.prove[1], 1) : ''}
    ${griglia()}

    <div class="eyebrow" style="margin-top:26px">condizioni del lotto · facoltative</div>
    <div class="nota" style="margin-top:4px">Non dividono le prove: servono a capire perché la
      stessa talea ha reso il 60% un anno e l'85% quello dopo. § 6.3</div>
    <div class="duecampi">
      ${campoNum('i-tmin', 'Temp. min °C', n.condizioni.tempMin, 1, 'data-az="cond:tempMin"')}
      ${campoNum('i-tmax', 'Temp. max °C', n.condizioni.tempMax, 1, 'data-az="cond:tempMax"')}</div>
    <div class="duecampi" style="margin-top:12px">
      ${campoNum('i-umin', 'Umidità min %', n.condizioni.umidMin, 1, 'data-az="cond:umidMin"')}
      ${campoNum('i-umax', 'Umidità max %', n.condizioni.umidMax, 1, 'data-az="cond:umidMax"')}</div>
    ${campoNum('i-costo', 'Costo d\'acquisto totale €', n.costoIniziale, 0.50, 'data-az="campo:costoIniziale"')}

    <div class="campo" style="margin-top:14px"><label for="i-note">Note</label>
      <textarea id="i-note" data-az="campo:note">${e(n.note)}</textarea></div>
  </div>`);

  barraTasti(comb > 1 ? `Crea ${comb} vaschette` : 'Crea lotto', salva, null, null, valido);
  collega();
});

const AZ = {};
function collega(){
  document.querySelectorAll('[data-az]').forEach(el => {
    const [nome, arg] = el.dataset.az.split(':');
    const fn = AZ[nome];
    if (!fn) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) el.onchange = ev => fn(arg, ev.target.value);
    else el.onclick = () => fn(arg);
  });
}
AZ.campo = (k, v) => {
  n[k] = (k === 'inserite') ? Math.max(0, +v || 0)
       : (k === 'costoIniziale') ? Math.max(0, +v || 0)
       : (k === 'sigla') ? v.toUpperCase() : v;
  rendi();
};
AZ.cond = (k, v) => { n.condizioni[k] = v === '' ? '' : +v; };
AZ['prova-var'] = (i, v) => {
  n.prove[+i] = { variabile: v, valori: [] };
  const vv = S.cfg.variabili.find(x => x.nome === v);
  if (vv?.tipo === 'lista') n.prove[+i].valori = vv.valori.slice(0, 2);
  rendi();
};
AZ['prova-val'] = arg => {
  const [i, val] = arg.split('|');
  const p = n.prove[+i];
  p.valori = p.valori.includes(val) ? p.valori.filter(x => x !== val) : [...p.valori, val];
  rendi();
};
AZ['prova-agg'] = i => {
  const v = prompt('Nuovo valore per ' + n.prove[+i].variabile);
  if (v) n.prove[+i].valori.push(v);
  rendi();
};

async function salva(){
  const sigla = n.sigla || siglaDa(n.specie);
  const prog = n.progressivo || prossimoProgressivo(sigla, n.anno);
  const id = `${sigla}-${n.anno}-${prog}`;
  const cond = Object.fromEntries(Object.entries(n.condizioni).filter(([, v]) => v !== ''));
  await creaLotto({
    lotto: { id, specie: n.specie.trim(), nomeBotanico: n.nomeBotanico, sigla, anno: n.anno,
             progressivo: prog, origine: n.origine, dataIngresso: n.dataIngresso,
             provenienza: n.provenienza, note: n.note,
             condizioni: Object.keys(cond).length ? cond : undefined },
    inserite: n.inserite, costoIniziale: n.costoIniziale, data: n.dataIngresso,
    prove: proveAttive(),
  });
  brindisi(`${id} creato · ${combinazioni() > 1 ? combinazioni() + ' vaschette' : n.inserite + ' talee'}`);
  n = null;
  await aggiornaE('lotto', { codice: id });
}
