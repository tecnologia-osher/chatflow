import { test } from "node:test"
import assert from "node:assert/strict"
import { criarSessao } from "../motor/sessao.js"

function armazenamentoFalso() {
  const dados = new Map()
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    _dados: dados
  }
}

const estadoExemplo = {
  respostas: { nome: "Ana" }, pontuacao: 3, grupoAtual: "g2",
  indiceBloco: 1, historico: ["g1", "g2"], terminou: false, tentativas: 0
}

test("salva e carrega o estado", () => {
  const arm = armazenamentoFalso()
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => 1000 })
  sessao.salvar(estadoExemplo)
  assert.deepEqual(sessao.carregar(), estadoExemplo)
})

test("sem nada salvo devolve null", () => {
  const sessao = criarSessao({ chave: "osher", armazenamento: armazenamentoFalso() })
  assert.equal(sessao.carregar(), null)
})

test("expira depois de 24 horas", () => {
  const arm = armazenamentoFalso()
  let momento = 0
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => momento })
  sessao.salvar(estadoExemplo)

  momento = 23 * 60 * 60 * 1000
  assert.notEqual(sessao.carregar(), null)

  momento = 25 * 60 * 60 * 1000
  assert.equal(sessao.carregar(), null)
})

test("carregar depois de expirado tambem apaga o registro", () => {
  const arm = armazenamentoFalso()
  let momento = 0
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => momento })
  sessao.salvar(estadoExemplo)
  momento = 25 * 60 * 60 * 1000
  sessao.carregar()
  assert.equal(arm._dados.size, 0)
})

test("limpar remove o registro", () => {
  const arm = armazenamentoFalso()
  const sessao = criarSessao({ chave: "osher", armazenamento: arm })
  sessao.salvar(estadoExemplo)
  sessao.limpar()
  assert.equal(sessao.carregar(), null)
})

test("conteudo corrompido devolve null sem lancar", () => {
  const arm = armazenamentoFalso()
  arm.setItem("chatflow:osher", "{ isso não é json")
  const sessao = criarSessao({ chave: "osher", armazenamento: arm })
  assert.equal(sessao.carregar(), null)
})

test("armazenamento indisponivel nao quebra", () => {
  const quebrado = {
    getItem: () => { throw new Error("bloqueado") },
    setItem: () => { throw new Error("bloqueado") },
    removeItem: () => { throw new Error("bloqueado") }
  }
  const sessao = criarSessao({ chave: "osher", armazenamento: quebrado })
  assert.doesNotThrow(() => sessao.salvar(estadoExemplo))
  assert.equal(sessao.carregar(), null)
  assert.doesNotThrow(() => sessao.limpar())
})

test("clientes diferentes nao se misturam", () => {
  const arm = armazenamentoFalso()
  const a = criarSessao({ chave: "osher", armazenamento: arm })
  const b = criarSessao({ chave: "outro", armazenamento: arm })
  a.salvar(estadoExemplo)
  assert.equal(b.carregar(), null)
})
