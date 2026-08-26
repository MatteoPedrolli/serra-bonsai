# SERRA — Specifica tecnica

App di gestione della produzione bonsai: dalla talea alla vendita.
Sostituisce *Bonsai Manager* (HTML + Google Sheets + Apps Script).

Versione schema: **1.0** · Documento di riferimento per la costruzione.

---

## 1 · PRINCIPI DI FONDO

Cinque decisioni che spiegano tutto il resto dello schema. Se una
implementazione le contraddice, è l'implementazione a essere sbagliata.

**IL LOTTO È UNA COORTE DI NASCITA, NON UN CONTENITORE**
Stessa specie, stessa data, stessa propagazione. Non si divide mai, non
cambia mai. L'etichetta fisica nel vaso porta solo il codice lotto: si
scrive una volta sulla vaschetta e si trasferisce nel vaso singolo.

**IL GRUPPO È LOTTO × CLASSE DI CONTENITORE**
È l'unità che nasce, si divide, si fonde e si svuota. Non ha bisogno di
cartellino proprio perché il contenitore stesso lo dichiara. Rinvasare *è*
cambiare gruppo.

**LE QUANTITÀ NON SI SCRIVONO, SI CALCOLANO**
Nessun campo `quantità` aggiornato a mano. Esiste un registro di movimenti
e la giacenza è il saldo. Nessuna riga viene mai sovrascritta o cancellata.

**LE PERDITE EMERGONO DAL CONTEGGIO**
Non si annotano quando accadono. A ogni rinvaso o censimento si conta
quante ce ne sono davvero e il sistema genera il movimento della
differenza. Il rinvaso è il momento naturale: le stai già toccando tutte.

**LA SPERIMENTAZIONE NON È UN SOTTOSISTEMA**
Una prova è un gruppo che porta un'etichetta variabile/valore. Se non
riesci a distinguere due prove guardandole, non sono due prove. Le
etichette seguono le piante attraverso i rinvasi, per anni.

---

## 2 · ARCHITETTURA

| Livello | Scelta |
|---|---|
| Distribuzione | file statici su GitHub Pages, PWA installabile |
| Persistenza | IndexedDB (via Dexie.js) — nessun backend |
| Rete | non richiesta a runtime |
| Backup | export/import JSON manuale, su Drive |
| Dispositivo | telefono, uso a una mano, viewport 380 px |

**Perché locale.** L'uso è in serra, dove la rete non c'è. Il modello a
movimenti richiede di rileggere molte righe per ogni saldo: su Sheets
sarebbe una chiamata di rete per volta, su IndexedDB è istantaneo.

**Il prezzo da pagare.** I dati stanno solo su quel dispositivo. Cancellare
i dati del sito, cambiare telefono o una pulizia automatica dello storage
li elimina. L'export non è un accessorio: è parte del progetto (§ 8).

---

## 3 · MODELLO DATI

Sei archivi operativi e sei di configurazione.

### 3.1 · `lotti`

```
id            string   PK — codice lotto, es. ACE-25-001
specie        string   nome comune o riferimento a specie
nomeBotanico  string
sigla         string   prefisso del codice, es. ACE
anno          string   2 cifre
progressivo   string
origine       enum     talea | seme | acquisto | raccolta | margotta
dataIngresso  date
provenienza   string   pianta madre, vivaio, luogo di raccolta
inserite      int      quantità di partenza (genera il movimento iniziale)
condizioni    object   { tempMin, tempMax, umidMin, umidMax }  facoltativo
note          string
creato        datetime
```

`condizioni` non divide le prove: serve a confrontare **annate diverse**
(§ 6.3). `inserite` è un dato anagrafico; la giacenza reale si ricava dai
movimenti.

Indici: `specie`, `anno`, `origine`.

### 3.2 · `gruppi`

```
id            int      PK autoincrementale
lotto         string   FK → lotti.id
classe        string   FK → classi.id  (incluso VAS, vedi § 7.1)
suffisso      string   facoltativo, per distinguere gradi diversi
                       nello stesso lotto e classe (es. 'B' = legate)
prove         array    max 2 elementi: { variabile, valore }
storicoProve  array    etichette ereditate dai gruppi genitori
aperto        bool     false quando la giacenza arriva a zero
creato        datetime
```

Un gruppo con giacenza zero **non si cancella**: si chiude. La sua storia
resta leggibile e i movimenti continuano a puntarci.

