// O idioma do editor. Não é o idioma da conversa: o que o lead lê é o que o
// cliente escreveu no fluxo, e isso não se traduz sozinho. Aqui ficam só as
// palavras que o editor põe na tela por conta própria.
//
// A chave do dicionário é a própria frase em português. Assim o código
// continua legível para quem o escreve, e frase sem tradução cai no original
// em vez de mostrar uma chave técnica na cara do cliente.

export const IDIOMAS = [
  { chave: "pt", nome: "Português" },
  { chave: "en", nome: "English" }
]

export const PADRAO = "pt"

export const EM_INGLES = {
  // --- barra e abas ---
  "Voltar aos projetos": "Back to projects",
  "Clique para renomear o projeto": "Click to rename the project",
  "Desfazer": "Undo",
  "Refazer": "Redo",
  "Fluxo": "Flow",
  "Tema": "Theme",
  "Resultados": "Results",
  "▶ Testar": "▶ Test",
  "Centralizar": "Center",
  "Põe o fluxo inteiro na tela": "Fits the whole flow on screen",
  "Salvar": "Save",
  "Salvando…": "Saving…",
  "Salvo": "Saved",
  "Configurações": "Settings",
  "Fechar": "Close",

  // --- paleta ---
  "Bolhas": "Bubbles",
  "Entrada": "Input",
  "Lógica": "Logic",
  "Conexão": "Connection",
  "Arraste um tipo até o quadro para criar um grupo. Solte sobre um cartão para pôr o bloco nele.":
    "Drag a type onto the board to create a group. Drop it on a card to put the block inside it.",
  "Arraste o tipo até o quadro para criar um grupo, ou selecione um grupo antes de clicar.":
    "Drag the type onto the board to create a group, or select a group before clicking.",

  // --- tipos de bloco ---
  "Texto": "Text",
  "Imagem": "Image",
  "Vídeo": "Video",
  "Botões": "Buttons",
  "E-mail": "Email",
  "Telefone": "Phone",
  "Número": "Number",
  "Data": "Date",
  "Condição": "Condition",
  "Definir variável": "Set variable",
  "Ir para": "Jump to",
  "Redirecionar": "Redirect",
  "Webhook": "Webhook",

  // --- quadro ---
  "Testar do início": "Test from the start",
  "Arraste até o primeiro grupo": "Drag to the first group",
  "Clique para renomear": "Click to rename",
  "Arraste para mover o grupo": "Drag to move the group",
  "Ações do grupo": "Group actions",
  "Mais opções deste bloco": "More options for this block",
  "Excluir": "Delete",
  "Excluir grupo": "Delete group",
  "Duplicar": "Duplicate",
  "padrão": "default",
  "Padrão: quem escolher uma opção sem destino próprio segue por aqui":
    "Default: anyone who picks an option without its own destination goes this way",
  "Para onde o grupo segue quando termina": "Where the group goes when it ends",
  "Escreva o botão": "Write the button",
  "+ botão": "+ button",
  "Acrescenta um botão nesta lista": "Adds a button to this list",
  "Arraste até um grupo para ligar": "Drag to a group to connect",
  "Arraste até o grupo seguinte": "Drag to the next group",
  "Começa em {grupo} — arraste para mudar": "Starts at {grupo} — drag to change",
  "Vai para {grupo} — arraste para mudar": "Goes to {grupo} — drag to change",
  "Segue para {grupo} — arraste para mudar": "Continues to {grupo} — drag to change",
  "Excluir grupo ({n} bloco)": "Delete group ({n} block)",
  "Excluir grupo ({n} blocos)": "Delete group ({n} blocks)",
  "Este caminho vem de uma regra de condição, que ainda não se edita aqui.":
    "This path comes from a condition rule, which can't be edited here yet.",

  // --- painel lateral ---
  "Grupo": "Group",
  "Título": "Title",
  "Próximo grupo": "Next group",
  "Salvar na variável": "Save to variable",
  "Opções": "Options",
  "Acrescentar opção": "Add option",
  "— não liga —": "— no link —",
  "Selecione um bloco ou um grupo no canvas para editar.":
    "Select a block or a group on the canvas to edit it.",
  '"{campo}" ainda se edita no arquivo. O editor visual chega numa próxima fatia.':
    '"{campo}" is still edited in the file. The visual editor gets there in a later slice.',

  // --- teste ---
  "Teste · do início": "Test · from the start",
  "Teste · a partir de {grupo}": "Test · from {grupo}",
  "Reiniciar": "Restart",
  "Começando do meio: as respostas anteriores não existem, então as variáveis delas aparecem vazias.":
    "Starting from the middle: the earlier answers don't exist, so their variables show up empty.",

  // --- salvar ---
  "Este editor está aberto sem servidor para gravar.":
    "This editor is open without a server to save to.",
  "este editor não sabe gravar o tema": "this editor has nowhere to save the theme",
  "Não consegui salvar ({motivo}). Baixei o {arquivo} para não perder o trabalho.":
    "Couldn't save ({motivo}). I downloaded {arquivo} so the work isn't lost.",

  // --- aba Tema ---
  "A conversa do seu jeito": "Your conversation, your way",
  "Reiniciar a conversa": "Restart the conversation",
  "O que mudar aqui vale para a conversa de todos os leads deste projeto.":
    "What you change here applies to every lead's conversation in this project.",
  "Voltar ao padrão": "Reset to default",
  "Conversa": "Conversation",
  "O quadro onde a conversa acontece.": "The frame the conversation happens in.",
  "Largura máxima": "Maximum width",
  "Largura máxima da conversa": "Maximum width of the conversation",
  "Fundo": "Background",
  "Fundo das caixas": "Box background",
  "Bordas": "Borders",
  "Fonte": "Font",
  "Padrão do sistema": "System default",
  "Personalizada: {fonte}": "Custom: {fonte}",
  "Retrato de quem atende": "Avatar",
  "Aparece ao lado das falas do chat.": "Shows next to the chat's messages.",
  "Mostrar retrato": "Show avatar",
  "Nome da marca": "Brand name",
  "Falas do chat": "Chat messages",
  "Falas da pessoa": "Person's messages",
  "Enviar e continuar.": "Send and continue.",
  "Botões de escolha": "Choice buttons",
  "As alternativas que a pessoa clica.": "The alternatives the person clicks.",
  "Campo de resposta": "Answer field",
  "Texto de exemplo": "Placeholder text",
  "Avisos": "Warnings",
  "Quando a resposta não serve.": "When the answer doesn't work.",
  "Faixa de erro": "Error bar",
  "Texto da faixa": "Bar text",
  "Selo de atenção": "Attention dot",

  // --- aba Resultados ---
  "Trocar chave": "Change key",
  "Atualizar": "Refresh",
  "Buscando…": "Fetching…",
  "Buscando os leads na planilha…": "Fetching the leads from the spreadsheet…",
  "Clique em Atualizar para buscar os leads.": "Click Refresh to fetch the leads.",
  "Veio da planilha e não está no fluxo": "Came from the spreadsheet and isn't in the flow",
  "Ninguém entrou no chat ainda. Quando alguém entrar, aparece aqui.":
    "Nobody has entered the chat yet. When someone does, they show up here.",
  "{n} pessoa": "{n} person",
  "{n} pessoas": "{n} people",
  "a mais recente primeiro": "most recent first",
  "buscando na planilha…": "fetching from the spreadsheet…",
  "lido em {quando}": "read at {quando}",
  "Quando": "When",
  "Situação": "Status",
  "Cole a chave de leitura da planilha — a que está nas propriedades do script, em CHAVE_LEITURA.":
    "Paste the spreadsheet's read key — the one in the script properties, under CHAVE_LEITURA.",
  "Para ver os leads, cole a chave de leitura da planilha. Ela fica guardada só neste navegador.":
    "To see the leads, paste the spreadsheet's read key. It stays in this browser only.",
  "chave de leitura": "read key",
  "Ver os leads": "See the leads",
  "Este editor está aberto sem de onde buscar os leads.":
    "This editor is open with nowhere to fetch the leads from.",

  // --- configurações ---
  "Quanto tempo o chat mostra os três pontinhos antes de cada fala.":
    "How long the chat shows the three dots before each message.",
  "Mínimo (ms)": "Minimum (ms)",
  "Por caractere (ms)": "Per character (ms)",
  "Máximo (ms)": "Maximum (ms)",
  "Digitação": "Typing",
  "Idioma do editor": "Editor language",
  "Vale só para esta tela: a conversa do lead segue no idioma em que você a escreveu.":
    "This screen only: the lead's conversation stays in the language you wrote it in."
}

const DICIONARIOS = { pt: {}, en: EM_INGLES }

// {nome} vira o valor. Frase com buraco é uma frase só, e não três pedaços
// costurados — em outra língua a ordem das partes muda.
export function preencher(frase, valores) {
  if (!valores) return frase
  return frase.replace(/\{(\w+)\}/g, (inteiro, nome) =>
    (nome in valores ? String(valores[nome]) : inteiro))
}

export function criarTradutor(idioma = PADRAO) {
  const dicionario = DICIONARIOS[idioma] || {}
  return (frase, valores) => preencher(dicionario[frase] ?? frase, valores)
}

export function idiomaValido(chave) {
  return IDIOMAS.some((i) => i.chave === chave)
}
