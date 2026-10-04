// O que a caixa flutuante de uma bolha de mídia mostra.
//
// Imagem e vídeo não se editam numa caixa de texto: o que a pessoa tem na mão
// é um link ou um arquivo, e no vídeo ainda há o autoplay. A caixa é descrita
// aqui como dado — aba por aba, campo por campo — e desenhada pelo editor.

export const TIPOS_DE_IMAGEM = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]
export const TIPOS_DE_AUDIO = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]
// Imagem maior que isto não é imagem de conversa: é um arquivo que alguém
// arrastou sem olhar, e o lead pagaria o download no celular dele.
export const LIMITE_DA_IMAGEM = 2 * 1024 * 1024
// Áudio é mais pesado por natureza: um minuto de voz em mp3 dá perto de 1 MB.
export const LIMITE_DO_AUDIO = 5 * 1024 * 1024

// O que cada bolha aceita subir. A caixa pergunta por aqui, e o servidor
// confere de novo do lado dele — quem escreve no disco não confia na rede.
export const ARQUIVOS = {
  imagem: {
    tipos: TIPOS_DE_IMAGEM,
    limite: LIMITE_DA_IMAGEM,
    aceita: "image/*",
    escolher: "Escolher uma imagem",
    formato: "Formato que a conversa não mostra. Use PNG, JPG, GIF, WEBP ou SVG.",
    tamanho: "Imagem grande demais: o limite é 2 MB, que já é muito para um celular."
  },
  audio: {
    tipos: TIPOS_DE_AUDIO,
    limite: LIMITE_DO_AUDIO,
    aceita: "audio/*",
    escolher: "Escolher um áudio",
    formato: "Formato que a conversa não toca. Use MP3, WAV ou OGG.",
    tamanho: "Áudio grande demais: o limite é 5 MB."
  }
}

export const CAIXAS = {
  imagem: {
    abas: [
      { chave: "link", rotulo: "Link" },
      { chave: "upload", rotulo: "Upload" }
    ],
    arquivo: "imagem",
    campo: { nome: "url", dica: "Cole o link da imagem…" },
    interruptor: {
      campo: "link_ao_clicar",
      rotulo: "Abrir link ao clicar",
      dica: "Para onde a imagem leva…"
    }
  },
  audio: {
    // Link primeiro, como na imagem: é o que funciona em qualquer lugar,
    // inclusive no editor publicado, onde não há servidor para guardar nada.
    abas: [
      { chave: "link", rotulo: "Link" },
      { chave: "upload", rotulo: "Upload" }
    ],
    arquivo: "audio",
    campo: { nome: "url", dica: "Cole o link do áudio…" },
    nota: "Funciona com .mp3 e .wav.",
    interruptor: { campo: "autoplay", rotulo: "Começar sozinho" }
  },
  video: {
    abas: [{ chave: "link", rotulo: "Link" }],
    campo: { nome: "url", dica: "Cole o link do vídeo…" },
    // A nota diz o que o motor faz de verdade. Prometer TikTok antes de o
    // motor saber abrir um seria mentir na própria tela.
    nota: "Funciona com YouTube, Vimeo e arquivos de vídeo (.mp4).",
    interruptor: { campo: "autoplay", rotulo: "Começar sozinho" }
  },
  incorporar: {
    abas: [{ chave: "link", rotulo: "Link" }],
    campo: { nome: "url", dica: "Cole o link ou o código…" },
    nota: "Funciona com PDFs, iframes e sites.",
    // Altura em vez de interruptor: uma página incorporada não tem tamanho
    // próprio dentro da conversa, alguém precisa dizer o dela.
    numero: { campo: "altura", rotulo: "Altura", sufixo: "px", padrao: 400 }
  }
}

export function temCaixa(tipo) {
  return Object.prototype.hasOwnProperty.call(CAIXAS, tipo)
}

export function caixaDoTipo(tipo) {
  return CAIXAS[tipo] || null
}

// Nome de arquivo que pode virar caminho dentro da pasta do cliente: sem
// acento, sem espaço e sem nada que signifique "suba um diretório".
export function nomeDeArquivo(nome) {
  const bruto = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  const limpo = bruto.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^[-.]+|-+$/g, "")
  const partes = limpo.split(".")
  const extensao = partes.length > 1 ? partes.pop() : ""
  const base = (partes.join("-") || "imagem").slice(0, 40)
  return extensao ? `${base}.${extensao.slice(0, 6)}` : base
}

// Por que este arquivo não serve. Devolve a frase, ou nulo quando serve.
export function problemaNoArquivo(arquivo, especie = "imagem") {
  const regra = ARQUIVOS[especie] || ARQUIVOS.imagem
  if (!arquivo) return "Nenhum arquivo escolhido."
  if (!regra.tipos.includes(arquivo.type)) return regra.formato
  if (arquivo.size > regra.limite) return regra.tamanho
  return null
}