`prove` sono le etichette assegnate alla nascita del gruppo.
`storicoProve` accumula quelle dei genitori: un gruppo nato in torba e poi
rinvasato in miscela sperimentale ne porta tre, di due prove distinte.

Indici: `lotto`, `classe`, `[lotto+classe+suffisso]` (univoco fra gruppi
aperti), `aperto`.

### 3.3 · `movimenti`

L'archivio più importante. Append-only.

```
id            int      PK autoincrementale
data          date
tipo          enum     apertura | attecchimento | perdita | rettifica
                       | vendita | ceduto | trasferimento
lotto         string   FK → lotti.id  (denormalizzato per le query)
gruppo        int      FK → gruppi.id — per i movimenti a gruppo singolo
gruppoDa      int      solo per trasferimento
gruppoA       int      solo per trasferimento
qta           int      con segno: positivo entra, negativo esce
costo         number    quota di costo che si sposta con le piante
valore        number    solo vendita: incasso totale
note          string
creato        datetime
```

Indici: `gruppo`, `gruppoDa`, `gruppoA`, `lotto`, `data`, `tipo`.

### 3.4 · `eventi`

Le lavorazioni. Sostituisce i fogli Rinvaso, Potatura e Legatura.

```
id            int      PK autoincrementale
data          date
tipo          string   FK → tipiIntervento.id
gruppo        int      FK → gruppi.id
lotto         string   denormalizzato
piante        int      quante piante ha coinvolto
ore           number
costoMateriali number  calcolato al momento del salvataggio
dettagli      object   campi specifici del tipo (§ 3.5)
note          string
creato        datetime
```

Indici: `gruppo`, `lotto`, `data`, `tipo`.

**Regola non negoziabile.** `costoMateriali` è il costo *calcolato quel
giorno*, non un riferimento al listino. Cambiare un prezzo in Config non
deve alterare gli eventi passati.

### 3.5 · `dettagli` per tipo

```
rinvaso       { classeDa, classeA, miscela, quote:{matId:parti},
                litriTotali, consumi:{matId:litri}, costoVasi }
concimazione  { scelta: 'Organico'|'Chimico' }
legatura      { calibro, metri }        se registrati
generico      { }
```

`consumi` va salvato esploso per materiale: è ciò che permette di sapere
quanta pomice serve per la prossima stagione (§ 6.4).

### 3.6 · `conteggi`

Facoltativo ma consigliato: la fotografia di un censimento.

```
id       int      PK
data     date
gruppo   int
attese   int
contate  int
vigore   int      1-5, facoltativo
note     string
```

Il conteggio genera anche un movimento di perdita o rettifica. Questo
archivio serve a rileggere la serie storica delle verifiche, incluso il
vigore, che non è deducibile dai soli saldi.

---

## 4 · REGOLE DI CALCOLO

### 4.1 · Giacenza

```
giacenza(gruppo) = Σ movimenti.qta dove gruppo o gruppoA = G
                 − Σ movimenti.qta dove gruppoDa = G
```

Il campo `qta` sul gruppo può essere tenuto come cache, ma deve esistere
una funzione `ricalcola(gruppo)` che lo ricostruisce dai movimenti, e
l'export deve contenere i movimenti, non la cache.

### 4.2 · Costo accumulato

```
costo(gruppo) = Σ eventi.costoTotale
              + Σ movimenti.costo entranti
              − Σ movimenti.costo uscenti

costoTotale(evento) = costoMateriali + ore × tariffaOraria
```

**Le tre regole che fanno la differenza:**

| Movimento | Quantità | Costo |
|---|---|---|
| Perdita | scende | **invariato** |
| Vendita | scende | scende pro-quota |
| Trasferimento | si sposta | si sposta pro-quota |

La perdita non scarica il costo perché quel costo è già stato sostenuto:
resta sulle sopravvissute. È il motivo per cui `costo/pianta` sale quando
muoiono delle piante, ed è il numero corretto su cui fare il prezzo.

```
quotaTrasferita = costo(gruppo) × pianteSpostate / giacenzaPrimaDelloSpostamento
```

### 4.3 · Ripartizione fra più destinazioni

Un rinvaso può smistare verso più classi. Il costo dell'operazione si
ripartisce:

- **substrato** → in proporzione ai litri di ciascuna destinazione
- **ore e vasi** → in proporzione al numero di piante

Il prototipo v3 ripartisce tutto per numero di piante: approssimazione
accettabile finché le classi coinvolte sono adiacenti, da correggere qui.

### 4.4 · Substrato

