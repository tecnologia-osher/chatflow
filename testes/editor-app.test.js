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

test("editar na caixa do cartao nao recria a caixa a cada tecla", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia")
  // Redesenhar o cartão a cada tecla recriaria o campo e jogaria o cursor
  // para o fim da frase — é o defeito clássico de editor que redesenha tudo.
  assert.equal(porClasse(hospedeiro, "ed__bloco-campo")[0], campo, "a caixa precisa ser a mesma")
})

test("clicar dentro da caixa de texto nao a recria por baixo do cursor", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  // Se o clique subir até o bloco, ele redesenha e a caixa que está sob o
  // cursor deixa de existir no meio da digitação.
  campo.disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__bloco-campo")[0], campo, "a caixa precisa ser a mesma")
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
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  await assentar()
  assert.match(porClasse(hospedeiro, "cf__bolha")[0].textContent, /Bom dia/)
})

test("editar com o preview fechado nao o abre sozinho", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__preview").length, 0)
})

test("o fluxo inteiro cabe na tela ao abrir, mesmo mais alto que ela", () => {
  // Altura do fluxo real da Osher: vai de y=40 a y=1020 numa área de ~700px.
  const alto = fluxoBase()
  alto.grupos[1].posicao = { x: 0, y: 1020 }
  const { editor } = montar(alto)
  const v = editor.vista()
  const base = (1020 + 56) * v.escala + v.y
  assert.ok(base <= 700, `o cartão de baixo ficou em ${Math.round(base)}px, fora dos 700px visíveis`)
  assert.ok(v.escala < 1, "um fluxo mais alto que a tela precisa ser reduzido para caber")
})

test("fluxo alto demais para o chao da escala nao e espremido ate ficar ilegivel", () => {
  const enorme = fluxoBase()
  enorme.grupos[1].posicao = { x: 0, y: 8000 }
  const { editor } = montar(enorme)
  // Abaixo de 0,25 os cartões viram manchas. Aí é melhor a pessoa arrastar.
  assert.equal(editor.vista().escala, 0.25)
})

test("o botao Ajustar a tela reenquadra depois de arrastar para longe", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 5000, clientY: 5000 })
  document.disparar("mouseup", {})
  assert.ok(editor.vista().x > 4000, "arrastou para longe")
  porClasse(hospedeiro, "ed__ajustar")[0].disparar("click")
  assert.ok(editor.vista().x < 1000, "Ajustar precisa trazer o fluxo de volta")
})

test("o botao Testar some enquanto a aba de teste esta aberta", async () => {
  const { hospedeiro } = montar()
  const visivel = () => !porClasse(hospedeiro, "ed__testar")[0].className.includes("ed__oculto")
  assert.equal(visivel(), true, "começa visível")

  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  assert.equal(visivel(), false, "com a aba aberta o botão não faz sentido")
})

test("fechar a aba traz o botao Testar de volta", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  porClasse(hospedeiro, "ed__preview-fechar")[0].disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__testar")[0].className.includes("ed__oculto"), false)
})

test("abrir pelo play de um cartao tambem esconde o botao", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__play")[1].disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__testar")[0].className.includes("ed__oculto"), true)
})

test("redesenhar com a aba aberta nao faz o botao reaparecer", async () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  porClasse(hospedeiro, "ed__criar-grupo")[0].disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__testar")[0].className.includes("ed__oculto"), true)
})

// --- painel sob demanda ----------------------------------------------------

test("sem selecao nao existe painel ocupando a direita", () => {
  const { hospedeiro } = montar()
  assert.equal(porClasse(hospedeiro, "ed__vazio").length, 0,
    "'Selecione um bloco' não pode ocupar espaço permanente")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0)
})

test("bloco com campo principal se edita no cartao, sem abrir painel", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0, "texto não precisa de painel")
})

test("editar o titulo no cartao muda o fluxo", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("dblclick")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Boas-vindas"
  campo.disparar("input")
  assert.equal(editor.fluxo().grupos[0].titulo, "Boas-vindas")
})

test("selecionar o grupo abre o painel para ligar o proximo", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__proximo").length, 1)
})

test("fechar o painel some com ele", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  porClasse(hospedeiro, "ed__painel-fechar")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0)
})

// --- opções no cartão ------------------------------------------------------

const comBotoes = () => {
  const f = fluxoBase()
  f.grupos[0].blocos.push({ id: "bb", tipo: "entrada_botoes", salvar_em: "idade",
    conteudo: { opcoes: [{ id: "o1", label: "25-34" }, { id: "o2", label: "35-44" }] } })
  return f
}

test("clicar no bloco de botoes nao abre painel: edita no cartao", () => {
  const { hospedeiro } = montar(comBotoes())
  porClasse(hospedeiro, "ed__bloco")[1].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0)
  assert.equal(porClasse(hospedeiro, "ed__opcao-campo").length, 2)
})

test("digitar numa opcao muda o fluxo", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  const campo = porClasse(hospedeiro, "ed__opcao-campo")[0]
  campo.value = "18-24"
  campo.disparar("input")
  assert.equal(editor.fluxo().grupos[0].blocos[1].conteudo.opcoes[0].label, "18-24")
})

test("Enter cria a opcao abaixo e o cursor vai para ela", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-campo")[0].disparar("keydown", { key: "Enter" })
  const opcoes = editor.fluxo().grupos[0].blocos[1].conteudo.opcoes
  assert.equal(opcoes.length, 3)
  assert.equal(opcoes[1].label, "", "a nova nasce vazia, pronta para digitar")
  assert.equal(document.focado, porClasse(hospedeiro, "ed__opcao-campo")[1],
    "quem aperta Enter espera continuar digitando")
})

test("Backspace numa opcao vazia a remove", () => {
  const f = comBotoes()
  f.grupos[0].blocos[1].conteudo.opcoes[0].label = ""
  const { hospedeiro, editor } = montar(f)
  porClasse(hospedeiro, "ed__opcao-campo")[0].disparar("keydown", { key: "Backspace" })
  assert.deepEqual(editor.fluxo().grupos[0].blocos[1].conteudo.opcoes.map((o) => o.id), ["o2"])
})

test("o botao de detalhes abre o painel para pontos e destino", () => {
  const { hospedeiro } = montar(comBotoes())
  porClasse(hospedeiro, "ed__bloco-mais")[1].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 1)
  assert.ok(porClasse(hospedeiro, "ed__opcao").length > 0, "pontos e destino continuam acessíveis")
})
