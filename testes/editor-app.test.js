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
  const editor = criarEditor({
    elemento: hospedeiro, fluxo, aoBaixar: (t, n) => baixados.push({ t, n }),
    esperarNoTeste: async () => {}
  })
  return { hospedeiro, editor, baixados }
}

const clicar = (n) => n.disparar("click")

// --- arrastar da paleta para o quadro --------------------------------------

const tipoDaPaleta = (h, rotulo) => porClasse(h, "ed__tipo").find((b) => b.textContent.trim() === rotulo)

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
  for (const c of ["Bolhas", "Entrada", "Lógica", "Conexão"]) assert.ok(categorias.includes(c), `faltou ${c}`)
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

test("sem servidor para gravar, salvar baixa o arquivo e explica", async () => {
  const { hospedeiro, editor, baixados } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  const { t, n } = baixados.at(-1)
  assert.match(n, /\.json$/)
  assert.deepEqual(JSON.parse(t), editor.fluxo())
  assert.match(porClasse(hospedeiro, "ed__recado")[0].textContent, /não consegui salvar/i)
})

test("o aviso de validacao aparece quando o fluxo quebra", () => {
  const { hospedeiro } = montar()
  // Apagar a ligação de g1 deixa g2 inalcançável.
  const faixa = porClasse(hospedeiro, "ed__seta-faixa").find((f) => f.dadosSeta.de === "g1")
  faixa.disparar("contextmenu", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__menu-excluir")[0].disparar("click")
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
  // Um por grupo, mais o do Start — que testa do começo.
  const plays = porClasse(hospedeiro, "ed__play").filter((b) => !b.className.includes("--evento"))
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

test("o botao Centralizar reenquadra depois de arrastar para longe", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 5000, clientY: 5000 })
  document.disparar("mouseup", {})
  assert.ok(editor.vista().x > 4000, "arrastou para longe")
  porClasse(hospedeiro, "ed__ajustar")[0].disparar("click")
  assert.ok(editor.vista().x < 1000, "Centralizar precisa trazer o fluxo de volta")
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
  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Boas-vindas"
  campo.disparar("input")
  assert.equal(editor.fluxo().grupos[0].titulo, "Boas-vindas")
})

test("selecionar o grupo nao abre painel nenhum", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0,
    "formulário que aparece sem ser chamado atrapalha quem ia mexer no cartão")
})

test("o ... do grupo nao abre painel: abre duplicar e excluir", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__cabecalho-mais")[0].disparar("click", { clientX: 0, clientY: 0 })
  assert.equal(porClasse(hospedeiro, "ed__painel").length, 0)
  assert.deepEqual(porClasse(hospedeiro, "ed__acao").map((b) => b.atributos["aria-label"]),
    ["Duplicar", "Excluir"])
})

test("duplicar pelo ... cria a copia do grupo, ja selecionada", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho-mais")[0].disparar("click", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__acao--duplicar")[0].disparar("click")

  const fluxo = editor.fluxo()
  assert.equal(fluxo.grupos.length, 3)
  assert.equal(fluxo.grupos.at(-1).titulo, "Abertura (cópia)")
  assert.deepEqual(fluxo.grupos.at(-1).blocos.map((b) => b.tipo), ["texto"])
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 3)

  // Selecionada: clicar num tipo da paleta acrescenta nela, não no original.
  tipoDaPaleta(hospedeiro, "Texto").disparar("click")
  assert.equal(editor.fluxo().grupos.at(-1).blocos.length, 2)
  assert.equal(editor.fluxo().grupos[0].blocos.length, 1)
})

test("excluir pela lixeira do ... apaga o grupo", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho-mais")[1].disparar("click", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g1"])
})

test("fechar o painel some com ele", () => {
  const { hospedeiro } = montar(comBotoes())
  porClasse(hospedeiro, "ed__bloco-mais")[1].disparar("click")
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
  assert.equal(novos[0].titulo, "Grupo #3", "o fluxo já tinha dois grupos: o novo é o terceiro")
})