```
litriTotali   = Σ (piante_destinazione × litriPerVaso(classe))
litri(mat)    = litriTotali × parti(mat) / Σ parti
costo         = Σ litri(mat) × prezzoLitro(mat)
```

Le miscele si definiscono in **parti**, non in litri: sono proporzioni che
valgono per qualunque volume di vaso.

### 4.5 · Prezzo suggerito

```
prezzoSuggerito = costo/pianta × moltiplicatore
```

È una proposta, non un vincolo. Se il prezzo inserito in una vendita è
inferiore al costo/pianta, l'app avvisa ma non blocca.

---

## 5 · FLUSSI OPERATIVI

Riferimento visivo: `serra-prototipo-v3.html`.

### 5.1 · Tre viste

| Vista | Domanda a cui risponde | Quando |
|---|---|---|
| **Serra** | cosa ho davanti adesso | in serra, mani sporche |
| **Lotto** | come sta andando questa coorte | a tavolino |
| **Analisi** | cosa funziona meglio, quanto costa | a tavolino |

Solo la prima è pensata per l'uso a una mano. Le altre due possono essere
più dense.

### 5.2 · Serra — elenco

Una riga per **gruppo**, non per lotto. Il numero a destra è la giacenza di
quel gruppo. Lo stesso lotto compare più volte se le sue piante stanno in
classi diverse: non è un errore, è il punto.

Ordinamento per classe di vaso (predefinito), lotto o quantità. Con
l'ordinamento per classe l'elenco rispecchia il giro fisico dei bancali.

### 5.3 · Rinvaso — quattro passi

```
1 · CONTEGGIO
    attese N → contate M
    differenza → movimento perdita/rettifica automatico

2 · SMISTAMENTO
    più destinazioni, ognuna con la sua quantità
    il resto torna nella classe di partenza, senza chiedere
    scala delle classi in scala visiva

3 · SUBSTRATO E ORE
    miscela preselezionata sull'ultima usata, modificabile
    solo i materiali di quella miscela compaiono nel form
    'salva come miscela' per rendere permanente una variazione

4 · CONFERMA
    elenco esplicito delle scritture prima di eseguirle
    costo/pianta risultante e prezzo suggerito
    [Salva] [Salva e ripeti]
```

`Salva e ripeti` conserva miscela, ore e destinazione e propone il gruppo
successivo della stessa classe. Quando si rinvasa, si rinvasa in serie.

**Scritture generate da un rinvaso:**
1. movimento `perdita` o `rettifica`, se il conteggio differisce
2. un movimento `trasferimento` per ogni destinazione, con la sua quota di costo
3. un evento `rinvaso` per ogni gruppo di destinazione, con la sua quota di costo
4. chiusura del gruppo di partenza se la giacenza arriva a zero

### 5.4 · Conteggio

Il passo 1 del rinvaso, isolato, più il campo vigore 1-5. Serve per i
censimenti fuori dal rinvaso e per chiudere le prove (§ 6.2).

### 5.5 · Vendita

Quantità e prezzo unitario. Mostra il costo/pianta accumulato e il margine.
Avvisa se sotto costo. Genera un movimento `vendita` con `valore`.

### 5.6 · Intervento

La scheda dipende dal modello configurato:

| `chiede` | Comportamento |
|---|---|
| `ore` | chiede solo le ore (potature, pinzatura) |
| `scelta` | mostra le opzioni; ogni opzione ha i suoi preset per pianta |
| `fisso` | precompila materiali e ore dai preset × piante del gruppo |

Ogni valore precompilato resta modificabile. Il preset è un punto di
partenza, non un vincolo: stesso principio del substrato.

### 5.7 · Nuovo lotto

Un solo form che crea il lotto **e** la sua prima vaschetta.

```
Specie · Sigla (proposta) · Anno · Progressivo → codice in anteprima
Origine · Data · Provenienza
Inserite: N
```

Crea: il record lotto, un gruppo in classe `VAS`, un movimento `apertura`
di N piante.

**Scorciatoia prove incrociate.** Se si scelgono due variabili con due
valori ciascuna, l'app genera quattro vaschette già etichettate,
dividendo le talee in parti uguali (§ 6.1).

---

## 6 · SPERIMENTAZIONE

### 6.1 · Le prove sono gruppi

Una variante non è una tabella separata: è un gruppo con un'etichetta.

```
ACE-25-001
├── VAS · A   40   Substrato = Torba pura
├── VAS · B   40   Substrato = Pomice+torba
└── VAS · C   40   Substrato = Perlite
```

