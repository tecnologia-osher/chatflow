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

// --- arrastar da paleta para o quadro --------------------------------------

const tipoDaPaleta = (h, rotulo) => porClasse(h, "ed__tipo").find((b) => b.textContent === rotulo)

// Onde um ponto do fluxo aparece na janela. Lê a mesma transformação que o
// navegador aplica — é o caminho inverso do que o canvas faz ao receber o
// clique, e sem ele o teste teria de adivinhar onde o cartão foi parar.
function naJanela(hospedeiro, ponto) {
  const mundo = porClasse(hospedeiro, "ed__mundo")[0]
  const t = mundo.style.propriedades.transform
  const [, x, y, escala] = t.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/)
  return {
    clientX: Number(x) + ponto.x * Number(escala),
    clientY: Number(y) + ponto.y * Number(escala)
  }
}

function arrastar(hospedeiro, rotulo, destino) {
  const botao = tipoDaPaleta(hospedeiro, rotulo)
  botao.disparar("mousedown", { button: 0, clientX: 5, clientY: 5 })
  document.disparar("mousemove", destino)
  document.disparar("mouseup", destino)
}

const gruposNovos = (editor, antes) =>
  editor.fluxo().grupos.filter((g) => !antes.has(g.id))

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

test("o grupo criado pelo arrasto aparece como cartao na hora", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
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
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
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
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
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

// --- o padrão e a opção que se desfaz -------------------------------------

const opcoesDe = (editor) => editor.fluxo().grupos[0].blocos[1].conteudo.opcoes.map((o) => o.label)

test("o + botao cria a opcao no fluxo, e sair sem escrever a desfaz", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  assert.equal(opcoesDe(editor).length, 3,
    "a opção nova precisa existir no fluxo, não só na tela")

  const vazia = porClasse(hospedeiro, "ed__opcao-campo").at(-1)
  assert.equal(vazia.value, "")
  vazia.disparar("blur")
  assert.deepEqual(opcoesDe(editor), ["25-34", "35-44"], "a lista volta ao que era")
  assert.equal(porClasse(hospedeiro, "ed__opcao-cartao--nova").length, 1,
    "o + botão continua fechando a lista")
})

test("o que foi escrito antes de sair fica", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  const nova = porClasse(hospedeiro, "ed__opcao-campo").at(-1)
  nova.value = "45-54"
  nova.disparar("input")
  nova.disparar("blur")
  assert.deepEqual(opcoesDe(editor), ["25-34", "35-44", "45-54"])
})

test("a opcao nova nasce com o cursor dentro", () => {
  const { hospedeiro } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  assert.equal(document.focado, porClasse(hospedeiro, "ed__opcao-campo").at(-1))
})

test("a unica opcao do bloco nao desaparece ao esvaziar", () => {
  const f = fluxoBase()
  f.grupos[0].blocos.push({ id: "bb", tipo: "entrada_botoes", salvar_em: "idade",
    conteudo: { opcoes: [{ id: "o1", label: "25-34" }] } })
  const { hospedeiro, editor } = montar(f)
  const campo = porClasse(hospedeiro, "ed__opcao-campo")[0]
  campo.value = ""
  campo.disparar("input")
  campo.disparar("blur")
  assert.equal(opcoesDe(editor).length, 1,
    "bloco de botões sem nenhum botão seria fluxo inválido")
})

test("sair da opcao vazia por um cabecalho tambem a desfaz", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  assert.equal(opcoesDe(editor).length, 3)
  // Clicar num cabeçalho não gera blur: o navegador cancela, porque o
  // mousedown do arrasto chama preventDefault. Quem limpa é o redesenho.
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  assert.deepEqual(opcoesDe(editor), ["25-34", "35-44"])
})

test("clicar duas vezes no + botao nao deixa duas linhas vazias", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("click")
  assert.equal(opcoesDe(editor).length, 3, "a vazia anterior sai antes de a nova entrar")
  assert.equal(porClasse(hospedeiro, "ed__opcao-campo").at(-1).value, "")
})

test("o clique no + botao nao deixa o cursor escapar antes de agir", () => {
  const { hospedeiro } = montar(comBotoes())
  let segurou = false
  porClasse(hospedeiro, "ed__opcao-nova")[0].disparar("mousedown", {
    button: 0, clientX: 0, clientY: 0, preventDefault() { segurou = true }
  })
  assert.equal(segurou, true)
})

