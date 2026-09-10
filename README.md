# VIVAIO

App di gestione della produzione bonsai: dalla talea alla vendita.
(Fino alla 2.0 si chiamava Serra: l'archivio interno, la cartella su Drive
e i nomi dei file restano `serra`, perché rinominarli vorrebbe dire
ripartire da un archivio vuoto.)
File statici, nessun backend, dati su IndexedDB. Schema **1.0**.

**In linea: https://matteopedrolli.github.io/serra-bonsai/**
Dal telefono: aprire il sito in Chrome → *Aggiungi a schermata Home*.

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
| `js/backup.js` | export/import JSON, istantanee, promemoria |
| `js/drive.js` | copia automatica su Google Drive |
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

### Copia automatica su Drive

L'app può depositare il JSON su Drive da sola, all'avvio e quando la
chiudi, senza server nostri in mezzo: è il browser che chiama le API di
Google. Scrive soltanto — non rilegge mai l'archivio da fuori.

Serve un codice cliente OAuth, da creare una volta:

1. [console.cloud.google.com](https://console.cloud.google.com) → nuovo progetto, nome a piacere
2. **API e servizi → Libreria** → abilita **Google Drive API**
3. **Schermata consenso OAuth** → tipo *Esterno* → compila nome app e la
   tua mail → fra gli utenti di test aggiungi il tuo indirizzo Google
4. **Credenziali → Crea credenziali → ID client OAuth** → tipo
   *Applicazione web*. In **Origini JavaScript autorizzate** metti
   `https://matteopedrolli.github.io` (e `http://localhost:8080` per le
   prove). Nessun URI di reindirizzamento.
5. Copia l'ID che finisce in `.apps.googleusercontent.com` e incollalo
   in Config → Dati → *copia automatica su Drive*

Lo scope richiesto è `drive.file`: l'app vede solo i file che ha creato
lei, quindi Google non richiede alcuna verifica. La copia è un file solo,
`serra.json` nella cartella **Serra — backup**, riscritto ogni N giorni
(Impostazioni → Dati, predefinito 3) se ci sono righe nuove. Drive ne
conserva tutte le versioni: tasto destro → *Gestisci versioni*.

Il permesso dura un'ora e si rinnova in silenzio finché la sessione
Google del telefono è viva. Quando non ci riesce, l'app smette di
insistere e aspetta un tocco in Config: non apre finestre a sorpresa.

## Stato della costruzione

- [x] **Fase 1** — archivi, saldi, costi, export/import, test
- [x] **Fase 2** — vista Serra, scheda gruppo, i quattro flussi
- [x] **Fase 3** — nuovo lotto con vaschette incrociate, le sei sezioni di Config
- [x] **Fase 4** — vista Lotto e le cinque interrogazioni di Analisi
- [x] **Fase 5** — migrazione dal foglio «Bonsai Inventario DB» (`dev/migrazione.mjs`)

**2.0**

- [x] Home a pulsanti; **Nursery** (gruppi in vaschetta) e **Produzione** (in vaso)
  separate. Nessun dato nuovo: la zona la dice la classe del vaso, il § 11 resta chiuso
- [x] **Intervento** su un gruppo, un lotto, una zona o tutto il vivaio: una
  lavorazione per gruppo, totali al centesimo
- [x] **Inventario** guidato nell'ordine dei bancali, interrompibile, scrittura
  unica alla fine preceduta da un'istantanea
- [x] **Storno**: ogni salvataggio è un'operazione con un codice; annullarla scrive
  le righe contrarie e nella storia restano entrambe
- [x] Modifica dell'anagrafica dei lotti (il codice e le quantità no)
- [x] Impostazioni: i costi in un posto, **filo per classe di vaso** (§ 12.1),
  miscele eliminabili
- [x] Stile più morbido, tutto in un blocco in fondo a `css/serra.css`

Restano aperte le questioni del § 12: suffisso di grado, litri per vaso
reali, prezzi e preset veri.

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
