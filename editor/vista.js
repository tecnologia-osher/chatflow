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
function ladosEntre(a, b) {
  const ca = centro(a)
  const cb = centro(b)
  const dx = cb.x - ca.x
  const dy = cb.y - ca.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["direita", "esquerda"] : ["esquerda", "direita"]
  }
  return dy >= 0 ? ["baixo", "cima"] : ["cima", "baixo"]
}

export function ancoras(a, b) {
  // Auto-laço: mesma caixa dos dois lados. Sai pela direita e volta por cima,
  // senão os dois pontos coincidem e a curva não aparece.
  const [ladoDe, ladoPara] = a === b || (a.x === b.x && a.y === b.y)
    ? ["direita", "cima"]
    : ladosEntre(a, b)

  const de = pontoNoLado(a, ladoDe)
  const para = pontoNoLado(b, ladoPara)

  // Curva de Bézier com as alças no eixo da saída: a seta deixa o cartão
  // perpendicular à borda, que é o que faz o desenho parecer arrumado.
  const forca = Math.max(60, Math.abs(para.x - de.x) / 2, Math.abs(para.y - de.y) / 2)
  const eixo = (lado) =>
    lado === "direita" ? { x: forca, y: 0 }
      : lado === "esquerda" ? { x: -forca, y: 0 }
        : lado === "baixo" ? { x: 0, y: forca } : { x: 0, y: -forca }

  const c1 = eixo(ladoDe)
  const c2 = eixo(ladoPara)
  const caminho =
    `M ${de.x} ${de.y} C ${de.x + c1.x} ${de.y + c1.y}, ${para.x + c2.x} ${para.y + c2.y}, ${para.x} ${para.y}`

  return { de, para, caminho }
}
