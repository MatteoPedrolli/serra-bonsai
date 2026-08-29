/* ============================================================
   SERRA · drive.js — la copia che sopravvive al telefono
   L'app parla direttamente con Google Drive: nessun server nostro in
   mezzo, nessuna sincronizzazione. Scrive e basta, non legge mai
   l'archivio da fuori. § 8, § 11
   ============================================================ */
import { db, adesso } from './db.js';
import * as B from './backup.js';

/* drive.file: l'app vede solo i file che ha creato lei. Del resto del
   tuo Drive non sa niente, e Google non chiede verifiche per questo. */
const AMBITO = 'https://www.googleapis.com/auth/drive.file';
const CARTELLA = 'Serra — backup';
const ATTESA = 5 * 60 * 1000;         /* non più di una copia ogni 5 minuti */

let gis = null, token = null, scadenza = 0, inCorso = null;

/* Il codice cliente lo scrivi tu in Config: non è un segreto — nelle
   applicazioni web sta in chiaro per costruzione — ma è tuo. */
let cid = '';
export const clientId = () => cid;
export const configurato = () => !!cid;

export async function caricaClientId(){
  const r = await db.impostazioni.get('driveClientId');
  cid = (r && r.valore ? String(r.valore) : '').trim();
  return cid;
}
export async function impostaClientId(v){
  await db.impostazioni.put({ chiave: 'driveClientId', valore: String(v || '').trim() });
  token = null; scadenza = 0;
  return caricaClientId();
}

/* ---------- la libreria di Google, caricata solo se serve ---------- */
function caricaGis(){
  if (gis) return gis;
  gis = new Promise((ok, no) => {
    if (window.google && window.google.accounts) return ok(window.google.accounts.oauth2);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok(window.google.accounts.oauth2);
    s.onerror = () => { gis = null; no(new Error('Non riesco a caricare Google: serve rete.')); };
    document.head.appendChild(s);
  });
  return gis;
}

/* Il permesso dura un'ora. Alla scadenza si prova a rinnovarlo in
   silenzio: funziona finché sei ancora dentro col tuo account Google.
   Se non funziona, serve un tocco — e l'app te lo chiede, non lo fa
   di nascosto. */
export async function permesso({ interattivo = false } = {}){
  if (token && Date.now() < scadenza - 60000) return token;
  if (!configurato()) throw new Error('Manca il codice cliente di Google.');
  const oauth2 = await caricaGis();
  return new Promise((ok, no) => {
    const client = oauth2.initTokenClient({
      client_id: clientId(),
      scope: AMBITO,
      prompt: interattivo ? 'consent' : '',
      callback: r => {
        if (r && r.access_token){
          token = r.access_token;
          scadenza = Date.now() + (r.expires_in || 3600) * 1000;
          ok(token);
        } else no(new Error('Permesso negato.'));
      },
      error_callback: err => {
        /* Google spiega bene i suoi rifiuti: riportarli per intero vale
           più di qualunque messaggio riscritto da noi. */
        if (err && err.type === 'popup_closed') return no(new Error('Finestra chiusa.'));
        if (err && err.type === 'popup_failed_to_open')
          return no(new Error('Il telefono ha bloccato la finestra di Google.'));
        no(new Error((err && (err.message || err.type)) || 'permesso negato'));
      },
    });
    client.requestAccessToken();
  });
}

