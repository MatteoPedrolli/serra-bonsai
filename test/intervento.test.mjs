/* L'intervento su molti gruppi: il totale scritto dall'utente è quello
   che finisce nei conti, al centesimo. */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
const { arrotonda } = await import('../js/viste/intervento.js');

test('i centesimi avanzati non spariscono né si moltiplicano', () => {
  const parti = [30 * 9 / 188, 30 * 20 / 188, 30 * 1 / 188, 30 * 158 / 188];
  const r = arrotonda(parti, 30);
  assert.equal(Math.round(r.reduce((s, x) => s + x, 0) * 100), 3000);
  r.forEach((x, i) => assert.ok(Math.abs(x - parti[i]) < 0.01, 'nessuno si allontana più di un centesimo'));
});

test('tre parti uguali di un euro', () => {
  const r = arrotonda([1 / 3, 1 / 3, 1 / 3], 1);
  assert.deepEqual(r.slice().sort(), [0.33, 0.33, 0.34]);
});

test('già tondi restano tondi', () => {
  assert.deepEqual(arrotonda([1.5, 2.25, 0], 3.75), [1.5, 2.25, 0]);
});
