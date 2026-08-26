/* Il file prodotto da dev/migrazione.mjs deve entrare nell'app e
   restituire gli stessi numeri del vecchio foglio. § 9 */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { db, apri } from '../js/db.js';
import * as C from '../js/calcoli.js';
import * as B from '../js/backup.js';

const testo = readFileSync('serra-backup-migrato.json', 'utf8');

await apri();
await B.importa(testo);

const gruppi = await db.gruppi.toArray();
const movimenti = await db.movimenti.toArray();
const q = C.saldi(movimenti);
const di = lotto => gruppi.filter(g => g.lotto === lotto);
const vive = lotto => di(lotto).reduce((s, g) => s + (q.get(g.id) || 0), 0);

test('il foglio entra tutto', async () => {
  assert.equal((await db.lotti.count()), 13);
  assert.equal(gruppi.length, 25);
  assert.equal((await db.eventi.count()), 0, 'i tab Rinvaso, Potatura e Legatura erano vuoti');
});

test('le divisioni decise a mano', async () => {
  const fic = di('Fic-26-014');
  assert.equal(fic.length, 2, 'mezze microphylla, mezze retusa');
  assert.deepEqual(fic.map(g => g.prove[0].valore).sort(), ['Ficus microphylla', 'Ficus retusa']);
  assert.equal(vive('Fic-26-014'), 30);
  assert.equal(vive('ITO-26-016'), 60, '30 grandi + 30 piccole, come il tab Lotti');
  const v = await db.variabili.get('specie');
  assert.equal(v.ambito, 'selezione', 'la specie è materiale di partenza, non un trattamento');
});

test('le giacenze coincidono con la colonna Quantità', () => {
  assert.equal(vive('ITO-25-010'), 64);   // 23+22+8+11+0
  assert.equal(vive('KYS-25-011'), 49);   // 28+21
  assert.equal(vive('ITO-25-009'), 9);
  assert.equal(vive('TAX-23-006'), 9);
});

test('le perdite storiche restano leggibili come movimenti', async () => {
  const perse = movimenti.filter(m => m.tipo === 'perdita' && m.lotto === 'ITO-25-010')
    .reduce((s, m) => s - m.qta, 0);
  assert.equal(perse, 51, '115 inserite − 64 attecchite');
  const c = await db.conteggi.where({ gruppo: di('ITO-25-010')[4].id }).first();
  assert.equal(c.contate, 0);
  assert.match(c.note, /tutte morte/, 'la conclusione della prova diventa la nota del conteggio');
});

test('ITO-26-017: la cima si legge, il diametro no · § 6.1', () => {
  const g = di('ITO-26-017');
  assert.equal(g.length, 5);
  assert.equal(g.reduce((s, x) => s + q.get(x.id), 0), 61, '4 + 25 + 32');
  assert.equal(C.leggibilita(g, 'Cima').esito, 'leggibile',
    'con e senza cima sono distribuite allo stesso modo fra medie e piccole');
  assert.equal(C.leggibilita(g, 'Diametro talea').esito, 'confuso',
    'i 4 grandi non hanno distinzione di cima');
});

test('il confronto sul buio è confuso, quello sull\'antitraspirante no · § 6.1', () => {
  assert.equal(C.leggibilita(di('ITO-25-010'), 'Giorni al buio').esito, 'confuso',
    'la variante C cambia anche il diametro delle talee');
  assert.equal(C.leggibilita(di('KYS-25-011'), 'Antitraspirante').esito, 'leggibile');
});

test('niente costi inventati', () => {
  const costi = C.costi(movimenti, [], 25);
  assert.ok([...costi.values()].every(c => c === 0), 'il vecchio foglio non registrava lavorazioni');
});

test('i lotti di produzione aspettano il censimento in classe NA · § 9.1', async () => {
  const na = gruppi.filter(g => g.classe === 'NA');
  assert.equal(na.length, 11);
  const classe = await db.classi.get('NA');
  assert.equal(classe.attiva, false, 'non è una destinazione di rinvaso, è un promemoria');
});
