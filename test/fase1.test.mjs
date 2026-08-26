/* Fase 1 — le fondamenta, verificate con dati finti prima della grafica.
   Le tre regole di § 4.2 sono il cuore di questo file. */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db, apri, leggiConfig } from '../js/db.js';
import * as C from '../js/calcoli.js';
import * as O from '../js/operazioni.js';
import * as B from '../js/backup.js';

const DATA = '2026-03-01';
const vicino = (a, b, t = 0.011) => assert.ok(Math.abs(a - b) < t, `${a} ≠ ${b}`);

async function stato(){
  const [movimenti, eventi, gruppi] = await Promise.all(
    [db.movimenti.toArray(), db.eventi.toArray(), db.gruppi.toArray()]);
  return { movimenti, eventi, gruppi,
           q: C.saldi(movimenti), c: C.costi(movimenti, eventi, 25) };
}

await apri();

test('semi di configurazione', async () => {
  const cfg = await leggiConfig();
  assert.equal(cfg.classi[0].id, 'VAS', 'VAS è la prima classe');
  assert.equal(cfg.impostazioni.tariffaOraria, 25);
  assert.equal(cfg.impostazioni.giorniPromemoriaBackup, 14);
});

test('nuovo lotto con prove incrociate 2×2', async () => {
  await O.creaLotto({
    lotto: { id: 'ACE-25-001', specie: 'Acer palmatum', sigla: 'ACE', anno: '25',
             progressivo: '001', origine: 'talea', dataIngresso: DATA },
    inserite: 120, data: DATA,
    prove: [ { variabile: 'Substrato', valori: ['Torba', 'Pomice'] },
             { variabile: 'Ormone',    valori: ['IBA', 'AIB'] } ],
  });
  const g = await db.gruppi.toArray();
  assert.equal(g.length, 4, 'quattro vaschette');
  assert.ok(g.every(x => x.classe === 'VAS' && x.prove.length === 2));
  const s = await stato();
  assert.deepEqual([...s.q.values()], [30, 30, 30, 30], 'talee divise in parti uguali');
  const confronto = C.leggibilita(g, 'Substrato');
  assert.equal(confronto.esito, 'leggibile', 'l\'incrocio rende il confronto valido');
});

test('la perdita non scarica il costo · § 4.2', async () => {
  const g = (await db.gruppi.toArray())[0];
  const cfg = await leggiConfig();

  await O.esegui(O.pianoIntervento({ gruppo: g, piante: 30, tipo: 'tratt',
    ore: 1, costoMateriali: 10, tariffa: cfg.impostazioni.tariffaOraria, data: DATA }));
  let s = await stato();
  assert.equal(s.c.get(g.id), 35, '10 € materiali + 1 h × 25');
  vicino(C.costoPianta(s.c.get(g.id), s.q.get(g.id)), 35 / 30);

  await O.esegui(O.pianoConteggio({ gruppo: g, attese: 30, contate: 24, vigore: 4, data: DATA }));
  s = await stato();
  assert.equal(s.q.get(g.id), 24, 'sei perdute');
  assert.equal(s.c.get(g.id), 35, 'il costo resta tutto sulle sopravvissute');
  vicino(C.costoPianta(s.c.get(g.id), s.q.get(g.id)), 35 / 24);
  assert.equal((await db.conteggi.toArray()).at(-1).vigore, 4, 'il vigore finisce nei conteggi');
});

