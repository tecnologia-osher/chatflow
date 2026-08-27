import { test } from "node:test"
import assert from "node:assert/strict"
import { registrar, obter, todos, limpar } from "../motor/blocos/_registro.js"

const definicaoValida = {
  tipo: "texto",
  categoria: "fala",
  rotulo: "Texto",
  ramifica: false,
  salva_variavel: false,
  campos: [{ nome: "texto", rotulo: "Mensagem", tipo: "texto", aceita_variavel: true }]
}

test("registra e recupera uma definicao", () => {
  limpar()
  registrar(definicaoValida)
  assert.equal(obter("texto").rotulo, "Texto")
})

test("obter tipo desconhecido lanca erro com o nome do tipo", () => {
  limpar()
  assert.throws(() => obter("inexistente"), /inexistente/)
})

test("registrar o mesmo tipo duas vezes lanca erro", () => {
  limpar()
  registrar(definicaoValida)
  assert.throws(() => registrar(definicaoValida), /já registrado/)
})

test("recusa definicao sem campos obrigatorios", () => {
  limpar()
  assert.throws(() => registrar({ tipo: "x" }), /categoria/)
})

test("recusa categoria invalida", () => {
  limpar()
  assert.throws(
    () => registrar({ ...definicaoValida, categoria: "outra" }),
    /categoria/
  )
})

test("todos devolve as definicoes registradas", () => {
  limpar()
  registrar(definicaoValida)
  registrar({ ...definicaoValida, tipo: "imagem", rotulo: "Imagem" })
  assert.deepEqual(todos().map((d) => d.tipo).sort(), ["imagem", "texto"])
})

test("definicao recuperada tem campos congelados", () => {
  limpar()
  registrar(definicaoValida)
  const def = obter("texto")
  assert.throws(() => def.campos.push({ nome: "novo" }), /Cannot add/)
})

test("mutacao da definicao original nao afeta o registrado", () => {
  limpar()
  const def = { ...definicaoValida }
  registrar(def)
  def.campos.push({ nome: "novo", rotulo: "Novo", tipo: "texto" })
  const recuperada = obter("texto")
  assert.equal(recuperada.campos.length, 1)
})
