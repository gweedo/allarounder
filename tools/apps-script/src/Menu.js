function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Allarounder")
    .addItem("Pubblica", "handlePubblica")
    .addItem("Nuovo articolo", "handleNuovoArticolo")
    .addSeparator()
    .addItem("Configura validazione colonne", "setupDataValidation")
    .addToUi();
}
