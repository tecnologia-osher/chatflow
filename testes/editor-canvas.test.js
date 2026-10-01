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

// --- edição dentro do cartão -----------------------------------------------

function montarEditavel() {
  const hospedeiro = new Elemento("div")
  const edicoes = []
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoEditarCampo: (o) => edicoes.push(o),
    aoRenomearGrupo: (o) => edicoes.push(o)
  })
  canvas.desenhar(fluxo)
  return { hospedeiro, canvas, edicoes }
}

test("clicar no bloco abre a edicao ali mesmo", () => {
  const { hospedeiro } = montarEditavel()
  assert.equal(hospedeiro.porClasse("ed__bloco-campo").length, 0, "fechado até alguém clicar")
  hospedeiro.porClasse("ed__bloco")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__bloco-campo")[0]
  assert.ok(campo, "o bloco precisa virar caixa de texto no lugar")
  assert.equal(campo.value, "Olá")
})

test("digitar no bloco avisa qual campo mudou", () => {
  const { hospedeiro, edicoes } = montarEditavel()
  hospedeiro.porClasse("ed__bloco")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__bloco-campo")[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  assert.deepEqual(edicoes.at(-1), { grupo: "g1", bloco: "b1", campo: "texto", valor: "Bom dia" })
})

test("bloco sem campo principal nao vira caixa", () => {
  const { hospedeiro } = montarEditavel()
  const comBotoes = { ...fluxo, grupos: [{ id: "g1", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "bb", tipo: "entrada_botoes", salvar_em: "v", conteudo: { opcoes: [{ id: "o1", label: "Sim" }] } }] }] }
  const h2 = new Elemento("div")
  const c2 = criarCanvas({ elemento: h2 })
  c2.desenhar(comBotoes)
  h2.porClasse("ed__bloco")[0].disparar("click")
  assert.equal(h2.porClasse("ed__bloco-campo").length, 0,
    "opções não cabem numa caixa de texto — isso é trabalho do painel")
})

test("o titulo do grupo tambem se edita no cartao", () => {
  const { hospedeiro, edicoes } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("dblclick")
  const campo = hospedeiro.porClasse("ed__titulo-campo")[0]
  assert.equal(campo.value, "Abertura")
  campo.value = "Boas-vindas"
  campo.disparar("input")
  assert.deepEqual(edicoes.at(-1), { grupo: "g1", valor: "Boas-vindas" })
})

test("editar o titulo nao comeca um arrasto", () => {
  const { hospedeiro, canvas } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("dblclick")
  hospedeiro.porClasse("ed__titulo-campo")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 80, clientY: 0 })
  document.disparar("mouseup", {})
  assert.equal(canvas.vista().x, 0)
})

// --- opções dentro do cartão -----------------------------------------------

const comBotoes = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Idade", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b_id", tipo: "entrada_botoes", salvar_em: "idade", conteudo: { opcoes: [
        { id: "o1", label: "25-34" },
        { id: "o2", label: "35-44", proximo: "g2" }] } }] },
    { id: "g2", titulo: "Fim", posicao: { x: 400, y: 0 }, blocos: [] }
  ]
}

function montarBotoes() {
  const hospedeiro = new Elemento("div")
  const eventos = []
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoEditarOpcao: (o) => eventos.push({ tipo: "editar", ...o }),
    aoAcrescentarOpcao: (o) => eventos.push({ tipo: "acrescentar", ...o }),
    aoRemoverOpcao: (o) => eventos.push({ tipo: "remover", ...o })
  })
  canvas.desenhar(comBotoes)
  return { hospedeiro, canvas, eventos }
}

test("as opcoes aparecem empilhadas dentro do bloco, sem precisar selecionar", () => {
  const { hospedeiro } = montarBotoes()
  const linhas = hospedeiro.porClasse("ed__opcao-cartao")
  assert.equal(linhas.length, 2)
  assert.deepEqual(hospedeiro.porClasse("ed__opcao-campo").map((c) => c.value), ["25-34", "35-44"])
})

test("cada opcao tem o ponto de ligacao, marcado quando tem destino", () => {
  const { hospedeiro } = montarBotoes()
  const pontos = hospedeiro.porClasse("ed__opcao-ponto")
  assert.equal(pontos.length, 2)
  assert.equal(pontos[0].className.includes("ed__opcao-ponto--ligado"), false)
  assert.equal(pontos[1].className.includes("ed__opcao-ponto--ligado"), true)
})

test("digitar numa opcao avisa qual mudou", () => {
  const { hospedeiro, eventos } = montarBotoes()
  const campo = hospedeiro.porClasse("ed__opcao-campo")[0]
  campo.value = "18-24"
  campo.disparar("input")
  assert.deepEqual(eventos.at(-1), { tipo: "editar", grupo: "g1", bloco: "b_id", opcao: "o1", valor: "18-24" })
})

