// O que a caixa flutuante de uma bolha de mídia mostra.
//
// Imagem e vídeo não se editam numa caixa de texto: o que a pessoa tem na mão
// é um link ou um arquivo, e no vídeo ainda há o autoplay. A caixa é descrita
// aqui como dado — aba por aba, campo por campo — e desenhada pelo editor.

export const TIPOS_DE_IMAGEM = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]
// Imagem maior que isto não é imagem de conversa: é um arquivo que alguém
// arrastou sem olhar, e o lead pagaria o download no celular dele.
export const LIMITE_DA_IMAGEM = 2 * 1024 * 1024

export const CAIXAS = {
  imagem: {
    abas: [
      { chave: "link", rotulo: "Link" },
      { chave: "upload", rotulo: "Upload" }
    ],
    campo: { nome: "url", dica: "Cole o link da imagem…" },
    interruptor: {
      campo: "link_ao_clicar",
      rotulo: "Abrir link ao clicar",
      dica: "Para onde a imagem leva…"
    }
  },
  video: {
    abas: [{ chave: "link", rotulo: "Link" }],
    campo: { nome: "url", dica: "Cole o link do vídeo…" },
    // A nota diz o que o motor faz de verdade. Prometer TikTok antes de o
    // motor saber abrir um seria mentir na própria tela.
    nota: "Funciona com YouTube, Vimeo e arquivos de vídeo (.mp4).",
    interruptor: { campo: "autoplay", rotulo: "Começar sozinho" }
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
export function problemaNoArquivo(arquivo) {
  if (!arquivo) return "Nenhum arquivo escolhido."
  if (!TIPOS_DE_IMAGEM.includes(arquivo.type)) {
    return "Formato que a conversa não mostra. Use PNG, JPG, GIF, WEBP ou SVG."
  }
  if (arquivo.size > LIMITE_DA_IMAGEM) {
    return "Imagem grande demais: o limite é 2 MB, que já é muito para um celular."
  }
  return null
}
