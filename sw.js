/* SERRA · service worker — in serra la rete non c'è.
   Cambia CACHE a ogni rilascio: il vecchio guscio viene buttato. */
const CACHE = 'serra-v14';
const GUSCIO = [
  '.', 'index.html', 'manifest.webmanifest', 'privacy.html', 'termini.html',
  'css/serra.css',
  'js/app.js', 'js/stato.js', 'js/ui.js', 'js/db.js', 'js/calcoli.js',
  'js/operazioni.js', 'js/backup.js', 'js/drive.js', 'js/vendor/dexie.mjs',
  'js/viste/elenco.js', 'js/viste/gruppo.js', 'js/viste/lotto.js', 'js/viste/lotti.js',
  'js/viste/flusso.js', 'js/viste/nuovoLotto.js', 'js/viste/config.js', 'js/viste/analisi.js',
  'icone/icona.svg', 'icone/icona-192.png', 'icone/icona-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(GUSCIO))
    .then(() => self.skipWaiting()));
});

/* «entra in servizio adesso», mandato da Config → Dati */
self.addEventListener('message', ev => { if (ev.data === 'salta-attesa') self.skipWaiting(); });

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

/* Cache prima, rete poi: l'app deve partire anche senza campo.
   I font di Google si mettono da parte al primo caricamento. */
/* Si mettono da parte solo i file dell'app e i font. Le chiamate a
   Google — permessi e caricamento su Drive — devono andare in rete ogni
   volta: una risposta vecchia lì dentro farebbe solo danni. */
const daTenere = url => {
  const u = new URL(url);
  return u.origin === location.origin
    || u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com';
};

self.addEventListener('fetch', ev => {
  const { request } = ev;
  if (request.method !== 'GET' || !daTenere(request.url)) return;
  ev.respondWith(caches.match(request).then(risposta => {
    const rete = fetch(request).then(r => {
      if (r && (r.ok || r.type === 'opaque'))
        caches.open(CACHE).then(c => c.put(request, r.clone()));
      return r;
    }).catch(() => risposta);
    return risposta || rete;
  }));
});
