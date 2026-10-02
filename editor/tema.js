// O tema do chat como dado editável: que seções existem, que controle cada
// cor tem e como uma cor se resolve quando o tema não a declara.
//
// A cascata vive no CSS do motor (`--cf-botao: var(--cf-acento)`), e por isso
// vive aqui também: sem ela, a aba Tema mostraria campo vazio no botão de um
// chat cujo botão é claramente azul. O editor mostra a cor que a pessoa vê.

// O que o motor usa quando o tema não diz nada. São os mesmos valores do topo
// de motor/tema.css — um teste confere que não se separaram.
export const COR_PADRAO = {
  fundo: "#f5f5f6",
  superficie: "#ffffff",
  acento: "#0c2340",
  destaque: "#bf9c5a",
  texto: "#12181f",
  "sobre-acento": "#ffffff",
  "sobre-destaque": "#ffffff",
  borda: "#d9dde3",
  aviso: "#d97757",
  erro: "#a6402f"
}

// Cor que, sem valor próprio, segue outra.
export const SEGUE = {
  botao: "acento",
  "sobre-botao": "sobre-acento",
  "botao-opcao": "destaque",
  "sobre-botao-opcao": "sobre-destaque",
  campo: "superficie",
  "sobre-erro": "superficie",
  "sobre-campo": "texto",
  placeholder: "texto"
}

export const LARGURA_PADRAO = "48rem"
export const LARGURA_MINIMA = 24
export const LARGURA_MAXIMA = 80

