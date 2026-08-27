import { test } from "node:test"
import assert from "node:assert/strict"
import { interpolar } from "../motor/interpolar.js"

test("troca uma variavel", () => {
  assert.equal(interpolar("Olá {{nome}}", { nome: "Ana" }), "Olá Ana")
})

test("troca varias ocorrencias da mesma variavel", () => {
  assert.equal(
    interpolar("{{nome}}, confirma? {{nome}}", { nome: "Ana" }),
    "Ana, confirma? Ana"
  )
})

test("variavel ausente vira string vazia, nunca undefined", () => {
  const saida = interpolar("Olá {{nome}}!", {})
  assert.equal(saida, "Olá !")
  assert.ok(!saida.includes("undefined"))
})

test("aceita espacos dentro das chaves", () => {
  assert.equal(interpolar("Olá {{ nome }}", { nome: "Ana" }), "Olá Ana")
})

test("converte numero para texto", () => {
  assert.equal(interpolar("Total: {{pontuacao}}", { pontuacao: 7 }), "Total: 7")
})

test("valor zero aparece, nao vira vazio", () => {
  assert.equal(interpolar("Pontos: {{p}}", { p: 0 }), "Pontos: 0")
})

test("texto sem variavel volta igual", () => {
  assert.equal(interpolar("Sem nada", { nome: "Ana" }), "Sem nada")
})

test("entrada nao textual devolve string vazia", () => {
  assert.equal(interpolar(undefined, {}), "")
  assert.equal(interpolar(null, {}), "")
})
