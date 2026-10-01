// Pan, zoom e por onde a seta sai e chega. Matemática pura: erra em silêncio
// e só aparece como "o canvas está estranho", então vem coberta.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  criarVista, arrastar, aplicarZoom, paraMundo, paraTela, ancoras, enquadrar, caixaEm,
  pontaDaSeta, ESCALA_MIN, ESCALA_MAX
} from "../editor/vista.js"

const perto = (a, b, tol = 0.001) =>
  assert.ok(Math.abs(a - b) < tol, `esperava ~${b}, veio ${a}`)

test("a vista comeca na origem, sem zoom", () => {
  const v = criarVista()
  assert.deepEqual(v, { x: 0, y: 0, escala: 1 })
})

test("arrastar desloca e nao mexe na escala", () => {
  const v = arrastar(criarVista(), { dx: 30, dy: -20 })
  assert.deepEqual(v, { x: 30, y: -20, escala: 1 })
})

test("arrastar nao modifica a vista recebida", () => {
  const v = criarVista()
  arrastar(v, { dx: 10, dy: 10 })
  assert.deepEqual(v, { x: 0, y: 0, escala: 1 })
})

test("tela e mundo sao o inverso um do outro", () => {
  const v = aplicarZoom(arrastar(criarVista(), { dx: 47, dy: -13 }), { delta: -3, ponto: { x: 200, y: 150 } })
  const mundo = paraMundo(v, { x: 321, y: 87 })
  const volta = paraTela(v, mundo)
  perto(volta.x, 321)
  perto(volta.y, 87)
})

test("o zoom mantem parado o ponto sob o cursor", () => {
  const v = arrastar(criarVista(), { dx: 12, dy: 34 })
  const cursor = { x: 400, y: 300 }
  const antes = paraMundo(v, cursor)

  const depois = paraMundo(aplicarZoom(v, { delta: -5, ponto: cursor }), cursor)

  perto(depois.x, antes.x)
  perto(depois.y, antes.y)
})

test("zoom para dentro aumenta a escala, para fora diminui", () => {
  const v = criarVista()
  assert.ok(aplicarZoom(v, { delta: -1, ponto: { x: 0, y: 0 } }).escala > 1)
  assert.ok(aplicarZoom(v, { delta: 1, ponto: { x: 0, y: 0 } }).escala < 1)
})

test("a escala tem teto e chao", () => {
  let v = criarVista()
  for (let i = 0; i < 100; i++) v = aplicarZoom(v, { delta: -10, ponto: { x: 0, y: 0 } })
  assert.equal(v.escala, ESCALA_MAX)
  for (let i = 0; i < 200; i++) v = aplicarZoom(v, { delta: 10, ponto: { x: 0, y: 0 } })
  assert.equal(v.escala, ESCALA_MIN)
})

// --- âncoras ---------------------------------------------------------------

const caixa = (x, y) => ({ x, y, largura: 260, altura: 120 })

test("destino a direita: sai pela direita, entra pela esquerda", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 0))
  assert.equal(a.de.lado, "direita")
  assert.equal(a.para.lado, "esquerda")
  perto(a.de.x, 260)
  perto(a.de.y, 60)
  perto(a.para.x, 500)
})

test("destino a esquerda: sai pela esquerda, entra pela direita", () => {
  const a = ancoras(caixa(500, 0), caixa(0, 0))
  assert.equal(a.de.lado, "esquerda")
  assert.equal(a.para.lado, "direita")
})

test("destino abaixo e quase alinhado: sai por baixo, entra por cima", () => {
  const a = ancoras(caixa(0, 0), caixa(20, 400))
  assert.equal(a.de.lado, "baixo")
  assert.equal(a.para.lado, "cima")
})

test("o caminho e um path SVG que comeca na ancora de saida", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 200))
  assert.match(a.caminho, /^M /)
  assert.match(a.caminho, /C /)
  assert.ok(a.caminho.startsWith(`M ${a.de.x} ${a.de.y}`))
  assert.ok(a.caminho.endsWith(`${a.para.x} ${a.para.y}`))
})

test("grupo que aponta para si mesmo nao vira caminho degenerado", () => {
  const c = caixa(100, 100)
  const a = ancoras(c, c)
  assert.ok(a.caminho.length > 10)
  assert.notEqual(a.de.lado, a.para.lado, "entrada e saída no mesmo lado desenham uma linha invisível")
})

// --- enquadrar -------------------------------------------------------------

test("enquadrar poe todo o conteudo dentro da area visivel", () => {
  const caixas = [caixa(0, 0), caixa(320, 1020), caixa(900, 400)]
  const v = enquadrar(caixas, { largura: 1000, altura: 800 })
  for (const c of caixas) {
    const a = paraTela(v, { x: c.x, y: c.y })
    const b = paraTela(v, { x: c.x + c.largura, y: c.y + c.altura })
    assert.ok(a.x >= -0.5 && a.y >= -0.5, `canto superior fora: ${JSON.stringify(a)}`)
    assert.ok(b.x <= 1000.5 && b.y <= 800.5, `canto inferior fora: ${JSON.stringify(b)}`)
  }
})

