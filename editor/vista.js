// Pan, zoom e geometria das setas. Tudo puro: recebe estado, devolve estado
// novo. O canvas só traduz isso em pixel.

export const ESCALA_MIN = 0.25
export const ESCALA_MAX = 2.5
const PASSO = 1.0015   // por unidade de deslocamento da roda

export function criarVista() {
  return { x: 0, y: 0, escala: 1 }
}

export function arrastar(vista, { dx = 0, dy = 0 } = {}) {
  return { ...vista, x: vista.x + dx, y: vista.y + dy }
}

// Converte um ponto da tela para a coordenada do fluxo.
export function paraMundo(vista, ponto) {
  return { x: (ponto.x - vista.x) / vista.escala, y: (ponto.y - vista.y) / vista.escala }
}

export function paraTela(vista, ponto) {
  return { x: ponto.x * vista.escala + vista.x, y: ponto.y * vista.escala + vista.y }
}

// Zoom ancorado no cursor: o ponto do fluxo que está sob o ponteiro continua
// sob o ponteiro depois. Sem isso o canvas "foge" da mão de quem usa.
export function aplicarZoom(vista, { delta, ponto }) {
  const bruta = vista.escala * Math.pow(PASSO, -delta)
  const escala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, bruta))
  if (escala === vista.escala) return { ...vista }

  const alvo = paraMundo(vista, ponto)
  return { escala, x: ponto.x - alvo.x * escala, y: ponto.y - alvo.y * escala }
}

// --- setas -----------------------------------------------------------------

const centro = (c) => ({ x: c.x + c.largura / 2, y: c.y + c.altura / 2 })

function pontoNoLado(caixa, lado) {
  const meio = centro(caixa)
  if (lado === "direita") return { x: caixa.x + caixa.largura, y: meio.y, lado }
  if (lado === "esquerda") return { x: caixa.x, y: meio.y, lado }
  if (lado === "baixo") return { x: meio.x, y: caixa.y + caixa.altura, lado }
  return { x: meio.x, y: caixa.y, lado }
}

// Escolhe os lados pelo eixo que domina a distância. Horizontal ganha empate
// porque o fluxo cresce para a direita — é como a pessoa lê.
// Por qual lado a seta sai e por qual ela entra.
//
// A saída é sempre lateral, porque é lá que estão as bolinhas: pela direita
// quando o destino está à direita, pela esquerda quando está à esquerda. Sair
// pelo topo, como se fazia quando a distância vertical era maior, mandava a
// linha para dentro do cartão de cima — era a bagunça que aparecia no fluxo da
// Osher entre "Idade" e "Objetivo".
//
// A entrada é a lateral que olha para a origem, com uma exceção: destino na
// mesma coluna e abaixo entra por cima, senão a linha teria de contornar o
// cartão inteiro para alcançar a lateral.
function ladosEntre(a, b) {
  // A saída é sempre pela direita: é lá que a bolinha está, em todo cartão e
  // no Start. Sair por outro lado faz a linha nascer longe dela.
  const paraEsquerda = centro(b).x < centro(a).x
  const mesmaColuna = Math.abs(b.x - a.x) < a.largura
  const abaixo = b.y > a.y + a.altura
  if (abaixo && mesmaColuna) return ["direita", "cima"]
  return ["direita", paraEsquerda ? "direita" : "esquerda"]
}

// O comprimento do toco que sai perpendicular à borda antes de a linha virar.
// Sem ele a curva nasce já torta e parece sair do canto do cartão.
const TOCO = 26
// Raio dos cantos. Encolhe quando o trecho é curto, senão o arco passa do fim
// do segmento e a linha dá um nó.
const CANTO = 10

function desloca(ponto, lado, quanto) {
  if (lado === "direita") return { x: ponto.x + quanto, y: ponto.y }
  if (lado === "esquerda") return { x: ponto.x - quanto, y: ponto.y }
  if (lado === "baixo") return { x: ponto.x, y: ponto.y + quanto }
  return { x: ponto.x, y: ponto.y - quanto }
}

const horizontal = (lado) => lado === "esquerda" || lado === "direita"

