// O canvas desenhado, dirigido no navegador de mentira.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { criarCanvas } = await import("../editor/canvas.js")

const fluxo = {
  versao: 2,
  eventos: [{ tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 300, y: 40 }, proximo: "g2", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] },
    { id: "g2", titulo: "Fim", posicao: { x: 700, y: 40 }, blocos: [] }
  ]
}

function montar(extra = {}) {
  const hospedeiro = new Elemento("div")
  const eventos = { selecionado: [], movido: [] }
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoSelecionar: (o) => eventos.selecionado.push(o),
    aoMover: (id, p) => eventos.movido.push({ id, ...p }),
    ...extra
  })
  canvas.desenhar(fluxo)
  return { hospedeiro, canvas, eventos }
}

const cartoes = (h) => h.porClasse("ed__cartao")
const setas = (h) => h.porClasse("ed__seta")

test("desenha um cartao por grupo, com titulo e blocos", () => {
  const { hospedeiro } = montar()
  assert.equal(cartoes(hospedeiro).length, 2)
  assert.match(cartoes(hospedeiro)[0].textContent, /Abertura/)
  assert.match(cartoes(hospedeiro)[0].textContent, /Olá/)
})

test("o cartao fica na posicao do grupo", () => {
  const { hospedeiro } = montar()
  const estilo = cartoes(hospedeiro)[0].style.propriedades
  assert.match(String(estilo.transform ?? ""), /300/)
  assert.match(String(estilo.transform ?? ""), /40/)
})

test("desenha uma seta por ligacao, incluindo a do evento de inicio", () => {
  const { hospedeiro } = montar()
  assert.equal(setas(hospedeiro).length, 2, "g1→g2 e o início→g1")
})

test("redesenhar nao acumula cartoes", () => {
  const { hospedeiro, canvas } = montar()
  canvas.desenhar(fluxo)
  canvas.desenhar(fluxo)
  assert.equal(cartoes(hospedeiro).length, 2)
})

test("clicar num bloco avisa qual foi", () => {
  const { hospedeiro, eventos } = montar()
  hospedeiro.porClasse("ed__bloco")[0].disparar("click")
  assert.deepEqual(eventos.selecionado.at(-1), { grupo: "g1", bloco: "b1" })
})

test("clicar no cabecalho do cartao seleciona o grupo, sem bloco", () => {
  const { hospedeiro, eventos } = montar()
  hospedeiro.porClasse("ed__cabecalho")[0].disparar("click")
  assert.deepEqual(eventos.selecionado.at(-1), { grupo: "g1", bloco: null })
})

test("a roda do mouse dá zoom e ancora no cursor", () => {
  const { hospedeiro, canvas } = montar()
  const antes = canvas.vista().escala
  hospedeiro.porClasse("ed__palco")[0].disparar("wheel", { deltaY: -120, clientX: 400, clientY: 300 })
  assert.ok(canvas.vista().escala > antes)
})

test("arrastar o fundo movimenta a vista, nao o grupo", () => {
  const { hospedeiro, canvas, eventos } = montar()
  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.disparar("mousedown", { clientX: 100, clientY: 100, button: 0 })
  document.disparar("mousemove", { clientX: 160, clientY: 130 })
  document.disparar("mouseup", {})
  assert.deepEqual({ x: canvas.vista().x, y: canvas.vista().y }, { x: 60, y: 30 })
  assert.equal(eventos.movido.length, 0)
})

test("arrastar o cabecalho move o grupo e avisa a nova posicao", () => {
  const { hospedeiro, canvas, eventos } = montar()
  hospedeiro.porClasse("ed__cabecalho")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 50, clientY: 25 })
  document.disparar("mouseup", {})
  assert.deepEqual(eventos.movido.at(-1), { id: "g1", x: 350, y: 65 })
  assert.equal(canvas.vista().x, 0, "arrastar cartão não pode arrastar o fundo junto")
})

test("o arrasto do grupo respeita o zoom", () => {
  const { hospedeiro, canvas, eventos } = montar()
  hospedeiro.porClasse("ed__palco")[0].disparar("wheel", { deltaY: -120, clientX: 0, clientY: 0 })
  const escala = canvas.vista().escala
  hospedeiro.porClasse("ed__cabecalho")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 100, clientY: 0 })
  document.disparar("mouseup", {})
  assert.ok(Math.abs(eventos.movido.at(-1).x - (300 + 100 / escala)) < 0.01,
    "com zoom, 100px de tela não são 100px de fluxo")
})

test("seta orfa e desenhada e marcada", () => {
  const { hospedeiro, canvas } = montar()
  canvas.desenhar({ ...fluxo, grupos: [{ ...fluxo.grupos[0], proximo: "g_fantasma" }, fluxo.grupos[1]] })
  const orfa = setas(hospedeiro).find((s) => s.className.includes("ed__seta--orfa"))
  assert.ok(orfa, "ligação para grupo inexistente precisa aparecer")
})

test("selecionar destaca o cartao na tela", () => {
  const { hospedeiro, canvas } = montar()
  canvas.selecionar({ grupo: "g2", bloco: null })
  const alvo = cartoes(hospedeiro).find((c) => c.className.includes("ed__cartao--ativo"))
  assert.match(alvo.textContent, /Fim/)
})
