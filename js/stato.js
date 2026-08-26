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
  S.q = C.saldi(movimenti);
  S.c = C.costi(movimenti, eventi, cfg.impostazioni.tariffaOraria);
  /* un gruppo con giacenza zero è chiuso: la cache in tabella si allinea
     al saldo, mai il contrario */
  for (const g of gruppi){
    const q = S.q.get(g.id) || 0;
    if (q <= 0 && g.aperto){ g.aperto = false; await db.gruppi.update(g.id, { aperto: false }); }
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

/* ---- navigazione ---- */
const viste = {};
export const registra = (nome, fn) => { viste[nome] = fn; };

export const nav = { nome: 'elenco', par: {}, pila: [] };

export function vai(nome, par = {}){
  if (nav.nome) nav.pila.push({ nome: nav.nome, par: nav.par });
  nav.nome = nome; nav.par = par;
  rendi();
}
export function sostituisci(nome, par = {}){ nav.nome = nome; nav.par = par; rendi(); }
export function radice(nome = 'elenco', par = {}){ nav.pila = []; nav.nome = nome; nav.par = par; rendi(); }
export function torna(){
  const p = nav.pila.pop();
  if (!p) return radice();
  nav.nome = p.nome; nav.par = p.par; rendi();
}
export function rendi(){
  window.scrollTo(0, 0);
  viste[nav.nome](nav.par);
}

/* Ricarica dal db e ridisegna: si chiama dopo ogni scrittura. */
export async function aggiornaE(nome, par){
  await ricarica();
  if (nome) radice(nome, par); else rendi();
}
