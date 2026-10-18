// One-off script that builds the writers' formatting questionnaire as a
// Google Form (E3, Docs → HTML conversion review). Not part of the Sheet's
// Apps Script project: run it once from the editorial account.
//
// 1. Open https://script.new while signed in as the editorial account.
// 2. Replace the editor contents with this file, save, and run
//    createFormattingQuestionnaire (approve the Forms permission prompt).
// 3. The execution log prints the link to send to the writers and the
//    edit link. Answers appear in the form's "Risposte" tab, which can be
//    linked to a Sheet from there.

function createFormattingQuestionnaire() {
  var form = FormApp.create("Allarounder — Come formattate gli articoli?");
  form
    .setDescription(
      "Stiamo migliorando il modo in cui un Google Doc diventa una pagina del sito. " +
        "Vogliamo sapere quali formattazioni usate davvero e quali vi servirebbero, " +
        "e preparare un modello di articolo migliore per \"Nuovo articolo\". " +
        "Ci vogliono circa 10 minuti. Nessuna domanda è obbligatoria: " +
        "se non sapete cosa rispondere, saltatela."
    )
    .setProgressBar(true)
    .setCollectEmail(false);

  form.addTextItem().setTitle("Come ti chiami?").setRequired(true);

  // 1. How they write today
  form.addPageBreakItem().setTitle("1. Come scrivete oggi");

  form
    .addMultipleChoiceItem()
    .setTitle("Come dividi un articolo in sezioni?")
    .setChoiceValues([
      "Scrivo il titolo della sezione su una riga, tutto in grassetto",
      "Uso gli stili di Google Docs (\"Titolo 1\", \"Titolo 2\"…)",
      "Non divido l'articolo in sezioni",
    ])
    .showOtherOption(true);

  form
    .addMultipleChoiceItem()
    .setTitle("Ti capita di mettere un titolo più piccolo dentro una sezione (una sotto-sezione)?")
    .setChoiceValues(["Mai", "Qualche volta", "Spesso"]);

  form
    .addMultipleChoiceItem()
    .setTitle("Usi i commenti di Google Docs (per esempio per chiedere un parere a un collega)?")
    .setChoiceValues([
      "No, non li uso",
      "Sì, e quando pubblico sono già tutti risolti",
      "Sì, e a volte restano aperti quando pubblico",
    ]);

  form
    .addMultipleChoiceItem()
    .setTitle("Usi la modalità \"Suggerimento\" (le modifiche proposte che compaiono in verde)?")
    .setChoiceValues([
      "No, non la uso",
      "Sì, e quando pubblico sono già tutti accettati o rifiutati",
      "Sì, e a volte restano suggerimenti in sospeso quando pubblico",
    ]);

  form
    .addParagraphTextItem()
    .setTitle("Qualcuno rilegge l'articolo prima che venga pubblicato? Se sì, chi, e lavora direttamente nel Doc?");

  form
    .addCheckboxItem()
    .setTitle("Dove scrivi il testo?")
    .setHelpText("Puoi scegliere più risposte.")
    .setChoiceValues([
      "Direttamente in Google Docs",
      "In Word, e poi lo copio nel Doc",
      "Nelle Note del telefono o del computer, e poi lo copio",
      "Con ChatGPT o un altro assistente, e poi lo copio",
    ])
    .showOtherOption(true);

  // 2. Formatting needs
  form.addPageBreakItem().setTitle("2. Quali formattazioni vi servono");

  form
    .addGridItem()
    .setTitle("Per ogni formattazione, scegli una risposta")
    .setRows([
      "Grassetto",
      "Corsivo",
      "Sottolineato",
      "Barrato",
      "Link a un sito esterno",
      "Link a un altro articolo di Allarounder",
      "Elenco puntato",
      "Elenco numerato",
      "Elenco dentro un elenco (rientrato)",
      "Frase in evidenza (per esempio una citazione dell'ospite)",
      "Tabella (per esempio punteggi o risultati di gara)",
      "Note a piè di pagina",
      "Linea orizzontale per separare parti del testo",
      "Testo colorato o evidenziato",
    ])
    .setColumns(["La uso già", "Mi servirebbe", "Non mi serve"]);

  form
    .addParagraphTextItem()
    .setTitle("Se ti serve una tabella: cosa ci metteresti dentro? Quante righe e colonne, più o meno?");

  form
    .addParagraphTextItem()
    .setTitle("Se usi il sottolineato o il testo colorato: cosa vuoi far notare al lettore?")
    .setHelpText(
      "Sul sito il sottolineato si confonde facilmente con un link, quindi vorremmo capire " +
        "se il grassetto potrebbe bastare."
    );

  form
    .addMultipleChoiceItem()
    .setTitle("Nelle interviste, come distingui le domande dalle risposte?")
    .setChoiceValues([
      "Le domande sono in grassetto",
      "Scrivo il nome della persona prima di ogni battuta",
      "Non scrivo interviste",
    ])
    .showOtherOption(true);

  // 3. Sources and notes
  form.addPageBreakItem().setTitle("3. Fonti e note");

  form
    .addMultipleChoiceItem()
    .setTitle("Quando citi studi, articoli o libri, come vorresti che comparissero sul sito?")
    .setChoiceValues([
      "Note numerate nel testo (¹ ² ³) con l'elenco in fondo",
      "Un elenco \"Fonti\" in fondo all'articolo, senza numeri nel testo",
      "Link direttamente nel testo",
      "Non cito fonti",
    ])
    .showOtherOption(true);

  form
    .addMultipleChoiceItem()
    .setTitle("Nell'elenco delle fonti, cosa preferisci mostrare?")
    .setChoiceValues([
      "Il titolo della fonte, cliccabile",
      "L'indirizzo completo (https://…)",
      "Mi è indifferente",
    ]);

  // 4. Images and media
  form.addPageBreakItem().setTitle("4. Immagini e video");

  form
    .addMultipleChoiceItem()
    .setTitle("Oltre alla copertina, metti immagini dentro il testo?")
    .setChoiceValues(["Mai", "Una o due", "Più di due"]);

  form
    .addMultipleChoiceItem()
    .setTitle("Le immagini hanno bisogno di una didascalia o dei crediti del fotografo?")
    .setChoiceValues(["Sì, sempre", "A volte", "No"]);

  form
    .addCheckboxItem()
    .setTitle("Cosa vorresti poter inserire dentro un articolo?")
    .setHelpText("Oggi nessuna di queste cose è possibile. Puoi scegliere più risposte.")
    .setChoiceValues([
      "Un video di YouTube (per esempio un esercizio di gara)",
      "Un post di Instagram o TikTok",
      "Un altro episodio Spotify, oltre a quello collegato all'articolo",
      "Nessuna di queste",
    ])
    .showOtherOption(true);

  // 5. The article template
  form
    .addPageBreakItem()
    .setTitle("5. Il modello di articolo")
    .setHelpText(
      "Quando usi \"Nuovo articolo\", oggi il Doc parte con tre sezioni vuote: " +
        "Introduzione, Sviluppo, Conclusione. Vorremmo sostituirlo con un modello vero."
    );

  form
    .addMultipleChoiceItem()
    .setTitle("Le tre sezioni attuali (Introduzione, Sviluppo, Conclusione) ti sono utili?")
    .setChoiceValues(["Sì, le uso", "Le rinomino", "Le cancello sempre"]);

  form
    .addParagraphTextItem()
    .setTitle("Che struttura usi per ogni categoria?")
    .setHelpText(
      "Per esempio, Interviste: presentazione dell'ospite, domande e risposte, chiusura. " +
        "Scrivi anche per Analisi, Roundtable e Out of the Box, se le scrivi."
    );

  form
    .addParagraphTextItem()
    .setTitle("C'è qualcosa che scrivi in ogni articolo e che il modello potrebbe già contenere?")
    .setHelpText(
      "Per esempio una frase finale che invita ad ascoltare la puntata su Spotify, " +
        "o una sezione \"Fonti\"."
    );

  form
    .addMultipleChoiceItem()
    .setTitle("Un promemoria su cosa si può usare nel Doc: dove lo preferisci?")
    .setChoiceValues([
      "In cima al Doc, sopra il testo dell'articolo (non viene pubblicato)",
      "In una guida separata, da aprire quando serve",
      "Non mi serve",
    ]);

  // 6. A real example
  form.addPageBreakItem().setTitle("6. Un esempio vero");

  form
    .addParagraphTextItem()
    .setTitle("Puoi condividere con Guido un Doc che usa le formattazioni che ti servono? Incolla qui il link.")
    .setHelpText(
      "Va bene anche un articolo vecchio o di prova, a cui aggiungi una tabella, una nota " +
        "o un elenco rientrato. Ci serve per provare la conversione su un documento reale."
    );

  form
    .addParagraphTextItem()
    .setTitle("Altro da segnalare?")
    .setHelpText(
      "Per esempio formattazioni che sul sito non sono venute come nel Doc, " +
        "o cose che hai evitato di usare perché temevi che non funzionassero."
    );

  Logger.log("Link da mandare agli autori: " + form.getPublishedUrl());
  Logger.log("Link per modificare il modulo: " + form.getEditUrl());
}
