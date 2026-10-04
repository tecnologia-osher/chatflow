// O editor inteiro: paleta, canvas, painel e preview conversando.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar, criarArmazenamento } from "./apoio/navegador.js"
instalarNavegador()

const { criarEditor } = await import("../editor/app.js")
const { todos } = await import("../editor/catalogo.js")
const { cartoes: cartoesDoFluxo, caixas: caixasDoFluxo } = await import("../editor/modelo.js")

const fluxoBase = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 0, y: 0 }, proximo: "g2", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] },
    { id: "g2", titulo: "Fim", posicao: { x: 400, y: 0 }, blocos: [] }
  ]
})

function montar(fluxo = fluxoBase(), armazenamento = criarArmazenamento()) {
  const hospedeiro = new Elemento("div")
  const baixados = []
  const editor = criarEditor({
    elemento: hospedeiro, fluxo, aoBaixar: (t, n) => baixados.push({ t, n }),
    esperarNoTeste: async () => {}, armazenamento
  })
  return { hospedeiro, editor, baixados, armazenamento }
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
  assert.deepEqual(categorias, ["Bolhas", "Entrada", "Lógica"],
    "três seções: Redirecionar e Webhook são decisões de para onde o fluxo vai, e isso é lógica")
})

test("clicar num tipo nao acrescenta bloco nenhum, nem com grupo selecionado", () => {
  // Clicando, o bloco caía no grupo selecionado de antes — quase nunca o
  // grupo em que a pessoa estava olhando. Um gesto só para pôr bloco no
  // fluxo, e é o arrasto.
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho")[1].disparar("click")        // seleciona g2
  porClasse(hospedeiro, "ed__tipo").find((t) => t.textContent.includes("Texto")).disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.blocos.length), [1, 0])
})

test("clicar num tipo descola ele do menu e nao acrescenta nada ainda", () => {
  const { hospedeiro, editor } = montar()
  const tipo = porClasse(hospedeiro, "ed__tipo")[0]
  tipo.disparar("mousedown", { button: 0, clientX: 40, clientY: 120 })
  document.disparar("mouseup", { clientX: 40, clientY: 120 })

  assert.equal(editor.fluxo().grupos[0].blocos.length, 1, "nada deve ser acrescentado ainda")
  assert.equal(porClasse(hospedeiro, "ed__fantasma").length, 1,
    "o tipo precisa descolar do menu e seguir o cursor")

  // Esc devolve o tipo ao menu: carregar um bloco que não se quer mais, sem
  // jeito de largar, seria uma armadilha.
  document.disparar("keydown", { key: "Escape" })
  assert.equal(porClasse(hospedeiro, "ed__fantasma").length, 0)
  assert.equal(editor.fluxo().grupos[0].blocos.length, 1)
})

test("com o tipo descolado, o clique no quadro e que poe o bloco", () => {
  const { hospedeiro, editor } = montar()
  const antes = new Set(editor.fluxo().grupos.map((g) => g.id))
  const tipo = tipoDaPaleta(hospedeiro, "Texto")
  tipo.disparar("mousedown", { button: 0, clientX: 40, clientY: 120 })
  document.disparar("mouseup", { clientX: 40, clientY: 120 })

  const onde = naJanela(hospedeiro, { x: 100, y: 300 })
  document.disparar("mousemove", onde)
  document.disparar("mousedown", { ...onde, button: 0 })

  const novos = gruposNovos(editor, antes)
  assert.equal(novos.length, 1, "o clique no quadro é que larga o bloco")
  assert.deepEqual(novos[0].blocos.map((b) => b.tipo), ["texto"])
  assert.equal(porClasse(hospedeiro, "ed__fantasma").length, 0, "largou: o fantasma some")
})

test("o bloco arrastado ja vem selecionado, pronto para editar", () => {
  const { hospedeiro, editor } = montar()
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: 100, y: 300 }))
  const novo = editor.fluxo().grupos.at(-1)
  assert.equal(editor.selecao().bloco, novo.blocos[0].id)
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

test("abrindo, o fluxo nao e espremido abaixo do legivel para caber", () => {
  // Altura do fluxo real da Osher: vai de y=40 a y=1020. Caber inteiro aqui
  // exigia 0,6 de escala, e a 0,6 a letra de um bloco sai a 8px no Chrome.
  const alto = fluxoBase()
  alto.grupos[1].posicao = { x: 0, y: 1020 }
  const { editor } = montar(alto)
  assert.equal(editor.vista().escala, 1,
    "abre no tamanho natural do cartão: abrir num tamanho que não se lê é o mesmo que não abrir")
})

test("o botao Centralizar continua mostrando tudo, no tamanho que der", () => {
  const alto = fluxoBase()
  alto.grupos[1].posicao = { x: 0, y: 1020 }
  const { hospedeiro, editor } = montar(alto)
  porClasse(hospedeiro, "ed__ajustar")[0].disparar("click")
  const v = editor.vista()
  const base = (1020 + 56) * v.escala + v.y
  assert.ok(base <= 700, `o cartão de baixo ficou em ${Math.round(base)}px, fora dos 700px visíveis`)
  assert.ok(v.escala < 1, "sem piso, Centralizar reduz até caber")
})

test("fluxo alto demais para o chao da escala nao e espremido ate ficar ilegivel", () => {
  const enorme = fluxoBase()
  enorme.grupos[1].posicao = { x: 0, y: 8000 }
  const { hospedeiro, editor } = montar(enorme)
  // Abaixo de 0,25 os cartões viram manchas. Aí é melhor a pessoa arrastar.
  porClasse(hospedeiro, "ed__ajustar")[0].disparar("click")
  assert.equal(editor.vista().escala, 0.25)
})

test("o que ja cabe inteiro abre centrado, como sempre abriu", () => {
  const { editor } = montar()
  assert.equal(editor.vista().escala, 1, "fluxo pequeno não é ampliado nem reduzido")
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

  // A cópia nasce selecionada, e o original fica como estava.
  assert.equal(editor.selecao().grupo, fluxo.grupos.at(-1).id)
  assert.equal(editor.fluxo().grupos[0].blocos.length, 1)
})

test("excluir pela lixeira do ... apaga o grupo", () => {
  const { hospedeiro, editor } = montar()
  porClasse(hospedeiro, "ed__cabecalho-mais")[1].disparar("click", { clientX: 0, clientY: 0 })
  porClasse(hospedeiro, "ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos.map((g) => g.id), ["g1"])
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
  // A coluna começa nas seções, sem recado nenhum no alto: o arrasto se
  // descobre arrastando, e o aviso fixo só ocupava a tela.
  assert.equal(porClasse(hospedeiro, "ed__dica").length, 0)
  assert.equal(porClasse(hospedeiro, "ed__paleta-corpo")[0].filhos[0].className, "ed__lado-topo")
})

test("soltar um tipo sobre um cartao poe o bloco nele, sem clique nenhum", () => {
  const { hospedeiro, editor } = montar()
  const alvo = editor.fluxo().grupos[0]
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: alvo.posicao.x + 20, y: alvo.posicao.y + 20 }))
  assert.equal(editor.fluxo().grupos[0].blocos.length, 2)
  assert.equal(editor.fluxo().grupos.length, 2, "soltar no cartão não cria grupo")
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
  // bloco nele. Hoje clique nenhum acrescenta: ele só descola do menu.
  tipoDaPaleta(hospedeiro, "Texto").disparar("click")
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

test("as abas trocam o que aparece", () => {
  const { hospedeiro } = montar()
  const aba = (rotulo) => porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === rotulo)
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), false)

  aba("Tema").disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), true,
    "o canvas sai da frente")
  assert.equal(porClasse(hospedeiro, "ed__tema")[0].className.includes("ed__oculto"), false)
  assert.equal(porClasse(hospedeiro, "ed__aba--ativa")[0].textContent, "Tema")

  aba("Fluxo").disparar("click")
  assert.equal(porClasse(hospedeiro, "ed__area-canvas")[0].className.includes("ed__oculto"), false)
  assert.equal(porClasse(hospedeiro, "ed__tema")[0].className.includes("ed__oculto"), true)
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
    ["Texto", "Imagem", "Vídeo", "Áudio", "Incorporar"])
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
  assert.equal(new Set(desenhos).size, 5, "ícones iguais não distinguem nada")
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

