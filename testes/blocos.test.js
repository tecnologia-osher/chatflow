import { test } from "node:test"
import assert from "node:assert/strict"
import { limpar, obter, todos } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"

function preparar() {
  limpar()
  registrarTodos()
}

test("registra os treze tipos do v1", () => {
  preparar()
  assert.equal(todos().length, 13)
})

test("so tres tipos ramificam", () => {
  preparar()
  const ramificam = todos().filter((d) => d.ramifica).map((d) => d.tipo).sort()
  assert.deepEqual(ramificam, ["condicao", "entrada_botoes", "ir_para"])
})

test("todo bloco de categoria entrada salva variavel", () => {
  preparar()
  for (const d of todos().filter((x) => x.categoria === "entrada")) {
    assert.equal(d.salva_variavel, true, `${d.tipo} deveria salvar variável`)
  }
})

test("validacao de email", () => {
  preparar()
  const email = obter("entrada_email")
  assert.equal(email.validar("ana@osher.com.br"), true)
  assert.equal(email.validar("ana@"), false)
  assert.equal(email.validar("sem arroba"), false)
  assert.equal(email.validar(""), false)
})

test("validacao de telefone aceita formatos brasileiros comuns", () => {
  preparar()
  const tel = obter("entrada_telefone")
  assert.equal(tel.validar("(61) 98228-6044"), true)
  assert.equal(tel.validar("61982286044"), true)
  assert.equal(tel.validar("+55 61 98228-6044"), true)
  assert.equal(tel.validar("123"), false)
  assert.equal(tel.validar("abcdefghijk"), false)
})

test("validacao de numero", () => {
  preparar()
  const num = obter("entrada_numero")
  assert.equal(num.validar("42"), true)
  assert.equal(num.validar("3,5"), true)
  assert.equal(num.validar("abc"), false)
  assert.equal(num.validar(""), false)
})

test("validacao de data no formato dd/mm/aaaa", () => {
  preparar()
  const data = obter("entrada_data")
  assert.equal(data.validar("27/08/2026"), true)
  assert.equal(data.validar("32/08/2026"), false)
  assert.equal(data.validar("27-08-2026"), false)
})

test("entrada de texto aceita qualquer conteudo nao vazio", () => {
  preparar()
  const texto = obter("entrada_texto")
  assert.equal(texto.validar("Ana"), true)
  assert.equal(texto.validar("   "), false)
})

test("validacao de botoes", () => {
  preparar()
  const botoes = obter("entrada_botoes")
  assert.equal(botoes.validar("Sim"), true)
  assert.equal(botoes.validar(""), false)
  assert.equal(botoes.validar(undefined), false)
})

test("todo tipo declara campos com nome e rotulo", () => {
  preparar()
  for (const d of todos()) {
    for (const campo of d.campos) {
      assert.equal(typeof campo.nome, "string", `${d.tipo}: campo sem nome`)
      assert.equal(typeof campo.rotulo, "string", `${d.tipo}: campo sem rotulo`)
    }
  }
})