test('rinvaso: substrato per litri, ore e vasi per piante · § 4.3', async () => {
  const g = (await db.gruppi.toArray())[0];
  const cfg = await leggiConfig();
  const miscela = cfg.miscele.find(m => m.id === 'produzione');

  const piano = O.pianoRinvaso({
    gruppo: g, attese: 24, contate: 24, costo: 35,
    destinazioni: [ { classe: '12', piante: 12 }, { classe: '10Q', piante: 12 } ],
    miscela, quote: miscela.quote, materiali: cfg.materiali, classi: cfg.classi,
    costoVasi: 6, ore: 2, tariffa: 25, data: DATA,
  });

  vicino(piano.litriTot, 14.4, 0.001);              // 12×0.75 + 12×0.45
  vicino(piano.costoSubstrato, 6.48, 0.001);
  vicino(piano.destinazioni[0].costoOperazione, 4.05 + 3 + 25);
  vicino(piano.destinazioni[1].costoOperazione, 2.43 + 3 + 25);
  vicino(piano.destinazioni[0].quotaCosto, 17.5);
  vicino(piano.eventi[0].dettagli.consumi.pomice, 5.4, 0.01);  // 8.64 L × 0.625
  assert.equal(piano.resto, 0);

  await O.esegui(piano);
  const s = await stato();
  assert.equal(s.q.get(g.id), 0);
  assert.equal((await db.gruppi.get(g.id)).aperto, false, 'il gruppo svuotato si chiude, non si cancella');

  const dodici = (await db.gruppi.toArray()).find(x => x.classe === '12');
  const dieciQ = (await db.gruppi.toArray()).find(x => x.classe === '10Q');
  assert.equal(s.q.get(dodici.id), 12);
  vicino(s.c.get(dodici.id), 49.55);
  vicino(s.c.get(dieciQ.id), 47.93);
  vicino(s.c.get(dodici.id) + s.c.get(dieciQ.id), 35 + 62.48, 0.02);

  assert.deepEqual(dodici.storicoProve.map(p => p.valore), ['Torba', 'IBA'],
    'le etichette seguono le piante attraverso il rinvaso · § 6.2');
});

test('la vendita scarica il costo pro-quota · § 4.2', async () => {
  const dodici = (await db.gruppi.toArray()).find(x => x.classe === '12');
  let s = await stato();
  const costoPrima = s.c.get(dodici.id);

  const piano = O.pianoVendita({ gruppo: dodici, giacenza: 12, costo: costoPrima,
    quantita: 6, prezzo: 10, data: DATA });
  vicino(piano.costoCeduto, costoPrima / 2);
  vicino(piano.margine, 60 - costoPrima / 2);

  await O.esegui(piano);
  s = await stato();
  assert.equal(s.q.get(dodici.id), 6);
  vicino(s.c.get(dodici.id), costoPrima / 2);
  vicino(C.costoPianta(s.c.get(dodici.id), s.q.get(dodici.id)),
         C.costoPianta(costoPrima, 12), 0.02, 'il costo a pianta non cambia con la vendita');
});

test('giacenza e saldi coincidono, gruppo per gruppo · § 4.1', async () => {
  const s = await stato();
  for (const g of s.gruppi)
    assert.equal(C.giacenza(s.movimenti, g.id), s.q.get(g.id) || 0, 'gruppo ' + g.id);
  assert.ok(s.movimenti.every(m => m.creato), 'ogni riga porta la sua data di scrittura');
});

test('export e import ricostruiscono tutto', async () => {
  const prima = await stato();
  const { testo, righe } = await B.esporta();
  assert.ok(righe > 0);
  const dump = JSON.parse(testo);
  assert.equal(dump.schema, '1.0');
  assert.ok(dump.config.classi.length && dump.config.impostazioni.tariffaOraria === 25);

  await db.movimenti.clear(); await db.gruppi.clear(); await db.lotti.clear();
  assert.equal((await db.movimenti.count()), 0);

  await B.importa(testo);
  const dopo = await stato();
  assert.equal(dopo.movimenti.length, prima.movimenti.length);
  assert.equal(dopo.gruppi.length, prima.gruppi.length);
  for (const g of dopo.gruppi) vicino(dopo.c.get(g.id) || 0, prima.c.get(g.id) || 0);

  await assert.rejects(() => B.importa('{"lotti":[]}'), /schema/i);
});

test('promemoria di backup · § 8', async () => {
  assert.equal(await B.backupScaduto(14), null, 'appena esportato, nessun avviso');
  await db.meta.put({ chiave: 'ultimoExport', valore: new Date(Date.now() - 20 * 86400000).toISOString() });
  const av = await B.backupScaduto(14);
  assert.equal(av.giorni, 20);
});

test('confronto confuso quando le variabili non sono incrociate · § 6.1', async () => {
  const due = [
    { prove: [ { variabile: 'Substrato', valore: 'Torba' },  { variabile: 'Ormone', valore: 'IBA' } ], storicoProve: [] },
    { prove: [ { variabile: 'Substrato', valore: 'Pomice' }, { variabile: 'Ormone', valore: 'AIB' } ], storicoProve: [] },
  ];
  assert.equal(C.leggibilita(due, 'Substrato').esito, 'confuso');
});