function montarComLeads(linhas, fluxo = fluxoBase(), armazenamento = criarArmazenamento()) {
  const hospedeiro = new Elemento("div")
  const pedidos = []
  const editor = criarEditor({
    elemento: hospedeiro, fluxo, esperarNoTeste: async () => {}, armazenamento,
    aoBuscarLeads: async (chave) => {
      pedidos.push(chave)
      if (typeof linhas === "function") return linhas(chave)
      return linhas
    }
  })
  return { hospedeiro, editor, pedidos, armazenamento }
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
  // A coluna leva o nome do grupo, não o da pergunta: é assim que a pessoa
  // lê o fluxo.
  assert.deepEqual(porClasse(hospedeiro, "ed__tabela-cabecalho").map((c) => c.textContent),
    ["Quando", "Situação", "Abertura"])
  assert.deepEqual(porClasse(hospedeiro, "ed__tabela-celula").map((c) => c.textContent),
    ["02/10 11:05", "concluído", "Ana"])
})

test("sem ninguem ainda, a tabela ja mostra as colunas do fluxo", async () => {
  const f = fluxoBase()
  f.grupos[0].blocos.push(
    { id: "b_nome", tipo: "entrada_texto", salvar_em: "nome", conteudo: { rotulo: "Seu nome" } })
  const { hospedeiro } = montarComLeads([], f)
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = "segredo"
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()

  // A tabela fica pronta: quando o primeiro lead cair, ele entra como linha
  // embaixo do cabeçalho, sem nada mudar de lugar.
  assert.deepEqual(porClasse(hospedeiro, "ed__tabela-cabecalho").map((c) => c.textContent),
    ["Quando", "Situação", "Abertura"])
  const vazia = porClasse(hospedeiro, "ed__tabela-celula--vazia")[0]
  assert.ok(vazia, "a tabela precisa dizer que ainda não há ninguém")
  assert.match(vazia.textContent, /ninguém entrou/i)
  assert.equal(vazia.atributos.colspan, "3", "a frase atravessa a tabela inteira")
  assert.doesNotMatch(porClasse(hospedeiro, "ed__resultados-conta")[0].textContent, /pessoa/,
    "zero pessoas não se conta")
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

test("falhar ao atualizar mantem a tabela, mas datada e com o erro em cima", async () => {
  // A tabela velha fica porque ela é verdade — era assim às tantas horas. O
  // que não pode é passar por dado de agora, e é a hora da leitura que separa
  // uma coisa da outra.
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
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 1)
  assert.match(porClasse(hospedeiro, "ed__resultados-conta")[0].textContent, /lido em \d\d\/\d\d/,
    "tabela sem hora de leitura ao lado de um erro passa por dado de agora")
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

// --- a aba Tema ------------------------------------------------------------
// As cores da conversa, editadas ao lado da conversa. O que vale medir aqui é
// se a mexida chega ao chat sem reiniciá-lo e se ela é salva no tema.json.

const { SECOES: SECOES_DO_TEMA, COR_PADRAO } = await import("../editor/tema.js")

function montarComTema({
  tema = { cores: { acento: "#0c2340" }, avatar: "logo.svg", marca: "Osher" },
  responder = async () => {},
  comGravadorDeTema = true
} = {}) {
  const hospedeiro = new Elemento("div")
  const salvos = []
  const temasSalvos = []
  const baixados = []
  const editor = criarEditor({
    elemento: hospedeiro, fluxo: fluxoBase(), tema,
    pastaDoCliente: "../clientes/osher",
    aoBaixar: (t, n) => baixados.push({ t, n }),
    aoSalvar: async (texto) => { salvos.push(texto) },
    aoSalvarTema: comGravadorDeTema
      ? async (texto) => { temasSalvos.push(texto); return responder(texto) }
      : null,
    esperarNoTeste: async () => {}
  })
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Tema").disparar("click")
  return { hospedeiro, editor, salvos, temasSalvos, baixados }
}

// A aba tem três "Fundo", um por seção: achar um controle é dizer a seção e o
// rótulo, do mesmo jeito que a pessoa lê a tela.
const linhaDoTema = (h, secao, rotulo) =>
  porClasse(h, `ed__tema-secao--${secao}`)[0]
    .porClasse("ed__tema-linha").find((l) => l.textContent.startsWith(rotulo))
const corDaLinha = (h, secao, rotulo) => linhaDoTema(h, secao, rotulo).porClasse("ed__tema-cor")[0]
const soltarDaLinha = (h, secao, rotulo) => linhaDoTema(h, secao, rotulo).porClasse("ed__tema-soltar")[0]
const chatDaAba = (h) => porClasse(h, "cf")[0]
const desfazerPasso = (h) => porClasse(h, "ed__passo--desfazer")[0]

test("a aba Tema mostra as secoes no lugar da paleta de blocos", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  const titulos = porClasse(hospedeiro, "ed__categoria").map((h) => h.textContent)
  assert.deepEqual(titulos, SECOES_DO_TEMA.map((s) => s.titulo))
  assert.equal(porClasse(hospedeiro, "ed__tipo").length, 0,
    "arrastar bloco não leva a nada com o canvas escondido")
})

test("a aba Tema roda a conversa deste projeto do lado", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  assert.ok(chatDaAba(hospedeiro), "a aba deveria mostrar o chat")
  assert.match(porClasse(hospedeiro, "cf__thread")[0].textContent, /Olá/)
})

test("o campo de cor comeca na cor que a conversa mostra, herdada ou nao", async () => {
  const { hospedeiro } = montarComTema({ tema: { cores: { acento: "#112233" } } })
  await assentar()
  assert.equal(corDaLinha(hospedeiro, "campo", "Fundo").value, COR_PADRAO.superficie,
    "sem valor próprio, o campo de resposta mostra a superfície padrão")
  assert.equal(corDaLinha(hospedeiro, "falas", "Fundo").value, "#112233",
    "a fala do chat é o acento, que o tema declarou")
  assert.equal(corDaLinha(hospedeiro, "botoes", "Fundo").value, "#112233",
    "o botão sem cor própria segue o acento, como no CSS do motor")
})

test("trocar a cor chega na conversa sem reinicia-la", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  const antes = chatDaAba(hospedeiro)
  const falasAntes = porClasse(hospedeiro, "cf__bolha").length
  assert.ok(falasAntes > 0, "sem fala nenhuma o teste não prova nada")

  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff00ff"
  campo.disparar("input")

  assert.equal(chatDaAba(hospedeiro), antes, "a conversa foi remontada por causa de uma cor")
  assert.equal(porClasse(hospedeiro, "cf__bolha").length, falasAntes)
  assert.equal(antes.style.propriedades["--cf-superficie"], "#ff00ff")
  assert.equal(editor.temMudancas(), true)
})

test("o botao de voltar ao padrao so existe depois de escolher, e desfaz a escolha", async () => {
  const { hospedeiro } = montarComTema({ tema: { cores: {} } })
  await assentar()
  assert.equal(soltarDaLinha(hospedeiro, "conversa", "Fundo das caixas").disabled, true,
    "nada a soltar enquanto a cor é herdada")

  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff00ff"
  campo.disparar("input")
  const soltar = soltarDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  assert.equal(soltar.disabled, false)

  soltar.disparar("click")
  assert.equal(campo.value, COR_PADRAO.superficie, "o campo volta a mostrar o padrão")
  assert.equal("--cf-superficie" in chatDaAba(hospedeiro).style.propriedades, false,
    "a cor solta tem de sair do elemento, senão fica grudada")
  assert.equal(soltar.disabled, true)
})

