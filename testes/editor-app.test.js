// O editor inteiro: paleta, canvas, painel e preview conversando.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { criarEditor } = await import("../editor/app.js")
const { todos } = await import("../editor/catalogo.js")

const fluxoBase = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 0, y: 0 }, proximo: "g2", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] },
    { id: "g2", titulo: "Fim", posicao: { x: 400, y: 0 }, blocos: [] }
  ]
})

function montar(fluxo = fluxoBase()) {
  const hospedeiro = new Elemento("div")
  const baixados = []
  const editor = criarEditor({ elemento: hospedeiro, fluxo, aoBaixar: (t, n) => baixados.push({ t, n }) })
  return { hospedeiro, editor, baixados }
}

const clicar = (n) => n.disparar("click")
const porClasse = (h, c) => h.porClasse(c)

test("a paleta oferece todos os tipos do catalogo, agrupados", () => {
  const { hospedeiro } = montar()
  const itens = porClasse(hospedeiro, "ed__tipo")
  assert.equal(itens.length, todos().length)
  const categorias = porClasse(hospedeiro, "ed__categoria").map((c) => c.textContent)
  for (const c of ["Fala", "Entrada", "Lógica", "Conexão"]) assert.ok(categorias.includes(c), `faltou ${c}`)
})

test("clicar num tipo com grupo selecionado acrescenta o bloco nele", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[1].disparar("click")        // seleciona g2
  porClasse(hospedeiro, "ed__tipo").find((t) => t.textContent.includes("Texto")).disparar("click")
  assert.equal(editor.fluxo().grupos[1].blocos.length, 1)
})

test("clicar num tipo sem selecao avisa em vez de quebrar", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__tipo")[0].disparar("click")
  assert.equal(editor.fluxo().grupos[0].blocos.length, 1, "nada deve ser acrescentado")
  assert.match(porClasse(hospedeiro, "ed__recado")[0].textContent, /selecione|grupo/i)
})

test("o bloco acrescentado ja vem selecionado, pronto para editar", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[1].disparar("click")
  porClasse(hospedeiro, "ed__tipo").find((t) => t.textContent.includes("Texto")).disparar("click")
  assert.equal(editor.selecao().bloco, editor.fluxo().grupos[1].blocos[0].id)
})

test("editar no painel muda o canvas", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  assert.match(porClasse(hospedeiro, "ed__cartao")[0].textContent, /Bom dia/)
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia")
})

test("arrastar o grupo grava a posicao no fluxo", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 60, clientY: 40 })
  document.disparar("mouseup", {})
  assert.deepEqual(editor.fluxo().grupos[0].posicao, { x: 60, y: 40 })
})

test("criar grupo acrescenta um cartao", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__criar-grupo")[0].disparar("click")
  assert.equal(editor.fluxo().grupos.length, 3)
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 3)
})

test("o preview nao envia nada a lugar nenhum", async () => {
  const chamadas = []
  globalThis.fetch = async (u) => { chamadas.push(u); return { ok: true } }
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  assert.deepEqual(chamadas, [], "preview que dispara webhook suja a planilha do cliente a cada tecla")
})

test("baixar entrega o json do fluxo atual", () => {
  const { hospedeiro, editor, baixados } = montar()
  porClasse(hospedeiro, "ed__criar-grupo")[0].disparar("click")
  porClasse(hospedeiro, "ed__baixar")[0].disparar("click")
  const { t, n } = baixados.at(-1)
  assert.match(n, /\.json$/)
  assert.deepEqual(JSON.parse(t), editor.fluxo())
})

test("o aviso de validacao aparece quando o fluxo quebra", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  const seletor = porClasse(hospedeiro, "ed__proximo")[0]
  seletor.value = ""
  seletor.disparar("change")
  // g1 sem proximo e sem blocos de saída: g2 fica inalcançável
  assert.match(porClasse(hospedeiro, "ed__problemas")[0].textContent, /g2/)
})

test("fluxo valido nao mostra problema nenhum", () => {
  const { hospedeiro } = montar()
  assert.equal(porClasse(hospedeiro, "ed__problemas")[0].textContent.trim(), "")
})

// --- botões de teste -------------------------------------------------------

test("o canvas comeca sem preview ocupando espaco", () => {
  const { hospedeiro } = montar()
  assert.equal(porClasse(hospedeiro, "ed__preview").length, 0)
  assert.equal(porClasse(hospedeiro, "cf__bolha").length, 0, "o chat só aparece quando pedido")
})

test("o botao Testar abre o preview do inicio", async () => {
  const { hospedeiro } = montar()
  const botao = porClasse(hospedeiro, "ed__testar")[0]
  assert.match(botao.textContent, /Test/i)
  botao.disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__preview").length, 1)
  assert.match(porClasse(hospedeiro, "cf__bolha")[0].textContent, /Olá/)
})

test("cada cartao tem um play que comeca o teste dali", async () => {
  const fluxo = fluxoBase()
  fluxo.grupos[1].blocos.push({ id: "b2", tipo: "texto", conteudo: { texto: "Fim do papo" } })
  const { hospedeiro } = montar(fluxo)
  const plays = porClasse(hospedeiro, "ed__play")
  assert.equal(plays.length, 2, "um por grupo")
  plays[1].disparar("click")
  await assentar()
  assert.match(porClasse(hospedeiro, "cf__bolha")[0].textContent, /Fim do papo/)
  assert.equal(
    porClasse(hospedeiro, "cf__bolha").some((b) => /Olá/.test(b.textContent)),
    false,
    "começar do segundo grupo não pode mostrar a fala do primeiro"
  )
})

test("o play do cartao nao seleciona o grupo nem arrasta", async () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__play")[1].disparar("click")
  await assentar()
  assert.equal(editor.selecao().grupo, null, "clicar no play não é clicar no cabeçalho")
})

test("editar com o preview aberto refaz a conversa", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  await assentar()
  assert.match(porClasse(hospedeiro, "cf__bolha")[0].textContent, /Bom dia/)
})

test("editar com o preview fechado nao o abre sozinho", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__preview").length, 0)
})