test("os grupos criados assim seguem a numeracao", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastar(hospedeiro, "Texto", { clientX: 300, clientY: 200 })
  arrastar(hospedeiro, "Texto", { clientX: 600, clientY: 450 })
  assert.deepEqual(gruposNovos(editor, antes).map((g) => g.titulo), ["Grupo #3", "Grupo #4"])
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

test("a barra diz Centralizar, e explica o que faz", () => {
  const { hospedeiro } = montar()
  const botao = porClasse(hospedeiro, "ed__ajustar")[0]
  assert.equal(botao.textContent, "Centralizar")
  assert.match(botao.atributos.title || "", /fluxo inteiro|tela/i)
})

// --- apagar uma ligação ----------------------------------------------------

const faixaDe = (h, criterio) => porClasse(h, "ed__seta-faixa").find((f) => criterio(f.dadosSeta))
function apagarLigacao(hospedeiro, criterio) {
  const faixa = faixaDe(hospedeiro, criterio)
  faixa.disparar("contextmenu", { clientX: 10, clientY: 10 })
  porClasse(hospedeiro, "ed__menu-excluir")[0].disparar("click")
}

test("excluir a linha da saida do grupo apaga o proximo dele", () => {
  const { hospedeiro, editor } = montar()
  assert.equal(editor.fluxo().grupos[0].proximo, "g2")
  apagarLigacao(hospedeiro, (s) => s.de === "g1" && !s.saida)
  assert.equal("proximo" in editor.fluxo().grupos[0], false,
    "destino apagado sai do JSON, não fica como texto vazio")
})

test("excluir a linha de uma opcao apaga so o destino daquela opcao", () => {
  const f = comBotoes()
  f.grupos[0].blocos[1].conteudo.opcoes[0].proximo = "g2"
  const { hospedeiro, editor } = montar(f)
  apagarLigacao(hospedeiro, (s) => s.saida?.opcao === "o1")
  const opcoes = editor.fluxo().grupos[0].blocos[1].conteudo.opcoes
  assert.equal("proximo" in opcoes[0], false)
  assert.equal(editor.fluxo().grupos[0].proximo, "g2", "a saída do grupo não era essa")
})

test("excluir a linha do Start apaga o inicio, e o aviso aparece", () => {
  const { hospedeiro, editor } = montar()
  apagarLigacao(hospedeiro, (s) => s.evento === "inicio")
  assert.equal("proximo" in editor.fluxo().eventos[0], false)
  assert.match(porClasse(hospedeiro, "ed__problemas")[0].textContent, /início/i,
    "fluxo sem início precisa gritar")
})

test("excluir a linha de um ir_para apaga o destino do bloco", () => {
  const f = fluxoBase()
  f.grupos[0].blocos.push({ id: "b_ir", tipo: "ir_para", conteudo: { destino: "g2" } })
  const { hospedeiro, editor } = montar(f)
  apagarLigacao(hospedeiro, (s) => s.origens.includes("ir_para"))
  assert.equal("destino" in editor.fluxo().grupos[0].blocos[1].conteudo, false)
})

test("depois de excluir, a linha sai do desenho", () => {
  const { hospedeiro } = montar()
  const antes = porClasse(hospedeiro, "ed__seta").length
  apagarLigacao(hospedeiro, (s) => s.de === "g1" && !s.saida)
  assert.equal(porClasse(hospedeiro, "ed__seta").length, antes - 1)
})

test("excluir o grupo tira o cartao e quem apontava para ele", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cartao")[1].disparar("contextmenu", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__menu-excluir")[0].disparar("click")

  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g1"])
  assert.equal("proximo" in editor.fluxo().grupos[0], false, "g1 apontava para g2")
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 1)
})

test("excluir o grupo selecionado larga a selecao, nao fica num grupo fantasma", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")

  porClasse(hospedeiro, "ed__cartao")[0].disparar("contextmenu", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__menu-excluir")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g2"])

  // Com a seleção presa no grupo apagado, clicar num tipo tentaria acrescentar
  // bloco nele e não diria nada: nem avisa, nem acrescenta.
  tipoDaPaleta(hospedeiro, "Texto").disparar("click")
  assert.match(porClasse(hospedeiro, "ed__recado")[0].textContent, /arraste|selecione/i)
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.blocos.length), [0])
})

test("texto digitado nao volta atras quando o canvas se redesenha sozinho", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")

  // Começar a arrastar o fundo faz o canvas se redesenhar por conta própria.
  // Se ele tiver guardado o fluxo do último desenho, repinta "Olá" por cima.
  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia")
  // O bloco segue selecionado, então o que está na tela é a caixa de edição:
  // recriada a partir do fluxo guardado, ela voltaria com "Olá".
  assert.equal(porClasse(hospedeiro, "ed__bloco-campo")[0].value, "Bom dia",
    "a caixa voltou com o texto antigo")
})

test("nome digitado sobrevive ao arrasto que fecha a caixa", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Qualificação do lead"
  campo.disparar("input")

  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  assert.equal(editor.fluxo().grupos[0].titulo, "Qualificação do lead")
  assert.equal(porClasse(hospedeiro, "ed__cabecalho-titulo")[0].textContent, "Qualificação do lead")
})

