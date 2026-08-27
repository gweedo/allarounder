# Guida al flusso editoriale — Allarounder

Questa pagina spiega come scrivere e pubblicare un articolo su Allarounder
usando Google Docs e il foglio Google Sheets "Editoriale". Non serve
conoscere codice o strumenti tecnici: tutto avviene tra Google Docs, il
foglio e i due pulsanti descritti qui sotto.

## 1. Iniziare un nuovo articolo

Nel foglio Editoriale, apri il menu **Allarounder → Nuovo articolo**. Ti
verrà chiesto il titolo dell'articolo: dopo averlo confermato, il sistema
crea automaticamente:

- un nuovo Google Doc con una struttura di partenza (titolo, Introduzione,
  Sviluppo, Conclusione) — apri il link che compare per iniziare a scrivere;
- una nuova riga nel foglio, già compilata con il titolo, il link al Doc e
  lo stato "Bozza".

Scrivi l'articolo direttamente nel Doc, con la formattazione che preferisci
(titoli, grassetto, corsivo, elenchi, immagini). Non serve sapere Markdown:
la conversione avviene automaticamente in fase di pubblicazione.

## 2. Compilare la riga nel foglio

Ogni riga del foglio corrisponde a un articolo. Ecco cosa significa ogni
colonna:

| Colonna | Cosa significa |
|---|---|
| **titolo** | Il titolo dell'articolo (compilato automaticamente da "Nuovo articolo") |
| **doc** | Il link al Google Doc con il testo (compilato automaticamente) |
| **categoria** | Una delle quattro sezioni del sito: Interviste, Analisi, Roundtable, Out of the Box. Scegli dal menu a tendina |
| **tag** | Parole chiave separate da virgola (es. "Mondiali, Esordienti"), per aiutare i lettori a trovare articoli simili |
| **autore** | Chi ha scritto l'articolo. Scegli dal menu a tendina — se non trovi il tuo nome, vedi il punto 5 |
| **ospite** | Se l'articolo è un'intervista, il nome della persona intervistata. Puoi scrivere qualsiasi nome: non serve che sia già "conosciuto" dal sistema (vedi punto 5) |
| **spotify** | Il link all'episodio o al canale Spotify collegato, se c'è. Lascia vuoto per un articolo senza episodio collegato |
| **copertina** | Il link di condivisione dell'immagine di copertina su Google Drive, se ne hai una |
| **meta_description** | Una breve descrizione dell'articolo per Google, tra **140 e 155 caratteri esatti** — né di più né di meno. Serve per come l'articolo appare nei risultati di ricerca |
| **data** | La data in cui l'articolo deve andare online (formato AAAA-MM-GG, es. 2026-09-15). Può essere una data futura: l'articolo resterà in attesa fino a quel giorno |
| **stato** | Bozza (stai ancora scrivendo) o Pronto (finito, in attesa di essere pubblicato): scegli tu dal menu a tendina. Pubblicato viene impostato da solo quando clicchi "Pubblica" — vedi punto 3 |
| **esito** | Compilata automaticamente dal sistema dopo ogni pubblicazione. Non scriverci mai sopra a mano — vedi punto 4 |

Un consiglio sulla **meta_description**: contala prima di pubblicare (con
qualsiasi contatore di caratteri, anche quello di Word o di un sito online).
Se è troppo corta o troppo lunga, la pubblicazione verrà rifiutata con un
messaggio che indica di quanto correggerla.

## 3. Pubblicare: il pulsante "Pubblica"

Quando l'articolo è pronto (testo finito nel Doc, tutte le colonne
compilate), seleziona la sua riga nel foglio e apri **Allarounder →
Pubblica**.

Questo pulsante fa due cose insieme: imposta lo stato su "Pubblicato" e
avvia la pubblicazione sul sito. Non serve fare altro.

Il sito impiega circa **2 minuti** ad aggiornarsi. Non c'è bisogno di
aspettare davanti al foglio: passato quel tempo, controlla la colonna
**esito** per sapere com'è andata (vedi punto 4).

Se nella colonna **data** hai messo una data futura, il pulsante "Pubblica"
funziona comunque, ma l'articolo resterà in attesa fino a quel giorno — il
sito lo pubblicherà da solo quando arriva la data, senza bisogno di
ricliccare nulla.

## 4. Capire la colonna "esito"

Dopo ogni tentativo di pubblicazione, il sistema scrive un messaggio in
**esito**:

- **✓ Pubblicato 14:32** — l'articolo è online, con l'orario di
  pubblicazione.
- **⏳ Programmato per 2026-09-15** — hai cliccato "Pubblica" ma la data è
  nel futuro: l'articolo andrà online da solo a quella data, non serve fare
  altro.
- **✗ seguito da un messaggio** — qualcosa non va e l'articolo **non** è
  stato pubblicato. Il messaggio spiega cosa correggere, ad esempio:
  - `✗ meta description troppo corta (128, servono 140–155)` → allunga la
    descrizione fino a essere tra 140 e 155 caratteri.
  - `✗ categoria "Interviste " non riconosciuta — controlla spazi o refusi`
    → probabilmente c'è uno spazio in più o un errore di battitura nella
    cella; correggila e riprova.
  - `✗ collegamento Spotify non valido` → controlla di aver incollato il
    link giusto (deve iniziare con `https://open.spotify.com/`).

Dopo aver corretto il problema, riseleziona la riga e clicca di nuovo
"Pubblica".

## 5. Aggiungere un nuovo ospite o un nuovo autore

Qui c'è una differenza importante tra le due colonne:

- **ospite**: puoi scrivere qualsiasi nome, anche se è la prima volta che
  compare. Il sistema crea automaticamente la pagina della persona
  intervistata. Se in futuro qualcuno vorrà aggiungere una biografia o una
  foto per quella persona, basterà chiederlo a Guido — ma non è necessario
  per pubblicare.
- **autore**: la lista è fissa e comprende solo chi scrive abitualmente su
  Allarounder. Se il tuo nome non compare nel menu a tendina della colonna
  **autore**, **non pubblicare** — chiedi prima a Guido di aggiungerti,
  altrimenti la pubblicazione verrà rifiutata.

## Domande frequenti

**Ho sbagliato il titolo dopo aver già pubblicato: cosa succede se lo
correggo?**
Il testo del titolo si aggiorna, ma l'indirizzo web (URL) dell'articolo
resta quello scelto alla prima pubblicazione — così non si rompono link già
condivisi. Non serve fare nulla di diverso: correggi il titolo nel foglio
e clicca di nuovo "Pubblica".

**Ho pubblicato per errore un articolo che non era pronto: come lo tolgo?**
Chiedi a Guido: togliere un articolo già pubblicato richiede un intervento
manuale sul codice (non è ancora automatizzato dal foglio).

**Posso modificare un articolo già pubblicato?**
Sì: modifica il Doc e/o la riga, poi clicca di nuovo "Pubblica" sulla stessa
riga. Il sito si aggiorna con le modifiche.
