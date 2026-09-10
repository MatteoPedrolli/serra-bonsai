/* 2.0 · il filo per classe di vaso deve arrivare anche a chi ha già
   l'app, e a chi reimporta un backup di prima — senza mai sovrascrivere
   un valore scelto dall'utente. § 12.1 */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { db, apri, normalizzaConfig } from '../js/db.js';
import * as B from '../js/backup.js';

await apri();

test('un backup di prima riceve il filo per classe', async () => {
  const vecchio = JSON.parse(readFileSync('serra-backup-migrato.json', 'utf8'));
  assert.equal(vecchio.config.classi.find(c => c.id === '14').filoPerPianta, undefined,
    'il file è davvero di prima della 2.0');
  await B.importa(JSON.stringify(vecchio));
  assert.equal((await db.classi.get('14')).filoPerPianta, 0.60);
  assert.equal((await db.classi.get('NA')).filoPerPianta, 0, 'una classe senza seme riceve zero');
  assert.equal((await db.tipiIntervento.get('leg')).filoPerClasse, true);
});

test('un valore scelto dall\'utente non si tocca', async () => {
  await db.classi.update('14', { filoPerPianta: 1.5 });
  await db.tipiIntervento.update('leg', { filoPerClasse: false });
  await normalizzaConfig();
  assert.equal((await db.classi.get('14')).filoPerPianta, 1.5);
  assert.equal((await db.tipiIntervento.get('leg')).filoPerClasse, false, 'chi lo spegne lo trova spento');
});

test('le impostazioni nuove arrivano a chi ha già l\'app', async () => {
  await db.impostazioni.delete('giorniBackupDrive');
  await normalizzaConfig();
  assert.equal((await db.impostazioni.get('giorniBackupDrive')).valore, 3);
});
