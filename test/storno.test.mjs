/* Correggere senza cancellare · § 1
   Uno storno scrive righe uguali e contrarie: le somme tornano come
   prima e nella storia restano tutte e due. */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db, apri, leggiConfig } from '../js/db.js';
import * as C from '../js/calcoli.js';
import * as O from '../js/operazioni.js';

const DATA = '2026-09-01';
await apri();
const cfg = await leggiConfig();

const stato = async () => {
  const [movimenti, eventi] = await Promise.all([db.movimenti.toArray(), db.eventi.toArray()]);
  return { movimenti, eventi, q: C.saldi(movimenti), c: C.costi(movimenti, eventi, 25) };
};
const vicino = (a, b) => assert.ok(Math.abs(a - b) < 0.011, `${a} ≠ ${b}`);

await O.creaLotto({
  lotto: { id: 'ACE-26-009', specie: 'Acer palmatum', sigla: 'ACE', anno: '26', progressivo: '009',
           origine: 'talea', dataIngresso: DATA },
  inserite: 40, data: DATA,
  prove: [{ variabile: 'Ormone', valori: ['IBA', 'Nessuno'] }],
});
const [A, Bg] = await db.gruppi.toArray();

test('ogni salvataggio porta il codice della sua operazione', async () => {
  const s = await stato();
  const g = { ...A };
  const { operazione } = await O.esegui(O.pianoRinvaso({
    gruppo: g, attese: 20, contate: 18, costo: s.c.get(A.id) || 0,
    destinazioni: [{ classe: '12', piante: 18 }], miscela: cfg.miscele[0], quote: cfg.miscele[0].quote,
    materiali: cfg.materiali, classi: cfg.classi, costoVasi: 2, ore: 1, tariffa: 25, data: DATA }));
  const righe = await O.righeOperazione({ operazione });
  assert.equal(righe.movimenti.length, 2, 'perdita e trasferimento');
  assert.equal(righe.eventi.length, 1, 'la lavorazione di rinvaso');
  assert.equal((await db.conteggi.toArray()).at(-1).operazione, operazione, 'anche il conteggio');
});

test('annullare un rinvaso lo annulla tutto, e riapre il gruppo svuotato', async () => {
  const prima = await stato();
  const dodici = (await db.gruppi.toArray()).find(g => g.classe === '12');
  assert.equal(prima.q.get(dodici.id), 18);
  assert.equal((await db.gruppi.get(A.id)).aperto, false, 'la vaschetta si era svuotata');

  const op = (await db.eventi.toArray()).find(e => e.tipo === 'rinvaso').operazione;
  await O.storna({ operazione: op }, { data: DATA });

  const dopo = await stato();
  assert.equal(dopo.q.get(A.id), 20, 'tornano anche le due trovate morte');
  assert.equal(dopo.q.get(dodici.id), 0);
  vicino(dopo.c.get(dodici.id) || 0, 0);
  vicino(dopo.c.get(A.id) || 0, 0);
  assert.equal((await db.gruppi.get(A.id)).aperto, true, 'la vaschetta si riapre');
  assert.equal(dopo.movimenti.filter(m => m.storna != null).length, 2, 'le righe contrarie ci sono');
  assert.equal(dopo.movimenti.length, prima.movimenti.length + 2, 'e nessuna è sparita');
});

test('una vendita annullata restituisce piante, costo e incasso', async () => {
  const s = await stato();
  await O.esegui(O.pianoIntervento({ gruppo: Bg, piante: 20, tipo: 'tratt', ore: 1,
    costoMateriali: 10, tariffa: 25, data: DATA }));
  const s1 = await stato();
  const { operazione } = await O.esegui(O.pianoVendita({ gruppo: Bg, giacenza: 20,
    costo: s1.c.get(Bg.id), quantita: 5, prezzo: 12, data: DATA }));
  await O.storna({ operazione }, { data: DATA });
  const s2 = await stato();
  assert.equal(s2.q.get(Bg.id), 20);
  vicino(s2.c.get(Bg.id), 35);
  const vendite = s2.movimenti.filter(m => m.tipo === 'vendita');
  assert.equal(vendite.reduce((t, m) => t + m.valore, 0), 0, 'l\'incasso si annulla');
  assert.equal(vendite.reduce((t, m) => t - m.qta, 0), 0, 'le piante vendute tornano zero');
  assert.ok(s.q.get(Bg.id) === 20);
});

test('uno storno non si storna, e un\'operazione non si annulla due volte', async () => {
  const storno = (await db.movimenti.toArray()).find(m => m.storna != null);
  await assert.rejects(() => O.storna({ operazione: storno.operazione }), /storno non si storna/);
  const vendita = (await db.movimenti.toArray()).find(m => m.tipo === 'vendita' && m.storna == null);
  await assert.rejects(() => O.storna({ operazione: vendita.operazione }), /già stata annullata/);
});

test('la resa non si fa ingannare dallo storno di una perdita', async () => {
  const s = await stato();
  const { operazione } = await O.esegui(O.pianoConteggio({ gruppo: Bg, attese: 20, contate: 14, data: DATA }));
  let r = C.resa([Bg], (await stato()).movimenti, (await stato()).q);
  vicino(r.quota, 14 / 20);
  await O.storna({ operazione }, { data: DATA });
  const d = await stato();
  r = C.resa([Bg], d.movimenti, d.q);
  assert.equal(r.entrate, 20, 'lo storno di una perdita non è un ingresso');
  assert.equal(r.quota, 1);
  assert.ok(s.q.get(Bg.id) === 20);
});

test('le righe di prima delle operazioni si annullano una alla volta', async () => {
  const vecchia = await db.movimenti.add({ data: DATA, tipo: 'perdita', lotto: 'ACE-26-009',
    gruppo: Bg.id, qta: -3, costo: 0, note: 'importata', creato: DATA });
  await O.storna({ movimento: vecchia }, { data: DATA });
  assert.equal((await stato()).q.get(Bg.id), 20);
});