// Tira ponto repetido e ponto no meio de uma reta: canto que não existe não
// precisa de arredondamento, e um ponto duplicado viraria um arco de raio zero.
function limparPontos(pontos) {
  const limpos = []
  for (const ponto of pontos) {
    const ultimo = limpos[limpos.length - 1]
    if (ultimo && Math.abs(ultimo.x - ponto.x) < 0.01 && Math.abs(ultimo.y - ponto.y) < 0.01) continue
    limpos.push(ponto)
  }
  const sem = []
  for (let i = 0; i < limpos.length; i++) {
    const antes = sem[sem.length - 1]
    const depois = limpos[i + 1]
    if (antes && depois) {
      const retaX = Math.abs(antes.x - limpos[i].x) < 0.01 && Math.abs(limpos[i].x - depois.x) < 0.01
      const retaY = Math.abs(antes.y - limpos[i].y) < 0.01 && Math.abs(limpos[i].y - depois.y) < 0.01
      if (retaX || retaY) continue
    }
    sem.push(limpos[i])
  }
  return sem
}

const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)

const caminhoPara = (a, b, quanto) => {
  const d = distancia(a, b) || 1
  return { x: a.x + ((b.x - a.x) / d) * quanto, y: a.y + ((b.y - a.y) / d) * quanto }
}

// A polilinha vira caminho com os cantos arredondados: chega-se perto do
// canto em reta, e o próprio canto é o controle de uma curva curta até o
// começo do trecho seguinte.
export function caminhoComCantos(pontos, raio = CANTO) {
  if (pontos.length < 2) return ""
  let d = `M ${pontos[0].x} ${pontos[0].y}`
  for (let i = 1; i < pontos.length - 1; i++) {
    const canto = pontos[i]
    const r = Math.min(raio, distancia(pontos[i - 1], canto) / 2, distancia(canto, pontos[i + 1]) / 2)
    const entra = caminhoPara(canto, pontos[i - 1], r)
    const sai = caminhoPara(canto, pontos[i + 1], r)
    d += ` L ${entra.x} ${entra.y} Q ${canto.x} ${canto.y}, ${sai.x} ${sai.y}`
  }
  const fim = pontos[pontos.length - 1]
  return `${d} L ${fim.x} ${fim.y}`
}

// Por onde a seta sai, por onde chega, e o caminho entre os dois.
//
// O caminho é ortogonal, de cantos arredondados, como no Typebot: sai
// perpendicular à borda, vira no meio do vão entre as duas caixas e entra
// perpendicular na outra. Era uma curva de Bézier, que corta em diagonal e
// passa por cima dos cartões que estiverem no meio; a perna vertical no meio
// do vão corre no corredor entre as colunas.
export function ancoras(a, b) {
  // Auto-laço: mesma caixa dos dois lados. Sai pela direita e volta por cima,
  // senão os dois pontos coincidem e a curva não aparece.
  const [ladoDe, ladoPara] = a === b || (a.x === b.x && a.y === b.y)
    ? ["direita", "cima"]
    : ladosEntre(a, b)

  const de = pontoNoLado(a, ladoDe)
  const para = pontoNoLado(b, ladoPara)
  const tocoDe = desloca(de, ladoDe, TOCO)
  const tocoPara = desloca(para, ladoPara, TOCO)

  const meio = []
  // Indo para trás, os dois tocos apontam para o mesmo lado e a virada não
  // pode ser no meio deles — cairia dentro de um dos cartões. A linha sai,
  // desce (ou sobe) até a altura do meio, volta e entra pelo mesmo lado.
  const paraTras = ladoDe === ladoPara
  if (horizontal(ladoDe) && horizontal(ladoPara) && paraTras) {
    const y = (tocoDe.y + tocoPara.y) / 2
    meio.push({ x: tocoDe.x, y }, { x: tocoPara.x, y })
  } else if (horizontal(ladoDe) && horizontal(ladoPara)) {
    const x = (tocoDe.x + tocoPara.x) / 2
    meio.push({ x, y: tocoDe.y }, { x, y: tocoPara.y })
  } else if (horizontal(ladoDe)) {
    // Desce (ou sobe) primeiro, pelo corredor ao lado do cartão, e só depois
    // atravessa: virar logo na altura da bolinha passaria por dentro dele.
    meio.push({ x: tocoDe.x, y: tocoPara.y })
  } else if (horizontal(ladoPara)) {
    meio.push({ x: tocoPara.x, y: tocoDe.y })
  } else {
    const y = (tocoDe.y + tocoPara.y) / 2
    meio.push({ x: tocoDe.x, y }, { x: tocoPara.x, y })
  }

  const pontos = limparPontos([de, tocoDe, ...meio, tocoPara, para])
  return { de, para, pontos, caminho: caminhoComCantos(pontos), ladoDe, ladoPara }
}


