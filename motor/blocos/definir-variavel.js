export default {
  tipo: "definir_variavel",
  categoria: "logica",
  rotulo: "Definir variável",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "operacao", rotulo: "Operação", tipo: "texto", padrao: "atribuir" },
    { nome: "valor", rotulo: "Valor", tipo: "texto", aceita_variavel: true }
  ]
}