test("limpar vazias nao mexe no resto do fluxo", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  const antes = JSON.stringify(editor.fluxo())
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  assert.equal(JSON.stringify(editor.fluxo()), antes, "redesenhar não pode reescrever o fluxo")
})

test("arrastar um tipo para o vazio cria um grupo com aquele bloco dentro", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastar(hospedeiro, "Texto", { clientX: 400, clientY: 300 })

  const novos = gruposNovos(editor, antes)
  assert.equal(novos.length, 1, "o grupo precisa nascer do arrasto")
  assert.equal(novos[0].blocos.length, 1)
  assert.equal(novos[0].blocos[0].tipo, "texto")
  assert.equal(novos[0].titulo, "Grupo #1")
})

test("os grupos criados assim seguem a numeracao", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastar(hospedeiro, "Texto", { clientX: 300, clientY: 200 })
  arrastar(hospedeiro, "Texto", { clientX: 600, clientY: 450 })
  assert.deepEqual(gruposNovos(editor, antes).map((g) => g.titulo), ["Grupo #1", "Grupo #2"])
})

test("o grupo nasce onde foi solto, nao num canto fixo", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  // Longe dos cartões que já existem, para o lugar pedido ser o lugar livre.
  const pedido = { x: 100, y: 300 }
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, pedido))
  assert.deepEqual(gruposNovos(editor, antes)[0].posicao, pedido)
})

test("soltar sobre um cartao poe o bloco nele, sem criar grupo novo", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  const alvo = editor.fluxo().grupos[0]
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, {
    x: alvo.posicao.x + 20, y: alvo.posicao.y + 20
  }))

  assert.deepEqual(gruposNovos(editor, antes), [], "soltar no cartão não cria grupo")
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.tipo), ["texto", "texto"])
})

test("soltar fora do palco nao cria nada", () => {
  const { hospedeiro, editor } = montar()
  const antes = JSON.stringify(editor.fluxo())
  arrastar(hospedeiro, "Texto", { clientX: 9000, clientY: 9000 })
  assert.equal(JSON.stringify(editor.fluxo()), antes)
})

test("o bloco que chega arrastado ja vem selecionado para editar", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastar(hospedeiro, "Texto", { clientX: 400, clientY: 300 })
  const novo = gruposNovos(editor, antes)[0]
  const cartao = porClasse(hospedeiro, "ed__cartao").at(-1)
  assert.equal(porClasse(cartao, "ed__bloco--ativo").length, 1,
    `o bloco de ${novo.id} devia estar ativo`)
})

test("enquanto arrasta, um fantasma acompanha o cursor", () => {
  const { hospedeiro } = montar()
  const botao = tipoDaPaleta(hospedeiro, "Texto")
  botao.disparar("mousedown", { button: 0, clientX: 5, clientY: 5 })
  document.disparar("mousemove", { clientX: 300, clientY: 200 })
  const fantasma = porClasse(hospedeiro, "ed__fantasma")[0]
  assert.ok(fantasma, "sem fantasma, ninguém sabe que está arrastando")
  assert.match(fantasma.textContent, /Texto/)
  document.disparar("mouseup", { clientX: 300, clientY: 200 })
  assert.equal(porClasse(hospedeiro, "ed__fantasma").length, 0, "o fantasma precisa sumir")
})

test("nao existe mais botao de novo grupo: o quadro recebe o arrasto", () => {
  const { hospedeiro } = montar()
  assert.equal(porClasse(hospedeiro, "ed__criar-grupo").length, 0)
  // Gesto escondido é gesto que não existe: a paleta precisa dizer qual é.
  const dica = porClasse(hospedeiro, "ed__dica")[0]
  assert.ok(dica, "sem dica, ninguém descobre que se arrasta")
  assert.match(dica.textContent, /arraste/i)
})

test("clicar no tipo continua valendo para quem ja tem grupo selecionado", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  tipoDaPaleta(hospedeiro, "Texto").disparar("click")
  assert.equal(editor.fluxo().grupos[0].blocos.length, 2)
})
