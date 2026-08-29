/* SERRA · Configurazione · § 7 — niente hardcoded, tutto da qui. */
import { db } from '../db.js';
import * as B from '../backup.js';
import * as D from '../drive.js';
import { S, registra, rendi, ricarica, imp } from '../stato.js';
import { $, e, eur, num, disegna, testa, vaso, brindisi, chiedi, nascondiBarra } from '../ui.js';

const SEZIONI = [['materiali', 'Materiali'], ['miscele', 'Miscele'], ['vasi', 'Vasi'],
                 ['interventi', 'Interventi'], ['variabili', 'Variabili'], ['dati', 'Dati']];
let sezione = 'materiali', miscelaAperta = null;

const salva = async (tab, riga) => { await db[tab].put(riga); await ricarica(); rendi(); };

registra('config', () => {
  testa({ titolo: 'Config', indietro: true });
  nascondiBarra();
  const corpo = { materiali: cfgMateriali, miscele: cfgMiscele, vasi: cfgVasi,
                  interventi: cfgInterventi, variabili: cfgVariabili, dati: cfgDati }[sezione]();
  disegna(`<div class="sezioni">${SEZIONI.map(([k, nm]) =>
      `<button class="mini ${sezione === k ? 'on' : ''}" data-sez="${k}">${nm}</button>`).join('')}</div>
    <div class="cfg">${corpo}</div>`);
  document.querySelectorAll('[data-sez]').forEach(b =>
    b.onclick = () => { sezione = b.dataset.sez; rendi(); });
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

/* ---------- materiali ---------- */
function cfgMateriali(){
  return '<div class="cfgtit">listino · prezzo al litro</div>'
    + S.cfg.materiali.map(m => `<div class="cfgriga ${m.attivo ? '' : 'spenta'}">
        <input type="text" value="${e(m.nome)}" data-az="mat-nome:${m.id}">
        <input type="number" step="0.05" min="0" value="${+m.prezzoLitro}" data-az="mat-eur:${m.id}">
        <span class="um">€/L</span>
        <button class="interr ${m.attivo ? 'on' : ''}" data-az="mat-on:${m.id}">${m.attivo ? '✓' : '○'}</button></div>`).join('')
    + `<button class="aggiungi" data-az="mat-nuovo:">+ Aggiungi materiale</button>
       <div class="nota">Un materiale che non usi più si spegne, non si cancella: i rinvasi già
       registrati continuano a mostrarlo. Cambiare un prezzo qui non tocca gli eventi passati,
       che conservano il costo calcolato quel giorno.</div>`;
}
AZ['mat-nome'] = (id, v) => salva('materiali', { ...S.cfg.materiali.find(m => m.id === id), nome: v });
AZ['mat-eur']  = (id, v) => salva('materiali', { ...S.cfg.materiali.find(m => m.id === id), prezzoLitro: +v || 0 });
AZ['mat-on']   = id => { const m = S.cfg.materiali.find(x => x.id === id); salva('materiali', { ...m, attivo: !m.attivo }); };
AZ['mat-nuovo'] = () => salva('materiali', { id: 'm' + Date.now(), nome: 'Nuovo materiale', prezzoLitro: 0, attivo: true });

/* ---------- miscele ---------- */
function cfgMiscele(){
  const r = S.cfg.miscele.find(x => x.id === miscelaAperta) || S.cfg.miscele[0];
  if (!r) return `<div class="nota">Nessuna miscela.</div>
    <button class="aggiungi" data-az="mix-nuova:">+ Nuova miscela</button>`;
  miscelaAperta = r.id;
  const ids = Object.keys(r.quote || {});
  const somma = ids.reduce((s, k) => s + (+r.quote[k] || 0), 0) || 1;
  const disp = S.cfg.materiali.filter(m => m.attivo && r.quote[m.id] === undefined);

  return '<div class="scelte">' + S.cfg.miscele.map(x =>
      `<button class="mini ${x.id === r.id ? 'on' : ''}" data-az="mix-apri:${x.id}">${e(x.nome)}</button>`).join('')
    + '<button class="mini" data-az="mix-nuova:">+</button></div>'
    + `<div class="cfgriga"><input type="text" value="${e(r.nome)}" data-az="mix-nome:${r.id}">
        <button class="interr ${r.sperimentale ? 'on' : ''}" title="miscela di prova"
          data-az="mix-sper:${r.id}">🔬</button></div>
       <div class="cfgtit">composizione · in parti</div>`
    + (ids.length ? '' : '<div class="nota">Nessun materiale. Aggiungine qui sotto.</div>')
    + ids.map(k => `<div class="cfgriga">
        <input type="text" value="${e((S.cfg.materiali.find(m => m.id === k) || { nome: k }).nome)}" readonly>
        <span class="um">${Math.round((+r.quote[k] || 0) / somma * 100)}%</span>
        <input type="number" step="5" min="0" value="${+r.quote[k]}" data-az="mix-quota:${r.id}|${k}">
        <button class="interr" data-az="mix-togli:${r.id}|${k}">×</button></div>`).join('')
    + (disp.length ? '<div class="passo-tasti">' + disp.map(m =>
        `<button class="mini" data-az="mix-agg:${r.id}|${m.id}">+ ${e(m.nome)}</button>`).join('') + '</div>' : '')
    + `<div class="nota">Le parti sono proporzioni, non litri: l'app moltiplica per il volume del
       vaso di destinazione. Il segno 🔬 marca una miscela di prova — usandola, il rinvaso apre
       un'etichetta sperimentale sui gruppi di destinazione.</div>`;
}
const mix = id => S.cfg.miscele.find(m => m.id === id);
AZ['mix-apri']  = id => { miscelaAperta = id; rendi(); };
AZ['mix-nome']  = (id, v) => salva('miscele', { ...mix(id), nome: v });
AZ['mix-sper']  = id => salva('miscele', { ...mix(id), sperimentale: !mix(id).sperimentale });
AZ['mix-nuova'] = async () => { const id = 'mix' + Date.now();
  await db.miscele.add({ id, nome: 'Nuova miscela', quote: {}, sperimentale: false });
  miscelaAperta = id; await ricarica(); rendi(); };
AZ['mix-quota'] = (arg, v) => { const [id, k] = arg.split('|');
  salva('miscele', { ...mix(id), quote: { ...mix(id).quote, [k]: +v || 0 } }); };
AZ['mix-agg']   = arg => { const [id, k] = arg.split('|');
  salva('miscele', { ...mix(id), quote: { ...mix(id).quote, [k]: 10 } }); };
AZ['mix-togli'] = arg => { const [id, k] = arg.split('|');
  const q = { ...mix(id).quote }; delete q[k]; salva('miscele', { ...mix(id), quote: q }); };

/* ---------- vasi ---------- */
function cfgVasi(){
  return '<div class="cfgtit">classi di vaso · litri di substrato per vaso</div>'
    + S.cfg.classi.map(c => `<div class="cfgriga ${c.attiva ? '' : 'spenta'}">
        ${vaso(c, 34)}
        <input type="text" value="${e(c.etichetta)}" data-az="cl-et:${c.id}">
        <input type="number" step="0.05" min="0" value="${+c.litriPerVaso}" data-az="cl-litri:${c.id}">
        <span class="um">L</span>
        <button class="interr ${c.attiva ? 'on' : ''}" data-az="cl-on:${c.id}">${c.attiva ? '✓' : '○'}</button></div>`).join('')
    + `<button class="aggiungi" data-az="cl-nuova:">+ Aggiungi classe</button>
       <div class="nota">I litri per vaso servono a calcolare il substrato consumato. Misurali una
       volta riempiendo un vaso e travasandolo in una brocca graduata. <b>VAS</b> è la vaschetta di
       radicazione: è una classe come le altre, ed è ciò che rende superflua la distinzione fra
       sperimentale e produzione.</div>`;
}
const cl = id => S.cfg.classi.find(c => c.id === id);
AZ['cl-et']    = (id, v) => salva('classi', { ...cl(id), etichetta: v });
AZ['cl-litri'] = (id, v) => salva('classi', { ...cl(id), litriPerVaso: +v || 0 });
AZ['cl-on']    = id => salva('classi', { ...cl(id), attiva: !cl(id).attiva });
AZ['cl-nuova'] = async () => {
  const id = prompt('Codice della classe (es. 26)');
  if (!id) return;
  if (cl(id)) return brindisi('Esiste già');
  const mm = +prompt('Diametro in mm', '260') || 260;
  await db.classi.add({ id, etichetta: id, mm, tondo: false, litriPerVaso: 0, attiva: true,
    ordine: (Math.max(...S.cfg.classi.map(c => c.ordine || 0)) + 10) });
  await ricarica(); rendi();
};

/* ---------- interventi ---------- */
function cfgInterventi(){
  return '<div class="cfgtit">modelli · quanto costa un intervento per pianta</div>'
    + S.cfg.tipiIntervento.map(t => {
      let h = `<div class="cfgriga"><input type="text" value="${e(t.nome)}" data-az="ti-nome:${t.id}">
        <span class="um">${e(t.chiede)}</span></div>`;
      if (t.chiede === 'ore') h += '<div class="nota" style="margin:-2px 2px 10px">chiede solo le ore, nessun preset</div>';
      else if (t.chiede === 'scelta') h += (t.opzioni || []).map((o, j) =>
        `<div class="cfgriga" style="margin-left:14px">
          <input type="text" value="${e(o.k)}" data-az="ti-opz:${t.id}|${j}|k">
          <input type="number" step="0.01" min="0" value="${+o.matPerPianta}" data-az="ti-opz:${t.id}|${j}|matPerPianta"><span class="um">€/pi</span>
          <input type="number" step="0.005" min="0" value="${+o.orePerPianta}" data-az="ti-opz:${t.id}|${j}|orePerPianta"><span class="um">h/pi</span></div>`).join('');
      else h += `<div class="cfgriga" style="margin-left:14px">
        <span style="flex:1" class="um">preset</span>
        <input type="number" step="0.05" min="0" value="${+t.matPerPianta}" data-az="ti-fisso:${t.id}|matPerPianta"><span class="um">€/pi</span>
        <input type="number" step="0.05" min="0" value="${+t.orePerPianta}" data-az="ti-fisso:${t.id}|orePerPianta"><span class="um">h/pi</span></div>`;
      return h;
    }).join('')
    + `<button class="aggiungi" data-az="ti-nuovo:">+ Aggiungi tipo</button>
       <div class="nota">I preset sono per pianta: l'app li moltiplica per le piante del gruppo e ti
       lascia correggere. La legatura di un vaso da 24 consuma più filo di un 12 — se la differenza
       pesa, questo campo va reso una tabella per classe di vaso. § 12.1</div>`;
}
const ti = id => S.cfg.tipiIntervento.find(t => t.id === id);
AZ['ti-nome']  = (id, v) => salva('tipiIntervento', { ...ti(id), nome: v });
AZ['ti-fisso'] = (arg, v) => { const [id, k] = arg.split('|'); salva('tipiIntervento', { ...ti(id), [k]: +v || 0 }); };
AZ['ti-opz']   = (arg, v) => {
  const [id, j, k] = arg.split('|');
  const t = ti(id), opzioni = t.opzioni.map((o, i) => i === +j ? { ...o, [k]: k === 'k' ? v : (+v || 0) } : o);
  salva('tipiIntervento', { ...t, opzioni });
};
AZ['ti-nuovo'] = async () => {
  const nome = prompt('Nome del tipo di intervento');
  if (!nome) return;
  const chiede = prompt('Che cosa chiede: ore | fisso', 'ore');
  if (!['ore', 'fisso'].includes(chiede)) return brindisi('Solo ore o fisso');
  await db.tipiIntervento.add({ id: 't' + Date.now(), nome, chiede,
    ...(chiede === 'fisso' ? { matPerPianta: 0, orePerPianta: 0 } : {}) });
  await ricarica(); rendi();
};

/* ---------- variabili ---------- */
function cfgVariabili(){
  const AMBITI = { prova: 'divide le vaschette, è un trattamento',
                   selezione: 'divide le vaschette, è materiale di partenza',
                   condizione: 'non divide niente, è contesto del lotto' };
  return '<div class="cfgtit">variabili di prova · § 6.3</div>'
    + S.cfg.variabili.map(v => `<div class="cfgriga">
        <input type="text" value="${e(v.nome)}" data-az="va-nome:${v.id}">
        <select style="border:1px solid var(--linea);background:var(--pomice);border-radius:2px;
          padding:6px;font-family:var(--cond);font-size:12px;text-transform:uppercase" data-az="va-ambito:${v.id}">
          ${Object.keys(AMBITI).map(a => `<option value="${a}"${v.ambito === a ? ' selected' : ''}>${a}</option>`).join('')}
        </select></div>`
      + (v.tipo === 'lista' ? `<div class="passo-tasti" style="margin:-2px 0 10px 14px">
          ${(v.valori || []).map(x => `<button class="mini" data-az="va-togli:${v.id}|${e(x)}">${e(x)} ×</button>`).join('')}
          <button class="mini" data-az="va-agg:${v.id}">+ valore</button></div>`
        : `<div class="nota" style="margin:-2px 2px 10px 14px">tipo ${e(v.tipo)}${
            v.soglie ? ' · soglie ' + v.soglie.join(', ') : ''}</div>`)).join('')
    + `<button class="aggiungi" data-az="va-nuova:">+ Aggiungi variabile</button>
       <div class="nota">Le <b>prove</b> e le <b>selezioni</b> dividono le vaschette; le
       <b>condizioni</b> stanno sul lotto e servono a confrontare annate diverse. La fase lunare è
       di tipo <i>auto</i>: si calcola dalla data, non si inserisce.</div>`;
}
const va = id => S.cfg.variabili.find(v => v.id === id);
AZ['va-nome']   = (id, v) => salva('variabili', { ...va(id), nome: v });
AZ['va-ambito'] = (id, v) => salva('variabili', { ...va(id), ambito: v });
AZ['va-agg']    = id => { const v = prompt('Nuovo valore'); if (v) salva('variabili', { ...va(id), valori: [...(va(id).valori || []), v] }); };
AZ['va-togli']  = arg => { const [id, val] = arg.split('|');
  salva('variabili', { ...va(id), valori: (va(id).valori || []).filter(x => x !== val) }); };
AZ['va-nuova']  = async () => {
  const nome = prompt('Nome della variabile');
  if (!nome) return;
  await db.variabili.add({ id: 'v' + Date.now(), nome, ambito: 'prova', tipo: 'lista', valori: [] });
  await ricarica(); rendi();
};


/* ---------- dati: tariffe, spazio, copie ---------- */
let info = null;                       /* caricato quando si apre la sezione */

async function caricaInfo(){
  info = {
    spazio: await B.proteggiSpazio(),
    giorni: await B.giorniDallUltimoExport(),
    nonSalvate: await B.righeNonSalvate(),
    istantanee: await B.elencoIstantanee(),
    drive: await D.stato(),
    clientId: await D.caricaClientId(),
    versione: await B.versioneInUso(),
    copia: await B.preparaCopia(),      /* pronta: il tocco non deve aspettare */
  };
  rendi();
}

const mb = n => (n / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' MB';
const quando = iso => new Date(iso).toLocaleString('it-IT',
  { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function cfgDati(){
  if (!info){ caricaInfo(); return '<div class="vuoto">Un momento…</div>'; }
  const s = info.spazio;

  const statoSpazio = s.stato === 'protetto'
    ? `<div class="avviso"><b>Spazio protetto.</b> Il browser si è impegnato a non cancellare
       l'archivio per fare posto. ${s.spazio ? `Usati ${mb(s.usati)} su ${mb(s.spazio)}.` : ''}</div>`
    : s.stato === 'a rischio'
      ? `<div class="avviso rosso"><b>Spazio non protetto.</b> Il telefono può cancellare
         l'archivio quando ha bisogno di posto, e su iPhone Safari lo fa da solo dopo qualche
         settimana di inattività. Installa l'app dalla schermata Home: di solito il permesso
         arriva subito dopo.</div>`
      : `<div class="avviso giallo">Questo browser non sa dirmi se lo spazio è protetto.
         Tieni le copie aggiornate.</div>`;

  const copie = info.giorni === null
    ? 'Nessuna copia fuori da qui.'
    : `Ultima copia ${info.giorni === 0 ? 'oggi' : info.giorni + ' giorni fa'}` +
      (info.nonSalvate ? `, ${info.nonSalvate} righe scritte da allora` : ', tutto salvato');

  const ist = info.istantanee.length
    ? info.istantanee.map(x => `<div class="cfgriga">
        <span style="flex:1;font-size:13.5px">${quando(x.data)}
          <span class="um" style="width:auto;display:block">${e(x.motivo)} · ${x.righe} righe</span></span>
        <button class="mini" data-az="ripristina:${x.id}">ripristina</button></div>`).join('')
    : '<div class="nota">Nessuna istantanea ancora.</div>';

  return `<div class="cfgtit">costo del lavoro e prezzo</div>
    <div class="cfgriga"><input type="text" value="Tariffa oraria" readonly>
      <input type="number" step="1" min="0" value="${+imp('tariffaOraria')}" data-az="set:tariffaOraria"><span class="um">€/h</span></div>
    <div class="cfgriga"><input type="text" value="Moltiplicatore prezzo" readonly>
      <input type="number" step="0.5" min="1" value="${+imp('moltiplicatorePrezzo')}" data-az="set:moltiplicatorePrezzo"><span class="um">×</span></div>
    <div class="cfgriga"><input type="text" value="Promemoria backup" readonly>
      <input type="number" step="1" min="1" value="${+imp('giorniPromemoriaBackup')}" data-az="set:giorniPromemoriaBackup"><span class="um">gg</span></div>
    <div class="nota">La tariffa vale per gli interventi <i>futuri</i>: ogni evento conserva la
      tariffa del giorno in cui è stato registrato.</div>

    <div class="cfgtit" style="margin-top:22px">dove stanno i dati</div>
    ${statoSpazio}
    <div class="nota">${e(copie)} · ${S.movimenti.length} movimenti, ${S.eventi.length} eventi,
      ${S.gruppi.length} gruppi.</div>

    <div class="cfgtit" style="margin-top:22px">copia di sicurezza</div>
    ${B.condivisioneDisponibile()
      ? `<button class="aggiungi" data-az="condividi:">↗ Manda la copia fuori · Drive, mail…</button>`
      : ''}
    <button class="aggiungi" data-az="scarica:">↧ Scarica il file</button>
    <div class="nota">${B.condivisioneDisponibile()
      ? `Il primo apre la scelta della destinazione: <b>Drive</b>, posta, quello che vuoi. Il file
         parte come <b>.txt</b> — dentro è lo stesso JSON, ma Android non lascia condividere i .json.`
      : `Questo dispositivo non sa aprire la condivisione, quindi il file finisce nei Download e da
         lì lo sposti tu. Dal telefono, invece, compare la scelta della destinazione.`}
      È l'unica copia che sopravvive a questo dispositivo: le istantanee qui sotto stanno dentro
      l'archivio e muoiono con lui.</div>

    <div class="cfgtit" style="margin-top:22px">istantanee locali · ${info.istantanee.length}</div>
    ${ist}
    <div class="nota">L'app ne prende una da sola una volta al giorno, e sempre prima di un
      import o di un ripristino.</div>

    <div class="cfgtit" style="margin-top:22px">versione dell'app</div>
    <div class="cfgriga"><span style="flex:1;font-family:var(--mono);font-size:13px">${e(info.versione)}</span>
      <button class="mini" data-az="aggiorna:">cerca aggiornamenti</button></div>
    <div class="nota">È il nome della cache da cui l'app sta pescando i file: se dopo un
      aggiornamento vedi ancora il numero vecchio, tocca qui.</div>

    <div class="cfgtit" style="margin-top:22px">copia automatica su Drive</div>
    ${bloccoDrive()}

    <div class="cfgtit" style="margin-top:22px">ripartire da un file</div>
    <button class="aggiungi" data-az="importa:">↥ Importa backup</button>
    <input type="file" id="file-import" accept="application/json,.json,text/plain,.txt" class="nascosto">
    <div class="nota">L'import <b>sostituisce tutto</b>. Prima di farlo l'app ti dice quante righe
      ci sono nel file e quante ne hai adesso, e mette da parte un'istantanea.</div>`;
}

AZ['set'] = async (k, v) => { await db.impostazioni.put({ chiave: k, valore: +v || 0 }); await ricarica(); rendi(); };

AZ['condividi'] = async () => {
  const r = await B.condividi(info && info.copia);
  if (r.via === 'annullato') return;
  brindisi(r.via === 'condivisione'
    ? `Condiviso ${r.nome} · ${r.righe} righe`
    : `Scaricato nei Download · ${r.motivo}`);
  await caricaInfo();
};
AZ['scarica'] = async () => {
  const { testo, nome, righe } = await B.esporta();
  B.scarica(testo, nome);
  brindisi(`${righe} righe · ${nome}`);
  await caricaInfo();
};

AZ['importa'] = () => {
  const inp = $('file-import');
  inp.onchange = async ev => {
    const file = ev.target.files[0];
    inp.value = '';
    if (!file) return;
    let esame;
    try { esame = await B.esamina(await file.text()); }
    catch (err){ return brindisi('File non valido: ' + err.message); }

    const dettaglio = Object.entries(esame.perTabella)
      .map(([t, n]) => `${n} ${t}`).join(' · ');
    const allarme = esame.perdita > 0
      ? `<div class="avviso rosso" style="margin:0 0 12px"><b>Attenzione: perdi ${esame.perdita} righe.</b>
         Il file ne contiene ${esame.righeFile}, qui dentro ce ne sono ${esame.righeOra}.
         Se è il file sbagliato, annulla adesso.</div>`
      : '';
    const ok = await chiedi('Sostituire tutti i dati?',
      `${allarme}<b>${e(file.name)}</b><br>${e(dettaglio)}<br>
       ${esame.esportato ? 'esportato il ' + quando(esame.esportato) + '<br>' : ''}
       <br>Prendo un'istantanea di com'è adesso, così puoi tornare indietro.`,
      'Sostituisci');
    if (!ok) return;
    try {
      const righe = await B.importa(await file.text());
      await ricarica();
      info = null;
      brindisi(`Importate ${righe} righe`);
      rendi();
    } catch (err){ brindisi('Import fallito: ' + err.message); }
  };
  inp.click();
};

AZ['ripristina'] = async id => {
  const x = info.istantanee.find(i => i.id === +id);
  const ok = await chiedi('Tornare a questa istantanea?',
    `<b>${quando(x.data)}</b> · ${x.righe} righe (${e(x.motivo)}).<br><br>
     Quello che c'è adesso viene messo da parte in un'altra istantanea, quindi anche questo
     passo si può annullare.`, 'Ripristina');
  if (!ok) return;
  await B.ripristina(+id);
  await ricarica();
  info = null;
  brindisi('Ripristinata');
  rendi();
};

/* ---------- copia automatica su Drive ---------- */
function bloccoDrive(){
  const d = info.drive;
  if (!info.clientId) return `<div class="cfgriga">
      <input type="text" value="" placeholder="codice cliente Google (.apps.googleusercontent.com)"
        data-az="drive-id:" style="font-family:var(--mono);font-size:12px"></div>
    <div class="nota">Incolla qui il codice cliente OAuth creato nella console Google. L'app userà
      il permesso <b>drive.file</b>: vede soltanto i file che crea lei, del resto del tuo Drive non
      sa niente. Il codice non è un segreto — nelle applicazioni web sta in chiaro per costruzione.</div>`;

  return `<div class="cfgriga">
      <input type="text" value="${e(info.clientId)}" data-az="drive-id:"
        style="font-family:var(--mono);font-size:11px">
      <button class="interr ${d.collegato ? 'on' : ''}" title="${d.collegato ? 'collegato' : 'non collegato'}"
        data-az="drive-collega:">${d.collegato ? '✓' : '○'}</button></div>
    ${d.ultimo
      ? `<div class="avviso">Ultima copia su Drive <b>${quando(d.ultimo)}</b>${
          d.file ? ' · ' + e(d.file) : ''}. Nella cartella <b>Serra — backup</b>, ne restano le ultime venti.</div>`
      : `<div class="avviso giallo">Non ancora collegato. Il primo invio chiede il tuo permesso a
         Google: dopo, l'app ci pensa da sola all'avvio e quando chiudi.</div>`}
    <button class="aggiungi" data-az="drive-ora:">↗ Manda una copia su Drive adesso</button>
    ${d.collegato ? '<button class="aggiungi" data-az="drive-scollega:">Scollega Drive</button>' : ''}
    <div class="nota">L'app scrive e basta: non legge mai i dati da Drive, non è una
      sincronizzazione. Se apri l'app su due telefoni, restano due archivi separati.</div>`;
}

AZ['drive-id'] = async (_, v) => { await D.impostaClientId(v); info = null; rendi(); };
AZ['drive-collega'] = async () => {
  try { await D.permesso({ interattivo: true }); brindisi('Permesso dato'); await AZ['drive-ora'](); }
  catch (err){ brindisi(err.message); }
};
AZ['drive-ora'] = async () => {
  brindisi('Invio in corso…');
  try {
    const r = await D.invia({ motivo: 'a mano' });
    brindisi(`Su Drive: ${r.nome} · ${r.righe} righe`);
  } catch (err){ brindisi('Drive: ' + err.message); }
  info = null; rendi();
};
AZ['drive-scollega'] = async () => {
  const ok = await chiedi('Scollegare Drive?',
    'Le copie già caricate restano su Drive. Da qui in poi l’app smette di mandarne di nuove.', 'Scollega');
  if (!ok) return;
  await D.scollega(); info = null; rendi();
};

AZ['aggiorna'] = async () => {
  brindisi('Cerco…');
  const esito = await B.aggiornaApp();
  brindisi(esito === 'in arrivo' ? 'Versione nuova in arrivo: l’app si ricarica' : 'App ' + esito);
  info = null; rendi();
};