test("a largura sai no slider, com unidade e medida na tela", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: {} } })
  await assentar()
  const linha = linhaDoTema(hospedeiro, "conversa", "Largura máxima")
  const faixa = linha.porClasse("ed__tema-faixa")[0]
  assert.equal(faixa.value, "48", "sem tema, começa no padrão do motor")
  faixa.value = "60"
  faixa.disparar("input")
  assert.equal(linha.porClasse("ed__tema-medida")[0].textContent, "60rem")
  assert.equal(chatDaAba(hospedeiro).style.propriedades["--cf-coluna"], "60rem")
  assert.equal(JSON.parse(JSON.stringify(editor.tema())).largura, "60rem")
})

test("a marca e o retrato remontam a conversa, mas so quando termina de escrever", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  const antes = chatDaAba(hospedeiro)
  const campo = linhaDoTema(hospedeiro, "retrato", "Nome da marca").porClasse("ed__tema-texto")[0]
  campo.value = "Outra"
  campo.disparar("input")
  assert.equal(chatDaAba(hospedeiro), antes, "remontar a cada letra jogaria a conversa para o início")
  assert.equal(editor.tema().marca, "Outra")

  campo.disparar("change")
  await assentar()
  assert.notEqual(chatDaAba(hospedeiro), antes, "o chat lê a marca ao nascer: precisa renascer")
})

test("o retrato tem interruptor, e religar nao pede o caminho de novo", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  const chave = () => linhaDoTema(hospedeiro, "retrato", "Mostrar retrato").porClasse("ed__tema-chave")[0]
  assert.equal(chave().className.includes("ed__tema-chave--ligado"), true)

  chave().disparar("click")
  await assentar()
  assert.equal("avatar" in editor.tema(), false, "retrato desligado sai do tema.json")
  assert.equal(porClasse(hospedeiro, "cf__avatar").length, 0)

  chave().disparar("click")
  await assentar()
  assert.equal(editor.tema().avatar, "logo.svg", "o caminho de antes deveria voltar sozinho")
  assert.ok(porClasse(hospedeiro, "cf__avatar").length > 0)
})

test("o retrato do tema vira o caminho que esta pagina consegue abrir", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  assert.equal(porClasse(hospedeiro, "cf__avatar")[0].src, "../clientes/osher/logo.svg")
  assert.equal(editor.tema().avatar, "logo.svg", "o tema gravado continua relativo ao cliente")
})

test("salvar manda o tema para o gravador do tema, e so ele", async () => {
  const { hospedeiro, editor, salvos, temasSalvos } = montarComTema()
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff00ff"
  campo.disparar("input")

  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  assert.equal(salvos.length, 0, "o fluxo não mudou: não tinha o que gravar")
  assert.equal(temasSalvos.length, 1)
  assert.equal(JSON.parse(temasSalvos[0]).cores.superficie, "#ff00ff")
  assert.equal(editor.temMudancas(), false)
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
})

test("sem gravador de tema, salvar baixa o tema.json em vez de perder a cor", async () => {
  const { hospedeiro, baixados, editor } = montarComTema({ comGravadorDeTema: false })
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff00ff"
  campo.disparar("input")
  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()

  assert.equal(baixados.length, 1)
  assert.equal(baixados[0].n, "tema.json")
  assert.equal(JSON.parse(baixados[0].t).cores.superficie, "#ff00ff")
  assert.equal(editor.temMudancas(), true, "não gravou: continua pendente")
})

test("desfazer volta a cor de antes", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: { acento: "#112233" } } })
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff00ff"
  campo.disparar("input")
  assert.equal(editor.tema().cores.superficie, "#ff00ff")

  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal("superficie" in editor.tema().cores, false, "desfazer deveria devolver o tema de antes")
  assert.equal(corDaLinha(hospedeiro, "conversa", "Fundo das caixas").value, COR_PADRAO.superficie)
  assert.equal(editor.temMudancas(), false)
})

test("arrastar o seletor de cor e um passo de desfazer, nao um por tom", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: {} } })
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  for (const tom of ["#ff0000", "#ff3300", "#ff6600"]) {
    campo.value = tom
    campo.disparar("input")
  }
  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal("superficie" in editor.tema().cores, false,
    "um desfazer deveria apagar o arrastão inteiro")
})

test("sair da aba desmonta a conversa de exemplo", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  assert.ok(chatDaAba(hospedeiro))
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Fluxo").disparar("click")
  assert.equal(porClasse(hospedeiro, "cf").length, 0,
    "chat escondido atrás de outra aba continua contando o tempo")
})

test("o Testar mostra o chat com as cores do cliente", async () => {
  const hospedeiro = new Elemento("div")
  criarEditor({
    elemento: hospedeiro, fluxo: fluxoBase(),
    tema: { cores: { acento: "#112233" }, avatar: "logo.svg" },
    pastaDoCliente: "../clientes/osher",
    esperarNoTeste: async () => {}
  })
  porClasse(hospedeiro, "ed__testar")[0].disparar("click")
  await assentar()
  const chat = porClasse(hospedeiro, "ed__preview")[0].porClasse("cf")[0]
  assert.equal(chat.style.propriedades["--cf-acento"], "#112233",
    "testar com as cores do motor mostraria um chat que não existe")
  assert.equal(porClasse(hospedeiro, "cf__avatar")[0].src, "../clientes/osher/logo.svg")
})

test("mexer so no fluxo nao reescreve o tema.json", async () => {
  const { hospedeiro, salvos, temasSalvos } = montarComTema()
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Fluxo").disparar("click")
  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Outro nome"
  campo.disparar("input")

  porClasse(hospedeiro, "ed__salvar")[0].disparar("click")
  await assentar()
  assert.equal(salvos.length, 1)
  assert.equal(temasSalvos.length, 0,
    "tema gravado sem ninguém ter tocado nele dá commit de tema em dia que ninguém mexeu nele")
})

test("desfazer volta um passo do tema, nao ao tema do comeco", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: {} } })
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff0000"
  campo.disparar("input")
  const outro = corDaLinha(hospedeiro, "falas", "Fundo")
  outro.value = "#00ff00"
  outro.disparar("input")

  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal(editor.tema().cores.superficie, "#ff0000",
    "desfazer a segunda cor levou a primeira junto")
  assert.equal("acento" in editor.tema().cores, false)
})

test("refazer traz a cor desfeita de volta", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: {} } })
  await assentar()
  const campo = corDaLinha(hospedeiro, "conversa", "Fundo das caixas")
  campo.value = "#ff0000"
  campo.disparar("input")
  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal("superficie" in editor.tema().cores, false)

  porClasse(hospedeiro, "ed__passo--refazer")[0].disparar("click")
  await assentar()
  assert.equal(editor.tema().cores.superficie, "#ff0000")
  assert.equal(chatDaAba(hospedeiro).style.propriedades["--cf-superficie"], "#ff0000",
    "a conversa tem de voltar junto com o tema")
})

test("o interruptor religa no retrato de agora, nao no que abriu com o editor", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  const campo = linhaDoTema(hospedeiro, "retrato", "Imagem").porClasse("ed__tema-texto")[0]
  campo.value = "outra.svg"
  campo.disparar("input")
  campo.disparar("change")
  await assentar()

  const chave = () => linhaDoTema(hospedeiro, "retrato", "Mostrar retrato").porClasse("ed__tema-chave")[0]
  chave().disparar("click")
  await assentar()
  chave().disparar("click")
  await assentar()
  assert.equal(editor.tema().avatar, "outra.svg", "religou na imagem antiga")
})

test("trocar a cor que outras seguem atualiza o seletor delas", async () => {
  const { hospedeiro } = montarComTema({ tema: { cores: { acento: "#0c2340" } } })
  await assentar()
  assert.equal(corDaLinha(hospedeiro, "botoes", "Fundo").value, "#0c2340")

  const fala = corDaLinha(hospedeiro, "falas", "Fundo")
  fala.value = "#7a1f3d"
  fala.disparar("input")
  assert.equal(corDaLinha(hospedeiro, "botoes", "Fundo").value, "#7a1f3d",
    "o painel diria azul enquanto a conversa já está vinho")
})

