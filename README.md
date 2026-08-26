# SERRA

App di gestione della produzione bonsai: dalla talea alla vendita.
File statici, nessun backend, dati su IndexedDB. Schema **1.0**.

Riferimento: `serra-specifica.md` — se il codice e la specifica non vanno
d'accordo, ha ragione la specifica. Le scelte del § 11 non si riaprono.

---

## Provare in locale

```bash
npm install
npm run dev        # http://localhost:8080
```

Serve un server: da `file://` IndexedDB non parte.

```bash
npm test           # le fondamenta: saldi, costi, rinvaso, export/import
```

## Mettere online

Tutto quello che serve è già nella cartella: `index.html`, `css/`, `js/`,
`icone/`, `sw.js`, `manifest.webmanifest`. Su GitHub Pages basta pubblicare
la radice del repo. `node_modules/`, `dev/` e `test/` non servono a runtime.

Dal telefono: aprire il sito in Chrome → *Aggiungi a schermata Home*.
Da lì funziona senza rete.

## Com'è fatto

| File | Cosa contiene |
|---|---|
| `js/db.js` | i dodici archivi Dexie e i semi di configurazione |
| `js/calcoli.js` | funzioni pure: giacenze, costi, substrato, leggibilità delle prove |
| `js/operazioni.js` | i piani dei quattro flussi e l'unica funzione che scrive |
| `js/backup.js` | export/import JSON e promemoria |
| `js/stato.js` | memoria di lavoro e navigazione |
| `js/viste/` | una vista per file, grafica del prototipo v3 |

**Il piano prima della scrittura.** Ogni flusso costruisce un *piano*: la
lista esatta delle righe che verranno scritte. Il passo di conferma
mostra quel piano, il tasto Salva lo esegue. Non esistono due percorsi.

**Le quantità non si scrivono.** Non c'è nessun campo `quantità`: la
giacenza è il saldo dei movimenti, ricostruito a ogni ricarica. Un gruppo
svuotato si chiude, non si cancella.

**I costi si congelano.** Ogni evento porta con sé il costo dei materiali
*e* la tariffa oraria del giorno in cui è stato registrato. Cambiare i
prezzi in Config non riscrive il passato.

## Backup

I dati stanno solo su questo dispositivo. Config → Dati → *Esporta tutto*
produce un JSON con tutti gli archivi; l'import lo rimette com'era, anche
su un altro telefono. Se l'ultimo export ha più di 14 giorni (numero
configurabile) l'app lo dice all'apertura.

Non è sincronizzazione: due dispositivi che scrivono in parallelo non si
fondono.

## Stato della costruzione

- [x] **Fase 1** — archivi, saldi, costi, export/import, test
- [x] **Fase 2** — vista Serra, scheda gruppo, i quattro flussi
- [x] **Fase 3** — nuovo lotto con vaschette incrociate, le sei sezioni di Config
- [x] **Fase 4** — vista Lotto e le cinque interrogazioni di Analisi
- [x] **Fase 5** — migrazione dal foglio «Bonsai Inventario DB» (`dev/migrazione.mjs`)

Restano aperte le questioni del § 12: filo per classe di vaso, suffisso di
grado, litri per vaso reali, prezzi e preset veri.

## Manutenzione

Aggiungendo o rinominando file dell'app, aggiornare l'elenco `GUSCIO` in
`sw.js` e alzare il numero di `CACHE`, altrimenti i telefoni già
installati continuano a servire la versione vecchia.

`node dev/icone.mjs` rigenera le icone PNG.

## Migrazione dal vecchio foglio

`dev/dati-vecchi.json` è la trascrizione del foglio Google, `dev/migrazione.mjs`
lo converte in `serra-backup-migrato.json`. Le scelte discutibili — ricodifica
delle variabili, quantità corrette a mano, divisioni dei lotti, classe di vaso —
stanno in cinque tabelle in cima allo script: si cambia una riga e si rilancia.

```bash
node dev/migrazione.mjs
```

Il test `test/migrazione.test.mjs` verifica che il file rientri nell'app con le
stesse giacenze del foglio di partenza.
