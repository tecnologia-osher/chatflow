export default {
  tipo: "incorporar",
  categoria: "fala",
  rotulo: "Incorporar",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço", tipo: "texto", aceita_variavel: true,
      ajuda: "Funciona com PDFs, iframes e sites." },
    { nome: "altura", rotulo: "Altura (px)", tipo: "numero" }
  ]
}