test("ligar logo depois de digitar usa o tamanho novo do cartao", async () => {
  const { cartoes, caixas } = await import("../editor/modelo.js")
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  const alturaAntes = caixas(cartoes(editor.fluxo())).get("g1").altura

  // Texto de quatro linhas: o cartão cresce bastante.
  campo.value = "Bem-vindo à Osher Capital. Queremos te conhecer melhor para " +
    "indicar o consórcio certo, com a parcela que caiba no seu mês, sem susto."
  campo.disparar("input")
  const caixa = caixas(cartoes(editor.fluxo())).get("g1")
  assert.ok(caixa.altura > alturaAntes + 30, "o cartão precisa ter crescido para o teste valer")

  // Solta a ligação de g2 numa faixa que só existe depois do crescimento.
  const ponto = naJanela(hospedeiro, { x: caixa.x + 30, y: alturaAntes + 20 + caixa.y })
  const saidaDeG2 = porClasse(hospedeiro, "ed__grupo-ponto").at(-1)
  saidaDeG2.disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", ponto)
  document.disparar("mouseup", ponto)

  assert.equal(editor.fluxo().grupos[1].proximo, "g1",
    "com as caixas do desenho anterior, o ponto cairia fora do cartão e nada ligaria")
})

// --- salvar ----------------------------------------------------------------

function montarComServidor(fluxo = fluxoBase(), responder = async () => {}) {
  const hospedeiro = new Elemento("div")
  const salvos = []
  const baixados = []
  const editor = criarEditor({
    elemento: hospedeiro, fluxo,
    aoBaixar: (t, n) => baixados.push({ t, n }),
    aoSalvar: async (texto) => { salvos.push(texto); return responder(texto) },
    esperarNoTeste: async () => {}
  })
  return { hospedeiro, editor, salvos, baixados }
}

test("a barra tem Salvar, e nao tem mais Baixar", () => {
  const { hospedeiro } = montarComServidor()
  assert.equal(porClasse(hospedeiro, "ed__baixar").length, 0)
  assert.equal(porClasse(hospedeiro, "ed__salvar").length, 1)
})

test("sem mudanca, o botao diz Salvo e nao manda nada", async () => {
  const { hospedeiro, salvos } = montarComServidor()
  const botao = porClasse(hospedeiro, "ed__salvar")[0]
  assert.equal(botao.textContent, "Salvo")
  assert.equal(botao.disabled, true)
  botao.disparar("click")
  await assentar()
  assert.deepEqual(salvos, [], "salvar o que não mudou só gasta disco")
})

test("depois de editar, o botao pede para salvar e manda o fluxo inteiro", async () => {
  const { hospedeiro, editor, salvos } = montarComServidor()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  const botao = porClasse(hospedeiro, "ed__salvar")[0]
  assert.equal(botao.textContent, "Salvar")
  assert.equal(botao.className.includes("ed__salvar--pendente"), true, "precisa chamar atenção")

  botao.disparar("click")
  await assentar()
  assert.equal(salvos.length, 1)
  assert.deepEqual(JSON.parse(salvos[0]), editor.fluxo())
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
  assert.equal(editor.temMudancas(), false)
})

test("editar de novo volta a pedir para salvar", async () => {
  const { hospedeiro, editor } = montarComServidor()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  assert.equal(editor.temMudancas(), false)

  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Outro nome"
  campo.disparar("input")
  assert.equal(editor.temMudancas(), true)
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvar")
})

test("mexer sem editar nao faz o botao pedir para salvar", () => {
  const { hospedeiro, editor } = montarComServidor()
  porClasse(hospedeiro, "ed__cabecalho")[0].disparar("click")
  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 5, clientY: 5, button: 0 })
  assert.equal(editor.temMudancas(), false, "selecionar e clicar no fundo não mudam o fluxo")
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
})

test("servidor fora do ar: baixa o arquivo e diz o motivo", async () => {
  const { hospedeiro, baixados, editor } = montarComServidor(fluxoBase(), async () => {
    throw new Error("o servidor respondeu 403")
  })
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()

  assert.equal(baixados.length, 1, "trabalho perdido por servidor fora seria o pior resultado")
  assert.deepEqual(JSON.parse(baixados[0].t), editor.fluxo())
  assert.match(porClasse(hospedeiro, "ed__recado")[0].textContent, /403/)
  assert.equal(editor.temMudancas(), true, "não gravou: continua pendente")
})

test("enquanto salva, o botao avisa e nao manda duas vezes", async () => {
  let soltar
  const { hospedeiro, salvos } = montarComServidor(fluxoBase(), () => new Promise((r) => { soltar = r }))
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  const botao = porClasse(hospedeiro, "ed__salvar")[0]
  botao.disparar("click")
  await assentar()

  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvando…")
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  assert.equal(salvos.length, 1, "dois cliques, um envio")
  soltar()
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
})

// --- o header --------------------------------------------------------------

