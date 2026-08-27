import { test } from "node:test"
import assert from "node:assert/strict"
import { limpar } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"
import {
  criarEstado, validarEntrada, registrarFalha, limparFalhas, destinoDeInvalido
} from "../motor/percurso.js"

function preparar() {
  limpar()
  registrarTodos()
}

const fluxo = {
  versao: 2,
  eventos: [
    { tipo: "inicio", proximo: "g1" },
    { tipo: "invalido", apos_tentativas: 2, proximo: "g_ajuda" }
  ],
  grupos: [
    { id: "g1", blocos: [{ id: "b1", tipo: "entrada_email", conteudo: {}, salvar_em: "email" }] },
    { id: "g_ajuda", blocos: [] }
  ]
}

test("entrada valida passa", () => {
  preparar()
  const bloco = fluxo.grupos[0].blocos[0]
  assert.deepEqual(validarEntrada(bloco, "ana@osher.com.br"), { ok: true, erro: null })
})

test("entrada invalida devolve a mensagem do tipo", () => {
  preparar()
  const bloco = fluxo.grupos[0].blocos[0]
  const r = validarEntrada(bloco, "ana@")
  assert.equal(r.ok, false)
  assert.match(r.erro, /e-mail/i)
})

test("bloco sem validador aceita qualquer coisa", () => {
  preparar()
  assert.equal(validarEntrada({ tipo: "texto", conteudo: {} }, "").ok, true)
})

test("estado comeca com zero tentativas", () => {
  preparar()
  assert.equal(criarEstado(fluxo).tentativas, 0)
})

test("registrarFalha incrementa e limparFalhas zera", () => {
  preparar()
  let e = criarEstado(fluxo)
  e = registrarFalha(e)
  assert.equal(e.tentativas, 1)
  e = registrarFalha(e)
  assert.equal(e.tentativas, 2)
  e = limparFalhas(e)
  assert.equal(e.tentativas, 0)
})

test("desvia so ao atingir apos_tentativas", () => {
  preparar()
  let e = criarEstado(fluxo)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(fluxo, e), null)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(fluxo, e), "g_ajuda")
})

test("sem evento invalido nunca desvia", () => {
  preparar()
  const semEvento = { ...fluxo, eventos: [{ tipo: "inicio", proximo: "g1" }] }
  let e = criarEstado(semEvento)
  e = registrarFalha(e)
  e = registrarFalha(e)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(semEvento, e), null)
})

test("apos_tentativas ausente desvia na primeira falha", () => {
  preparar()
  const f = {
    ...fluxo,
    eventos: [
      { tipo: "inicio", proximo: "g1" },
      { tipo: "invalido", proximo: "g_ajuda" }
    ]
  }
  let e = criarEstado(f)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(f, e), "g_ajuda")
})