test("Enter pede uma opcao nova logo abaixo", () => {
  const { hospedeiro, eventos } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-campo")[0].disparar("keydown", { key: "Enter" })
  assert.deepEqual(eventos.at(-1), { tipo: "acrescentar", grupo: "g1", bloco: "b_id", apos: "o1" })
})

test("Enter com Shift nao cria opcao", () => {
  const { hospedeiro, eventos } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-campo")[0].disparar("keydown", { key: "Enter", shiftKey: true })
  assert.equal(eventos.length, 0)
})

test("apagar uma opcao vazia com Backspace remove a linha", () => {
  const { hospedeiro, eventos } = montarBotoes()
  const campo = hospedeiro.porClasse("ed__opcao-campo")[0]
  campo.value = ""
  campo.disparar("keydown", { key: "Backspace" })
  assert.deepEqual(eventos.at(-1), { tipo: "remover", grupo: "g1", bloco: "b_id", opcao: "o1" })
})

test("Backspace numa opcao escrita nao remove nada", () => {
  const { hospedeiro, eventos } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-campo")[0].disparar("keydown", { key: "Backspace" })
  assert.equal(eventos.length, 0)
})

test("escrever numa opcao nao arrasta o cartao nem seleciona", () => {
  const { hospedeiro, canvas } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-campo")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 0 })
  document.disparar("mouseup", {})
  assert.equal(canvas.vista().x, 0)
})

test("focarOpcao poe o cursor na caixa pedida", () => {
  const { hospedeiro, canvas } = montarBotoes()
  canvas.focarOpcao("b_id", "o2")
  assert.equal(document.focado, hospedeiro.porClasse("ed__opcao-campo")[1])
})

// --- arrastar a ligação de uma opção ---------------------------------------

function montarLigacao() {
  const hospedeiro = new Elemento("div")
  const ligacoes = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoLigarOpcao: (o) => ligacoes.push(o) })
  canvas.desenhar(comBotoes)
  return { hospedeiro, canvas, ligacoes }
}

test("arrastar o circulo ate outro grupo liga aquela opcao nele", () => {
  const { hospedeiro, ligacoes } = montarLigacao()
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  // g2 está em x=400,y=0 e o canvas abre enquadrado, então solta-se no centro dele
  document.disparar("mousemove", { clientX: 450, clientY: 30 })
  document.disparar("mouseup", { clientX: 450, clientY: 30 })
  assert.deepEqual(ligacoes.at(-1), { grupo: "g1", bloco: "b_id", opcao: "o1", destino: "g2" })
})

test("enquanto arrasta, uma linha acompanha o cursor", () => {
  const { hospedeiro } = montarLigacao()
  assert.equal(hospedeiro.porClasse("ed__seta--arrastando").length, 0)
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 200, clientY: 100 })
  assert.equal(hospedeiro.porClasse("ed__seta--arrastando").length, 1,
    "sem o fio seguindo o cursor, ninguém sabe o que está ligando")
  document.disparar("mouseup", { clientX: 200, clientY: 100 })
  assert.equal(hospedeiro.porClasse("ed__seta--arrastando").length, 0, "o fio some ao soltar")
})

test("soltar no vazio nao liga nada e nao desliga o que havia", () => {
  const { hospedeiro, ligacoes } = montarLigacao()
  hospedeiro.porClasse("ed__opcao-ponto")[1].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 5000, clientY: 5000 })
  document.disparar("mouseup", { clientX: 5000, clientY: 5000 })
  assert.equal(ligacoes.length, 0, "soltar no nada não pode apagar uma ligação por acidente")
})

test("arrastar o circulo nao arrasta o cartao nem o fundo", () => {
  const { hospedeiro, canvas } = montarLigacao()
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 120, clientY: 60 })
  document.disparar("mouseup", { clientX: 120, clientY: 60 })
  assert.equal(canvas.vista().x, canvas.vista().x)
  assert.deepEqual(canvas.vista(), canvas.vista())
})

test("o canvas desconta a propria posicao na janela", () => {
  const hospedeiro = new Elemento("div")
  const ligacoes = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoLigarOpcao: (o) => ligacoes.push(o) })
  canvas.desenhar(comBotoes)
  // paleta de 272px à esquerda e barra de 57px em cima, como no navegador
  hospedeiro.porClasse("ed__palco")[0].deslocamento = { left: 272, top: 57 }

  const alvo = canvas.vista()
  const g2 = { x: 400 + 130, y: 0 + 28 }   // centro aproximado do cartão g2
  const naJanela = { x: g2.x * alvo.escala + alvo.x + 272, y: g2.y * alvo.escala + alvo.y + 57 }

  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 300, clientY: 100, button: 0 })
  document.disparar("mousemove", { clientX: naJanela.x, clientY: naJanela.y })
  document.disparar("mouseup", { clientX: naJanela.x, clientY: naJanela.y })

  assert.equal(ligacoes.at(-1)?.destino, "g2",
    "sem descontar a origem do palco, a ligação cai num grupo que não é o de baixo do cursor")
})