test("o header tem voltar, nome, desfazer, refazer, abas e engrenagem", () => {
  const { hospedeiro } = montar()
  for (const classe of ["ed__voltar", "ed__nome", "ed__passo--desfazer", "ed__passo--refazer",
    "ed__engrenagem", "ed__testar", "ed__ajustar", "ed__salvar"]) {
    assert.equal(porClasse(hospedeiro, classe).length, 1, `faltou ${classe}`)
  }
  assert.deepEqual(porClasse(hospedeiro, "ed__aba").map((b) => b.textContent),
    ["Fluxo", "Tema", "Resultados"])
  assert.equal(porClasse(hospedeiro, "ed__aba--ativa")[0].textContent, "Fluxo")
})

test("o voltar avisa quem abriu o editor, para levar aos projetos", () => {
  const hospedeiro = new Elemento("div")
  const voltas = []
  criarEditor({ elemento: hospedeiro, fluxo: fluxoBase(), aoVoltar: () => voltas.push(1) })
  porClasse(hospedeiro, "ed__voltar")[0].disparar("click")
  assert.equal(voltas.length, 1)
})

test("fluxo sem nome aparece como My Chatflow, e o nome se edita ali mesmo", () => {
  const { hospedeiro, editor } = montar()
  assert.equal(porClasse(hospedeiro, "ed__nome-texto")[0].textContent, "My Chatflow")

  porClasse(hospedeiro, "ed__nome-texto")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__nome-campo")[0]
  assert.equal(document.focado, campo, "a caixa nasce com o cursor")
  campo.value = "Osher 01"
  campo.disparar("input")
  assert.equal(editor.fluxo().nome, "Osher 01")

  campo.disparar("blur")
  assert.equal(porClasse(hospedeiro, "ed__nome-texto")[0].textContent, "Osher 01")
})

test("renomear o projeto conta como mudanca a salvar", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__nome-texto")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__nome-campo")[0]
  campo.value = "Osher 01"
  campo.disparar("input")
  assert.equal(editor.temMudancas(), true)
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvar")
})

test("as abas trocam o que aparece, e dizem o que ainda nao existe", () => {
  const { hospedeiro } = montar()
  const aba = (rotulo) => porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === rotulo)
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), false)

  aba("Tema").disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), true,
    "o canvas sai da frente")
  assert.equal(porClasse(hospedeiro, "ed__em-breve-titulo")[0].textContent, "Tema")
  assert.match(porClasse(hospedeiro, "ed__em-breve-texto")[0].textContent, /tema\.json/)
  assert.equal(porClasse(hospedeiro, "ed__aba--ativa")[0].textContent, "Tema")

  aba("Fluxo").disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), false)
  assert.equal(porClasse(hospedeiro, "ed__em-breve")[0].className.includes("ed__oculto"), true)
})

test("a engrenagem abre e fecha as configuracoes, com o ritmo da digitacao", () => {
  const { hospedeiro, editor } = montar()
  assert.equal(porClasse(hospedeiro, "ed__config").length, 0, "não aparece sozinha")

  porClasse(hospedeiro, "ed__engrenagem")[0].disparar("click")
  const campos = porClasse(hospedeiro, "ed__config-campo")
  assert.equal(campos.length, 3)
  campos[0].value = "800"
  campos[0].disparar("input")
  assert.equal(editor.fluxo().ritmo.piso, 800)
  assert.equal(typeof editor.fluxo().ritmo.piso, "number", "em texto, o motor soma errado")

  porClasse(hospedeiro, "ed__config-fechar")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__config").length, 0)
})

test("limpar um campo do ritmo tira ele do fluxo, nao grava vazio", () => {
  const f = fluxoBase()
  f.ritmo = { piso: 1000, porCaractere: 0, teto: 1000 }
  const { hospedeiro, editor } = montar(f)
  porClasse(hospedeiro, "ed__engrenagem")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__config-campo")[0]
  campo.value = ""
  campo.disparar("input")
  assert.equal("piso" in editor.fluxo().ritmo, false)
})

// --- desfazer e refazer ----------------------------------------------------

test("desfazer volta a ultima mudanca, refazer traz de volta", () => {
  const { hospedeiro, editor } = montar()
  const antes = JSON.stringify(editor.fluxo())
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  assert.equal(editor.fluxo().grupos.length, 3)

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.fluxo().grupos.length, 2)
  assert.equal(JSON.stringify(editor.fluxo()), antes, "voltou exatamente ao que era")
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 2, "e o canvas acompanhou")

  porClasse(hospedeiro, "ed__passo--refazer")[0].disparar("click")
  assert.equal(editor.fluxo().grupos.length, 3)
})

