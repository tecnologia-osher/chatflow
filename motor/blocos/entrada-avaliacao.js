export default {
  tipo: "entrada_avaliacao",
  categoria: "entrada",
  rotulo: "Avaliação",
  // Uma nota é um número, não um caminho: cinco estrelas não são cinco saídas
  // do grupo. Quem quiser tratar nota alta e nota baixa de formas diferentes
  // usa uma Condição depois, que é o bloco que existe para isso.
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "maximo", rotulo: "Quantas estrelas", tipo: "numero", padrao: 5 },
    { nome: "rotulo", rotulo: "Texto acima das estrelas", tipo: "texto", aceita_variavel: true }
  ],
  validar: (valor) => /^[1-9]\d*$/.test(String(valor || "")),
  erro: "Toque numa estrela para dar a sua nota."
}
