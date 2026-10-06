function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Allarounder")
    .addItem("Pubblica", "handlePubblica")
    .addItem("Nuovo articolo", "handleNuovoArticolo")
    .addItem("Elimina bozza", "handleEliminaBozza")
    .addSeparator()
    .addItem("Configura validazione colonne", "setupDataValidation")
    .addToUi();
}
