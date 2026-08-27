export default {
  tipo: "redirecionar",
  categoria: "conexao",
  rotulo: "Redirecionar",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço", tipo: "texto", aceita_variavel: true },
    { nome: "nova_aba", rotulo: "Abrir em nova aba", tipo: "booleano", padrao: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Continuar" }
  ]
}
