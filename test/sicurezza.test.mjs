/* Le difese dei dati · § 8. Un'app che dura anni deve poter tornare
   indietro da un import sbagliato: è l'incidente più facile da fare. */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db, apri } from '../js/db.js';
import * as O from '../js/operazioni.js';
import * as B from '../js/backup.js';

const DATA = '2026-05-01';
await apri();

await O.creaLotto({
  lotto: { id:'QUE-26-001', specie:'Quercus ilex', sigla:'QUE', anno:'26', progressivo:'001',
           origine:'seme', dataIngresso: DATA },
  inserite: 50, data: DATA,
});

test('un import sbagliato si annulla', async () => {
  const pieno = (await B.esporta()).testo;
  assert.equal(await db.movimenti.count(), 1);

  /* il file vuoto: quello che si esporta per sbaglio ad app appena aperta */
  const vuoto = JSON.stringify({ schema:'1.0', esportato: new Date().toISOString(),
    lotti:[], gruppi:[], movimenti:[], eventi:[], conteggi:[], config:{} });

  const esame = await B.esamina(vuoto);
  assert.equal(esame.righeFile, 0);
  assert.equal(esame.perdita, 3, 'l\'app sa dire quante righe perderesti · 1 lotto + 1 gruppo + 1 movimento');

  await B.importa(vuoto);
  assert.equal(await db.lotti.count(), 0, 'l\'import ha fatto il suo mestiere');

  const ist = await B.elencoIstantanee();
  assert.equal(ist[0].motivo, 'prima di un import');
  assert.equal(ist[0].righe, 3);

  await B.ripristina(ist[0].id);
  assert.equal(await db.lotti.count(), 1, 'tornati indietro');
  assert.equal((await db.movimenti.toArray())[0].qta, 50);

  const dopo = await B.elencoIstantanee();
  assert.equal(dopo[0].motivo, 'prima di un ripristino', 'anche il ripristino si annulla');
  assert.equal(JSON.parse(pieno).lotti.length, 1);
});

test('l\'istantanea automatica scatta una volta al giorno', async () => {
  await db.istantanee.clear();
  assert.ok(await B.istantaneaGiornaliera(), 'la prima si prende');
  assert.equal(await B.istantaneaGiornaliera(), null, 'la seconda no');
  await db.istantanee.toCollection().modify({ data: new Date(Date.now() - 30 * 3600e3).toISOString() });
  assert.ok(await B.istantaneaGiornaliera(), 'il giorno dopo sì');
});

test('il promemoria conta le righe scritte, non solo i giorni', async () => {
  await B.esporta();
  assert.equal(await B.righeNonSalvate(), 0);
  assert.equal(await B.backupScaduto(14), null, 'appena salvato, nessun avviso');

  const g = (await db.gruppi.toArray())[0];
  await O.esegui(O.pianoConteggio({ gruppo: g, attese: 50, contate: 44, data: DATA }));
  assert.equal(await B.righeNonSalvate(), 2, 'un movimento di perdita e un conteggio');

  const av = await B.backupScaduto(14);
  assert.equal(av.righe, 2, 'avvisa subito, senza aspettare quattordici giorni');
});

test('le istantanee non finiscono nell\'export', async () => {
  const dump = JSON.parse((await B.esporta()).testo);
  assert.equal(dump.istantanee, undefined);
  assert.equal(dump.config.istantanee, undefined);
});

test('un file di schema diverso non tocca niente', async () => {
  const prima = await db.movimenti.count();
  await assert.rejects(() => B.importa('{"schema":"2.0","lotti":[]}'), /incompatibile/i);
  assert.equal(await db.movimenti.count(), prima);
});

test('il corpo multiparte per Drive è ben formato', async () => {
  const { corpoMultiparte } = await import('../js/drive.js');
  const { tipo, corpo } = corpoMultiparte({ name: 'serra.json', parents: ['abc'] }, '{"a":1}');
  const confine = tipo.match(/boundary=(.+)$/)[1];
  assert.ok(corpo.startsWith(`--${confine}\r\n`), 'apre col confine');
  assert.ok(corpo.endsWith(`--${confine}--`), 'chiude col confine');
  assert.equal(corpo.split(`--${confine}`).length - 1, 3, 'due parti e la chiusura');
  assert.ok(corpo.includes('"parents":["abc"]'), 'la cartella di destinazione c\'è');
  assert.ok(corpo.includes('{"a":1}'), 'e i dati pure');
});
