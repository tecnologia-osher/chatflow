// O formato de um destino: grupo, e opcionalmente um bloco dentro dele.

import { test } from "node:test"
import assert from "node:assert/strict"
import { partesDoDestino, grupoDoDestino, montarDestino } from "../motor/destino.js"

test("destino sem bloco e o grupo inteiro", () => {
  assert.deepEqual(partesDoDestino("g_contato"), { grupo: "g_contato", bloco: null })
  assert.equal(grupoDoDestino("g_contato"), "g_contato")
})

test("destino com bloco diz grupo e bloco", () => {
  assert.deepEqual(partesDoDestino("g_contato#b_fone"), { grupo: "g_contato", bloco: "b_fone" })
  assert.equal(grupoDoDestino("g_contato#b_fone"), "g_contato")
})

test("montar e desmontar sao a mesma coisa de dois lados", () => {
  assert.equal(montarDestino("g1", "b2"), "g1#b2")
  assert.equal(montarDestino("g1", null), "g1", "sem bloco, o destino continua sendo só o grupo")
  assert.deepEqual(partesDoDestino(montarDestino("g1", "b2")), { grupo: "g1", bloco: "b2" })
})

test("id de bloco com o separador dentro nao perde o resto", () => {
  // O separador do grupo é o primeiro: o que vem depois é o bloco inteiro.
  assert.deepEqual(partesDoDestino("g1#b#estranho"), { grupo: "g1", bloco: "b#estranho" })
})

test("separador solto no fim nao inventa bloco vazio", () => {
  assert.deepEqual(partesDoDestino("g1#"), { grupo: "g1", bloco: null })
})

test("valor que nao e texto nao derruba nada", () => {
  for (const valor of [undefined, null, 0, {}]) {
    assert.deepEqual(partesDoDestino(valor), { grupo: "", bloco: null })
  }
})
