export default {
  tipo: "audio",
  categoria: "fala",
  rotulo: "Áudio",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço do áudio", tipo: "texto", aceita_variavel: true,
      ajuda: "Funciona com .mp3 e .wav." },
    { nome: "autoplay", rotulo: "Começar sozinho", tipo: "booleano",
      ajuda: "O navegador pode segurar o som até a pessoa tocar na tela." }
  ]
}