test("os botoes ficam apagados quando nao ha o que desfazer ou refazer", () => {
  const { hospedeiro } = montar()
  const desfazer = () => porClasse(hospedeiro, "ed__passo--desfazer")[0]
  const refazer = () => porClasse(hospedeiro, "ed__passo--refazer")[0]
  assert.equal(desfazer().disabled, true, "nada aconteceu ainda")
  assert.equal(refazer().disabled, true)

  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  assert.equal(desfazer().disabled, false)
  assert.equal(refazer().disabled, true, "ainda não se desfez nada")

  desfazer().disparar("click")
  assert.equal(refazer().disabled, false)
})

test("digitar seguido vira um passo so, nao um por letra", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]
  for (const texto of ["B", "Bo", "Bom", "Bom d", "Bom dia"]) {
    campo.value = texto
    campo.disparar("input")
  }
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia")

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Olá",
    "desfazer letra por letra o que se digitou seria um castigo")
})

test("edicoes em campos diferentes sao passos diferentes", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const texto = porClasse(hospedeiro, "ed__bloco-campo")[0]
  texto.value = "Bom dia"
  texto.disparar("input")

  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const titulo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  titulo.value = "Boas-vindas"
  titulo.disparar("input")

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.fluxo().grupos[0].titulo, "Abertura", "o título voltou")
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.texto, "Bom dia", "o texto ficou")
})

test("uma mudanca nova apaga o caminho de volta do refazer", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__passo--refazer")[0].disabled, false)

  arrastar(hospedeiro, "Botões", naJanela(hospedeiro, { x: 600, y: 300 }))
  assert.equal(porClasse(hospedeiro, "ed__passo--refazer")[0].disabled, true,
    "o futuro que havia deixou de existir quando o caminho mudou")
  assert.equal(editor.fluxo().grupos.at(-1).blocos[0].tipo, "entrada_botoes")
})

test("desfazer apagar um grupo traz o grupo e quem apontava para ele", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cartao")[1].disparar("contextmenu", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__menu-excluir")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g1"])

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g1", "g2"])
  assert.equal(editor.fluxo().grupos[0].proximo, "g2", "a ligação voltou junto")
})

test("desfazer solta a selecao de um grupo que deixou de existir", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  const novo = editor.fluxo().grupos.at(-1).id
  assert.equal(editor.selecao().grupo, novo, "o grupo novo nasce selecionado")

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.selecao().grupo, null,
    "seleção num grupo que sumiu faz a paleta acrescentar bloco no nada")
})

test("desfazer depois de salvar volta a pedir para salvar", async () => {
  const { hospedeiro, editor } = montarComServidor()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  assert.equal(editor.temMudancas(), false)

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.temMudancas(), true, "o arquivo tem o grupo que a tela já não tem")
})

test("Ctrl+Z desfaz e Ctrl+Shift+Z refaz, sem precisar do botao", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  assert.equal(editor.fluxo().grupos.length, 3)

  document.disparar("keydown", { key: "z", ctrlKey: true })
  assert.equal(editor.fluxo().grupos.length, 2)
  document.disparar("keydown", { key: "Z", ctrlKey: true, shiftKey: true })
  assert.equal(editor.fluxo().grupos.length, 3)
})

test("Ctrl+Z dentro de uma caixa de texto e do campo, nao do editor", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__bloco-campo")[0]

  document.disparar("keydown", { key: "z", ctrlKey: true, target: campo })
  assert.equal(editor.fluxo().grupos.length, 3, "quem digita espera desfazer a letra, não o grupo")
})

test("Ctrl+Z sem nada para desfazer nao quebra o editor", () => {
  const { hospedeiro, editor } = montar()
  document.disparar("keydown", { key: "z", ctrlKey: true })
  document.disparar("keydown", { key: "Z", ctrlKey: true, shiftKey: true })
  assert.equal(editor.fluxo().grupos.length, 2)
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 2)
})

test("desfazer o nome do projeto volta o nome no header", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__nome-texto")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__nome-campo")[0]
  campo.value = "Osher 01"
  campo.disparar("input")
  campo.disparar("blur")
  assert.equal(porClasse(hospedeiro, "ed__nome-texto")[0].textContent, "Osher 01")

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.fluxo().nome, undefined)
  assert.equal(porClasse(hospedeiro, "ed__nome-texto")[0].textContent, "My Chatflow",
    "o fluxo voltou e o header continuou mostrando o nome antigo")
})

