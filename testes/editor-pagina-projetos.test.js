// A primeira página, dirigida no navegador de mentira: a lista, o diálogo de
// criar e a galeria de modelos.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar, criarArmazenamento } from "./apoio/navegador.js"
instalarNavegador()

const { criarPaginaDeProjetos } = await import("../editor/pagina-projetos.js")
const { MODELOS, fluxoDoZero } = await import("../editor/projetos.js")

const DOIS_PROJETOS = [
  { id: "osher", nome: "Osher 01", icone: "🤝", publicado: true },
  { id: "quiz", nome: "Quiz", icone: "🕹️", publicado: false }
]

const fluxoDoModeloDeTeste = () => ({
  versao: 2,
  nome: "Captação simples",
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [{ id: "g1", titulo: "Abertura", blocos: [
    { id: "b1", tipo: "texto", conteudo: { texto: "Oi, tudo bem?" } }] }]
})

function montar({ projetos = DOIS_PROJETOS, criar = null, modelo = fluxoDoModeloDeTeste } = {}) {
  const hospedeiro = new Elemento("div")
  const abertos = []
  const criados = []
  const pagina = criarPaginaDeProjetos({
    elemento: hospedeiro,
    armazenamento: criarArmazenamento(),
    esperarNoTeste: async () => {},
    aoListar: async () => (typeof projetos === "function" ? projetos() : projetos),
    aoCriar: criar === null ? null : async (o) => { criados.push(o); return criar(o) },
    aoAbrir: (id) => abertos.push(id),
    aoLerModelo: async (m) => (typeof modelo === "function" ? modelo(m) : modelo)
  })
  return { hospedeiro, pagina, abertos, criados }
}

const porClasse = (no, classe) => no.porClasse(classe)
const cartoes = (h) => porClasse(h, "pr__cartao")

// --- a lista ---------------------------------------------------------------

test("a pagina lista os chats que existem, com o laranja de criar na frente", async () => {
  const { hospedeiro } = montar()
  await assentar()
  assert.equal(porClasse(hospedeiro, "pr__novo").length, 1)
  assert.deepEqual(cartoes(hospedeiro).map((c) => c.porClasse("pr__cartao-nome")[0].textContent),
    ["Osher 01", "Quiz"])
  assert.deepEqual(cartoes(hospedeiro).map((c) => c.porClasse("pr__cartao-icone")[0].textContent),
    ["🤝", "🕹️"])
})

test("o selo No ar aparece so em quem esta no ar", async () => {
  const { hospedeiro } = montar()
  await assentar()
  assert.deepEqual(cartoes(hospedeiro).map((c) => c.porClasse("pr__selo").length), [1, 0],
    "dois cartões iguais escondem qual é o que está recebendo gente")
})

test("clicar num cartao abre aquele projeto", async () => {
  const { hospedeiro, abertos } = montar()
  await assentar()
  cartoes(hospedeiro)[1].disparar("click")
  assert.deepEqual(abertos, ["quiz"])
})

test("sem nenhum projeto, a pagina convida em vez de ficar vazia", async () => {
  const { hospedeiro } = montar({ projetos: [] })
  await assentar()
  assert.equal(cartoes(hospedeiro).length, 0)
  assert.match(porClasse(hospedeiro, "pr__vazio")[0].textContent, /Nenhum chat ainda/)
  assert.equal(porClasse(hospedeiro, "pr__novo").length, 1, "o caminho para criar não some")
})

test("listagem que falha nao deixa a pagina em branco", async () => {
  const { hospedeiro } = montar({ projetos: () => { throw new Error("servidor fora") } })
  await assentar()
  assert.match(porClasse(hospedeiro, "pr__recado")[0].textContent, /servidor fora/)
  assert.equal(porClasse(hospedeiro, "pr__novo").length, 1)
})

// --- criar -----------------------------------------------------------------

test("o botao laranja abre os tres caminhos", async () => {
  const { hospedeiro } = montar()
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  assert.deepEqual(porClasse(hospedeiro, "pr__opcao-rotulo").map((e) => e.textContent),
    ["Começar do zero", "Começar de um modelo", "Importar um arquivo"])
})

test("começar do zero cria o projeto e abre o editor nele", async () => {
  const { hospedeiro, criados, abertos } = montar({ criar: () => "projeto" })
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--zero")[0].disparar("click")
  await assentar()

  assert.equal(criados.length, 1)
  assert.equal(criados[0].fluxo.grupos.length, 1, "nasce com um grupo para ter onde escrever")
  assert.deepEqual(abertos, ["projeto"], "criar e não abrir deixaria a pessoa na lista sem saber o que houve")
})

test("sem servidor para criar, a pagina diz isso em vez de nao fazer nada", async () => {
  const { hospedeiro, abertos } = montar({ criar: null })
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--zero")[0].disparar("click")
  await assentar()
  assert.match(porClasse(hospedeiro, "pr__recado")[0].textContent, /sem servidor/)
  assert.deepEqual(abertos, [])
})

test("criacao que falha volta para a lista com o motivo", async () => {
  const { hospedeiro } = montar({ criar: () => { throw new Error("pasta já existe") } })
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--zero")[0].disparar("click")
  await assentar()
  assert.match(porClasse(hospedeiro, "pr__recado")[0].textContent, /pasta já existe/)
})

// --- modelos ---------------------------------------------------------------

test("a galeria lista os modelos por categoria e mostra a conversa do escolhido", async () => {
  const { hospedeiro } = montar()
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--modelo")[0].disparar("click")
  await assentar()

  assert.ok(porClasse(hospedeiro, "pr__categoria").length >= 1)
  assert.deepEqual(porClasse(hospedeiro, "pr__modelo-nome").map((e) => e.textContent),
    MODELOS.map((m) => m.nome))
  assert.ok(porClasse(hospedeiro, "pr__amostra")[0].porClasse("cf").length,
    "ler a conversa é a única maneira honesta de escolher um modelo")
  assert.match(porClasse(hospedeiro, "pr__amostra")[0].textContent, /Oi, tudo bem/)
})

test("usar o modelo cria um projeto com o fluxo dele", async () => {
  const { hospedeiro, criados, abertos } = montar({ criar: () => "captacao" })
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--modelo")[0].disparar("click")
  await assentar()
  porClasse(hospedeiro, "pr__usar")[0].disparar("click")
  await assentar()

  assert.equal(criados.length, 1)
  assert.equal(criados[0].fluxo.nome, MODELOS[0].nome)
  assert.equal(criados[0].fluxo.grupos.length, 1)
  assert.deepEqual(abertos, ["captacao"])
})

test("modelo que nao abre avisa, em vez de criar um projeto vazio", async () => {
  const { hospedeiro, criados } = montar({ criar: () => "x", modelo: () => null })
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--modelo")[0].disparar("click")
  await assentar()
  assert.match(porClasse(hospedeiro, "pr__amostra")[0].textContent, /Não consegui abrir/)
  porClasse(hospedeiro, "pr__usar")[0].disparar("click")
  await assentar()
  assert.deepEqual(criados, [])
})

test("a seta volta da galeria para a lista", async () => {
  const { hospedeiro } = montar()
  await assentar()
  porClasse(hospedeiro, "pr__novo")[0].disparar("click")
  porClasse(hospedeiro, "pr__opcao--modelo")[0].disparar("click")
  await assentar()
  porClasse(hospedeiro, "pr__voltar")[0].disparar("click")
  await assentar()
  assert.equal(cartoes(hospedeiro).length, 2)
})