test("cor propria nao e arrastada pela cor que ela so poderia seguir", async () => {
  const { hospedeiro } = montarComTema({ tema: { cores: { acento: "#0c2340", botao: "#112233" } } })
  await assentar()
  const fala = corDaLinha(hospedeiro, "falas", "Fundo")
  fala.value = "#7a1f3d"
  fala.disparar("input")
  assert.equal(corDaLinha(hospedeiro, "botoes", "Fundo").value, "#112233")
})

test("o campo da imagem so aparece com o retrato ligado", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  const campoDaImagem = () => linhaDoTema(hospedeiro, "retrato", "Imagem")
  assert.ok(campoDaImagem())

  linhaDoTema(hospedeiro, "retrato", "Mostrar retrato").porClasse("ed__tema-chave")[0].disparar("click")
  await assentar()
  assert.equal(campoDaImagem(), undefined, "campo vazio sob interruptor desligado só faz perguntar para quê")
})

test("ligar o retrato sem imagem nenhuma abre o campo em vez de nao fazer nada", async () => {
  const { hospedeiro } = montarComTema({ tema: { cores: {} } })
  await assentar()
  const chave = () => linhaDoTema(hospedeiro, "retrato", "Mostrar retrato").porClasse("ed__tema-chave")[0]
  assert.equal(chave().className.includes("--ligado"), false)

  chave().disparar("click")
  await assentar()
  assert.equal(chave().className.includes("--ligado"), true, "o interruptor voltou sozinho para desligado")
  assert.ok(linhaDoTema(hospedeiro, "retrato", "Imagem"), "o campo da imagem é o próximo passo")
})

test("desfazer devolve o interruptor ao que o tema diz", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  const chave = () => linhaDoTema(hospedeiro, "retrato", "Mostrar retrato").porClasse("ed__tema-chave")[0]
  chave().disparar("click")
  await assentar()
  assert.equal(chave().className.includes("--ligado"), false)

  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal(chave().className.includes("--ligado"), true,
    "o tema voltou a ter retrato, o interruptor tem de voltar junto")
  assert.ok(linhaDoTema(hospedeiro, "retrato", "Imagem"))
})

// --- a lista de fontes -----------------------------------------------------

const { FONTES } = await import("../editor/fontes.js")
const listaDeFontes = (h) => linhaDoTema(h, "conversa", "Fonte").porClasse("ed__tema-lista")[0]

test("a fonte sai de uma lista, com a do cliente ja escolhida", async () => {
  const { hospedeiro } = montarComTema({
    tema: { fonte: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }
  })
  await assentar()
  const lista = listaDeFontes(hospedeiro)
  assert.deepEqual(lista.porClasse("ed__tema-opcao").map((o) => o.textContent),
    FONTES.map((f) => f.nome))
  assert.equal(lista.value, "Open Sans")
})

test("cada nome da lista aparece na sua propria letra", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  const opcoes = listaDeFontes(hospedeiro).porClasse("ed__tema-opcao")
  for (const [i, opcao] of opcoes.entries()) {
    assert.equal(opcao.style.propriedades["font-family"], FONTES[i].familia,
      "quinze nomes na mesma letra não ajudam a escolher")
  }
})

test("escolher uma fonte troca a familia e a folha, e chega na conversa", async () => {
  const { hospedeiro, editor } = montarComTema()
  await assentar()
  const antes = chatDaAba(hospedeiro)
  const lista = listaDeFontes(hospedeiro)
  lista.value = "Poppins"
  lista.disparar("change")

  assert.match(editor.tema().fonte, /^'Poppins'/)
  assert.match(editor.tema().fonte_url, /family=Poppins/)
  assert.equal(chatDaAba(hospedeiro), antes, "trocar de fonte não precisa reiniciar a conversa")
  assert.match(antes.style.fontFamily, /^'Poppins'/)
  assert.equal(editor.temMudancas(), true)
})

test("o padrao do sistema tira a folha, e a conversa deixa de pedi-la", async () => {
  const { hospedeiro, editor } = montarComTema({
    tema: { fonte: "'Poppins', sans-serif", fonte_url: "https://exemplo/poppins" }
  })
  await assentar()
  const lista = listaDeFontes(hospedeiro)
  lista.value = "Padrão do sistema"
  lista.disparar("change")
  assert.equal("fonte_url" in editor.tema(), false)
  assert.equal(listaDeFontes(hospedeiro).value, "Padrão do sistema")
})

test("fonte escrita a mao no tema.json aparece como personalizada e nao e apagada", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { fonte: "'Comic Sans MS', cursive" } })
  await assentar()
  const lista = listaDeFontes(hospedeiro)
  const ultima = lista.porClasse("ed__tema-opcao").at(-1)
  assert.match(ultima.textContent, /Personalizada: 'Comic Sans MS'/)
  assert.equal(lista.value, "personalizada")
  assert.equal(editor.tema().fonte, "'Comic Sans MS', cursive", "a lista não pode atropelar a escolha de ninguém")

  lista.value = "Poppins"
  lista.disparar("change")
  assert.equal(listaDeFontes(hospedeiro).porClasse("ed__tema-opcao").length, FONTES.length,
    "trocada a fonte, a opção personalizada não tem mais o que guardar")
})

test("desfazer devolve a fonte de antes, na lista e na conversa", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: {} })
  await assentar()
  const lista = listaDeFontes(hospedeiro)
  lista.value = "Poppins"
  lista.disparar("change")

  desfazerPasso(hospedeiro).disparar("click")
  await assentar()
  assert.equal("fonte" in editor.tema(), false)
  assert.equal(listaDeFontes(hospedeiro).value, "Padrão do sistema")
})

// --- a última leitura fica no navegador ------------------------------------
// Abrir a aba para conferir um telefone não deveria custar uma viagem à
// planilha de alguns segundos. A cópia guardada aparece na hora; a planilha é
// consultada por baixo e corrige a tabela quando responde.

const UMA_PESSOA = [{ atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "concluído", nome: "Ana" }]

async function comChave(hospedeiro, chave = "segredo") {
  abrirResultados(hospedeiro)
  porClasse(hospedeiro, "ed__chave-campo")[0].value = chave
  porClasse(hospedeiro, "ed__chave")[0].disparar("submit")
  await assentar()
}

test("a leitura fica guardada no navegador, com a hora", async () => {
  const { hospedeiro, armazenamento } = montarComLeads(UMA_PESSOA)
  await comChave(hospedeiro)
  const guardado = JSON.parse(armazenamento.getItem("chatflow:leads:exemplo"))
  assert.deepEqual(guardado.linhas, UMA_PESSOA)
  assert.match(guardado.em, /^\d{4}-\d\d-\d\dT/)
  assert.match(porClasse(hospedeiro, "ed__resultados-conta")[0].textContent,
    /1 pessoa .* lido em \d\d\/\d\d \d\d:\d\d/)
})

test("a copia guardada enche a tabela no instante em que a aba abre", async () => {
  const guardado = criarArmazenamento()
  const primeiro = montarComLeads(UMA_PESSOA, fluxoBase(), guardado)
  await comChave(primeiro.hospedeiro)

  // Segunda abertura, com a planilha lenta: a tabela não espera por ela.
  let soltar
  const segundo = montarComLeads(() => new Promise((r) => { soltar = r }), fluxoBase(), guardado)
  abrirResultados(segundo.hospedeiro)
  assert.equal(porClasse(segundo.hospedeiro, "ed__chave").length, 0, "a chave também ficou guardada")
  assert.equal(porClasse(segundo.hospedeiro, "ed__tabela").length, 1,
    "a cópia guardada existe: ninguém devia esperar a planilha para ver a tabela")
  assert.match(porClasse(segundo.hospedeiro, "ed__tabela")[0].textContent, /Ana/)
  assert.match(porClasse(segundo.hospedeiro, "ed__resultados-conta")[0].textContent, /buscando na planilha/)

  soltar([...UMA_PESSOA, { atualizadoEm: "2026-10-02T15:00:00.000Z", situacao: "em andamento", nome: "Bruno" }])
  await assentar()
  assert.match(porClasse(segundo.hospedeiro, "ed__tabela")[0].textContent, /Bruno/,
    "a resposta da planilha tem de corrigir a tabela")
  assert.equal(segundo.pedidos.length, 1, "uma viagem por sessão, não uma por desenho")
})

