/* Unire due gruppi dello stesso lotto: quello che si perde e quello che
   resta. Nel vaso c'è scritto solo il codice lotto, quindi due mucchi
   mescolati sul bancale sono un mucchio solo anche qui. */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db, apri, leggiConfig } from '../js/db.js';
import * as C from '../js/calcoli.js';
import * as O from '../js/operazioni.js';

const DATA = '2026-04-01';
await apri();
const cfg = await leggiConfig();

const stato = async () => {
  const [movimenti, eventi] = await Promise.all([db.movimenti.toArray(), db.eventi.toArray()]);
  return { movimenti, q: C.saldi(movimenti), c: C.costi(movimenti, eventi, 25) };
};

const rinvasa = async (g, dest) => {
  const s = await stato();
  return O.esegui(O.pianoRinvaso({
    gruppo: g, attese: s.q.get(g.id), contate: s.q.get(g.id), costo: s.c.get(g.id) || 0,
    destinazioni: [dest], miscela: cfg.miscele[0], quote: cfg.miscele[0].quote,
    materiali: cfg.materiali, classi: cfg.classi, costoVasi: 0, ore: 1, tariffa: 25, data: DATA,
  }));
};

await O.creaLotto({
  lotto: { id:'PIN-26-001', specie:'Pinus mugo', sigla:'PIN', anno:'26', progressivo:'001',
           origine:'talea', dataIngresso: DATA },
  inserite: 80, data: DATA,
  prove: [{ variabile:'Ormone', valori:['IBA', 'Nessuno'] }],
});

test('separate finché non dici tu', async () => {
  const [a, b] = await db.gruppi.toArray();
  await rinvasa(a, { classe:'12', piante: 40 });
  await rinvasa(b, { classe:'12', piante: 40 });
  const dodici = (await db.gruppi.toArray()).filter(g => g.classe === '12');
  assert.equal(dodici.length, 2, 'etichette diverse, gruppi diversi');
  assert.deepEqual(dodici.map(g => g.suffisso), ['', 'B'], 'il secondo prende un suffisso libero');
});

test('unite, cade solo l\'etichetta che le divideva', async () => {
  await db.delete();
  await apri();
  await O.creaLotto({
    lotto: { id:'PIN-26-002', specie:'Pinus mugo', sigla:'PIN', anno:'26', progressivo:'002',
             origine:'talea', dataIngresso: DATA },
    inserite: 80, data: DATA,
    prove: [{ variabile:'Ormone', valori:['IBA', 'Nessuno'] }],
  });
  const [a, b] = await db.gruppi.toArray();
  await rinvasa(a, { classe:'12', piante: 40 });

  const primo = (await db.gruppi.toArray()).find(g => g.classe === '12');
  assert.equal(primo.storicoProve.length, 1, 'nasce con l\'etichetta del genitore');

  const s = await stato();
  const piano = O.pianoRinvaso({
    gruppo: b, attese: 40, contate: 40, costo: s.c.get(b.id) || 0,
    destinazioni: [{ classe:'12', piante: 40, unisci: primo }],
    miscela: cfg.miscele[0], quote: cfg.miscele[0].quote,
    materiali: cfg.materiali, classi: cfg.classi, costoVasi: 0, ore: 1, tariffa: 25, data: DATA,
  });
  assert.deepEqual(piano.destinazioni[0].etichettePerse.map(p => p.valore).sort(),
    ['IBA', 'Nessuno'], 'la conferma dice quali etichette cadono');
  await O.esegui(piano);

  const dodici = (await db.gruppi.toArray()).filter(g => g.classe === '12' && g.aperto);
  assert.equal(dodici.length, 1, 'un gruppo solo');
  const dopo = await stato();
  assert.equal(dopo.q.get(dodici[0].id), 80, 'tutte le piante insieme');
  assert.deepEqual(dodici[0].storicoProve, [], 'nessuna etichetta è vera di tutte');
  assert.equal(dodici[0].suffisso, '', 'rimasto solo, torna a chiamarsi come il lotto');
});

test('dopo l\'unione la prova risulta conclusa, non fallita', async () => {
  const gruppi = await db.gruppi.toArray();
  const s = await stato();
  const conIBA = gruppi.filter(g => C.etichetta(g, 'Ormone') === 'IBA');
  const r = C.resa(conIBA, s.movimenti, s.q);
  assert.equal(r.vive, 0, 'il gruppo di partenza è chiuso e vuoto');
  assert.equal(r.uscite, 40, 'ma le sue 40 piante sono passate al gruppo unito');
  assert.equal(r.quota, 1, '100%: sono vive, hanno solo smesso di essere una prova');
});

test('quello che era già stato contato resta leggibile', async () => {
  const conteggi = await db.conteggi.toArray();
  assert.ok(conteggi.length >= 2, 'i conteggi dei due gruppi separati restano');
  const trasferimenti = (await db.movimenti.toArray()).filter(m => m.tipo === 'trasferimento');
  assert.equal(trasferimenti.length, 2, 'due movimenti distinti: si vede da dove vengono');
  const { c } = await stato();
  const dodici = (await db.gruppi.toArray()).find(g => g.classe === '12' && g.aperto);
  assert.equal(Math.round(c.get(dodici.id)), 77,
    'i costi si sommano: 2 × (1 h × 25 + 30 L di miscela a 0,45)');
});
