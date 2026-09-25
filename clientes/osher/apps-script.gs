// Receptor dos leads da Osher. Cole este arquivo inteiro no editor do
// Apps Script (script.google.com), preencha o ID abaixo, salve e publique.
//
// Este script é AVULSO: não nasce dentro de uma planilha, então precisa
// dizer explicitamente em qual planilha escrever. O ID é o trecho do link
// entre "/d/" e "/edit".
//
// Planilha "Leads Osher Backup", que já guarda os leads históricos de 2025.
// O chat escreve só nas três abas nomeadas abaixo, criadas sozinhas na
// primeira vez. Nenhuma aba existente é tocada.
const ID_DA_PLANILHA = "1utcWfxzIZUOpC8IF7ckwDFaCrdKZwDhZILVgkUG1JEI";

// Onde o chat escreve. Renomear aqui é suficiente: as abas são criadas com
// o nome que estiver nestas constantes.
//   ABA_LEADS     -> uma linha por pessoa que TERMINOU o chat, com todas as
//                    respostas, a pontuação e a classificação.
//   ABA_EVENTOS   -> uma linha cada vez que uma pergunta é EXIBIDA, mesmo que
//                    a pessoa abandone o chat. É o funil: mostra em que
//                    pergunta as pessoas mais desistem. São ~16 linhas por
//                    visitante, por isso fica longe da aba de leads.
//   ABA_PARCIAIS  -> uma linha POR PESSOA, reescrita a cada passo, com o que
//                    ela já tinha respondido até ali. É a aba que o vendedor
//                    abre: quem parou no meio e deixou telefone aparece aqui
//                    e em lugar nenhum mais. A aba de eventos é log; esta é
//                    lista de gente.
const ABA_LEADS = "Chatflow";
const ABA_EVENTOS = "Chatflow Eventos";
const ABA_PARCIAIS = "Chatflow Parciais";

// O motor marca o evento de funil com o campo "event". É só isso que separa
// o funil do lead finalizado.
//
// Pergunta nova no fluxo.json vira coluna nova sozinha na próxima resposta
// recebida — nenhuma das abas precisa ser editada à mão.

// Campos de controle do evento: dizem ONDE a pessoa está, não o que ela
// respondeu. Ficam de fora das respostas na aba de parciais, que já tem
// colunas próprias para eles.
const CONTROLE = ["event", "sessaoId", "grupoId", "blocoId", "em"];

// Marca da versão publicada. Serve para conferir de fora, com um GET, se o
// que está no ar é o que está no repositório — sem depender de abrir a
// planilha e procurar aba. Trocar quando o arquivo mudar de verdade.
const VERSAO = "2026-09-25-parciais";