test("com a copia na tela, a planilha fora do ar nao apaga o que ja se sabia", async () => {
  const guardado = criarArmazenamento()
  await comChave(montarComLeads(UMA_PESSOA, fluxoBase(), guardado).hospedeiro)

  const segundo = montarComLeads(async () => { throw new Error("rede fora") }, fluxoBase(), guardado)
  abrirResultados(segundo.hospedeiro)
  await assentar()
  assert.match(porClasse(segundo.hospedeiro, "ed__tabela")[0].textContent, /Ana/)
  assert.match(porClasse(segundo.hospedeiro, "ed__resultados-conta")[0].textContent, /lido em /)
  assert.match(porClasse(segundo.hospedeiro, "ed__resultados-aviso")[0].textContent, /rede fora/)
})

test("trocar a chave esquece a copia guardada", async () => {
  const guardado = criarArmazenamento()
  const { hospedeiro, armazenamento } = montarComLeads(UMA_PESSOA, fluxoBase(), guardado)
  await comChave(hospedeiro)
  porClasse(hospedeiro, "ed__resultados-trocar")[0].disparar("click")
  assert.equal(armazenamento.getItem("chatflow:leads:exemplo"), null,
    "a chave saiu mas o telefone de todo mundo continuaria guardado neste navegador")
  assert.equal(porClasse(hospedeiro, "ed__tabela").length, 0)
})

test("copia estragada nao impede a aba de abrir", async () => {
  const guardado = criarArmazenamento()
  guardado.setItem("chatflow:leads:exemplo", "{isto não é json")
  const { hospedeiro } = montarComLeads(UMA_PESSOA, fluxoBase(), guardado)
  await comChave(hospedeiro)
  assert.match(porClasse(hospedeiro, "ed__tabela")[0].textContent, /Ana/)
})

test("navegador sem armazenamento: a aba funciona, so nao guarda", async () => {
  const semNada = {
    getItem() { throw new Error("armazenamento bloqueado") },
    setItem() { throw new Error("armazenamento bloqueado") },
    removeItem() { throw new Error("armazenamento bloqueado") }
  }
  const { hospedeiro } = montarComLeads(UMA_PESSOA, fluxoBase(), semNada)
  await comChave(hospedeiro)
  assert.match(porClasse(hospedeiro, "ed__tabela")[0].textContent, /Ana/)
})

test("planilha grande demais para caber guarda as mais recentes", async () => {
  const muitas = Array.from({ length: 500 }, (_, i) => ({
    atualizadoEm: "2026-10-02T14:05:00.000Z", situacao: "concluído", nome: `Pessoa ${i}`
  }))
  const dados = new Map()
  const apertado = {
    getItem: (c) => (dados.has(c) ? dados.get(c) : null),
    setItem: (c, v) => {
      if (String(v).length > 20000) throw new Error("QuotaExceededError")
      dados.set(c, String(v))
    },
    removeItem: (c) => dados.delete(c)
  }
  const { hospedeiro } = montarComLeads(muitas, fluxoBase(), apertado)
  await comChave(hospedeiro)
  const guardado = JSON.parse(apertado.getItem("chatflow:leads:exemplo"))
  assert.equal(guardado.linhas.length, 200)
  assert.equal(guardado.linhas[0].nome, "Pessoa 0", "guardou as mais antigas; a tabela abre pelas recentes")
  assert.equal(porClasse(hospedeiro, "ed__tabela-linha").length, 501, "a tabela desta sessão mostra todas")
})

test("o header nao mora na coluna do meio, e a paleta nao empurra nada", () => {
  // Era isto que fazia as abas deslizarem ao abrir Resultados: o header
  // estava dentro da coluna da direita, e a coluna da esquerda sumia.
  const { hospedeiro } = montarComLeads([])
  const raiz = porClasse(hospedeiro, "ed")[0]
  assert.deepEqual(raiz.filhos.map((f) => f.className).slice(0, 2), ["ed__barra", "ed__corpo"])

  const corpo = porClasse(hospedeiro, "ed__corpo")[0]
  assert.deepEqual(corpo.filhos.map((f) => f.className), ["ed__puxador", "ed__paleta", "ed__centro"],
    "a paleta flutua sobre o corpo, do lado do centro — nunca dentro dele")
  assert.equal(porClasse(hospedeiro, "ed__centro")[0].filhos.some((f) => f.className === "ed__barra"),
    false)
})

test("o header fica igual quando a paleta some na aba Resultados", () => {
  const { hospedeiro } = montarComLeads([])
  const antes = porClasse(hospedeiro, "ed__barra")[0]
  const posicaoDasAbas = antes.filhos.map((f) => f.className)

  abrirResultados(hospedeiro)
  assert.equal(porClasse(hospedeiro, "ed__paleta")[0].className.includes("ed__oculto"), true)
  assert.equal(porClasse(hospedeiro, "ed__barra")[0], antes, "o header nem foi remontado")
  assert.deepEqual(antes.filhos.map((f) => f.className), posicaoDasAbas)
})

test("soltar um tipo em cima da paleta nao cria grupo nenhum", () => {
  const { hospedeiro, editor } = montar()
  const quantos = editor.fluxo().grupos.length
  const paleta = porClasse(hospedeiro, "ed__paleta")[0]

  const tipo = tipoDaPaleta(hospedeiro, "Texto")
  tipo.disparar("mousedown", { button: 0, clientX: 40, clientY: 120 })
  document.disparar("mousemove", { clientX: 60, clientY: 300 })
  // Largar de volta no painel é desistir: criar um grupo ali o esconderia
  // atrás dele, e a pessoa concluiria que o editor engoliu o arrasto. O
  // mouseup cai num botão lá dentro, não no painel em si — é onde o cursor
  // está de verdade.
  const dentroDaPaleta = paleta.porClasse("ed__tipo")[1]
  dentroDaPaleta.disparar("mouseup", { clientX: 60, clientY: 300 })
  assert.equal(editor.fluxo().grupos.length, quantos)
})

test("centralizar poe o fluxo ao lado da paleta, nao atras dela", () => {
  const { hospedeiro, editor } = montar()
  const paleta = porClasse(hospedeiro, "ed__paleta")[0]
  const centralizar = () => porClasse(hospedeiro, "ed__ajustar")[0].disparar("click")

  // O navegador de mentira mede todo elemento igual; aqui a paleta ganha o
  // tamanho que tem de verdade na tela.
  paleta.clientWidth = 272
  centralizar()
  const comPaleta = editor.vista().x

  paleta.clientWidth = 0
  centralizar()
  const semPaleta = editor.vista().x
  assert.ok(comPaleta > semPaleta,
    "com o painel por cima, o fluxo tem de andar para a direita dele")

  // Na aba Resultados a paleta some, e painel escondido não tapa nada: o
  // fluxo volta ao meio da tela inteira.
  paleta.clientWidth = 272
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Resultados").disparar("click")
  centralizar()
  assert.equal(editor.vista().x, semPaleta)
})

// --- as seções da coluna da esquerda abrem e fecham ------------------------

const secao = (h, chave) => porClasse(h, `ed__secao--${chave}`)[0]
const fechada = (h, chave) => secao(h, chave).className.includes("ed__secao--fechada")

test("cada grupo da paleta e uma secao com seta, aberta de inicio", () => {
  const { hospedeiro } = montar()
  const secoes = porClasse(hospedeiro, "ed__secao")
  assert.deepEqual(secoes.map((s) => s.porClasse("ed__categoria")[0].textContent),
    ["Bolhas", "Entrada", "Lógica"])
  for (const s of secoes) {
    assert.equal(s.porClasse("ed__secao-topo")[0].atributos["aria-expanded"], "true")
    assert.ok(s.porClasse("ed__secao-corpo").length, "seção que já abre dobrada esconde o que ninguém viu ainda")
  }
})

