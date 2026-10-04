export default {
  tipo: "entrada_imagens",
  categoria: "entrada",
  rotulo: "Escolha visual",
  ramifica: true,
  salva_variavel: true,
  campos: [
    { nome: "opcoes", rotulo: "Opções", tipo: "lista" }
  ],
  // O que cada opção carrega além do texto do botão. O editor monta a caixa
  // de edição a partir daqui: um tipo novo que precise de outro campo na
  // opção declara aqui e ganha o campo na tela, sem mexer no editor.
  campos_da_opcao: [
    { nome: "imagem", rotulo: "Imagem", tipo: "imagem", dica: "Cole o link da imagem…" }
  ],
  validar: (valor) => typeof valor === "string" && valor.length > 0,
  erro: "Escolha uma das opções."
}
