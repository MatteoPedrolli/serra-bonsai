/* Genera le icone PNG dell'app senza dipendenze: un vaso e un germoglio.
   node dev/icone.mjs */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const POMICE = [228, 226, 218], INCHIOSTRO = [25, 30, 26], GERMOGLIO = [63, 125, 32];

function png(size, path){
  const px = (x, y) => {
    const u = x / size, v = y / size;
    /* vaso: trapezio fra 0.52 e 0.86 di altezza */
    const dentroVaso = v > .54 && v < .86 &&
      Math.abs(u - .5) < (.30 - (v - .54) * .42);
    const bordo = v > .48 && v <= .54 && Math.abs(u - .5) < .34;
    /* germoglio: due foglie tonde e un gambo */
    const gambo = Math.abs(u - .5) < .022 && v > .24 && v < .55;
    const foglia = (cx, cy, r) => ((u - cx) ** 2 + ((v - cy) * 1.7) ** 2) < r * r;
    const foglie = foglia(.37, .33, .13) || foglia(.63, .27, .13);
    if (foglie || gambo) return GERMOGLIO;
    if (dentroVaso || bordo) return INCHIOSTRO;
    return POMICE;
  };
  const righe = [];
  for (let y = 0; y < size; y++){
    const r = Buffer.alloc(size * 3 + 1);
    for (let x = 0; x < size; x++){
      const c = px(x + .5, y + .5);
      r[1 + x * 3] = c[0]; r[2 + x * 3] = c[1]; r[3 + x * 3] = c[2];
    }
    righe.push(r);
  }
  const dati = deflateSync(Buffer.concat(righe), { level: 9 });
  const crcTab = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = b => { let c = 0xFFFFFFFF;
    for (const x of b) c = crcTab[(c ^ x) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (tipo, corpo) => {
    const lung = Buffer.alloc(4); lung.writeUInt32BE(corpo.length);
    const tc = Buffer.concat([Buffer.from(tipo), corpo]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tc));
    return Buffer.concat([lung, tc, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', dati), chunk('IEND', Buffer.alloc(0)),
  ]));
  console.log(path, size + '×' + size);
}

png(192, 'icone/icona-192.png');
png(512, 'icone/icona-512.png');
png(180, 'icone/icona-180.png');
