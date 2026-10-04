// Onde uma caixa flutuante abre. Pura geometria, de propósito: no dublê de DOM
// a caixa não tem tamanho até ser medida pelo navegador, e forçar tamanho nela
// provaria o dublê, não a conta.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ondeAbrirACaixa } from "../editor/onde-abrir.js"

const quadro = { left: 0, top: 0, right: 1000, bottom: 600 }
const FOLGA = 12

test("abre a direita do bloco quando cabe", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 200, right: 400, top: 100, bottom: 140 },
    area: quadro, caixa: { largura: 280, altura: 200 }
  })
  assert.equal(onde.x, 400 + FOLGA)
  assert.equal(onde.y, 100)
})

test("sem espaco a direita, abre a esquerda", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 700, right: 900, top: 100, bottom: 140 },
    area: quadro, caixa: { largura: 280, altura: 200 }
  })
  assert.equal(onde.x, 700 - FOLGA - 280)
})

test("sem espaco dos dois lados, fica na beira de dentro", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 20, right: 980, top: 100, bottom: 140 },
    area: quadro, caixa: { largura: 280, altura: 200 }
  })
  assert.equal(onde.x, FOLGA, "caixa com o começo fora do quadro não dá para preencher")
})

test("caixa alta perto do pe do quadro sobe ate caber", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 200, right: 400, top: 560, bottom: 590 },
    area: quadro, caixa: { largura: 280, altura: 260 }
  })
  assert.ok(onde.y + 260 <= 600 - FOLGA,
    `termina em ${onde.y + 260}, fora do quadro: metade da caixa fica inalcançável`)
  assert.ok(onde.y >= FOLGA, "subir demais a tira pela beira de cima")
})

test("caixa mais alta que o quadro encosta no topo, e nao no meio do nada", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 200, right: 400, top: 300, bottom: 340 },
    area: quadro, caixa: { largura: 280, altura: 900 }
  })
  assert.equal(onde.y, FOLGA, "o que importa é ver o começo dela")
})

test("a conta e relativa ao quadro, e nao a janela", () => {
  const deslocado = { left: 300, top: 60, right: 1300, bottom: 660 }
  const onde = ondeAbrirACaixa({
    alvo: { left: 500, right: 700, top: 160, bottom: 200 },
    area: deslocado, caixa: { largura: 280, altura: 200 }
  })
  assert.equal(onde.x, 700 - 300 + FOLGA, "a caixa é posicionada dentro do palco")
  assert.equal(onde.y, 160 - 60)
})

test("caixa sem altura medida ainda abre em algum lugar util", () => {
  const onde = ondeAbrirACaixa({
    alvo: { left: 200, right: 400, top: 100, bottom: 140 },
    area: quadro, caixa: { largura: 0, altura: 0 }
  })
  assert.ok(Number.isFinite(onde.x) && Number.isFinite(onde.y))
  assert.ok(onde.y >= 0)
})