test("clicar no titulo fecha a secao, e o conteudo some de verdade", () => {
  const { hospedeiro } = montar()
  const quantosTipos = porClasse(hospedeiro, "ed__tipo").length
  const bolhas = () => secao(hospedeiro, "fala")

  bolhas().porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(fechada(hospedeiro, "fala"), true)
  assert.equal(bolhas().porClasse("ed__secao-corpo").length, 0)
  assert.equal(bolhas().porClasse("ed__secao-topo")[0].atributos["aria-expanded"], "false")
  assert.ok(porClasse(hospedeiro, "ed__tipo").length < quantosTipos,
    "escondido por CSS continuaria no caminho do teclado e do arrasto")

  bolhas().porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(fechada(hospedeiro, "fala"), false)
  assert.equal(porClasse(hospedeiro, "ed__tipo").length, quantosTipos)
})

test("fechar uma secao nao mexe nas outras", () => {
  const { hospedeiro } = montar()
  secao(hospedeiro, "logica").porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(fechada(hospedeiro, "logica"), true)
  assert.equal(fechada(hospedeiro, "fala"), false)
  assert.equal(fechada(hospedeiro, "entrada"), false)
})

test("a secao fechada continua fechada na proxima vez que abrir o editor", () => {
  const guardado = criarArmazenamento()
  const primeiro = montar(fluxoBase(), guardado)
  secao(primeiro.hospedeiro, "logica").porClasse("ed__secao-topo")[0].disparar("click")

  const segundo = montar(fluxoBase(), guardado)
  assert.equal(fechada(segundo.hospedeiro, "logica"), true,
    "dobrar a mesma seção toda vez que abre seria pior que não poder dobrar")
  assert.equal(fechada(segundo.hospedeiro, "fala"), false)
})

test("o que se fecha no fluxo nao fecha nada no tema", async () => {
  const guardado = criarArmazenamento()
  const { hospedeiro } = montar(fluxoBase(), guardado)
  secao(hospedeiro, "fala").porClasse("ed__secao-topo")[0].disparar("click")

  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Tema").disparar("click")
  await assentar()
  assert.equal(fechada(hospedeiro, "falas"), false, "são colunas diferentes, com seções diferentes")
  assert.deepEqual(JSON.parse(guardado.getItem("chatflow:secoes")), { fluxo: ["fala"], tema: [] })

  secao(hospedeiro, "falas").porClasse("ed__secao-topo")[0].disparar("click")
  assert.deepEqual(JSON.parse(guardado.getItem("chatflow:secoes")), { fluxo: ["fala"], tema: ["falas"] },
    "o que se dobra no tema tem de ser guardado como do tema")

  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Fluxo").disparar("click")
  assert.equal(fechada(hospedeiro, "fala"), true, "voltar para o fluxo acha o que estava dobrado lá")
})

test("as secoes do tema tambem dobram, e a conversa segue viva", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  const chat = chatDaAba(hospedeiro)
  assert.ok(linhaDoTema(hospedeiro, "conversa", "Fundo"))

  secao(hospedeiro, "conversa").porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(secao(hospedeiro, "conversa").porClasse("ed__tema-linha").length, 0)
  assert.equal(chatDaAba(hospedeiro), chat, "dobrar um grupo de cores não reinicia a conversa")
  assert.ok(linhaDoTema(hospedeiro, "falas", "Fundo"), "as outras seções continuam lá")
})

test("cor de secao fechada nao some do tema, so da tela", async () => {
  const { hospedeiro, editor } = montarComTema({ tema: { cores: { acento: "#112233" } } })
  await assentar()
  secao(hospedeiro, "falas").porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(editor.tema().cores.acento, "#112233")
  assert.equal(chatDaAba(hospedeiro).style.propriedades["--cf-acento"], "#112233")
})

test("copia estragada do que esta fechado abre tudo, em vez de quebrar", () => {
  const guardado = criarArmazenamento()
  guardado.setItem("chatflow:secoes", "{isto não é json")
  const { hospedeiro } = montar(fluxoBase(), guardado)
  assert.equal(porClasse(hospedeiro, "ed__secao-corpo").length,
    porClasse(hospedeiro, "ed__secao").length)
})

// --- o painel preso ou solto -----------------------------------------------

const trava = (h) => porClasse(h, "ed__trava")[0]
const corpoDoEditor = (h) => porClasse(h, "ed__corpo")[0]

test("o painel comeca preso, e o cadeado diz isso", () => {
  const { hospedeiro } = montar()
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo")
  assert.equal(trava(hospedeiro).atributos["aria-pressed"], "true")
  assert.match(trava(hospedeiro).atributos.title, /Soltar o painel/)
})

test("soltar o painel deixa ele se recolher, e prender traz de volta", () => {
  const { hospedeiro } = montar()
  clicar(trava(hospedeiro))
  assert.match(corpoDoEditor(hospedeiro).className, /ed__corpo--solto/)
  assert.match(corpoDoEditor(hospedeiro).className, /ed__corpo--espiando/,
    "quem soltou está com o mouse no cadeado: o painel não pode fugir de baixo da mão")
  assert.equal(trava(hospedeiro).atributos["aria-pressed"], "false")
  assert.match(trava(hospedeiro).atributos.title, /Prender o painel/)

  clicar(trava(hospedeiro))
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo")
})

test("o painel solto continua solto na proxima vez que abrir o editor", () => {
  const guardado = criarArmazenamento()
  clicar(trava(montar(fluxoBase(), guardado).hospedeiro))
  assert.equal(guardado.getItem("chatflow:lado-preso"), "nao")

  const outro = montar(fluxoBase(), guardado)
  assert.match(corpoDoEditor(outro.hospedeiro).className, /ed__corpo--solto/)
  assert.equal(trava(outro.hospedeiro).atributos["aria-pressed"], "false")
})

test("na aba Resultados o painel nao existe, entao nao fica nem preso nem solto", () => {
  const { hospedeiro } = montarComLeads([])
  clicar(trava(hospedeiro))
  assert.match(corpoDoEditor(hospedeiro).className, /ed__corpo--solto/)

  abrirResultados(hospedeiro)
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo",
    "pílula na beira de uma tela sem painel só faria perguntar o que é aquilo")
})

test("o cadeado tambem esta no alto da aba Tema, e segue o mesmo estado", async () => {
  const { hospedeiro } = montarComTema()
  await assentar()
  assert.ok(trava(hospedeiro), "a coluna do tema é a mesma coluna")
  clicar(trava(hospedeiro))
  assert.match(corpoDoEditor(hospedeiro).className, /ed__corpo--solto/)
  assert.equal(trava(hospedeiro).atributos["aria-pressed"], "false")
})

test("com o painel solto, o mouse perto da beira o traz de volta", () => {
  const { hospedeiro } = montar()
  clicar(trava(hospedeiro))
  // O dublê mede tudo igual; aqui a paleta tem a largura que tem na tela.
  porClasse(hospedeiro, "ed__paleta")[0].clientWidth = 274
  const classe = () => corpoDoEditor(hospedeiro).className

  document.disparar("mousemove", { clientX: 600, clientY: 400 })
  assert.doesNotMatch(classe(), /espiando/, "o mouse saiu de perto: ele se recolhe")

  // Nem precisa encostar na pílula: chegar perto basta.
  document.disparar("mousemove", { clientX: 40, clientY: 400 })
  assert.match(classe(), /ed__corpo--espiando/)
})

test("o painel aberto so se recolhe quando o mouse se afasta dele", () => {
  const { hospedeiro } = montar()
  clicar(trava(hospedeiro))
  const paleta = porClasse(hospedeiro, "ed__paleta")[0]
  // O dublê mede tudo igual; aqui a paleta tem a largura que tem na tela.
  paleta.clientWidth = 274
  const classe = () => corpoDoEditor(hospedeiro).className

  document.disparar("mousemove", { clientX: 40, clientY: 400 })
  assert.match(classe(), /espiando/)

  document.disparar("mousemove", { clientX: 200, clientY: 400 })
  assert.match(classe(), /espiando/, "o mouse está dentro do painel: ele não pode fugir")

  document.disparar("mousemove", { clientX: 500, clientY: 400 })
  assert.doesNotMatch(classe(), /espiando/)
})

