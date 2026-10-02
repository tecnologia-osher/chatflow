// Pré-visualização: abrir, fechar, e começar de uma etapa específica.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { fluxoComecandoEm, criarPreview } = await import("../editor/preview.js")
const { validarFluxo } = await import("../motor/validar.js")

const fluxo = () => ({
  versao: 2,
  eventos: [
    { tipo: "inicio", proximo: "g_abertura" },
    { tipo: "invalido", apos_tentativas: 2, proximo: "g_ajuda" }
  ],
  grupos: [
    { id: "g_abertura", titulo: "Abertura", posicao: { x: 0, y: 0 }, proximo: "g_idade", blocos: [
      { id: "b_ola", tipo: "texto", conteudo: { texto: "Olá" } },
      { id: "b_nome", tipo: "entrada_texto", conteudo: {}, salvar_em: "nome" }] },
    { id: "g_idade", titulo: "Idade", posicao: { x: 300, y: 0 }, proximo: "g_fim", blocos: [
      { id: "b_idade", tipo: "texto", conteudo: { texto: "Qual sua idade, {{nome}}?" } }] },
    { id: "g_fim", titulo: "Fim", posicao: { x: 600, y: 0 }, blocos: [
      { id: "b_fim", tipo: "texto", conteudo: { texto: "Obrigado" } }] },
    { id: "g_ajuda", titulo: "Ajuda", posicao: { x: 0, y: 300 }, proximo: "g_idade", blocos: [] }
  ]
})

// --- o fluxo temporário ----------------------------------------------------

test("sem grupo escolhido, devolve o fluxo como está", () => {
  const f = fluxo()
  assert.equal(fluxoComecandoEm(f, null), f)
})

test("comecar numa etapa aponta o inicio para ela", () => {
  const f = fluxoComecandoEm(fluxo(), "g_idade")
  assert.equal(f.eventos.find((e) => e.tipo === "inicio").proximo, "g_idade")
})

test("nao modifica o fluxo recebido", () => {
  const f = fluxo()
  const copia = JSON.parse(JSON.stringify(f))
  fluxoComecandoEm(f, "g_idade")
  assert.deepEqual(f, copia)
})

test("os grupos que ficaram para tras continuam alcancaveis para o validador", () => {
  const f = fluxoComecandoEm(fluxo(), "g_idade")
  // Sem isto o preview abriria com uma faixa de "fluxo inválido" dizendo que
  // g_abertura é inalcançável — assustando quem só queria testar do meio.
  assert.deepEqual(validarFluxo(f).erros, [])
})

test("os outros eventos continuam valendo", () => {
  const f = fluxoComecandoEm(fluxo(), "g_idade")
  assert.ok(f.eventos.some((e) => e.tipo === "invalido" && e.proximo === "g_ajuda"))
})

test("grupo inexistente nao quebra: devolve o fluxo original", () => {
  const f = fluxo()
  assert.equal(fluxoComecandoEm(f, "g_fantasma"), f)
})

// --- o painel --------------------------------------------------------------

function montar() {
  const hospedeiro = new Elemento("div")
  // O preview digita no compasso do fluxo, como o chat de verdade. Aqui a
  // espera é imediata: o que se quer provar é o que aparece, não o relógio.
  const preview = criarPreview({ elemento: hospedeiro, esperar: async () => {} })
  return { hospedeiro, preview }
}
const bolhas = (h) => h.porClasse("cf__bolha").map((b) => b.textContent)

test("comeca fechado, sem ocupar espaco", async () => {
  const { hospedeiro, preview } = montar()
  assert.equal(preview.aberto(), false)
  assert.equal(hospedeiro.porClasse("ed__preview").length, 0)
})

test("abrir monta o chat desde o inicio", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), null)
  await assentar()
  assert.equal(preview.aberto(), true)
  assert.match(bolhas(hospedeiro)[0], /Olá/)
})

test("abrir numa etapa comeca por ela, pulando o que vem antes", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), "g_idade")
  await assentar()
  assert.match(bolhas(hospedeiro)[0], /Qual sua idade/)
  assert.equal(bolhas(hospedeiro).some((b) => /Olá/.test(b)), false)
})

test("o cabecalho diz de onde o teste esta comecando", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), "g_idade")
  await assentar()
  assert.match(hospedeiro.porClasse("ed__preview-titulo")[0].textContent, /Idade/)
})

test("comecar do meio avisa que as respostas anteriores nao existem", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), "g_idade")
  await assentar()
  assert.match(hospedeiro.porClasse("ed__preview-nota")[0].textContent, /anteriores|vazia|variáve/i)
})

test("comecar do inicio nao mostra essa nota", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), null)
  await assentar()
  assert.equal(hospedeiro.porClasse("ed__preview-nota").length, 0)
})

test("fechar tira o chat da tela", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), null)
  await assentar()
  hospedeiro.porClasse("ed__preview-fechar")[0].disparar("click")
  assert.equal(preview.aberto(), false)
  assert.equal(hospedeiro.porClasse("cf__bolha").length, 0)
})

test("reiniciar recomeca a conversa", async () => {
  const { hospedeiro, preview } = montar()
  preview.abrir(fluxo(), null)
  await assentar()
  const campo = hospedeiro.porClasse("cf__campo")[0]
  campo.value = "Ana"
  hospedeiro.porClasse("cf__botao--enviar")[0].disparar("click")
  await assentar()
  assert.ok(bolhas(hospedeiro).some((b) => b === "Ana"))

  hospedeiro.porClasse("ed__preview-reiniciar")[0].disparar("click")
  await assentar()
  assert.equal(bolhas(hospedeiro).some((b) => b === "Ana"), false)
})

test("o preview nunca fala com a rede", async () => {
  const chamadas = []
  globalThis.fetch = async (u) => { chamadas.push(u); return { ok: true } }
  const { hospedeiro, preview } = montar()
  preview.abrir({ ...fluxo(), destinos: {} }, null)
  await assentar()
  assert.deepEqual(chamadas, [])
})

test("o preview digita no compasso do fluxo, com os tres pontinhos", async () => {
  const hospedeiro = new Elemento("div")
  const esperas = []
  const preview = criarPreview({
    elemento: hospedeiro,
    esperar: async (ms) => { esperas.push(ms) }
  })
  preview.abrir({
    versao: 2,
    ritmo: { piso: 900, porCaractere: 0, teto: 900 },
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", titulo: "a", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Bem-vindo" } }] }]
  })
  await assentar()

  assert.deepEqual(esperas, [900],
    "a conversa aparecia inteira de uma vez: o preview zerava o compasso")
  assert.deepEqual(hospedeiro.porClasse("cf__bolha").map((b) => b.textContent), ["Bem-vindo"])
})

test("fluxo sem ritmo proprio usa o compasso padrao do motor, nao zero", async () => {
  const hospedeiro = new Elemento("div")
  const esperas = []
  const preview = criarPreview({ elemento: hospedeiro, esperar: async (ms) => { esperas.push(ms) } })
  preview.abrir({
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", titulo: "a", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Oi" } }] }]
  })
  await assentar()
  assert.equal(esperas.length, 1)
  assert.ok(esperas[0] > 0, "sem pausa, o lead vê a frase pronta e não vê ninguém digitando")
})
