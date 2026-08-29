/* Quanto pesa il backup fra qualche anno?
   Non a spanne: si simula con le stesse funzioni dell'app e si pesa.
   node dev/stima.mjs [lotti] [anni] */
import 'fake-indexeddb/auto';
import { db, apri, leggiConfig } from '../js/db.js';
import * as C from '../js/calcoli.js';
import * as O from '../js/operazioni.js';
import * as B from '../js/backup.js';
import { gzipSync } from 'node:zlib';

const LOTTI = +process.argv[2] || 50;
const ANNI  = +process.argv[3] || 5;

await apri();
const cfg = await leggiConfig();
const CLASSI = cfg.classi.filter(c => c.attiva && c.id !== 'VAS');
const miscela = cfg.miscele[0];
const SPECIE = ['Acer palmatum', 'Ginepro itoigawa', 'Pinus mugo', 'Carpinus betulus', 'Prunus mume'];
const caso = (n) => Math.floor(Math.random() * n);

const saldi = async () => {
  const [m, e] = await Promise.all([db.movimenti.toArray(), db.eventi.toArray()]);
  return { m, q: C.saldi(m), c: C.costi(m, e, 25) };
};

/* --- si creano i lotti: metà con una prova a due valori --- */
for (let i = 0; i < LOTTI; i++){
  const anno = String(24 + caso(ANNI)).padStart(2, '0');
  await O.creaLotto({
    lotto: { id: `LOT-${anno}-${String(i).padStart(3, '0')}`, specie: SPECIE[i % SPECIE.length],
             sigla: 'LOT', anno, progressivo: String(i), origine: 'talea',
             dataIngresso: `20${anno}-03-15`, provenienza: 'pianta madre del vivaio' },
    inserite: 40 + caso(80), data: `20${anno}-03-15`,
    prove: i % 2 ? [{ variabile: 'Substrato', valori: ['Torba', 'Pomice'] }] : [],
  });
}

/* --- gli anni passano: si conta, si rinvasa, si lavora, si vende --- */
for (let anno = 0; anno < ANNI; anno++){
  const data = `20${26 + anno}-04-10`;
  const aperti = (await db.gruppi.toArray()).filter(g => g.aperto);
  for (const g of aperti){
    const s = await saldi();
    const n = s.q.get(g.id) || 0;
    if (n <= 0) continue;

    /* due interventi l'anno */
    for (const t of ['pot-pul', 'conc'])
      await O.esegui(O.pianoIntervento({ gruppo: g, piante: n, tipo: t,
        dettagli: t === 'conc' ? { scelta: 'Organico' } : {},
        ore: n * 0.02, costoMateriali: n * 0.12, tariffa: 25, data,
        note: 'lavorazione di stagione' }));

    /* un rinvaso ogni due anni, con una perdita fisiologica */
    if (anno % 2 === 0){
      const s2 = await saldi();
      const vive = Math.max(0, (s2.q.get(g.id) || 0) - caso(4));
      const i = CLASSI.findIndex(c => c.id === g.classe);
      const su = CLASSI[Math.min(i + 1, CLASSI.length - 1)];
      const giu = CLASSI[Math.max(0, i)];
      const meta = Math.floor(vive / 2);
      const dest = meta > 0 && su.id !== giu.id
        ? [{ classe: su.id, piante: meta }, { classe: giu.id, piante: vive - meta }]
        : [{ classe: su.id, piante: vive }];
      await O.esegui(O.pianoRinvaso({
        gruppo: g, attese: s2.q.get(g.id) || 0, contate: vive, costo: s2.c.get(g.id) || 0,
        destinazioni: dest, miscela, quote: miscela.quote,
        materiali: cfg.materiali, classi: cfg.classi,
        costoVasi: vive * 0.35, ore: vive * 0.05, tariffa: 25, data,
        note: 'rinvaso di stagione, radici in ordine' }));
    }
  }

  /* si vende un gruppo su cinque */
  for (const g of (await db.gruppi.toArray()).filter(x => x.aperto)){
    if (caso(5)) continue;
    const s = await saldi();
    const n = s.q.get(g.id) || 0;
    if (n < 3) continue;
    await O.esegui(O.pianoVendita({ gruppo: g, giacenza: n, costo: s.c.get(g.id) || 0,
      quantita: Math.max(1, Math.floor(n / 3)), prezzo: 18, data }));
  }
}

/* --- il peso --- */
const dump = await B.costruisciExport();
const testo = JSON.stringify(dump, null, 1);
const compatto = JSON.stringify(dump);
const zip = gzipSync(Buffer.from(testo));
const righe = B.conta(dump);
const kb = n => (n / 1024).toFixed(0) + ' KB';

console.log(`\n${LOTTI} lotti · ${ANNI} anni di lavorazioni\n`);
for (const [t, v] of Object.entries(B.contaPerTabella(dump)))
  console.log(`  ${t.padEnd(11)} ${String(v.length ?? v).padStart(6)}`);
console.log(`\n  righe in tutto      ${righe}`);
console.log(`  gruppi aperti       ${dump.gruppi.filter(g => g.aperto).length} su ${dump.gruppi.length}`);
console.log(`\n  file come lo scrive l'app  ${kb(Buffer.byteLength(testo))}`);
console.log(`  senza indentazione         ${kb(Buffer.byteLength(compatto))}`);
console.log(`  compresso (gzip)           ${kb(zip.length)}`);
console.log(`  per riga                   ${(Buffer.byteLength(testo) / righe).toFixed(0)} byte\n`);