test("com o painel preso, mexer o mouse nao muda nada", () => {
  const { hospedeiro } = montar()
  document.disparar("mousemove", { clientX: 10, clientY: 400 })
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo")
})

test("prender o painel de volta o deixa parado, e o mouse passa a nao contar", () => {
  const { hospedeiro } = montar()
  clicar(trava(hospedeiro))
  document.disparar("mousemove", { clientX: 10, clientY: 400 })
  assert.match(corpoDoEditor(hospedeiro).className, /espiando/)

  clicar(trava(hospedeiro))
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo")
  document.disparar("mousemove", { clientX: 900, clientY: 400 })
  document.disparar("mousemove", { clientX: 10, clientY: 400 })
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo", "preso é preso")
})

test("na aba Resultados o mouse na beira nao chama painel nenhum", () => {
  const { hospedeiro } = montarComLeads([])
  clicar(trava(hospedeiro))
  document.disparar("mousemove", { clientX: 900, clientY: 400 })
  abrirResultados(hospedeiro)
  document.disparar("mousemove", { clientX: 10, clientY: 400 })
  assert.equal(corpoDoEditor(hospedeiro).className, "ed__corpo")

  // O clique na aba foi no header, longe da beira: o fluxo abre recolhido,
  // não com um espiar que sobrou de um mouse que passou em outra aba.
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Fluxo").disparar("click")
  assert.doesNotMatch(corpoDoEditor(hospedeiro).className, /espiando/)
})

test("trocar de aba com o painel aberto o recolhe: o clique foi no header", () => {
  const { hospedeiro } = montar()
  clicar(trava(hospedeiro))
  assert.match(corpoDoEditor(hospedeiro).className, /espiando/)
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Tema").disparar("click")
  assert.doesNotMatch(corpoDoEditor(hospedeiro).className, /espiando/)
})

test("com o painel preso, ou sem painel, o mouse nao custa medicao nenhuma", () => {
  // O caminho do mouse é percorrido centenas de vezes por minuto. Medir o
  // painel a cada mexida, com ele preso na tela, é trabalho jogado fora.
  const { hospedeiro } = montarComLeads([])
  const paleta = porClasse(hospedeiro, "ed__paleta")[0]
  let medidas = 0
  const medirDeVerdade = paleta.getBoundingClientRect.bind(paleta)
  paleta.getBoundingClientRect = () => { medidas++; return medirDeVerdade() }

  const mexer = () => {
    for (let i = 0; i < 5; i++) document.disparar("mousemove", { clientX: 10 + i, clientY: 400 })
  }
  mexer()
  assert.equal(medidas, 0, "o painel está preso: não há o que medir")

  clicar(trava(hospedeiro))
  abrirResultados(hospedeiro)
  mexer()
  assert.equal(medidas, 0, "nesta aba não existe painel para chamar de volta")
})

test("Excluir no ⋯ do bloco tira o bloco do fluxo, e cabe num desfazer", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  const blocosAntes = editor.fluxo().grupos[0].blocos.map((b) => b.id)
  assert.ok(blocosAntes.length > 1, "com um bloco só o teste não prova nada")

  porClasse(hospedeiro, "ed__bloco-mais")[0].disparar("click")
  porClasse(hospedeiro, "ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.id), blocosAntes.slice(1))
  assert.equal(editor.temMudancas(), true)

  desfazerPasso(hospedeiro).disparar("click")
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.id), blocosAntes,
    "apagar sem desfazer é uma armadilha")
})

test("apagar o bloco selecionado larga a selecao nele, nao num bloco fantasma", () => {
  const { hospedeiro, editor } = montar(comBotoes())
  const alvo = editor.fluxo().grupos[0].blocos[0].id
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  assert.equal(editor.selecao().bloco, alvo)

  porClasse(hospedeiro, "ed__bloco-mais")[0].disparar("click")
  porClasse(hospedeiro, "ed__acao--excluir")[0].disparar("click")
  assert.equal(editor.selecao().bloco, null)
  assert.equal(editor.selecao().grupo, "g1", "a seleção fica no grupo, que é onde a pessoa olha")
})

test("voltar aos projetos grava o que estava pendente", async () => {
  // Renomear e sair pela seta perdia o nome: ele vivia só na tela, e a lista
  // continuava mostrando o antigo.
  const { hospedeiro, editor, salvos } = montarComServidor()
  porClasse(hospedeiro, "ed__cabecalho-titulo")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__titulo-campo")[0]
  campo.value = "Outro nome"
  campo.disparar("input")
  assert.equal(editor.temMudancas(), true)

  await editor.salvar()
  assert.equal(salvos.length, 1)
  assert.equal(editor.temMudancas(), false, "depois de gravar, sair é seguro")
})

// --- a busca dos tipos -----------------------------------------------------

const campoDeBusca = (h) => porClasse(h, "ed__busca")[0]
const tiposNaTela = (h) => porClasse(h, "ed__tipo").map((b) => b.textContent.trim())

function procurar(h, termo) {
  const campo = campoDeBusca(h)
  campo.value = termo
  campo.disparar("input")
  return campo
}

test("a busca fica no alto da coluna, ao lado do cadeado", () => {
  const { hospedeiro } = montar()
  const topo = porClasse(hospedeiro, "ed__lado-topo")[0]
  assert.deepEqual(topo.filhos.map((f) => f.className.split(" ")[0]), ["ed__busca", "ed__trava"])
  assert.equal(campoDeBusca(hospedeiro).atributos.placeholder, "Procurar")
})

test("procurar deixa na tela so os tipos com aquelas letras", () => {
  const { hospedeiro } = montar()
  const todosOsTipos = tiposNaTela(hospedeiro)
  assert.ok(todosOsTipos.length > 10, "sem tipos o teste não prova nada")

  procurar(hospedeiro, "tele")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Telefone"])

  procurar(hospedeiro, "")
  assert.deepEqual(tiposNaTela(hospedeiro), todosOsTipos, "apagar a busca traz tudo de volta")
})

test("acento nao atrapalha quem digita com pressa", () => {
  const { hospedeiro } = montar()
  procurar(hospedeiro, "video")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Vídeo"])
  procurar(hospedeiro, "condi")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Condição"])
})

test("o nome do grupo tambem acha", () => {
  const { hospedeiro } = montar()
  procurar(hospedeiro, "bolhas")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Texto", "Imagem", "Vídeo", "Áudio", "Incorporar"])
  assert.deepEqual(porClasse(hospedeiro, "ed__categoria").map((e) => e.textContent), ["Bolhas"],
    "grupo sem nenhum achado não fica ocupando a coluna")
})

test("duas palavras estreitam a busca, nao alargam", () => {
  const { hospedeiro } = montar()
  procurar(hospedeiro, "texto")
  assert.equal(tiposNaTela(hospedeiro).length, 2, "há um Texto em Bolhas e outro em Entrada")
  procurar(hospedeiro, "entrada texto")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Texto"])
  assert.deepEqual(porClasse(hospedeiro, "ed__categoria").map((e) => e.textContent), ["Entrada"])
})

test("procurando, o grupo dobrado abre: achado escondido nao e achado", () => {
  const { hospedeiro } = montar()
  secao(hospedeiro, "entrada").porClasse("ed__secao-topo")[0].disparar("click")
  assert.equal(tiposNaTela(hospedeiro).some((n) => n === "Telefone"), false, "dobrado, some")

  procurar(hospedeiro, "tele")
  assert.deepEqual(tiposNaTela(hospedeiro), ["Telefone"])

  procurar(hospedeiro, "")
  assert.equal(tiposNaTela(hospedeiro).some((n) => n === "Telefone"), false,
    "apagada a busca, o grupo volta a estar dobrado como a pessoa deixou")
})

