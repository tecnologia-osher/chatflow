export default {
  tipo: "entrada_cartoes",
  categoria: "entrada",
  rotulo: "Cartões",
  ramifica: true,
  salva_variavel: true,
  campos: [
    { nome: "opcoes", rotulo: "Cartões", tipo: "lista" }
  ],
  // Um cartão por opção, e um botão por cartão: é a saída que o grupo já sabe
  // desenhar. Vários botões no mesmo cartão seriam saídas dentro de uma saída,
  // e nem o modelo do quadro nem as setas sabem disso hoje.
  campos_da_opcao: [
    { nome: "imagem", rotulo: "Imagem", tipo: "imagem", dica: "Cole o link da imagem…" },
    { nome: "titulo", rotulo: "Título", tipo: "texto", dica: "Título do cartão…" },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", dica: "Uma linha sobre ele…" }
  ],
  validar: (valor) => typeof valor === "string" && valor.length > 0,
  erro: "Escolha um dos cartões."
}