Massimo **due** variabili per gruppo. Con due variabili, il confronto è
leggibile solo se le prove sono incrociate:

```
            IBA        AIB
Torba        A          B
Pomice       C          D
```

Con questo schema si legge il substrato confrontando A+B contro C+D, e
l'ormone confrontando A+C contro B+D. Con due sole vaschette le variabili
sono confuse e nessuno dei due confronti è valido.

**L'app non blocca**, ma in Analisi marca ogni confronto come *leggibile*
o *confuso*, invece di restituire un numero che sembra una risposta.

### 6.2 · Le etichette seguono le piante

A ogni rinvaso il gruppo di destinazione eredita `prove` + `storicoProve`
del genitore. Un gruppo accumula così un profilo:

```
nato in torba · rinvasato in miscela sperimentale · concimato organico
```

Una prova non si "chiude" con un valore finale: si legge ai conteggi
successivi. Questo permette la domanda che oggi manca — non solo *quante
ne hanno attecchito*, ma *come stanno tre anni dopo*.

### 6.3 · Tre tipi di variabile

| Ambito | Cosa fa | Esempi |
|---|---|---|
| **prova** | divide le vaschette, è un trattamento | substrato, ormone, periodo al buio |
| **selezione** | divide le vaschette, è materiale di partenza | diametro talea, vigoria |
| **condizione** | non divide niente, contesto del lotto | temperatura, umidità |

Le **condizioni** vanno sul lotto e servono a confrontare annate: perché la
stessa talea ha reso il 60% nel 2025 e l'85% nel 2026. Diventerebbero
variabili di prova solo con due ambienti in contemporanea.

**Fase lunare**: calcolata dalla data, mai inserita a mano. Ambito prova,
ma inseparabile dal periodo in una singola stagione — l'app la registra e
segnala il confronto come confuso finché non ci sono ripetizioni
sufficienti su cicli diversi.

### 6.4 · Interrogazioni che l'Analisi deve saper fare

1. **Resa per valore di variabile**, filtrabile per specie e per anno
   → attecchimento, sopravvivenza a N anni, vigore medio
2. **Costo per pianta** per lotto, classe di vaso, specie
3. **Margine** sulle vendite: incasso meno costo accumulato
4. **Consumo materiali** per stagione, dai `dettagli.consumi` degli eventi
5. **Ore per specie e per tipo di intervento**

---

## 7 · CONFIGURAZIONE

Tutto quello che segue è modificabile dall'interfaccia. Niente hardcoded.

### 7.1 · `classi`

```
id · etichetta · mm · tondo (bool) · litriPerVaso · attiva · ordine
```

Valori iniziali: `VAS` (vaschetta di radicazione), `10T`, `10Q`, `12`,
`14`, `16`, `18`, `20`, `22`, `24`.

`VAS` è ciò che rende superflua la vecchia distinzione
Sperimentale/Produzione: non c'è cambio di stato, c'è un travaso.

I litri per vaso vanno misurati una volta, riempiendo un vaso e
travasandolo in una brocca graduata.

### 7.2 · `materiali`

```
id · nome · prezzoLitro · attivo
```

`attivo` invece della cancellazione: un materiale dismesso sparisce dalle
scelte ma resta leggibile negli eventi passati.

### 7.3 · `miscele`

```
id · nome · quote {matId: parti} · sperimentale (bool)
```

Solo i materiali presenti nella miscela compaiono nel form del rinvaso: è
ciò che tiene corto il form anche con un listino lungo.

`sperimentale` marca una miscela di prova: usandola, il rinvaso apre
automaticamente una variante sul gruppo di destinazione.

### 7.4 · `tipiIntervento`

```
id · nome · chiede: ore | scelta | fisso
opzioni [ { k, matPerPianta, orePerPianta } ]   se chiede = scelta
matPerPianta · orePerPianta                      se chiede = fisso
```

**Nota aperta**: il filo di un vaso da 24 non è quello di un 12. Se la
differenza pesa, `matPerPianta` per la legatura va reso una tabella per
classe di vaso. Da decidere dopo qualche mese di dati reali.

### 7.5 · `variabili`

```
id · nome · ambito: prova | selezione | condizione
tipo: lista | numero | classi | scala | auto
valori []           se tipo = lista
soglie []           se tipo = classi, es. [3, 5] → <3 | 3-5 | >5
```

### 7.6 · `impostazioni`

