// Pan, zoom e por onde a seta sai e chega. Matemática pura: erra em silêncio
// e só aparece como "o canvas está estranho", então vem coberta.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  criarVista, arrastar, aplicarZoom, paraMundo, paraTela, ancoras, enquadrar,
  ESCALA_MIN, ESCALA_MAX
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
