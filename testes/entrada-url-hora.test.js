// Website e Hora: dois tipos que o motor já sabia atender antes de existirem.
// Quem valida é a própria definição, e quem diz os atributos do campo também —
// por isso nenhum dos dois pediu uma linha no motor.

import { test } from "node:test"
import assert from "node:assert/strict"
import { registrarTodos } from "../motor/blocos/index.js"
import { obter, limpar } from "../motor/blocos/_registro.js"

limpar()
registrarTodos()

const url = obter("entrada_url")
const hora = obter("entrada_hora")

test("o endereco de site aceita o que as pessoas de fato digitam", () => {
  for (const bom of ["https://osher.com.br", "http://x.co/a?b=1",
    "osher.com.br", "www.osher.com.br", "osher.com.br/planos"]) {
    assert.equal(url.validar(bom), true, `recusou "${bom}", que é um site`)
  }
})

test("ninguem digita o protocolo: sem ele continua sendo site", () => {
  assert.equal(url.validar("osher.com.br"), true,
    "exigir https:// transformaria o campo numa pegadinha")
})

test("o que nao e endereco nao passa", () => {
  for (const ruim of ["", "   ", "osher", "osher.", "@osher.com.br", "ponto com",
    "javascript:alert(1)", "http://", "a b.com"]) {
    assert.equal(url.validar(ruim), false, `aceitou "${ruim}", que não é site`)
  }
})

test("o campo de site pede o teclado de endereco no celular", () => {
  assert.equal(url.campo_html.type, "url")
  assert.equal(url.campo_html.inputmode, "url")
})

test("a hora aceita o relogio de 24 horas, e so ele", () => {
  for (const boa of ["00:00", "09:30", "13:05", "23:59"]) {
    assert.equal(hora.validar(boa), true, `recusou ${boa}`)
  }
  for (const ruim of ["", "24:00", "9:30", "23:60", "12", "12:5", "meio-dia", "12:00:00"]) {
    assert.equal(hora.validar(ruim), false, `aceitou ${ruim}`)
  }
})

test("a hora usa o campo nativo: no celular ele abre o relogio", () => {
  assert.equal(hora.campo_html.type, "time")
})

test("os dois guardam resposta e nenhum ramifica", () => {
  for (const d of [url, hora]) {
    assert.equal(d.categoria, "entrada")
    assert.equal(d.salva_variavel, true)
    assert.equal(d.ramifica, false)
    assert.match(d.erro, /\S/, "erro em branco deixa a pessoa travada sem saber por quê")
  }
})
