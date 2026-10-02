export default {
  tipo: "imagem",
  categoria: "fala",
  rotulo: "Imagem",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço da imagem", tipo: "texto", aceita_variavel: true },
    { nome: "alternativo", rotulo: "Texto alternativo", tipo: "texto" },
    { nome: "link_ao_clicar", rotulo: "Abrir link ao clicar", tipo: "texto", aceita_variavel: true,
      ajuda: "Vazio: a imagem é só imagem." }
  ]
}
