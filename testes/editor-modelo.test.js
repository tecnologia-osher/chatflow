// O editor lê o fluxo e devolve o que o canvas desenha: cartões e setas.
// Lógica pura, sem DOM — é aqui que mora a chance de errar em silêncio.

import { test } from "node:test"
import assert from "node:assert/strict"
import { cartoes, setas } from "../editor/modelo.js"

const fluxo = {
  versao: 2,
  eventos: [
    { tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" },
    { tipo: "invalido", posicao: { x: 40, y: 300 }, apos_tentativas: 2, proximo: "g_ajuda" }
  ],
  grupos: [
    {
      id: "g1", titulo: "Abertura", posicao: { x: 320, y: 40 },
      blocos: [
        { id: "b_ola", tipo: "texto", conteudo: { texto: "Olá. Tudo bem por aí?" } },
        { id: "b_nome", tipo: "entrada_texto", conteudo: { placeholder: "Seu nome" }, salvar_em: "nome" }
      ],
      proximo: "g2"
    },
    {
      id: "g2", titulo: "Escolha", posicao: { x: 700, y: 40 },
      blocos: [
        { id: "b_op", tipo: "entrada_botoes", salvar_em: "bem", conteudo: { opcoes: [
          { id: "o1", label: "Imóvel", proximo: "g3" },
          { id: "o2", label: "Não sei" }
        ] } },
        { id: "b_cond", tipo: "condicao", conteudo: { regras: [
          { se: { variavel: "bem", vazio: true }, entao: "g_ajuda" }
        ] } }
      ],
      proximo: "g3"
    },
    { id: "g3", titulo: "Fim", posicao: { x: 1080, y: 40 }, blocos: [] },
    { id: "g_ajuda", titulo: "Ajuda", posicao: { x: 320, y: 300 }, blocos: [], proximo: "g3" }
  ]
}

test("cada grupo vira um cartao com posicao e blocos", () => {
  const c = cartoes(fluxo)
  assert.deepEqual(c.map((x) => x.id), ["g1", "g2", "g3", "g_ajuda"])
  assert.deepEqual(c[0].posicao, { x: 320, y: 40 })
  assert.equal(c[0].titulo, "Abertura")
  assert.equal(c[0].blocos.length, 2)
})

test("grupo sem posicao ganha uma, para nao empilhar tudo na origem", () => {
  const sem = { ...fluxo, grupos: [{ id: "x", blocos: [] }, { id: "y", blocos: [] }] }
  const c = cartoes(sem)
  assert.ok(c[0].posicao && typeof c[0].posicao.x === "number")
  assert.notDeepEqual(c[0].posicao, c[1].posicao, "dois cartões no mesmo lugar ficam invisíveis")
})

test("cada bloco leva o rotulo do tipo e um resumo do que ele diz", () => {
  const [g1] = cartoes(fluxo)
  assert.equal(g1.blocos[0].rotulo, "Texto")
  assert.match(g1.blocos[0].resumo, /Olá/)
  assert.equal(g1.blocos[1].rotulo, "Texto")   // entrada_texto também se chama "Texto"
  assert.match(g1.blocos[1].resumo, /Seu nome/)
})

test("resumo longo e cortado para caber no cartao", () => {
  const longo = { ...fluxo, grupos: [{ id: "g", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "texto", conteudo: { texto: "x".repeat(200) } }] }] }
  assert.ok(cartoes(longo)[0].blocos[0].resumo.length < 90)
})

test("bloco de tipo desconhecido nao derruba o canvas", () => {
  const torto = { ...fluxo, grupos: [{ id: "g", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "inventado", conteudo: {} }] }] }
  const b = cartoes(torto)[0].blocos[0]
  assert.equal(b.rotulo, "inventado")
  assert.equal(b.desconhecido, true)
})

test("seta do proximo do grupo", () => {
  const s = setas(fluxo)
  const g1g2 = s.find((x) => x.de === "g1" && x.para === "g2")
  assert.ok(g1g2)
  assert.deepEqual(g1g2.origens, ["grupo"])
})

test("seta de opcao de botao e de condicao", () => {
  const s = setas(fluxo)
  // A ordem das origens não é contrato — duas saídas para o mesmo grupo
  // viram uma seta só, dizendo de onde cada uma veio.
  assert.deepEqual(
    s.find((x) => x.de === "g2" && x.para === "g3").origens.slice().sort(),
    ["grupo", "opcao"]
  )
  assert.deepEqual(s.find((x) => x.de === "g2" && x.para === "g_ajuda").origens, ["condicao"])
})

test("os eventos entram como setas, com de nulo", () => {
  const s = setas(fluxo)
  const inicio = s.find((x) => x.evento === "inicio")
  assert.equal(inicio.de, null)
  assert.equal(inicio.para, "g1")
  assert.ok(s.some((x) => x.evento === "invalido" && x.para === "g_ajuda"))
})

test("destino inexistente vira seta marcada, nao some", () => {
  const quebrado = { ...fluxo, grupos: [
    { id: "g", posicao: { x: 0, y: 0 }, blocos: [], proximo: "g_fantasma" }] }
  const s = setas(quebrado).find((x) => x.para === "g_fantasma")
  assert.equal(s.orfa, true, "seta para o nada precisa aparecer, é assim que se vê o erro")
})

test("nao duplica seta quando dois caminhos levam ao mesmo grupo", () => {
  const s = setas(fluxo).filter((x) => x.de === "g2" && x.para === "g3")
  assert.equal(s.length, 1)
})
