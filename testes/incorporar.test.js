// A bolha de incorporar: o que se cola e a altura.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  enderecoIncorporado, alturaIncorporada, ALTURA_PADRAO, ALTURA_MAXIMA, ALTURA_MINIMA
} from "../motor/incorporar.js"

test("um endereco vira o proprio endereco", () => {
  assert.equal(enderecoIncorporado("https://exemplo.com/a.pdf"), "https://exemplo.com/a.pdf")
  assert.equal(enderecoIncorporado("  https://exemplo.com/f  "), "https://exemplo.com/f")
  assert.equal(enderecoIncorporado("//exemplo.com/f"), "//exemplo.com/f")
})

test("o codigo de incorporar tambem serve: e o que os servicos dao de copiar", () => {
  assert.equal(
    enderecoIncorporado('<iframe src="https://docs.google.com/forms/d/e/x/viewform?embedded=true" width="640"></iframe>'),
    "https://docs.google.com/forms/d/e/x/viewform?embedded=true")
  assert.equal(enderecoIncorporado("<iframe width='100' src='https://exemplo/a'></iframe>"), "https://exemplo/a")
})

test("o que nao e endereco nao vira quadro", () => {
  assert.equal(enderecoIncorporado("javascript:alert(1)"), "")
  assert.equal(enderecoIncorporado("<script>roubar()</script>"), "")
  assert.equal(enderecoIncorporado("qualquer frase"), "")
  assert.equal(enderecoIncorporado(""), "")
  assert.equal(enderecoIncorporado(null), "")
})

test("a altura tem um padrao, e ele e o do print", () => {
  assert.equal(alturaIncorporada(undefined), ALTURA_PADRAO)
  assert.equal(ALTURA_PADRAO, 400)
  assert.equal(alturaIncorporada(""), ALTURA_PADRAO)
  assert.equal(alturaIncorporada("nada"), ALTURA_PADRAO)
})

test("a altura fica entre limites que cabem numa tela", () => {
  assert.equal(alturaIncorporada(10), ALTURA_MINIMA)
  assert.equal(alturaIncorporada(99999), ALTURA_MAXIMA)
  assert.equal(alturaIncorporada("600"), 600)
  assert.equal(alturaIncorporada(600.7), 600)
})