```
tariffaOraria · moltiplicatorePrezzo · giorniPromemoriaBackup
```

---

## 8 · BACKUP

Non è una funzione accessoria: è l'unica copia dei dati.

**Export** — un file JSON con tutti gli archivi, incluso il numero di
versione dello schema. Un tocco, poi condivisione su Drive.

```json
{
  "schema": "1.0",
  "esportato": "2026-08-26T18:00:00Z",
  "lotti": [], "gruppi": [], "movimenti": [], "eventi": [],
  "conteggi": [],
  "config": { "classi": [], "materiali": [], "miscele": [],
              "tipiIntervento": [], "variabili": [], "impostazioni": {} }
}
```

**Import** — ricostruisce tutto, anche su un dispositivo diverso.
Sostituzione integrale, previa conferma esplicita.

**Promemoria** — se l'ultimo export ha più di N giorni, l'app lo segnala
all'apertura. N configurabile, predefinito 14.

Questo **non è sincronizzazione**: due dispositivi che modificano in
parallelo non si fondono. Se serve il multi-dispositivo reale, è
un'architettura diversa e va deciso prima, non dopo.

---

## 9 · MIGRAZIONE DAI DATI ATTUALI

Circa dieci lotti su Google Sheets. Importatore **una tantum**, non
funzione permanente: esportare i cinque fogli in CSV e caricarli.

| Foglio attuale | Destinazione |
|---|---|
| `Lotti` | `lotti` + un gruppo iniziale + movimento `apertura` da `Quantità` |
| `Rinvaso` | `eventi` tipo rinvaso; il diametro determina la classe del gruppo |
| `Potatura` | `eventi` tipo potatura |
| `Legatura` | `eventi` tipo legatura |
| `Sperimentazione` | `gruppi` in classe VAS con etichette + movimenti |
| `Materiali` | `config.materiali` |

**Tre punti richiedono intervento manuale:**

1. **I gruppi non esistono** nei dati vecchi. L'import crea un gruppo per
   lotto, con la classe dell'ultimo rinvaso registrato o `non assegnato`.
   Poi va sistemato davanti ai bancali: mezz'ora di conteggio reale.
2. **Le variabili sperimentali sono stringhe libere** e vanno ricodificate
   in `variabile` + `valore`. È l'unico lavoro manuale vero, ed è la
   ragione per cui oggi le sperimentazioni non sono confrontabili. Con
   dieci lotti sono pochi minuti.
3. **I costi storici** vanno ricalcolati con la tariffa attuale: i vecchi
   eventi non conservano il costo del momento.

---

## 10 · ORDINE DI COSTRUZIONE

Ogni fase deve essere usabile prima di passare alla successiva.

**Fase 1 — fondamenta**
Dexie, i sei archivi, le funzioni di saldo e costo, l'export/import JSON.
Nessuna interfaccia oltre a un elenco grezzo. È il pezzo su cui poggia
tutto: va verificato con dati finti prima di metterci sopra la grafica.

**Fase 2 — Serra**
Elenco gruppi, scheda gruppo, i quattro flussi. La grafica del prototipo
v3 è già decisa: va portata, non ridisegnata.

**Fase 3 — nuovo lotto e Config**
Creazione lotto con vaschette incrociate. Le sei sezioni di Config.

**Fase 4 — Lotto e Analisi**
Vista lotto con la ripartizione. Poi le interrogazioni di § 6.4, una alla
volta, partendo dalla resa per variabile.

**Fase 5 — migrazione**
L'importatore CSV, usato una volta e poi rimosso.

---

## 11 · SCELTE GIÀ FATTE, DA NON RIAPRIRE

- Nessun backend, nessuna sincronizzazione automatica
- Nessun livello "pianta singola": l'unità è il gruppo (rivedibile in
  futuro, ma non ora)
- Nessuno stato Sperimentale/Produzione: sostituito dalla classe `VAS`
- Nessuna posizione fisica registrata: i bancali cambiano, il vaso no
- Nessun aggiornamento in luogo delle quantità: solo movimenti

---

## 12 · QUESTIONI APERTE

1. Legatura: costo del filo fisso per pianta o per classe di vaso
2. Ripartizione substrato per litri invece che per numero di piante (§ 4.3)
3. Suffisso di grado sul gruppo: serve davvero, o basta il contatore
   lavorazioni
4. Litri per vaso reali delle nove classi — da misurare
5. Prezzi materiali e preset interventi reali — da inserire