// O campo de cor do navegador só aceita `#rrggbb`. Tema escrito à mão pode
// trazer `#FFF`, e cliente antigo pode trazer qualquer coisa: o que não dá
// para mostrar num seletor de cor vale como ausente, e a cascata segue.
export function corValida(valor) {
  if (typeof valor !== "string") return null
  const texto = valor.trim()
  if (/^#[0-9a-f]{6}$/i.test(texto)) return texto.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(texto)) {
    return `#${texto.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase()
  }
  return null
}

// A cor que o chat mostra hoje nesta chave: a declarada, a que ela segue, ou
// o padrão do motor.
export function corDoTema(tema, chave) {
  const cores = (tema && tema.cores) || {}
  const vista = new Set()
  let atual = chave
  while (atual && !vista.has(atual)) {
    vista.add(atual)
    const propria = corValida(cores[atual])
    if (propria) return propria
    const padrao = corValida(COR_PADRAO[atual])
    if (padrao) return padrao
    atual = SEGUE[atual]
  }
  return "#000000"
}

// Verdadeiro quando a cor é só herança: serve para a aba dizer "segue o
// acento" em vez de fingir que alguém escolheu aquele azul.
export function corHerdada(tema, chave) {
  return !corValida(((tema && tema.cores) || {})[chave])
}

export function definirCor(tema, chave, valor) {
  const cor = corValida(valor)
  if (!cor) return tema
  return { ...tema, cores: { ...((tema && tema.cores) || {}), [chave]: cor } }
}

// Devolve a cor à herança — é o que permite desfazer uma escolha sem ter de
// adivinhar o valor de onde ela vinha.
export function soltarCor(tema, chave) {
  const cores = { ...((tema && tema.cores) || {}) }
  if (!(chave in cores)) return tema
  delete cores[chave]
  return { ...tema, cores }
}

// Campo de primeiro nível (marca, fonte, fonte_url, avatar, largura). Valor
// vazio sai do arquivo em vez de virar `""`: tema do cliente é lido pelo chat
// de verdade, e chave vazia ali só gera dúvida.
export function definirDoTema(tema, chave, valor) {
  const novo = { ...tema }
  if (valor === "" || valor === null || valor === undefined) delete novo[chave]
  else novo[chave] = valor
  return novo
}

export function larguraEmRem(tema) {
  const valor = String((tema && tema.largura) || LARGURA_PADRAO).trim()
  const numero = Number.parseFloat(valor)
  if (!Number.isFinite(numero) || numero <= 0) return Number.parseFloat(LARGURA_PADRAO)
  if (/px$/i.test(valor)) return Math.round((numero / 16) * 10) / 10
  return numero
}

export function definirLargura(tema, rem) {
  const numero = Number.parseFloat(rem)
  if (!Number.isFinite(numero) || numero <= 0) return tema
  const preso = Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, numero))
  return definirDoTema(tema, "largura", `${preso}rem`)
}

// As seções da aba, na ordem em que aparecem. Cada controle diz o que é e
// qual chave do tema ele mexe — a tela é desenhada a partir disto, então
// controle novo é uma linha aqui, não uma função nova.
export const SECOES = [
  {
    chave: "conversa",
    titulo: "Conversa",
    nota: "O quadro onde a conversa acontece.",
    controles: [
      { tipo: "largura", rotulo: "Largura máxima" },
      { tipo: "cor", chave: "fundo", rotulo: "Fundo" },
      { tipo: "cor", chave: "superficie", rotulo: "Fundo das caixas" },
      { tipo: "cor", chave: "texto", rotulo: "Texto" },
      { tipo: "cor", chave: "borda", rotulo: "Bordas" },
      { tipo: "fonte", chave: "fonte", rotulo: "Fonte" }
    ]
  },
  {
    chave: "retrato",
    titulo: "Retrato de quem atende",
    nota: "Aparece ao lado das falas do chat.",
    controles: [
      { tipo: "interruptor", chave: "avatar", rotulo: "Mostrar retrato" },
      { tipo: "texto", chave: "avatar", rotulo: "Imagem", dica: "logo.svg" },
      { tipo: "texto", chave: "marca", rotulo: "Nome da marca", dica: "Osher" }
    ]
  },
  {
    chave: "falas",
    titulo: "Falas do chat",
    controles: [
      { tipo: "cor", chave: "acento", rotulo: "Fundo" },
      { tipo: "cor", chave: "sobre-acento", rotulo: "Texto" }
    ]
  },
  {
    chave: "respostas",
    titulo: "Falas da pessoa",
    controles: [
      { tipo: "cor", chave: "destaque", rotulo: "Fundo" },
      { tipo: "cor", chave: "sobre-destaque", rotulo: "Texto" }
    ]
  },
  {
    chave: "botoes",
    titulo: "Botões",
    nota: "Enviar e continuar.",
    controles: [
      { tipo: "cor", chave: "botao", rotulo: "Fundo" },
      { tipo: "cor", chave: "sobre-botao", rotulo: "Texto" }
    ]
  },
  {
    chave: "opcoes",
    titulo: "Botões de escolha",
    nota: "As alternativas que a pessoa clica.",
    controles: [
      { tipo: "cor", chave: "botao-opcao", rotulo: "Fundo" },
      { tipo: "cor", chave: "sobre-botao-opcao", rotulo: "Texto" }
    ]
  },
  {
    chave: "campo",
    titulo: "Campo de resposta",
    controles: [
      { tipo: "cor", chave: "campo", rotulo: "Fundo" },
      { tipo: "cor", chave: "sobre-campo", rotulo: "Texto" },
      { tipo: "cor", chave: "placeholder", rotulo: "Texto de exemplo" }
    ]
  },
  {
    chave: "erros",
    titulo: "Avisos",
    nota: "Quando a resposta não serve.",
    controles: [
      { tipo: "cor", chave: "erro", rotulo: "Faixa de erro" },
      { tipo: "cor", chave: "sobre-erro", rotulo: "Texto da faixa" },
      { tipo: "cor", chave: "aviso", rotulo: "Selo de atenção" }
    ]
  }
]

// Toda chave de cor que a aba sabe editar. Serve ao teste que confere se
// alguma cor do motor ficou sem controle.
export function coresEditaveis() {
  return SECOES.flatMap((s) => s.controles.filter((c) => c.tipo === "cor").map((c) => c.chave))
}