test("clicar no quadro fecha a caixa do nome do projeto", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__nome-texto")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__nome-campo")[0]
  campo.value = "Osher 01"
  campo.disparar("input")

  // O arrasto do quadro chama preventDefault e segura o foco: sem fechar na
  // mão, a caixa ficaria aberta atrás do resto.
  porClasse(hospedeiro, "ed__palco")[0].disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  assert.equal(porClasse(hospedeiro, "ed__nome-campo").length, 0)
  assert.equal(porClasse(hospedeiro, "ed__nome-texto")[0].textContent, "Osher 01")
  assert.equal(editor.fluxo().nome, "Osher 01", "o que foi digitado fica")
})

test("clicar dentro da caixa do nome nao a fecha", () => {
  const { hospedeiro } = montar()
  porClasse(hospedeiro, "ed__nome-texto")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__nome-campo")[0]
  campo.disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  assert.equal(porClasse(hospedeiro, "ed__nome-campo").length, 1)
})

test("cada tipo da paleta tem icone e rotulo, nos tres da categoria Bolhas", () => {
  const { hospedeiro } = montar()
  const tipos = porClasse(hospedeiro, "ed__tipo")
  assert.equal(porClasse(hospedeiro, "ed__tipo-icone").length, tipos.length,
    "tipo sem ícone na paleta obriga a soletrar o nome")

  const bolhas = tipos.filter((b) => b.className.includes("ed__tipo--fala"))
  assert.deepEqual(bolhas.map((b) => b.porClasse("ed__tipo-rotulo")[0].textContent),
    ["Texto", "Imagem", "Vídeo"])
  for (const botao of bolhas) {
    const traco = botao.porClasse("ed__tipo-icone")[0].filhos[0]
    assert.match(traco.atributos.d || "", /^M/, "o ícone precisa ter desenho")
  }
})

test("o desenho de cada bolha e diferente do das outras", () => {
  const { hospedeiro } = montar()
  const desenhos = porClasse(hospedeiro, "ed__tipo")
    .filter((b) => b.className.includes("ed__tipo--fala"))
    .map((b) => b.porClasse("ed__tipo-icone")[0].filhos[0].atributos.d)
  assert.equal(new Set(desenhos).size, 3, "três ícones iguais não distinguem nada")
})

test("arrastar um tipo continua funcionando com o icone dentro", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastar(hospedeiro, "Vídeo", naJanela(hospedeiro, { x: 100, y: 300 }))
  const novos = editor.fluxo().grupos.filter((g) => !antes.has(g.id))
  assert.equal(novos.length, 1)
  assert.equal(novos[0].blocos[0].tipo, "video")
})

// --- levar blocos de um grupo para outro -----------------------------------

const arrastarBloco = (hospedeiro, blocoId, destino) => {
  const bloco = porClasse(hospedeiro, "ed__bloco").find((b) => b.dadosBloco === blocoId)
  bloco.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mousemove", destino)
  document.disparar("mouseup", destino)
}

test("arrastar o bloco para outro grupo muda o fluxo e redesenha", async () => {
  const { cartoes, caixas } = await import("../editor/modelo.js")
  const f = fluxoBase()
  f.grupos[1].blocos.push({ id: "b2", tipo: "texto", conteudo: { texto: "Tchau" } })
  const { hospedeiro, editor } = montar(f)
  const destino = caixas(cartoes(editor.fluxo())).get("g2")

  arrastarBloco(hospedeiro, "b1", naJanela(hospedeiro, {
    x: destino.x + 30, y: destino.y + destino.altura - 8
  }))

  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.id), [])
  assert.deepEqual(editor.fluxo().grupos[1].blocos.map((b) => b.id), ["b2", "b1"])
  assert.equal(editor.selecao().grupo, "g2", "o bloco continua selecionado onde foi parar")
})

test("soltar o bloco no quadro cria um grupo com ele", async () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  arrastarBloco(hospedeiro, "b1", naJanela(hospedeiro, { x: 150, y: 300 }))

  const novo = editor.fluxo().grupos.find((g) => !antes.has(g.id))
  assert.ok(novo, "o grupo novo precisa existir")
  assert.deepEqual(novo.blocos.map((b) => b.id), ["b1"])
  assert.deepEqual(editor.fluxo().grupos[0].blocos, [], "e sair de onde estava")
  assert.equal(porClasse(hospedeiro, "ed__cartao").length, 3)
  assert.equal(editor.selecao().grupo, novo.id)
})

test("levar um bloco cabe num desfazer so", async () => {
  const { cartoes, caixas } = await import("../editor/modelo.js")
  const { hospedeiro, editor } = montar()
  const destino = caixas(cartoes(editor.fluxo())).get("g2")
  arrastarBloco(hospedeiro, "b1", naJanela(hospedeiro, { x: destino.x + 30, y: destino.y + 20 }))
  assert.deepEqual(editor.fluxo().grupos[1].blocos.map((b) => b.id), ["b1"])

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.id), ["b1"])
  assert.deepEqual(editor.fluxo().grupos[1].blocos, [])
})