test("busca sem achado diz isso, em vez de uma coluna vazia", () => {
  const { hospedeiro } = montar()
  procurar(hospedeiro, "xyz")
  assert.deepEqual(tiposNaTela(hospedeiro), [])
  assert.match(porClasse(hospedeiro, "ed__sem-tipo")[0].textContent, /Nenhum tipo/)
})

test("digitar na busca nao refaz a coluna: o cursor fica onde estava", () => {
  // Refazer a paleta a cada tecla recria (ou ao menos remonta) o campo, e o
  // navegador tira o foco de elemento que muda de lugar na árvore. O dublê
  // não sente isso: o que ele prova é que a coluna não foi remontada.
  const { hospedeiro } = montar()
  const campoAntes = campoDeBusca(hospedeiro)
  const corpoAntes = porClasse(hospedeiro, "ed__paleta-corpo")[0]
  procurar(hospedeiro, "te")
  procurar(hospedeiro, "tel")
  assert.equal(campoDeBusca(hospedeiro), campoAntes)
  assert.equal(porClasse(hospedeiro, "ed__paleta-corpo")[0], corpoAntes,
    "só os tipos se redesenham a cada tecla")
  assert.equal(campoDeBusca(hospedeiro).value, "tel")
})

test("o tipo achado continua servindo para arrastar", () => {
  const { hospedeiro, editor } = montar()
  procurar(hospedeiro, "video")
  const alvo = editor.fluxo().grupos[0]
  arrastar(hospedeiro, "Vídeo", naJanela(hospedeiro, { x: alvo.posicao.x + 20, y: alvo.posicao.y + 20 }))
  assert.equal(editor.fluxo().grupos[0].blocos.at(-1).tipo, "video",
    "achar e não poder usar seria pior que não achar")
})

// --- soltar no meio do grupo, e não no fim ----------------------------------

const fluxoDeIdade = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Idade", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Qual a sua idade?" } },
      { id: "b2", tipo: "entrada_botoes", conteudo: {},
        opcoes: [{ id: "o1", rotulo: "18 a 30" }, { id: "o2", rotulo: "31 a 50" }] }
    ] }
  ]
})

// O meio da faixa de um bloco, em coordenadas de janela.
function sobreOBloco(hospedeiro, editor, grupoId, blocoId) {
  const c = caixasDoFluxo(cartoesDoFluxo(editor.fluxo())).get(grupoId)
  const b = c.blocos.find((x) => x.id === blocoId)
  return naJanela(hospedeiro, { x: c.x + 10, y: c.y + b.y + b.altura / 2 })
}

test("soltar sobre os botoes poe a bolha acima deles, nao no fim", () => {
  const { hospedeiro, editor } = montar(fluxoDeIdade())
  arrastar(hospedeiro, "Áudio", sobreOBloco(hospedeiro, editor, "g1", "b2"))
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.tipo),
    ["texto", "audio", "entrada_botoes"])
})

test("soltar sobre o primeiro bloco poe a bolha no topo do grupo", () => {
  const { hospedeiro, editor } = montar(fluxoDeIdade())
  arrastar(hospedeiro, "Vídeo", sobreOBloco(hospedeiro, editor, "g1", "b1"))
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.tipo),
    ["video", "texto", "entrada_botoes"])
})

test("solto no nome do grupo, continua indo para o fim", () => {
  const { hospedeiro, editor } = montar(fluxoDeIdade())
  const c = caixasDoFluxo(cartoesDoFluxo(editor.fluxo())).get("g1")
  arrastar(hospedeiro, "Texto", naJanela(hospedeiro, { x: c.x + 10, y: c.y + 4 }))
  assert.deepEqual(editor.fluxo().grupos[0].blocos.map((b) => b.tipo),
    ["texto", "entrada_botoes", "texto"])
})

test("enquanto a mao esta no ar, a marca mostra onde o bloco vai entrar", () => {
  const { hospedeiro, editor } = montar(fluxoDeIdade())
  const botao = tipoDaPaleta(hospedeiro, "Áudio")
  botao.disparar("mousedown", { button: 0, clientX: 5, clientY: 5 })
  document.disparar("mousemove", sobreOBloco(hospedeiro, editor, "g1", "b2"))

  const acesos = porClasse(hospedeiro, "ed__bloco")
    .filter((n) => /ed__bloco--acima/.test(n.className)).map((n) => n.dadosBloco)
  assert.deepEqual(acesos, ["b2"], "sem a marca, só se descobre onde caiu depois de soltar")

  document.disparar("keydown", { key: "Escape" })
  assert.deepEqual(porClasse(hospedeiro, "ed__bloco")
    .filter((n) => /ed__bloco--acima/.test(n.className)), [],
    "desistindo, a marca tem de apagar junto com o fantasma")
})

// --- as entradas que carregam mais que texto --------------------------------

const fluxoDeEscolhas = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [{ id: "g1", titulo: "Planos", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b1", tipo: "entrada_imagens", salvar_em: "plano", conteudo: {
      opcoes: [{ id: "o1", label: "Carro" }, { id: "o2", label: "Imóvel" }] } }] }]
})

test("escrever na caixa de uma opcao grava no fluxo, na opcao certa", () => {
  const { hospedeiro, editor } = montar(fluxoDeEscolhas())
  porClasse(hospedeiro, "ed__opcao-editar")[1].disparar("click")
  const campo = porClasse(hospedeiro, "ed__midia--opcao")[0].porClasse("ed__midia-campo")[0]
  campo.value = "casa.png"
  campo.disparar("input")
  const opcoes = editor.fluxo().grupos[0].blocos[0].conteudo.opcoes
  assert.equal(opcoes[1].imagem, "casa.png")
  assert.equal(opcoes[0].imagem, undefined, "escreveu na opção errada")
  assert.equal(opcoes[1].label, "Imóvel", "o texto do botão não pode ser atropelado")
})

test("editar a figura de uma opcao nao redesenha o cartao debaixo do cursor", () => {
  const { hospedeiro } = montar(fluxoDeEscolhas())
  porClasse(hospedeiro, "ed__opcao-editar")[0].disparar("click")
  const campo = porClasse(hospedeiro, "ed__midia--opcao")[0].porClasse("ed__midia-campo")[0]
  campo.value = "c"
  campo.disparar("input")
  assert.equal(porClasse(hospedeiro, "ed__midia--opcao").length, 1,
    "redesenhar fecharia a caixa a cada letra digitada")
})

test("a avaliacao se edita numa caixa: o texto e quantas estrelas", () => {
  const fluxo = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", titulo: "Nota", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "entrada_avaliacao", salvar_em: "nota", conteudo: {} }] }]
  }
  const { hospedeiro, editor } = montar(fluxo)
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const caixa = porClasse(hospedeiro, "ed__midia")[0]
  assert.ok(caixa, "sem caixa, não há onde dizer quantas estrelas")
  const numero = caixa.porClasse("ed__midia-numero-campo")[0]
  assert.equal(numero.value, "5", "cinco é o padrão, e a caixa tem de mostrá-lo")
  numero.value = "8"
  numero.disparar("input")
  numero.disparar("change")
  assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.maximo, 8)
})

test("a caixa da avaliacao prende o numero entre tres e dez", () => {
  const fluxo = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", titulo: "Nota", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "entrada_avaliacao", salvar_em: "nota", conteudo: {} }] }]
  }
  const { hospedeiro, editor } = montar(fluxo)
  porClasse(hospedeiro, "ed__bloco")[0].disparar("click")
  const numero = porClasse(hospedeiro, "ed__midia")[0].porClasse("ed__midia-numero-campo")[0]
  for (const [digitado, guardado] of [["99", 10], ["1", 3], ["0", 3]]) {
    numero.value = digitado
    numero.disparar("input")
    numero.disparar("change")
    assert.equal(editor.fluxo().grupos[0].blocos[0].conteudo.maximo, guardado,
      `digitou ${digitado}`)
  }
})
