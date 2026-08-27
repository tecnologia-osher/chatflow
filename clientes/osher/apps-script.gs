// Receptor dos leads da Osher. Cole este arquivo inteiro no editor do
// Apps Script (script.google.com), preencha o ID abaixo, salve e publique.
//
// Este script é AVULSO: não nasce dentro de uma planilha, então precisa
// dizer explicitamente em qual planilha escrever. O ID é o trecho do link
// entre "/d/" e "/edit".
//
// Planilha "Leads Osher Backup", que já guarda os leads históricos de 2025.
// O chat escreve só nas duas abas nomeadas abaixo, criadas sozinhas na
// primeira vez. Nenhuma aba existente é tocada.
const ID_DA_PLANILHA = "1utcWfxzIZUOpC8IF7ckwDFaCrdKZwDhZILVgkUG1JEI";

// Onde o chat escreve. Renomear aqui é suficiente: as abas são criadas com
// o nome que estiver nestas constantes.
//   ABA_LEADS   -> uma linha por pessoa que TERMINOU o chat, com todas as
//                  respostas, a pontuação e a classificação.
//   ABA_EVENTOS -> uma linha cada vez que uma pergunta é EXIBIDA, mesmo que
//                  a pessoa abandone o chat. É o funil: mostra em que
//                  pergunta as pessoas mais desistem. São ~16 linhas por
//                  visitante, por isso fica longe da aba de leads.
const ABA_LEADS = "Chatflow";
const ABA_EVENTOS = "Chatflow Eventos";

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
    const sheet = getOrCreateSheet(data.event ? ABA_EVENTOS : ABA_LEADS);

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

// Confere o ID e mostra o que já existe na planilha, antes de publicar.
// Rode esta função e olhe o Registro de execução.
function conferirPlanilha() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  const abas = ss.getSheets().map((s) => s.getName());
  Logger.log(
    ss.getName() + "\n" + ss.getUrl() +
    "\n\nAbas hoje: " + abas.join(", ") +
    "\n\nO chat vai escrever em: " + ABA_LEADS + " e " + ABA_EVENTOS +
    "\n" + (abas.indexOf(ABA_LEADS) === -1
      ? "Ainda não existem — serão criadas no primeiro envio."
      : "Já existem — o chat vai acrescentar linhas nelas.")
  );
}
