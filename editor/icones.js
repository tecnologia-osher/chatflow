// Um ícone por tipo, desenhado em traço simples de 16px. Ler a paleta e o
// cartão vira reconhecer a forma, não soletrar a palavra.
export const ICONE_DO_TIPO = {
  texto: "M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z",
  imagem: "M2.5 3.5h11v9h-11zM2.5 10l3-3 2.5 2.5 2-2 3.5 3.5M10.5 6.2h.01",
  video: "M2.5 3.5h11v9h-11zM6.8 6.3l3.7 2.2-3.7 2.2z",
  entrada_texto: "M2.5 4.5h11v7h-11zM5 8h4",
  entrada_numero: "M2.5 4.5h11v7h-11zM5.5 10.2V6.5l-1.3 1",
  entrada_email: "M2.5 4h11v8h-11zM2.5 4.6l5.5 4 5.5-4",
  entrada_telefone: "M5.6 2.8h4.8v10.4H5.6zM7.4 11.6h1.2",
  entrada_data: "M2.8 4.3h10.4v9H2.8zM2.8 7h10.4M5.6 2.6v2.4M10.4 2.6v2.4",
  entrada_botoes: "M2.8 3.6h10.4v3.2H2.8zM2.8 9.2h10.4v3.2H2.8z",
  condicao: "M8 2.6l3.4 3.4L8 9.4 4.6 6zM8 9.4v4",
  definir_variavel: "M4.4 3.2C3 5 3 11 4.4 12.8M11.6 3.2C13 5 13 11 11.6 12.8M6.4 6.4l3.2 3.2M9.6 6.4l-3.2 3.2",
  ir_para: "M3 8h9M8.6 4.6L12 8l-3.4 3.4",
  redirecionar: "M9 3.2h3.8V7M12.8 3.2L7.6 8.4M11.4 9.2v3.6H3.2V4.6h3.6",
  webhook: "M5.2 6.6a2.8 2.8 0 1 1 4.3 2.4M10.8 9.4a2.8 2.8 0 1 1-4.3-2.4M8 13.2a2.8 2.8 0 1 1 0-5.6"
}

export function iconeDoTipo(tipo, classe = "ed__tipo-icone") {
  const caminho = ICONE_DO_TIPO[tipo]
  if (!caminho) return null
  const SVG = "http://www.w3.org/2000/svg"
  const desenho = document.createElementNS(SVG, "svg")
  desenho.setAttribute("class", classe)
  desenho.setAttribute("viewBox", "0 0 16 16")
  const traco = document.createElementNS(SVG, "path")
  traco.setAttribute("d", caminho)
  desenho.append(traco)
  return desenho
}

// Ícones da barra. Mesmo traço dos tipos, nomes de ação em vez de tipo.
export const ICONE_DA_ACAO = {
  // Desfazer e refazer: seta deitada, com a cauda virando para baixo. Os
  // glifos ↶ ↷ do texto saíam em pé e finos demais para um botão.
  desfazer: { viewBox: "0 0 24 24", d: "M9 14 4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4" },
  refazer: { viewBox: "0 0 24 24", d: "M15 14l5-5-5-5M4 20v-7a4 4 0 0 1 4-4h12" },
  // Seta da seção que abre e fecha. Deitada para baixo quando aberta; o CSS
  // a gira quando fechada, para não haver dois desenhos dizendo a mesma coisa.
  seta: { viewBox: "0 0 24 24", d: "M6 9l6 6 6-6" },
  // Cadeado fechado e aberto: o painel preso no lugar ou livre para se
  // recolher. A diferença é só a haste — fechada desce dos dois lados,
  // aberta fica solta de um deles.
  cadeado: { viewBox: "0 0 24 24", d: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" },
  cadeado_aberto: { viewBox: "0 0 24 24", d: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0" },
  // Quatro cantos apontando para dentro: pôr tudo na tela.
  centralizar: "M2.5 5.5v-3h3M13.5 5.5v-3h-3M2.5 10.5v3h3M13.5 10.5v3h-3",
  // Disquete, que ainda é o que todo mundo lê como "guardar".
  salvar: "M3 2.5h8.5L13.5 4.5v9h-11zM5 2.5v4h6v-4M5 9.5h6v4h-6z",
  // Visto: já está guardado.
  salvo: "M3 8.5l3.5 3.5 6.5-7.5",
  // Engrenagem de verdade: os dentes encostados no corpo. Com os traços
  // soltos em volta do círculo, como estava, o desenho virava um sol.
  configuracoes: {
    viewBox: "0 0 24 24",
    d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" +
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  }
}

export function iconeDaAcao(nome, classe = "ed__barra-icone") {
  const definicao = ICONE_DA_ACAO[nome]
  if (!definicao) return null
  // Um ícone pode trazer a própria moldura: desenhos emprestados costumam vir
  // em 24, e redesenhá-los em 16 à mão só introduz erro.
  const caminho = typeof definicao === "string" ? definicao : definicao.d
  const moldura = typeof definicao === "string" ? "0 0 16 16" : definicao.viewBox
  const SVG = "http://www.w3.org/2000/svg"
  const desenho = document.createElementNS(SVG, "svg")
  desenho.setAttribute("class", classe)
  desenho.setAttribute("viewBox", moldura)
  const traco = document.createElementNS(SVG, "path")
  traco.setAttribute("d", caminho)
  desenho.append(traco)
  return desenho
}
