/* ============================================================
   SERRA · stato.js — memoria di lavoro e navigazione
   Nessuna quantità è scritta in tabella: giacenze e costi vivono qui,
   ricostruiti dai movimenti a ogni ricarica. § 4.1
   ============================================================ */
import { db, leggiConfig } from './db.js';
import * as C from './calcoli.js';

export const S = {
  cfg: null, lotti: [], gruppi: [], movimenti: [], eventi: [], conteggi: [],
  q: new Map(), c: new Map(),
};

export async function ricarica(){
  const [cfg, lotti, gruppi, movimenti, eventi, conteggi] = await Promise.all([
    leggiConfig(), db.lotti.toArray(), db.gruppi.toArray(),
    db.movimenti.toArray(), db.eventi.toArray(), db.conteggi.toArray(),
  ]);
  Object.assign(S, { cfg, lotti, gruppi, movimenti, eventi, conteggi });
  const [inv, giro] = await Promise.all([db.meta.get('ultimoInventario'), db.meta.get('inventario')]);
  S.ultimoInventario = inv ? inv.valore : null;
  S.inventarioInCorso = giro ? giro.valore : null;
  /* le righe annullate da uno storno, e le operazioni a cui appartenevano */
  S.stornati = new Set([
    ...movimenti.filter(m => m.storna != null).map(m => 'm' + m.storna),
    ...eventi.filter(e => e.storna != null).map(e => 'e' + e.storna)]);
  S.opAnnullate = new Set([
    ...movimenti.filter(m => m.operazione && S.stornati.has('m' + m.id)).map(m => m.operazione),
    ...eventi.filter(e => e.operazione && S.stornati.has('e' + e.id)).map(e => e.operazione)]);
  S.q = C.saldi(movimenti);
  S.c = C.costi(movimenti, eventi, cfg.impostazioni.tariffaOraria);
  /* un gruppo con giacenza zero è chiuso: la cache in tabella si allinea
     al saldo, mai il contrario */
  for (const g of gruppi){
    const q = S.q.get(g.id) || 0;
    if (q <= 0 && g.aperto){ g.aperto = false; await db.gruppi.update(g.id, { aperto: false }); }
    /* uno storno può ridare piante a un gruppo chiuso: allora torna aperto */
    else if (q > 0 && !g.aperto){ g.aperto = true; await db.gruppi.update(g.id, { aperto: true }); }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('serra:scritto'));
}

/* ---- letture comode ---- */
export const classe   = id => S.cfg.classi.find(c => c.id === id) || { id, etichetta: id, mm: 60, litriPerVaso: 0 };
export const lotto    = id => S.lotti.find(l => l.id === id) || { id, specie: '—', inserite: 0 };
export const materiale= id => S.cfg.materiali.find(m => m.id === id) || { id, nome: id, prezzoLitro: 0 };
export const miscela  = id => S.cfg.miscele.find(m => m.id === id);
export const tipoInt  = id => S.cfg.tipiIntervento.find(t => t.id === id);
export const gruppo   = id => S.gruppi.find(g => g.id === id);
export const qta      = g => S.q.get(typeof g === 'object' ? g.id : g) || 0;
export const costo    = g => S.c.get(typeof g === 'object' ? g.id : g) || 0;
export const perPianta= g => C.costoPianta(costo(g), qta(g));
export const ordineCl = id => S.cfg.classi.findIndex(c => c.id === id);
export const imp      = k => S.cfg.impostazioni[k];
export const aperti   = () => S.gruppi.filter(g => g.aperto);

export const nomeGruppo = g => g.lotto + (g.suffisso ? ' · ' + g.suffisso : '');

/* una lavorazione conta se non è uno storno e non è stata stornata */
export const eventoVivo = e => e.storna == null && !S.stornati.has('e' + e.id);
export const movimentoVivo = m => m.storna == null && !S.stornati.has('m' + m.id);
/* un conteggio fatto dentro un'operazione annullata non vale più */
export const conteggioVivo = c => !c.operazione || !S.opAnnullate.has(c.operazione);
export const lavorazioni = id => S.eventi.filter(x => x.gruppo === id && eventoVivo(x)).length;

/* ---- navigazione ---- */
const viste = {};
export const registra = (nome, fn) => { viste[nome] = fn; };
export const esiste = nome => !!viste[nome];

export const nav = { nome: 'home', par: {}, pila: [] };

export function vai(nome, par = {}){
  if (nav.nome) nav.pila.push({ nome: nav.nome, par: nav.par });
  nav.nome = nome; nav.par = par;
  rendi();
}
export function sostituisci(nome, par = {}){ nav.nome = nome; nav.par = par; rendi(); }
export function radice(nome = 'home', par = {}){ nav.pila = []; nav.nome = nome; nav.par = par; rendi(); }

/* Nursery e produzione non sono due stati della pianta: sono due
   contenitori. In vaschetta è nursery, in vaso è produzione, e il
   passaggio dall'una all'altra è il rinvaso. § 11 */
export const zonaDi = classe => classe === 'VAS' ? 'nursery' : 'produzione';

/* torna all'elenco di una zona, con la home come unico passo indietro */
export function aZona(zona){
  nav.pila = [{ nome: 'home', par: {} }];
  nav.nome = 'elenco'; nav.par = { zona };
  rendi();
}
export function torna(){
  const p = nav.pila.pop();
  if (!p) return radice();
  nav.nome = p.nome; nav.par = p.par; rendi();
}
export function rendi(){
  window.scrollTo(0, 0);
  if (!viste[nav.nome]){ nav.nome = 'home'; nav.par = {}; nav.pila = []; }
  viste[nav.nome](nav.par);
}

/* Ricarica dal db e ridisegna: si chiama dopo ogni scrittura. */
export async function aggiornaE(nome, par){
  await ricarica();
  if (nome) radice(nome, par); else rendi();
}