const api = async (url, opzioni = {}) => {
  const t = await permesso();
  const r = await fetch(url, { ...opzioni,
    headers: { ...(opzioni.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401){ token = null; throw new Error('Permesso scaduto.'); }
  if (!r.ok) throw new Error('Drive ha risposto ' + r.status);
  return r.status === 204 ? null : r.json();
};

/* ---------- la cartella, creata una volta sola ---------- */
async function cartella(){
  const salvata = await db.meta.get('driveCartella');
  if (salvata && salvata.valore){
    try { await api(`https://www.googleapis.com/drive/v3/files/${salvata.valore}?fields=id,trashed`);
      return salvata.valore; } catch { /* cancellata a mano: se ne fa un'altra */ }
  }
  const trovata = await api('https://www.googleapis.com/drive/v3/files?fields=files(id,name)'
    + '&q=' + encodeURIComponent(
      `name='${CARTELLA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`));
  const id = trovata.files && trovata.files.length
    ? trovata.files[0].id
    : (await api('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: CARTELLA, mimeType: 'application/vnd.google-apps.folder' }),
      })).id;
  await db.meta.put({ chiave: 'driveCartella', valore: id });
  return id;
}

/* ---------- il caricamento ---------- */
export function corpoMultiparte(metadati, testo){
  const b = 'serra' + Date.now();
  return {
    tipo: `multipart/related; boundary=${b}`,
    corpo: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
      + JSON.stringify(metadati)
      + `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n`
      + testo + `\r\n--${b}--`,
  };
}

/* Un file solo, sempre lo stesso, riscritto da capo ogni volta: su Drive
   resta una riga sola invece di una collezione. La storia non si perde
   perché ogni riscrittura diventa una *versione* del file, e chiediamo a
   Drive di tenerle tutte: tasto destro sul file → Gestisci versioni.
   È il meglio dei due modi — ordine sopra, storico sotto. */
const NOME_FILE = 'serra.json';

async function fileEsistente(idCartella){
  const salvato = await db.meta.get('driveFileId');
  if (salvato && salvato.valore){
    try {
      const f = await api(`https://www.googleapis.com/drive/v3/files/${salvato.valore}?fields=id,trashed`);
      if (f && !f.trashed) return salvato.valore;
    } catch { /* cancellato a mano: se ne fa uno nuovo */ }
  }
  const l = await api('https://www.googleapis.com/drive/v3/files?fields=files(id)&pageSize=1&q='
    + encodeURIComponent(`name='${NOME_FILE}' and '${idCartella}' in parents and trashed=false`));
  return (l.files && l.files[0]) ? l.files[0].id : null;
}

export async function invia({ motivo = 'automatica' } = {}){
  if (inCorso) return inCorso;
  inCorso = (async () => {
    const idCartella = await cartella();
    const { testo, righe } = await B.esporta();
    const esistente = await fileEsistente(idCartella);

    /* keepRevisionForever: senza, Drive fa piazza pulita delle versioni
       vecchie quando gli pare. Con, restano finché non le togli tu. */
    const { tipo, corpo } = esistente
      ? corpoMultiparte({ name: NOME_FILE }, testo)
      : corpoMultiparte({ name: NOME_FILE, parents: [idCartella] }, testo);
    const url = esistente
      ? `https://www.googleapis.com/upload/drive/v3/files/${esistente}?uploadType=multipart&keepRevisionForever=true&fields=id,name,version`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&keepRevisionForever=true&fields=id,name,version';

    const file = await api(url, { method: esistente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': tipo }, body: corpo });

    await db.meta.put({ chiave: 'driveFileId', valore: file.id });
    await db.meta.put({ chiave: 'driveUltimo', valore: adesso() });
    await db.meta.put({ chiave: 'driveUltimoFile', valore: file.name });
    await db.meta.put({ chiave: 'driveVersioni', valore: (file.version || '') + '' });
    return { nome: file.name, righe, motivo, versione: file.version, nuovo: !esistente };
  })().finally(() => { inCorso = null; });
  return inCorso;
}

export async function elenco(){
  const idCartella = await cartella();
  const l = await api('https://www.googleapis.com/drive/v3/files?fields=files(id,name,createdTime,size)'
    + '&orderBy=createdTime desc&pageSize=25&q='
    + encodeURIComponent(`'${idCartella}' in parents and trashed=false`));
  return l.files || [];
}

/* ---------- il gesto automatico ----------
   Alla partenza e ogni volta che chiudi l'app, se hai scritto qualcosa
   e c'è rete. In silenzio: se il permesso è scaduto e serve un tocco,
   aspetta che lo dia tu dalla configurazione. */
export async function inviaSePuoi(){
  if (!configurato() || !navigator.onLine) return null;
  if ((await B.righeNonSalvate()) === 0) return null;      /* niente di nuovo da salvare */

  const g = await db.impostazioni.get('giorniBackupDrive');
  const giorni = g && g.valore != null ? +g.valore : 3;
  const ultimo = await db.meta.get('driveUltimo');
  const attesa = Math.max(giorni, 0) * 86400000 || ATTESA;
  if (ultimo && Date.now() - new Date(ultimo.valore).getTime() < attesa) return null;

  try { return await invia({ motivo: 'automatica' }); }
  catch { return null; }
}

export async function stato(){
  const [ultimo, file, cart] = await Promise.all([
    db.meta.get('driveUltimo'), db.meta.get('driveUltimoFile'), db.meta.get('driveCartella')]);
  return {
    configurato: configurato(),
    collegato: !!(cart && cart.valore),
    ultimo: ultimo ? ultimo.valore : null,
    file: file ? file.valore : null,
  };
}

export async function scollega(){
  token = null; scadenza = 0;
  await db.meta.delete('driveCartella');
  await db.meta.delete('driveUltimo');
  await db.meta.delete('driveUltimoFile');
}