// GET devolve a versão e as abas existentes. Não escreve nada.
function doGet() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  return ContentService
    .createTextOutput(JSON.stringify({
      versao: VERSAO,
      abas: ss.getSheets().map(function (s) { return s.getName(); })
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // O chat dispara os eventos em rajada, um por bloco exibido, quase ao
  // mesmo tempo. Sem a trava, duas execuções simultâneas reescrevem o
  // cabeçalho uma por cima da outra e as colunas saem desalinhadas.
  const trava = LockService.getScriptLock();
  trava.waitLock(30000);

  try {
    const data = JSON.parse(e.postData.contents);

    if (data.event) {
      acrescentar(getOrCreateSheet(ABA_EVENTOS), data);
      registrarParcial(data);
    } else {
      acrescentar(getOrCreateSheet(ABA_LEADS), data);
      concluirParcial(data);
    }

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

// Garante que toda chave recebida tenha coluna e devolve o cabeçalho atual.
// É o que faz pergunta nova virar coluna nova sem ninguém editar a planilha.
function garantirColunas(sheet, chaves) {
  let headers = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  const novas = chaves.filter(function (k) { return headers.indexOf(k) === -1; });

  if (headers.length === 0) {
    headers = chaves;
    sheet.appendRow(headers);
  } else if (novas.length > 0) {
    headers = headers.concat(novas);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return headers;
}

function acrescentar(sheet, data) {
  const headers = garantirColunas(sheet, Object.keys(data));
  sheet.appendRow(headers.map(function (h) {
    return data[h] !== undefined ? data[h] : "";
  }));
}

// Em que linha da aba mora esta sessão. Zero quando ainda não existe.
function linhaDaSessao(sheet, sessaoId) {
  if (sheet.getLastRow() < 2) return 0;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const coluna = headers.indexOf("sessaoId") + 1;
  if (coluna === 0) return 0;

  const valores = sheet.getRange(2, coluna, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]) === String(sessaoId)) return i + 2;
  }
  return 0;
}

// Escreve (ou reescreve) a linha da sessão. Só toca nas colunas que vieram
// desta vez: o que já estava lá e não veio agora permanece — assim uma
// resposta gravada antes não some porque o passo seguinte não a repetiu.
function gravarParcial(sheet, sessaoId, campos) {
  const headers = garantirColunas(sheet, Object.keys(campos));
  const linha = linhaDaSessao(sheet, sessaoId);

  if (linha === 0) {
    sheet.appendRow(headers.map(function (h) {
      return campos[h] !== undefined ? campos[h] : "";
    }));
    return;
  }

  const atual = sheet.getRange(linha, 1, 1, headers.length).getValues()[0];
  const novo = headers.map(function (h, i) {
    return campos[h] !== undefined ? campos[h] : atual[i];
  });
  sheet.getRange(linha, 1, 1, headers.length).setValues([novo]);
}

// Chamada a cada pergunta exibida. O evento traz tudo o que a pessoa já
// respondeu, então esta linha é o retrato mais recente dela.
function registrarParcial(data) {
  if (!data.sessaoId) return; // sem chave não há como consolidar por pessoa

  // As colunas de controle vêm primeiro para a aba abrir legível: quem é,
  // como está, quando foi, onde parou. As respostas entram depois, na ordem
  // em que o fluxo as coleta.
  const campos = {
    sessaoId: data.sessaoId,
    situacao: "em andamento",
    atualizadoEm: data.em || new Date().toISOString(),
    ultimoGrupo: data.grupoId || "",
    ultimoBloco: data.blocoId || ""
  };

  Object.keys(data).forEach(function (k) {
    if (CONTROLE.indexOf(k) === -1) campos[k] = data[k];
  });

  gravarParcial(getOrCreateSheet(ABA_PARCIAIS), data.sessaoId, campos);
}

// Chamada quando o lead finalizado chega. Marca a linha para o vendedor não
// ligar para quem já entrou no CRM pelo caminho normal, e traz junto as
// respostas finais: sem isso a linha diria "concluído" exibindo o retrato
// incompleto do penúltimo passo, que é pior do que não dizer nada.
function concluirParcial(data) {
  if (!data.sessaoId) return;

  const sheet = getOrCreateSheet(ABA_PARCIAIS);
  if (linhaDaSessao(sheet, data.sessaoId) === 0) return;

  const campos = {
    sessaoId: data.sessaoId,
    situacao: "concluído",
    atualizadoEm: data.finalizadoEm || new Date().toISOString()
  };

  Object.keys(data).forEach(function (k) {
    if (CONTROLE.indexOf(k) === -1 && k !== "finalizadoEm") campos[k] = data[k];
  });

  gravarParcial(sheet, data.sessaoId, campos);
}

// Confere o ID e mostra o que já existe na planilha, antes de publicar.
// Rode esta função e olhe o Registro de execução.
function conferirPlanilha() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  const abas = ss.getSheets().map(function (s) { return s.getName(); });
  Logger.log(
    ss.getName() + "\n" + ss.getUrl() +
    "\n\nAbas hoje: " + abas.join(", ") +
    "\n\nO chat vai escrever em: " + ABA_LEADS + ", " + ABA_EVENTOS + " e " + ABA_PARCIAIS +
    "\n" + (abas.indexOf(ABA_LEADS) === -1
      ? "Ainda não existem — serão criadas no primeiro envio."
      : "Já existem — o chat vai acrescentar linhas nelas.")
  );
}
