export default {
  tipo: "entrada_botoes",
  categoria: "entrada",
  rotulo: "Botões",
  ramifica: true,
  salva_variavel: true,
  campos: [
    { nome: "opcoes", rotulo: "Opções", tipo: "lista" },
    { nome: "multipla", rotulo: "Permite mais de uma escolha", tipo: "booleano", padrao: false }
  ],
  validar: (valor) => typeof valor === "string" && valor.length > 0,
  erro: "Escolha uma das opções."
}
