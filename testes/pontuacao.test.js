import { test } from "node:test"
import assert from "node:assert/strict"
import { classificar, pontuacaoAtiva } from "../motor/pontuacao.js"

const faixas = { quente: 9, morno: 5 }

test("classifica nos limites exatos", () => {
  assert.equal(classificar(9, faixas), "quente")
  assert.equal(classificar(8, faixas), "morno")
  assert.equal(classificar(5, faixas), "morno")
  assert.equal(classificar(4, faixas), "frio")
})

test("acima da maior faixa continua quente", () => {
  assert.equal(classificar(50, faixas), "quente")
})

test("zero e frio", () => {
  assert.equal(classificar(0, faixas), "frio")
})

test("faixas fora de ordem no objeto nao afetam o resultado", () => {
  assert.equal(classificar(9, { morno: 5, quente: 9 }), "quente")
})

test("faixas ausentes devolve null", () => {
  assert.equal(classificar(9, undefined), null)
  assert.equal(classificar(9, {}), null)
})

test("pontuacaoAtiva le a configuracao do fluxo", () => {
  assert.equal(pontuacaoAtiva({ pontuacao: { ativa: true, faixas } }), true)
  assert.equal(pontuacaoAtiva({ pontuacao: { ativa: false, faixas } }), false)
  assert.equal(pontuacaoAtiva({}), false)
})