// Enquadra todo o conteúdo na área visível. Sem isto, um fluxo mais alto que
// a tela abre mostrando só o começo, e quem olha conclui que o editor cortou
// o trabalho — foi exatamente o que aconteceu com o fluxo da Osher, que vai
// de y=40 a y=1020 numa área de 843px.
const MARGEM = 48

export function enquadrar(caixas, { largura, altura, margem = MARGEM } = {}) {
  const lista = (caixas || []).filter(Boolean)
  if (lista.length === 0) return criarVista()

  const minX = Math.min(...lista.map((c) => c.x))
  const minY = Math.min(...lista.map((c) => c.y))
  const maxX = Math.max(...lista.map((c) => c.x + c.largura))
  const maxY = Math.max(...lista.map((c) => c.y + c.altura))

  const util = {
    largura: Math.max(1, (largura || 0) - margem * 2),
    altura: Math.max(1, (altura || 0) - margem * 2)
  }
  const conteudo = { largura: Math.max(1, maxX - minX), altura: Math.max(1, maxY - minY) }

  // Nunca amplia além do tamanho natural: um fluxo de um cartão só ficaria
  // gigante e desorientado no meio da tela.
  const escala = Math.max(ESCALA_MIN, Math.min(1,
    util.largura / conteudo.largura, util.altura / conteudo.altura))

  return {
    escala,
    x: (largura || 0) / 2 - (minX + conteudo.largura / 2) * escala,
    y: (altura || 0) / 2 - (minY + conteudo.altura / 2) * escala
  }
}

// Qual grupo está sob um ponto do fluxo. Serve para saber onde a ligação foi
// solta. Percorre de trás para frente: com cartões sobrepostos, o de cima é o
// que a pessoa vê e acredita estar acertando.
//
// A `margem` é o alcance do ímã: com ela, chegar perto do cartão já conta como
// acertar. Zero é o encaixe exato.
export function caixaEm(mapaDeCaixas, ponto, margem = 0) {
  const entradas = [...(mapaDeCaixas?.entries?.() || [])]
  for (let i = entradas.length - 1; i >= 0; i--) {
    const [id, c] = entradas[i]
    if (ponto.x >= c.x - margem && ponto.x <= c.x + c.largura + margem &&
        ponto.y >= c.y - margem && ponto.y <= c.y + c.altura + margem) return id
  }
  return null
}

// A ponta da seta: um triângulo apontando para dentro da caixa que recebe a
// ligação. Linha sem ponta não diz quem liga quem — os dois lados parecem
// iguais, e num fluxo com volta ninguém sabe para onde o lead vai.
const PONTA = 9

export function pontaDaSeta(ponto, lado, tamanho = PONTA) {
  // O lado é o da caixa que recebe: entrando pela esquerda, a seta aponta
  // para a direita.
  const direcao = {
    esquerda: { x: 1, y: 0 }, direita: { x: -1, y: 0 },
    cima: { x: 0, y: 1 }, baixo: { x: 0, y: -1 }
  }[lado] || { x: 1, y: 0 }

  // Base do triângulo, perpendicular à direção.
  const lateral = { x: -direcao.y, y: direcao.x }
  const base = { x: ponto.x - direcao.x * tamanho, y: ponto.y - direcao.y * tamanho }
  const meia = tamanho * 0.5
  const a = { x: base.x + lateral.x * meia, y: base.y + lateral.y * meia }
  const b = { x: base.x - lateral.x * meia, y: base.y - lateral.y * meia }
  return `M ${ponto.x} ${ponto.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`
}
