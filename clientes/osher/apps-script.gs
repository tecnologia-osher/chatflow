// Receptor dos leads da Osher. Cole este arquivo inteiro no editor do
// Apps Script (script.google.com), preencha o ID abaixo, salve e publique.
//
// Este script é AVULSO: não nasce dentro de uma planilha, então precisa
// dizer explicitamente em qual planilha escrever. Troque a constante abaixo
// pelo ID da planilha — é o trecho do link entre "/d/" e "/edit".
//
// https://docs.google.com/spreadsheets/d/ESTE_PEDACO_AQUI/edit
const ID_DA_PLANILHA = "COLE_AQUI_O_ID_DA_PLANILHA";

// Duas abas, criadas sozinhas na primeira vez:
//   "Respostas" -> uma linha por pessoa que TERMINOU o chat, com todas as
//                  respostas, a pontuação e a classificação.
//   "Eventos"   -> uma linha cada vez que uma pergunta é EXIBIDA, mesmo que
//                  a pessoa abandone o chat. É o funil: mostra em que
//                  pergunta as pessoas mais desistem.
//
// O motor marca o evento de funil com o campo "event". É só isso que separa
// uma aba da outra.
//
// Pergunta nova no fluxo.json vira coluna nova sozinha na próxima resposta
// recebida — nenhuma das duas abas precisa ser editada à mão.

function doPost(e) {
  // O chat dispara os eventos em rajada, um por bloco exibido, quase ao
  // mesmo tempo. Sem a trava, duas execuções simultâneas reescrevem o
  // cabeçalho uma por cima da outra e as colunas saem desalinhadas.
  const trava = LockService.getScriptLock();
  trava.waitLock(30000);

  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet(data.event ? "Eventos" : "Respostas");

    let headers = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    const incomingKeys = Object.keys(data);
    const newKeys = incomingKeys.filter((k) => headers.indexOf(k) === -1);

    if (headers.length === 0) {
      headers = incomingKeys;
      sheet.appendRow(headers);
    } else if (newKeys.length > 0) {
      headers = headers.concat(newKeys);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    sheet.appendRow(headers.map((h) => (data[h] !== undefined ? data[h] : "")));

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    trava.releaseLock();
  }
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Confere se o ID está certo antes de publicar. Rode esta função e olhe o
// Registro de execução: deve aparecer o nome da planilha que você espera.
function conferirPlanilha() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  Logger.log(ss.getName() + "\n" + ss.getUrl());
}
