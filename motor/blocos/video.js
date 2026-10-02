export default {
  tipo: "video",
  categoria: "fala",
  rotulo: "Vídeo",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço do vídeo", tipo: "texto", aceita_variavel: true,
      ajuda: "Funciona com YouTube, Vimeo e arquivos de vídeo (.mp4)." },
    { nome: "autoplay", rotulo: "Começar sozinho", tipo: "booleano" }
  ]
}
