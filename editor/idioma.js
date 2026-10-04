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
  // --- a primeira página ---
  "Criar um chatflow": "Create a chatflow",
  "Procurando os seus chats…": "Looking for your chats…",
  "Nenhum chat ainda. Crie o primeiro aqui ao lado.": "No chats yet. Create the first one next to this.",
  "No ar": "Live",
  "Começar do zero": "Start from scratch",
  "Um grupo vazio, e o fluxo é seu.": "An empty group, and the flow is yours.",
  "Começar de um modelo": "Start from a template",
  "Fluxos semiprontos, para ajustar em vez de escrever.":
    "Half-built flows, to adjust instead of write.",
  "Importar um arquivo": "Import a file",
  "Um fluxo.json que você já tem.": "A fluxo.json you already have.",
  "Modelos": "Templates",
  "Voltar": "Back",
  "Usar este modelo": "Use this template",
  "Não consegui abrir este modelo.": "I couldn't open this template.",
  "Este chatflow está aberto sem servidor para criar projetos.":
    "This chatflow is open without a server to create projects.",
  "Não consegui criar ({motivo}).": "Couldn't create it ({motivo}).",
  "Não consegui importar ({motivo}).": "Couldn't import it ({motivo}).",
  "Não consegui listar os projetos ({motivo}).": "Couldn't list the projects ({motivo}).",
  "isto não parece um fluxo do chatflow": "this doesn't look like a chatflow flow",

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
  "Soltar o painel: ele se recolhe quando o mouse sai":
    "Unpin the panel: it slides away when the mouse leaves",
  "Prender o painel no lugar": "Pin the panel in place",
  "Mostrar o painel": "Show the panel",
  "Arraste o tipo até o quadro, ou solte sobre um cartão.":
    "Drag the type onto the board, or drop it on a card.",

  "Procurar": "Search",
  "Procurar um tipo": "Search for a type",
  "Nenhum tipo com esse nome.": "No type with that name.",

  // --- tipos de bloco ---
  "Texto": "Text",
  "Imagem": "Image",
  "Vídeo": "Video",
  "Áudio": "Audio",
  "Incorporar": "Embed",
  "Botões": "Buttons",
  "E-mail": "Email",
  "Telefone": "Phone",
  "Número": "Number",
  "Data": "Date",
  "Hora": "Time",
  "Site": "Website",
  "Avaliação": "Rating",
  "Escolha visual": "Pic choice",
  "Cartões": "Cards",
  "Editar esta opção": "Edit this option",
  "Quantas estrelas": "How many stars",
  "Texto acima das estrelas…": "Text above the stars…",
  "Texto acima das estrelas": "Text above the stars",
  "Título": "Title",
  "Descrição": "Description",
  "Título do cartão…": "Card title…",
  "Uma linha sobre ele…": "One line about it…",
  "Condição": "Condition",
  "Definir variável": "Set variable",
  "Ir para": "Jump to",
  "Redirecionar": "Redirect",
  "Webhook": "Webhook",

  // --- a caixa da bolha de mídia ---
  "Link": "Link",
  "Upload": "Upload",
  "Clique para editar…": "Click to edit…",
  "Cole o link ou o código…": "Paste the link or code…",
  "Funciona com PDFs, iframes e sites.": "Works with PDFs, iframes and websites.",
  "Altura": "Height",
  "Aumentar": "Increase",
  "Diminuir": "Decrease",
  "Cole o link da imagem…": "Paste the image link…",
  "Cole o link do vídeo…": "Paste the video link…",
  "Abrir link ao clicar": "On click link",
  "Para onde a imagem leva…": "Where the image leads…",
  "Começar sozinho": "Enable autoplay",
  "Funciona com YouTube, Vimeo e arquivos de vídeo (.mp4).":
    "Works with YouTube, Vimeo and video files (.mp4).",
  "Escolher uma imagem": "Choose an image",
  "Escolher um áudio": "Choose an audio file",
  "Cole o link do áudio…": "Paste the audio file link…",
  "Funciona com .mp3 e .wav.": "Works with .mp3 and .wav.",
  "Formato que a conversa não toca. Use MP3, WAV ou OGG.":
    "A format the conversation can't play. Use MP3, WAV or OGG.",
  "Áudio grande demais: o limite é 5 MB.": "Audio too large: the limit is 5 MB.",
  "Subindo…": "Uploading…",
  "Não consegui subir ({motivo}).": "Couldn't upload it ({motivo}).",
  "Subir arquivo precisa de servidor. Aberto assim, use o link.":
    "Uploading needs a server. Opened like this, use the link.",
  "Formato que a conversa não mostra. Use PNG, JPG, GIF, WEBP ou SVG.":
    "A format the conversation can't show. Use PNG, JPG, GIF, WEBP or SVG.",
  "Imagem grande demais: o limite é 2 MB, que já é muito para um celular.":
    "Image too large: the limit is 2 MB, which is already a lot for a phone.",
  "Nenhum arquivo escolhido.": "No file chosen.",

  // --- quadro ---
  "Testar do início": "Test from the start",
  "Arraste até o primeiro grupo": "Drag to the first group",
  "Clique para renomear": "Click to rename",
  "Arraste para mover o grupo": "Drag to move the group",
  "Ações do grupo": "Group actions",
  "Ações deste bloco": "Actions for this block",
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