test("enquadrar centra o conteudo", () => {
  const caixas = [caixa(0, 0)]
  const v = enquadrar(caixas, { largura: 1000, altura: 800 })
  const centro = paraTela(v, { x: 130, y: 60 })   // centro da caixa 260x120
  perto(centro.x, 500, 1)
  perto(centro.y, 400, 1)
})

test("fluxo pequeno nao e ampliado alem do tamanho natural", () => {
  const v = enquadrar([caixa(0, 0)], { largura: 2000, altura: 2000 })
  assert.equal(v.escala, 1, "ampliar um fluxo de um cartão só deixaria tudo gigante")
})

test("fluxo grande e reduzido ate caber, respeitando o chao da escala", () => {
  const v = enquadrar([caixa(0, 0), caixa(20000, 20000)], { largura: 800, altura: 600 })
  assert.ok(v.escala < 1)
  assert.ok(v.escala >= ESCALA_MIN)
})

test("sem caixa nenhuma devolve a vista inicial", () => {
  assert.deepEqual(enquadrar([], { largura: 800, altura: 600 }), criarVista())
})

test("area sem tamanho ainda devolve vista utilizavel", () => {
  const v = enquadrar([caixa(0, 0)], { largura: 0, altura: 0 })
  assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && v.escala > 0)
})

// --- quem está sob o ponto -------------------------------------------------

test("caixaEm acha o grupo sob o ponto", () => {
  const mapa = new Map([["g1", caixa(0, 0)], ["g2", caixa(400, 200)]])
  assert.equal(caixaEm(mapa, { x: 10, y: 10 }), "g1")
  assert.equal(caixaEm(mapa, { x: 500, y: 250 }), "g2")
})

test("ponto no vazio nao e grupo nenhum", () => {
  const mapa = new Map([["g1", caixa(0, 0)]])
  assert.equal(caixaEm(mapa, { x: 999, y: 999 }), null)
})

test("a borda conta como dentro", () => {
  const mapa = new Map([["g1", caixa(0, 0)]])
  assert.equal(caixaEm(mapa, { x: 260, y: 120 }), "g1")
})

test("com caixas sobrepostas, a de cima vence", () => {
  const mapa = new Map([["debaixo", caixa(0, 0)], ["emcima", caixa(10, 10)]])
  assert.equal(caixaEm(mapa, { x: 50, y: 50 }), "emcima",
    "a última desenhada é a que a pessoa vê e acha que está clicando")
})

// --- ponta da seta ---------------------------------------------------------

test("a ponta aponta para dentro da caixa que recebe a ligacao", () => {
  // Entrando pela esquerda, o bico fica no ponto e a base à esquerda dele.
  const d = pontaDaSeta({ x: 100, y: 50 }, "esquerda", 10)
  const pontos = d.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.deepEqual(pontos.slice(0, 2), [100, 50], "o bico fica no ponto de encontro")
  assert.ok(pontos[2] < 100 && pontos[4] < 100, "a base fica atrás do bico")
  assert.notEqual(pontos[3], pontos[5], "a base tem largura")
})

test("a ponta gira com o lado de chegada", () => {
  const porCima = pontaDaSeta({ x: 100, y: 50 }, "cima", 10)
  const pontos = porCima.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.deepEqual(pontos.slice(0, 2), [100, 50])
  assert.ok(pontos[3] < 50 && pontos[5] < 50, "entrando por cima, a base fica acima")
  assert.notEqual(pontos[2], pontos[4], "a base tem largura")
})

test("lado desconhecido nao derruba o desenho", () => {
  assert.match(pontaDaSeta({ x: 0, y: 0 }, undefined, 8), /^M 0 0 L/)
})

test("ancoras dizem por onde a seta sai e por onde chega", () => {
  const a = { x: 0, y: 0, largura: 100, altura: 50 }
  const b = { x: 400, y: 0, largura: 100, altura: 50 }
  const { ladoDe, ladoPara } = ancoras(a, b)
  assert.equal(ladoDe, "direita")
  assert.equal(ladoPara, "esquerda")
})

// --- ímã -------------------------------------------------------------------

test("com margem, chegar perto do cartao ja conta como acertar", () => {
  const mapa = new Map([["g1", { x: 100, y: 100, largura: 60, altura: 40 }]])
  const quaseEmCima = { x: 90, y: 110 }
  assert.equal(caixaEm(mapa, quaseEmCima), null, "sem ímã, só o encaixe exato")
  assert.equal(caixaEm(mapa, quaseEmCima, 20), "g1", "com ímã, 10px fora conta")
  assert.equal(caixaEm(mapa, { x: 40, y: 110 }, 20), null, "longe continua longe")
})