test("o bloco virar grupo tambem cabe num desfazer so", () => {
  const { hospedeiro, editor } = montar()
  arrastarBloco(hospedeiro, "b1", naJanela(hospedeiro, { x: 150, y: 300 }))
  assert.equal(editor.fluxo().grupos.length, 3)

  porClasse(hospedeiro, "ed__passo--desfazer")[0].disparar("click")
  assert.equal(editor.fluxo().grupos.length, 2)
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.id), ["b1"])
})

test("o que se arrasta da paleta e a propria caixa, com icone e tamanho", () => {
  const { hospedeiro } = montar()
  const botao = tipoDaPaleta(hospedeiro, "Botões")
  botao.deslocamento = { left: 30, top: 200 }
  botao.clientWidth = 150
  botao.clientHeight = 44

  botao.disparar("mousedown", { button: 0, clientX: 40, clientY: 210, currentTarget: botao })
  document.disparar("mousemove", { clientX: 500, clientY: 400 })

  const fantasma = porClasse(hospedeiro, "ed__fantasma")[0]
  assert.ok(fantasma.className.includes("ed__fantasma--tipo"), "arrastar o nome solto não mostra o que vai cair")
  assert.equal(fantasma.porClasse("ed__tipo-icone").length, 1)
  assert.equal(fantasma.porClasse("ed__tipo-rotulo")[0].textContent, "Botões")
  assert.equal(fantasma.style.propriedades.width, "150px")
  assert.equal(fantasma.style.propriedades.height, "44px")

  document.disparar("mouseup", { clientX: 500, clientY: 400 })
})

test("o fantasma fica preso onde a mao pegou, nao salta para o cursor", () => {
  const { hospedeiro } = montar()
  const botao = tipoDaPaleta(hospedeiro, "Texto")
  botao.deslocamento = { left: 30, top: 200 }
  botao.clientWidth = 150
  botao.clientHeight = 44

  // Pegou a 10px da borda esquerda e 10 do topo.
  botao.disparar("mousedown", { button: 0, clientX: 40, clientY: 210, currentTarget: botao })
  document.disparar("mousemove", { clientX: 500, clientY: 400 })

  const fantasma = porClasse(hospedeiro, "ed__fantasma")[0]
  assert.equal(fantasma.style.propriedades.left, "490px", "manteve os 10px da borda")
  assert.equal(fantasma.style.propriedades.top, "390px")
  document.disparar("mouseup", { clientX: 500, clientY: 400 })
})

test("sem saber o tamanho da caixa, o fantasma ainda aparece", () => {
  const { hospedeiro } = montar()
  const botao = tipoDaPaleta(hospedeiro, "Texto")
  botao.disparar("mousedown", { button: 0, clientX: 5, clientY: 5 })
  document.disparar("mousemove", { clientX: 300, clientY: 200 })
  assert.equal(porClasse(hospedeiro, "ed__fantasma").length, 1)
  document.disparar("mouseup", { clientX: 300, clientY: 200 })
})

test("os botoes da barra tem icone, e o do salvar conta o estado", () => {
  const { hospedeiro, editor } = montar()
  const icones = (classe) => porClasse(hospedeiro, classe)[0].porClasse("ed__barra-icone").length
  assert.equal(icones("ed__ajustar"), 1, "Centralizar sem ícone")
  assert.equal(icones("ed__salvar"), 1, "Salvar sem ícone")
  assert.equal(icones("ed__engrenagem"), 1, "engrenagem sem ícone")

  const desenhoDoSalvar = () =>
    porClasse(hospedeiro, "ed__salvar")[0].porClasse("ed__barra-icone")[0].filhos[0].atributos.d
  const guardado = desenhoDoSalvar()
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")

  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvar")
  assert.notEqual(desenhoDoSalvar(), guardado, "o ícone precisa mudar junto com a palavra")
  assert.equal(editor.temMudancas(), true)
})

test("a engrenagem tem o icone maior que os outros da barra", () => {
  const { hospedeiro } = montar()
  const daEngrenagem = porClasse(hospedeiro, "ed__engrenagem")[0].porClasse("ed__barra-icone")[0]
  assert.ok(daEngrenagem.className.includes("ed__barra-icone--grande"))
})

// --- a aba Resultados ------------------------------------------------------

function montarComLeads(linhas, fluxo = fluxoBase()) {
  const hospedeiro = new Elemento("div")
  const pedidos = []
  const editor = criarEditor({
    elemento: hospedeiro, fluxo, esperarNoTeste: async () => {},
    aoBuscarLeads: async (chave) => {
      pedidos.push(chave)
      if (typeof linhas === "function") return linhas(chave)
      return linhas
    }
  })
  return { hospedeiro, editor, pedidos }
}

