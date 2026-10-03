// A busca da coluna da esquerda.

import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizar, palavrasDe, combina, filtrar } from "../editor/busca.js"

test("normalizar tira acento, caixa alta e espaço sobrando", () => {
  assert.equal(normalizar("  Vídeo "), "video")
  assert.equal(normalizar("Botões"), "botoes")
  assert.equal(normalizar("Condição"), "condicao")
  assert.equal(normalizar(null), "")
})

test("quem digita sem acento acha quem tem acento", () => {
  assert.equal(combina("video", "Vídeo"), true)
  assert.equal(combina("botoes", "Botões"), true)
  assert.equal(combina("CONDI", "Condição"), true)
})

test("o que a busca nao faz: trocar singular por plural", () => {
  // "botao" não acha "Botões" — as letras não batem, e inventar radicais para
  // o português seria uma gramática inteira dentro do editor. Quem digita
  // "bot" acha, e é assim que se digita com pressa.
  assert.equal(combina("botao", "Botões"), false)
  assert.equal(combina("bot", "Botões"), true)
})

test("pedaço do nome basta: ninguem digita o nome inteiro", () => {
  assert.equal(combina("tel", "Telefone"), true)
  assert.equal(combina("fone", "Telefone"), true)
  assert.equal(combina("xyz", "Telefone"), false)
})

test("todas as palavras precisam aparecer, em qualquer um dos textos", () => {
  assert.equal(combina("entrada texto", "Texto", "Entrada"), true,
    "exigir todas é o que separa um item dos sete que têm 'texto'")
  assert.equal(combina("entrada texto", "Texto", "Bolhas"), false)
  assert.equal(combina("bolha video", "Vídeo", "Bolhas"), true)
})

test("busca vazia nao filtra nada", () => {
  assert.equal(combina("", "qualquer"), true)
  assert.equal(combina("   ", "qualquer"), true)
  assert.deepEqual(palavrasDe("  "), [])
})

// --- a lista ---------------------------------------------------------------

const TIPOS = [
  { tipo: "texto", rotulo: "Texto", grupo: "Bolhas" },
  { tipo: "video", rotulo: "Vídeo", grupo: "Bolhas" },
  { tipo: "entrada_texto", rotulo: "Texto", grupo: "Entrada" },
  { tipo: "entrada_telefone", rotulo: "Telefone", grupo: "Entrada" },
  { tipo: "condicao", rotulo: "Condição", grupo: "Lógica" }
]
const textos = (t) => [t.rotulo, t.grupo]

test("filtrar devolve so quem combina", () => {
  assert.deepEqual(filtrar(TIPOS, "tele", textos).map((t) => t.tipo), ["entrada_telefone"])
  assert.deepEqual(filtrar(TIPOS, "texto", textos).map((t) => t.tipo), ["texto", "entrada_texto"])
})

test("o nome do grupo tambem acha: ele e um nome que a pessoa conhece", () => {
  assert.deepEqual(filtrar(TIPOS, "logica", textos).map((t) => t.tipo), ["condicao"])
  assert.deepEqual(filtrar(TIPOS, "bolhas", textos).map((t) => t.tipo), ["texto", "video"])
})

test("sem termo, a lista inteira volta — e e a mesma lista", () => {
  assert.equal(filtrar(TIPOS, "", textos), TIPOS)
  assert.equal(filtrar(TIPOS, "  ", textos), TIPOS)
})

test("termo que nao acha nada devolve lista vazia, nao a lista toda", () => {
  assert.deepEqual(filtrar(TIPOS, "xyz", textos), [])
})