const abrirResultados = (h) =>
  porClasse(h, "ed__aba").find((b) => b.textContent === "Resultados").disparar("click")

test("sem chave, a aba pede a chave em vez de buscar", () => {
  const { hospedeiro, pedidos } = montarComLeads([])
  abrirResultados(hospedeiro)
  assert.equal(porClasse(hospedeiro, "ed__chave").length, 1)
  assert.deepEqual(pedidos, [], "buscar sem chave só gastaria uma viagem")
})

test("com a chave colada, busca e monta a tabela com as colunas do fluxo", async () => {
  const f = fluxoBase()
  f.grupos[0].blocos.push(
    { id: "b_nome", tipo: "entrada_texto", salvar_em: "nome", conteudo: { rotulo: "Seu nome" } })
  const { hospedeiro, pedidos } = montarComLeads([
    { atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "concluído", nome: "Ana" }
  ], f)
  abrirResultados(hospedeiro)

  const campo = porClasse(hospedeiro, "ed__chave-campo")[0]
  campo.value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  assert.deepEqual(pedidos, ["segredo"])
  assert.deepEqual(porClasse(hospedeiro, "ed__tabela-cabecalho").map((c) => c.textContent),
    ["Quando", "Situação", "Seu nome"])
  assert.deepEqual(porClasse(hospedeiro, "ed__tabela-celula").map((c) => c.textContent),
    ["02/10 11:05", "concluído", "Ana"])
})

test("planilha vazia diz que ninguem entrou, em vez de tabela sem linha", async () => {
  const { hospedeiro } = montarComLeads([])
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 0)
  assert.match(porClasse(hospedeiro, "ed__resultados-vazio")[0].textContent, /ninguém entrou/i)
})

test("chave recusada aparece na tela, e a tabela nao mente", async () => {
  const { hospedeiro } = montarComLeads(async () => { throw new Error("Chave inválida.") })
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "errada"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  assert.match(porClasse(hospedeiro, "ed__resultados-aviso")[0].textContent, /chave inválida/i)
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 0)
})

test("coluna que veio da planilha e nao esta no fluxo aparece marcada", async () => {
  const { hospedeiro } = montarComLeads([
    { atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "em andamento", classificacao: "quente" }
  ])
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  const extra = porClasse(hospedeiro, "ed__tabela-cabecalho--extra")[0]
  assert.equal(extra.textContent, "classificacao")
  assert.match(extra.atributos.title || "", /não está no fluxo/i)
})

test("voltar para o Fluxo guarda o canvas de volta", async () => {
  const { hospedeiro } = montarComLeads([])
  abrirResultados(hospedeiro)
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), true)

  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Fluxo").disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), false)
  assert.equal(porClasse(hospedeiro, "ed__resultados")[0].className.includes("ed__oculto"), true)
})

test("sem de onde buscar, a aba diz isso em vez de ficar rodando", () => {
  const { hospedeiro } = montar()
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  assert.match(porClasse(hospedeiro, "ed__resultados-aviso")[0].textContent, /sem de onde buscar/i)
})

test("falhar ao atualizar tira a tabela velha, em vez de mostrar dado de antes", async () => {
  let vez = 0
  const { hospedeiro } = montarComLeads(async () => {
    vez += 1
    if (vez === 1) return [{ atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "concluído" }]
    throw new Error("a planilha respondeu 500")
  })
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 1)

  porClasse(hospedeiro, "ed__resultados-atualizar")[0].disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 0,
    "tabela velha ao lado de um aviso de erro é mentira com cara de dado")
  assert.match(porClasse(hospedeiro, "ed__resultados-aviso")[0].textContent, /500/)
})

test("chave recusada devolve o campo, para colar outra", async () => {
  let chaveBoa = false
  const { hospedeiro, pedidos } = montarComLeads(async (chave) => {
    if (chave !== "certa") throw new Error("Chave inválida.")
    chaveBoa = true
    return [{ atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "concluído" }]
  })
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "errada"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  assert.equal(porClasse(hospedeiro, "ed__chave").length, 1,
    "com o aviso e sem campo, não havia como corrigir a chave")
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "certa"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  assert.deepEqual(pedidos, ["errada", "certa"])
  assert.equal(chaveBoa, true)
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 1)
  assert.equal(porClasse(hospedeiro, "ed__chave").length, 0, "deu certo: o campo sai de cena")
})

test("com a tabela na tela, da para trocar a chave", async () => {
  const { hospedeiro } = montarComLeads([{ atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "ok" }])
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 1)

  porClasse(hospedeiro, "ed__resultados-trocar")[0].disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__chave").length, 1)
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 0)
})
