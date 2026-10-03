// O canvas desenhado, dirigido no navegador de mentira.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { criarCanvas } = await import("../editor/canvas.js")
const { cartoes: cartoesDoFluxo, caixas } = await import("../editor/modelo.js")

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

test("a roda passeia pelo quadro, para cima e para os lados", () => {
  const { hospedeiro, canvas } = montar()
  const palco = hospedeiro.porClasse("ed__palco")[0]
  const escala = canvas.vista().escala

  palco.disparar("wheel", { deltaY: 120, clientX: 400, clientY: 300 })
  assert.deepEqual({ x: canvas.vista().x, y: canvas.vista().y }, { x: 0, y: -120 },
    "rolar para baixo leva o conteúdo para cima, como em qualquer mapa")

  palco.disparar("wheel", { deltaX: 80, deltaY: 0, clientX: 400, clientY: 300 })
  assert.deepEqual({ x: canvas.vista().x, y: canvas.vista().y }, { x: -80, y: -120 },
    "trackpad para o lado anda para o lado")
  assert.equal(canvas.vista().escala, escala, "rolar não pode mudar o tamanho do fluxo")
})

test("a pinça e o Ctrl+roda dão zoom, ancorados no cursor", () => {
  const { hospedeiro, canvas } = montar()
  const palco = hospedeiro.porClasse("ed__palco")[0]
  const antes = canvas.vista().escala
  // A pinça do trackpad chega ao navegador como wheel com ctrlKey — é assim
  // que ele conta um gesto de zoom.
  palco.disparar("wheel", { deltaY: -120, clientX: 400, clientY: 300, ctrlKey: true })
  assert.ok(canvas.vista().escala > antes)

  palco.disparar("wheel", { deltaY: 120, clientX: 400, clientY: 300, metaKey: true })
  assert.ok(canvas.vista().escala < antes || Math.abs(canvas.vista().escala - antes) < 0.001)
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
  hospedeiro.porClasse("ed__palco")[0].disparar("wheel",
    { deltaY: -120, clientX: 0, clientY: 0, ctrlKey: true })
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

test("um clique no nome do grupo abre a caixa de renomear ali mesmo", () => {
  const { hospedeiro, edicoes } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__titulo-campo")[0]
  assert.equal(campo.value, "Abertura")
  campo.value = "Boas-vindas"
  campo.disparar("input")
  assert.deepEqual(edicoes.at(-1), { grupo: "g1", valor: "Boas-vindas" })
})

test("editar o titulo nao comeca um arrasto", () => {
  const { hospedeiro, canvas } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
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
    aoSelecionar: (o) => eventos.push({ tipo: "selecionar", ...o }),
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
    .filter((l) => !l.className.includes("--nova"))
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
  const { hospedeiro, canvas, eventos } = montarBotoes()
  const campo = hospedeiro.porClasse("ed__opcao-campo")[0]
  campo.disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 0 })
  document.disparar("mouseup", {})
  campo.disparar("click")
  assert.equal(canvas.vista().x, 0)
  assert.equal(eventos.some((e) => e.tipo === "selecionar"), false)
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

// --- o cartão de Start -----------------------------------------------------

function montarComEventos(f = fluxo) {
  const hospedeiro = new Elemento("div")
  const avisos = []
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoLigarEvento: (o) => avisos.push({ tipo: "ligar", ...o }),
    aoMoverEvento: (o) => avisos.push({ tipo: "mover", ...o })
  })
  canvas.desenhar(f)
  return { hospedeiro, canvas, avisos }
}

test("o Start aparece como cartao, com bandeira", () => {
  const { hospedeiro } = montarComEventos()
  const start = hospedeiro.porClasse("ed__evento").find((e) => e.textContent.includes("Start"))
  assert.ok(start, "o fluxo precisa começar de algum lugar visível")
  assert.match(start.textContent, /⚑/)
})

test("fluxo do zero ja mostra o Start esperando ligacao", () => {
  const { hospedeiro } = montarComEventos({ versao: 2, grupos: [] })
  assert.equal(hospedeiro.porClasse("ed__evento").length, 1)
  assert.equal(hospedeiro.porClasse("ed__evento-ponto")[0].className.includes("ed__evento-ponto--ligado"), false)
})

test("a bola do Start puxa a ligacao ate um grupo", () => {
  const { hospedeiro, avisos } = montarComEventos()
  // g1 ocupa x 300–560, y 40–148; soltar dentro dele
  hospedeiro.porClasse("ed__evento-ponto")[0].disparar("mousedown", { clientX: 230, clientY: 64, button: 0 })
  document.disparar("mousemove", { clientX: 350, clientY: 60 })
  document.disparar("mouseup", { clientX: 350, clientY: 60 })
  assert.deepEqual(avisos.at(-1), { tipo: "ligar", evento: "inicio", destino: "g1" })
})

test("arrastar o Start reposiciona o cartao dele", () => {
  const { hospedeiro, avisos } = montarComEventos()
  hospedeiro.porClasse("ed__evento")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 40, clientY: 25 })
  document.disparar("mouseup", {})
  const movido = avisos.filter((a) => a.tipo === "mover").at(-1)
  assert.equal(movido?.evento, "inicio")
  assert.ok(Number.isFinite(movido?.x))
})

test("a seta do inicio sai do cartao de Start, nao do nada", async () => {
  const { hospedeiro } = montarComEventos()
  const doEvento = hospedeiro.porClasse("ed__seta--evento")
  assert.ok(doEvento.length > 0)
  const caminho = doEvento[0].atributos.d
  // O Start está em x=40,y=40 e tem 190x48: a seta parte da bolinha dele, que
  // fica à direita da borda, a CARTAO_CONECTOR dela.
  const { MEDIDAS } = await import("../editor/modelo.js")
  assert.ok(caminho.startsWith(`M ${230 + MEDIDAS.CARTAO_CONECTOR} 64`), caminho)
})

// --- a saída do grupo ------------------------------------------------------

function montarSaida(f = fluxo) {
  const hospedeiro = new Elemento("div")
  const ligacoes = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoLigarGrupo: (o) => ligacoes.push(o) })
  canvas.desenhar(f)
  return { hospedeiro, canvas, ligacoes }
}

test("todo grupo tem a bolinha de saida, inclusive o que ainda nao liga em nada", () => {
  const { hospedeiro } = montarSaida()
  const pontos = hospedeiro.porClasse("ed__grupo-ponto")
  assert.equal(pontos.length, hospedeiro.porClasse("ed__cartao").length)
})

test("a bolinha fica cheia quando o grupo ja tem proximo", () => {
  const { hospedeiro } = montarSaida()
  const pontos = hospedeiro.porClasse("ed__grupo-ponto")
  assert.equal(pontos[0].className.includes("ed__grupo-ponto--ligado"), true, "g1 vai para g2")
  assert.equal(pontos.at(-1).className.includes("ed__grupo-ponto--ligado"), false, "o último não liga em nada")
})

test("arrastar a bolinha de saida liga o grupo", () => {
  const { hospedeiro, ligacoes } = montarSaida()
  // g2 ocupa x 700–960, y 40–...
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 750, clientY: 60 })
  document.disparar("mouseup", { clientX: 750, clientY: 60 })
  assert.deepEqual(ligacoes.at(-1), { grupo: "g1", destino: "g2" })
})

test("arrastar a saida nao arrasta o cartao", () => {
  const { hospedeiro, canvas } = montarSaida()
  const antes = canvas.vista()
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 40 })
  document.disparar("mouseup", { clientX: 90, clientY: 40 })
  assert.deepEqual(canvas.vista(), antes)
})

test("sem botoes, a saida e so a bolinha: nao ha padrao a nomear", () => {
  const { hospedeiro } = montarSaida()
  assert.equal(hospedeiro.porClasse("ed__rodape-rotulo").length, 0,
    "palavra que não distingue nada é ruído")
  assert.equal(hospedeiro.porClasse("ed__grupo-ponto").length,
    hospedeiro.porClasse("ed__cartao").length, "a bolinha continua em todo cartão")
})

test("o rodape do cartao com botoes explica que opcao sem destino cai nele", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comBotoes)
  const rodape = hospedeiro.porClasse("ed__cartao")[0].porClasse("ed__rodape")[0]
  assert.match(rodape.atributos.title || "", /sem destino/i)
})

// --- o padrão como botão ---------------------------------------------------

test("a lista fecha com um + botao, que nao e caixa de digitar nem bolinha", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comBotoes)
  const ultima = hospedeiro.porClasse("ed__opcao-cartao").at(-1)
  assert.ok(ultima.className.includes("ed__opcao-cartao--nova"), "o + botão fecha a lista")
  assert.match(ultima.textContent, /botão/i)
  assert.equal(ultima.porClasse("ed__opcao-campo").length, 0, "não é caixa de digitar")
  assert.equal(ultima.porClasse("ed__grupo-ponto").length, 0,
    "a saída do grupo não mora aqui: um controle, um trabalho")
})

test("o + botao acrescenta uma opcao no fim da lista", () => {
  const { hospedeiro, eventos } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-nova")[0].disparar("click")
  assert.deepEqual(eventos.at(-1),
    { tipo: "acrescentar", grupo: "g1", bloco: "b_id", apos: "o2" })
})

test("o + botao nao seleciona nem arrasta o cartao", () => {
  const { hospedeiro, canvas, eventos } = montarBotoes()
  const antes = canvas.vista()
  const mais = hospedeiro.porClasse("ed__opcao-nova")[0]
  mais.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 60 })
  document.disparar("mouseup", { clientX: 90, clientY: 60 })
  assert.deepEqual(canvas.vista(), antes)
  assert.equal(eventos.some((e) => e.tipo === "selecionar"), false)
})

test("todo cartao tem uma saida so, no rodape, com ou sem botoes", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comBotoes)
  for (const cartao of hospedeiro.porClasse("ed__cartao")) {
    assert.equal(cartao.porClasse("ed__rodape").length, 1)
    assert.equal(cartao.porClasse("ed__grupo-ponto").length, 1)
    assert.equal(cartao.porClasse("ed__rodape")[0].porClasse("ed__grupo-ponto").length, 1,
      "a bolinha de saída fica no rodapé")
  }
})

test("padrao aparece so onde ha botoes, que e onde ele significa algo", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comBotoes)
  const [comOpcoes, semOpcoes] = hospedeiro.porClasse("ed__cartao")

  assert.match(comOpcoes.porClasse("ed__rodape-rotulo")[0].textContent, /padrão/i,
    "com botões, é por ali que segue quem não tem destino próprio")
  assert.equal(semOpcoes.porClasse("ed__rodape-rotulo").length, 0)
  assert.equal(semOpcoes.porClasse("ed__grupo-ponto").length, 1, "a bolinha fica")
})

test("cada bloco de botoes tem o seu + botao, e a saida do cartao segue uma", () => {
  const dois = { ...comBotoes, grupos: [{ ...comBotoes.grupos[0], blocos: [
    comBotoes.grupos[0].blocos[0],
    { id: "b2", tipo: "entrada_botoes", salvar_em: "outra",
      conteudo: { opcoes: [{ id: "p1", label: "Sim" }] } }] }, comBotoes.grupos[1]] }
  const hospedeiro = new Elemento("div")
  const eventos = []
  criarCanvas({ elemento: hospedeiro, aoAcrescentarOpcao: (o) => eventos.push(o) }).desenhar(dois)
  assert.equal(hospedeiro.porClasse("ed__opcao-nova").length, 2, "um + botão por bloco de botões")
  assert.equal(hospedeiro.porClasse("ed__cartao")[0].porClasse("ed__grupo-ponto").length, 1,
    "duas saídas no mesmo cartão viram dois caminhos imaginários")
  hospedeiro.porClasse("ed__opcao-nova")[1].disparar("click")
  assert.equal(eventos.at(-1).bloco, "b2", "cada + botão acrescenta no bloco dele")
})

test("sair de uma opcao vazia desfaz a linha: a lista volta ao padrao", () => {
  const { hospedeiro, eventos } = montarBotoes()
  const campo = hospedeiro.porClasse("ed__opcao-campo")[0]
  campo.value = ""
  campo.disparar("blur")
  assert.deepEqual(eventos.at(-1), { tipo: "remover", grupo: "g1", bloco: "b_id", opcao: "o1" })
})

test("sair de uma opcao escrita nao apaga nada", () => {
  const { hospedeiro, eventos } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-campo")[0].disparar("blur")
  assert.equal(eventos.some((e) => e.tipo === "remover"), false)
})

test("so o espaco nao conta como botao preenchido", () => {
  const { hospedeiro, eventos } = montarBotoes()
  const campo = hospedeiro.porClasse("ed__opcao-campo")[0]
  campo.value = "   "
  campo.disparar("blur")
  assert.equal(eventos.at(-1).tipo, "remover")
})

test("puxar a ligacao de uma opcao vazia nao a perde pelo caminho", () => {
  const { hospedeiro } = montarBotoes()
  let segurouOFoco = false
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", {
    clientX: 0, clientY: 0, button: 0, preventDefault() { segurouOFoco = true }
  })
  document.disparar("mouseup", { clientX: 0, clientY: 0 })
  // Sem preventDefault o clique no círculo tira o foco da caixa, ela sai
  // vazia e a opção que se estava ligando desaparece no meio do arrasto.
  assert.equal(segurouOFoco, true)
})

// --- onde um ponto da janela cai no fluxo -----------------------------------

test("alvoDe traduz o ponto da janela para o fluxo, descontando o palco", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.deslocamento = { left: 272, top: 57 }
  palco.clientWidth = 900
  palco.clientHeight = 600

  const vista = canvas.vista()
  const esperado = { x: 100, y: 100 }
  const naJanela = {
    clientX: esperado.x * vista.escala + vista.x + 272,
    clientY: esperado.y * vista.escala + vista.y + 57
  }
  const alvo = canvas.alvoDe(naJanela)
  assert.equal(alvo.dentro, true)
  assert.deepEqual(alvo.ponto, esperado)
})

test("alvoDe diz sobre qual grupo o ponto caiu", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  const caixa = [...caixas(cartoesDoFluxo(fluxo)).entries()][0]
  const dentro = { clientX: caixa[1].x + 10, clientY: caixa[1].y + 10 }
  assert.equal(canvas.alvoDe(dentro).grupo, caixa[0])
  assert.equal(canvas.alvoDe({ clientX: 10_000, clientY: 10_000 }).grupo, null)
})

test("alvoDe avisa quando o ponto nem esta no palco", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.deslocamento = { left: 272, top: 57 }
  palco.clientWidth = 900
  palco.clientHeight = 600
  assert.equal(canvas.alvoDe({ clientX: 100, clientY: 300 }).dentro, false,
    "100px está na paleta, antes do palco começar")
  assert.equal(canvas.alvoDe({ clientX: 500, clientY: 300 }).dentro, true)
})

test("clicar no nome nao seleciona o grupo: renomear nao e selecionar", () => {
  const hospedeiro = new Elemento("div")
  const selecoes = []
  criarCanvas({ elemento: hospedeiro, aoSelecionar: (s) => selecoes.push(s) }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  assert.deepEqual(selecoes, [])
})

test("a caixa de renomear nasce com o cursor dentro e o nome selecionado", () => {
  const { hospedeiro } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__titulo-campo")[0]
  assert.equal(document.focado, campo)
  assert.equal(campo.selectionStart, 0)
  assert.equal(campo.selectionEnd, "Abertura".length,
    "nome inteiro selecionado: digitar troca o nome, não acrescenta no fim")
})

test("arrastar o cartao pelo nome move o cartao e nao abre a caixa", () => {
  const { hospedeiro, canvas } = montarEditavel()
  const titulo = hospedeiro.porClasse("ed__cabecalho-titulo")[0]
  titulo.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 40 })
  document.disparar("mouseup", { clientX: 90, clientY: 40 })
  titulo.disparar("click")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 0,
    "quem arrastou não pediu para renomear")
})

test("tremida de mao sobre o nome ainda conta como clique", () => {
  const { hospedeiro } = montarEditavel()
  const titulo = hospedeiro.porClasse("ed__cabecalho-titulo")[0]
  titulo.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mousemove", { clientX: 11, clientY: 11 })
  document.disparar("mouseup", { clientX: 11, clientY: 11 })
  titulo.disparar("click")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 1)
})

test("o ... do cabecalho abre as acoes do grupo, nao um painel", () => {
  const hospedeiro = new Elemento("div")
  const pedidos = []
  criarCanvas({ elemento: hospedeiro, aoAbrirDetalhes: (o) => pedidos.push(o) }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-mais")[0].disparar("click", { clientX: 300, clientY: 80 })

  assert.deepEqual(pedidos, [], "o painel da direita saiu de cena")
  const menu = hospedeiro.porClasse("ed__menu-acoes")[0]
  assert.ok(menu, "a caixa de ações precisa aparecer")
  assert.equal(menu.style.propriedades.left, "300px", "ela nasce onde está o botão")
  assert.deepEqual(hospedeiro.porClasse("ed__acao").map((b) => b.atributos["aria-label"]),
    ["Duplicar", "Excluir"])
})

test("cada acao tem a sua dica escrita, para aparecer no passar do mouse", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-mais")[0].disparar("click", { clientX: 0, clientY: 0 })
  assert.deepEqual(hospedeiro.porClasse("ed__acao-dica").map((d) => d.textContent),
    ["Duplicar", "Excluir"])
  assert.equal(hospedeiro.porClasse("ed__acao-icone").length, 2, "ícone, não palavra, no botão")
})

test("duplicar avisa qual grupo copiar, e fecha a caixa", () => {
  const hospedeiro = new Elemento("div")
  const copiados = []
  criarCanvas({ elemento: hospedeiro, aoDuplicarGrupo: (o) => copiados.push(o) }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-mais")[0].disparar("click", { clientX: 0, clientY: 0 })
  hospedeiro.porClasse("ed__acao--duplicar")[0].disparar("click")
  assert.deepEqual(copiados, [{ grupo: "g1" }])
  assert.equal(hospedeiro.porClasse("ed__menu-acoes").length, 0)
})

test("a lixeira das acoes apaga o mesmo grupo", () => {
  const hospedeiro = new Elemento("div")
  const apagados = []
  criarCanvas({ elemento: hospedeiro, aoApagarGrupo: (o) => apagados.push(o) }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-mais")[1].disparar("click", { clientX: 0, clientY: 0 })
  hospedeiro.porClasse("ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(apagados, [{ grupo: "g2" }])
})

test("clicar no fundo fecha as acoes", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cabecalho-mais")[0].disparar("click", { clientX: 0, clientY: 0 })
  hospedeiro.porClasse("ed__palco")[0].disparar("mousedown", { clientX: 5, clientY: 5, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__menu-acoes").length, 0)
})

test("renomear continua funcionando depois de arrastar um cartao", () => {
  const { hospedeiro } = montarEditavel()
  // Arrasta o cartão pelo cabeçalho...
  hospedeiro.porClasse("ed__cabecalho")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 120, clientY: 60 })
  document.disparar("mouseup", { clientX: 120, clientY: 60 })
  // ...e depois clica no nome, com a sequência inteira que o mouse manda. Se
  // o arrasto anterior não for esquecido no mousedown, este clique é tratado
  // como arrasto e a caixa nunca abre.
  const titulo = hospedeiro.porClasse("ed__cabecalho-titulo")[0]
  titulo.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mouseup", { clientX: 10, clientY: 10 })
  titulo.disparar("click")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 1)
})

// --- seta com ponta, e o ímã -----------------------------------------------
// O fim de um caminho: o último par de coordenadas, seja reta ou curva.
const fimDoCaminho = (d) => {
  const n = d.match(/-?[\d.]+/g).map(Number)
  return { x: n[n.length - 2], y: n[n.length - 1] }
}


test("cada seta desenhada tem uma ponta, e da cor dela", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comBotoes)
  const linhas = hospedeiro.porClasse("ed__seta")
  const pontas = hospedeiro.porClasse("ed__ponta")
  assert.equal(pontas.length, linhas.length, "linha sem ponta não diz quem liga quem")
  const daOpcao = pontas.find((p) => p.className.includes("ed__ponta--opcao"))
  assert.ok(daOpcao, "a ponta precisa herdar o tipo da seta para herdar a cor")
  assert.match(daOpcao.atributos.d, /^M -?[\d.]+ -?[\d.]+ L/)
})

test("o fio arrastado tambem tem ponta, apontando para onde vai", () => {
  const { hospedeiro } = montarBotoes()
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 600, clientY: 400 })
  const ponta = hospedeiro.porClasse("ed__ponta--arrastando")[0]
  assert.ok(ponta, "fio sem ponta não mostra o sentido da ligação")
  document.disparar("mouseup", { clientX: 600, clientY: 400 })
  assert.equal(hospedeiro.porClasse("ed__ponta--arrastando").length, 0, "a ponta do fio precisa sumir")
})

test("chegar perto do cartao gruda o fio nele e acende o cartao", () => {
  const { hospedeiro, canvas } = montarBotoes()
  const caixa = caixas(cartoesDoFluxo(comBotoes)).get("g2")
  // 6px acima da borda de g2: fora do cartão, dentro da folga do ímã.
  const perto = { clientX: caixa.x + 10, clientY: caixa.y - 6 }
  hospedeiro.porClasse("ed__opcao-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", perto)

  const alvos = hospedeiro.porClasse("ed__cartao").filter((c) => c.className.includes("ed__cartao--alvo"))
  assert.equal(alvos.length, 1, "o ímã precisa acender o cartão que vai receber")
  const fio = hospedeiro.porClasse("ed__seta--arrastando")[0]
  assert.notEqual(fimDoCaminho(fio.atributos.d).x, perto.clientX,
    "grudado, o fio deixa o cursor e vai à borda")
  document.disparar("mouseup", perto)
  assert.equal(hospedeiro.porClasse("ed__cartao").filter((c) => c.className.includes("ed__cartao--alvo")).length, 0,
    "o aceso precisa apagar ao soltar")
})

test("soltar perto do cartao liga nele, sem precisar acertar dentro", () => {
  const { hospedeiro, ligacoes } = montarSaida()
  const caixa = caixas(cartoesDoFluxo(fluxo)).get("g2")
  const perto = { clientX: caixa.x - 6, clientY: caixa.y + 10 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", perto)
  document.disparar("mouseup", perto)
  assert.deepEqual(ligacoes.at(-1), { grupo: "g1", destino: "g2" })
})

test("longe de todo cartao o fio segue o cursor e nao liga nada", () => {
  const { hospedeiro, ligacoes } = montarSaida()
  const longe = { clientX: 5000, clientY: 5000 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", longe)
  const fio = hospedeiro.porClasse("ed__seta--arrastando")[0]
  assert.deepEqual(fimDoCaminho(fio.atributos.d), { x: 5000, y: 5000 })
  document.disparar("mouseup", longe)
  assert.deepEqual(ligacoes, [])
})

test("o fio solto tem os mesmos cantos da seta pronta, nao e uma reta", () => {
  const { hospedeiro } = montarSaida()
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 1200, clientY: 300 })
  const d = hospedeiro.porClasse("ed__seta--arrastando")[0].atributos.d
  assert.match(d, / Q /, "reta no arrasto e canto depois: o desenho muda de forma ao soltar")
  document.disparar("mouseup", { clientX: 1200, clientY: 300 })
})

test("o fio nasce na bolinha, para qualquer lado que o cursor va", async () => {
  const { MEDIDAS } = await import("../editor/modelo.js")
  const { hospedeiro } = montarSaida()
  const origem = caixas(cartoesDoFluxo(fluxo)).get("g1")
  const comeco = (d) => {
    const n = d.match(/-?[\d.]+/g).map(Number)
    return { x: n[0], y: n[1] }
  }
  const naBolinha = origem.x + origem.largura + MEDIDAS.CARTAO_CONECTOR
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })

  document.disparar("mousemove", { clientX: origem.x + 900, clientY: origem.y + 20 })
  assert.equal(comeco(hospedeiro.porClasse("ed__seta--arrastando")[0].atributos.d).x, naBolinha,
    "cursor à direita")

  document.disparar("mousemove", { clientX: origem.x - 400, clientY: origem.y + 20 })
  assert.equal(comeco(hospedeiro.porClasse("ed__seta--arrastando")[0].atributos.d).x, naBolinha,
    "cursor à esquerda: a bolinha continua sendo a mesma, na direita")
  document.disparar("mouseup", { clientX: origem.x - 400, clientY: origem.y + 20 })
})

test("o fio grudado e exatamente a seta que vai ficar", () => {
  const { hospedeiro, canvas, ligacoes } = montarSaida()
  const caixa = caixas(cartoesDoFluxo(fluxo)).get("g2")
  const dentro = { clientX: caixa.x + 30, clientY: caixa.y + 10 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", dentro)
  const doFio = hospedeiro.porClasse("ed__seta--arrastando")[0].atributos.d
  document.disparar("mouseup", dentro)

  // Desenha o fluxo já com a ligação feita: o caminho tem de ser o mesmo que
  // o fio mostrava. Se diferir, a linha "pula" no instante em que se solta.
  const ligado = JSON.parse(JSON.stringify(fluxo))
  ligado.grupos[0].proximo = ligacoes.at(-1).destino
  canvas.desenhar(ligado)
  const daSeta = hospedeiro.porClasse("ed__seta")
    .filter((s) => !s.className.includes("evento") && !s.className.includes("arrastando"))
    .map((s) => s.atributos.d)
  assert.ok(daSeta.includes(doFio), `o fio mostrava ${doFio}, e a seta virou ${daSeta.join(" | ")}`)
})

test("a ponta da seta gira com o lado por onde ela chega no cartao", () => {
  const empilhado = {
    versao: 2, eventos: [],
    grupos: [
      { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, proximo: "g2", blocos: [] },
      { id: "g2", titulo: "b", posicao: { x: 0, y: 400 }, blocos: [] }
    ]
  }
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(empilhado)
  const d = hospedeiro.porClasse("ed__ponta")[0].atributos.d
  const n = d.match(/-?[\d.]+/g).map(Number)
  // Cartões empilhados: a seta desce e entra por cima, então o bico fica
  // embaixo da base. Com a ponta presa num lado só, isto deita.
  assert.ok(n[3] < n[1] && n[5] < n[1], `ponta deitada: ${d}`)
  assert.notEqual(n[2], n[4], "a base tem largura na horizontal")
})

// --- ímã no bloco ----------------------------------------------------------

// g2 do fluxo base não tem bloco nenhum, e é justamente nos blocos do destino
// que o ímã mira.
const comMiolo = {
  versao: 2,
  eventos: [{ tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 300, y: 40 }, proximo: "g2", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] },
    { id: "g2", titulo: "Contato", posicao: { x: 700, y: 40 }, blocos: [
      { id: "b_fala", tipo: "texto", conteudo: { texto: "Prazer" } },
      { id: "b_fone", tipo: "entrada_telefone", salvar_em: "fone", conteudo: { rotulo: "Qual seu WhatsApp?" } }] }
  ]
}

test("soltar sobre um bloco liga naquele bloco, nao no comeco do grupo", () => {
  const { hospedeiro, ligacoes } = montarSaida(comMiolo)
  const caixa = caixas(cartoesDoFluxo(comMiolo)).get("g2")
  const faixa = caixa.blocos[1]
  const dentro = { clientX: caixa.x + 20, clientY: caixa.y + faixa.y + faixa.altura / 2 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", dentro)
  document.disparar("mouseup", dentro)
  assert.deepEqual(ligacoes.at(-1), { grupo: "g1", destino: `g2#${faixa.id}` })
})

test("soltar no cabecalho do cartao liga no grupo inteiro", () => {
  const { hospedeiro, ligacoes } = montarSaida()
  const caixa = caixas(cartoesDoFluxo(fluxo)).get("g2")
  const noNome = { clientX: caixa.x + 20, clientY: caixa.y + 6 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", noNome)
  document.disparar("mouseup", noNome)
  assert.deepEqual(ligacoes.at(-1), { grupo: "g1", destino: "g2" })
})

test("o bloco mirado acende, e so ele", () => {
  const { hospedeiro } = montarSaida(comMiolo)
  const caixa = caixas(cartoesDoFluxo(comMiolo)).get("g2")
  const faixa = caixa.blocos[1]
  const dentro = { clientX: caixa.x + 20, clientY: caixa.y + faixa.y + faixa.altura / 2 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", dentro)
  const acesos = hospedeiro.porClasse("ed__bloco").filter((b) => b.className.includes("ed__bloco--alvo"))
  assert.equal(acesos.length, 1)
  assert.equal(acesos[0].dadosBloco, faixa.id)
  document.disparar("mouseup", dentro)
  assert.equal(hospedeiro.porClasse("ed__bloco").filter((b) => b.className.includes("ed__bloco--alvo")).length, 0)
})

test("chegando por fora, o ima pega o grupo e nenhum bloco acende", () => {
  const { hospedeiro } = montarSaida(comMiolo)
  const caixa = caixas(cartoesDoFluxo(comMiolo)).get("g2")
  const faixa = caixa.blocos[1]
  // Por fora, mas na mesma altura de um bloco: é aqui que um ímã desatento
  // acha que a pessoa mirou o bloco quando ela só chegou perto do cartão.
  const porFora = { clientX: caixa.x - 6, clientY: caixa.y + faixa.y + faixa.altura / 2 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", porFora)
  assert.equal(hospedeiro.porClasse("ed__bloco").filter((b) => b.className.includes("ed__bloco--alvo")).length, 0,
    "por fora ninguém mira bloco: o alvo é o cartão")
  assert.equal(hospedeiro.porClasse("ed__cartao").filter((c) => c.className.includes("ed__cartao--alvo")).length, 1)
  document.disparar("mouseup", porFora)
})

test("a seta de um destino com bloco chega na faixa daquele bloco", () => {
  const comMiolo = {
    versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, proximo: "g2#b_dois", blocos: [] },
      { id: "g2", titulo: "b", posicao: { x: 500, y: 0 }, blocos: [
        { id: "b_um", tipo: "texto", conteudo: { texto: "Um" } },
        { id: "b_dois", tipo: "texto", conteudo: { texto: "Dois" } }] }
    ]
  }
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comMiolo)
  const caixa = caixas(cartoesDoFluxo(comMiolo)).get("g2")
  const faixa = caixa.blocos[1]
  const seta = hospedeiro.porClasse("ed__seta").find((s) => !s.className.includes("evento"))
  const fim = seta.atributos.d.match(/([\d.-]+) ([\d.-]+)$/)
  const meioDaFaixa = caixa.y + faixa.y + faixa.altura / 2
  assert.ok(Math.abs(Number(fim[2]) - meioDaFaixa) < 2,
    `a seta chegou em y=${fim[2]}, e a faixa do bloco está em ${meioDaFaixa}`)
})

test("grudado num bloco, o fio para na faixa dele e nao na borda do cartao", () => {
  const { hospedeiro } = montarSaida(comMiolo)
  const caixa = caixas(cartoesDoFluxo(comMiolo)).get("g2")
  const faixa = caixa.blocos[1]
  const dentro = { clientX: caixa.x + 20, clientY: caixa.y + faixa.y + faixa.altura / 2 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", dentro)
  const fim = fimDoCaminho(hospedeiro.porClasse("ed__seta--arrastando")[0].atributos.d)
  const meioDaFaixa = caixa.y + faixa.y + faixa.altura / 2
  assert.ok(Math.abs(fim.y - meioDaFaixa) < 2,
    `o fio parou em y=${fim.y}, e a faixa está em ${meioDaFaixa}`)
  document.disparar("mouseup", dentro)
})

test("dois grupos com bloco de mesmo id: acende o do cartao mirado", () => {
  const repetido = {
    versao: 2, eventos: [{ tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" }],
    grupos: [
      { id: "g1", titulo: "a", posicao: { x: 300, y: 40 }, proximo: "g2", blocos: [
        { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] },
      { id: "g2", titulo: "b", posicao: { x: 700, y: 40 }, blocos: [
        { id: "b1", tipo: "texto", conteudo: { texto: "Outro" } }] }
    ]
  }
  const { hospedeiro } = montarSaida(repetido)
  const caixa = caixas(cartoesDoFluxo(repetido)).get("g2")
  const faixa = caixa.blocos[0]
  const dentro = { clientX: caixa.x + 20, clientY: caixa.y + faixa.y + faixa.altura / 2 }
  hospedeiro.porClasse("ed__grupo-ponto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", dentro)
  const acesos = hospedeiro.porClasse("ed__bloco").filter((b) => b.className.includes("ed__bloco--alvo"))
  assert.equal(acesos.length, 1, "id de bloco se repete entre grupos: o cartão é que decide")
  assert.equal(acesos[0].dadosGrupo, "g2")
  document.disparar("mouseup", dentro)
})

// --- clicar na linha -------------------------------------------------------

test("clicar na linha a seleciona, e avisa qual foi", () => {
  const hospedeiro = new Elemento("div")
  const escolhidas = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoSelecionarLigacao: (s) => escolhidas.push(s) })
  canvas.desenhar(fluxo)
  const faixas = hospedeiro.porClasse("ed__seta-faixa")
  assert.equal(faixas.length, hospedeiro.porClasse("ed__seta").length,
    "sem faixa larga, acertar a linha com o mouse seria sorte")

  faixas[0].disparar("click")
  assert.equal(escolhidas.length, 1)
  const marcadas = hospedeiro.porClasse("ed__seta").filter((s) => s.className.includes("--selecionada"))
  assert.equal(marcadas.length, 1, "a linha escolhida precisa aparecer escolhida")
})

test("clicar no fundo larga a selecao", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  hospedeiro.porClasse("ed__seta-faixa")[0].disparar("click")
  hospedeiro.porClasse("ed__palco")[0].disparar("mousedown", { clientX: 5, clientY: 5, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__seta").filter((s) => s.className.includes("--selecionada")).length, 0)
})

test("botao direito na linha abre o menu onde se clicou, com Excluir", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  const faixa = hospedeiro.porClasse("ed__seta-faixa")[0]
  let barrou = false
  faixa.disparar("contextmenu", { clientX: 420, clientY: 160, preventDefault() { barrou = true } })

  assert.equal(barrou, true, "sem barrar, o menu do navegador cobre o nosso")
  const menu = hospedeiro.porClasse("ed__menu-ligacao")[0]
  assert.ok(menu, "o menu precisa aparecer")
  assert.equal(menu.style.propriedades.left, "420px")
  assert.equal(menu.style.propriedades.top, "160px")
  assert.equal(hospedeiro.porClasse("ed__menu-excluir")[0].textContent, "Excluir")
})

test("o Excluir avisa qual ligacao apagar, e fecha o menu", () => {
  const hospedeiro = new Elemento("div")
  const apagadas = []
  criarCanvas({ elemento: hospedeiro, aoApagarLigacao: (s) => apagadas.push(s) }).desenhar(fluxo)
  const faixa = hospedeiro.porClasse("ed__seta-faixa").find((f) => f.dadosSeta.de === "g1")
  faixa.disparar("contextmenu", { clientX: 10, clientY: 10 })
  hospedeiro.porClasse("ed__menu-excluir")[0].disparar("click")

  assert.equal(apagadas.length, 1)
  assert.equal(apagadas[0].de, "g1")
  assert.equal(hospedeiro.porClasse("ed__menu-ligacao").length, 0, "o menu precisa fechar")
})

test("clicar no fundo fecha o menu", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__seta-faixa")[0].disparar("contextmenu", { clientX: 10, clientY: 10 })
  hospedeiro.porClasse("ed__palco")[0].disparar("mousedown", { clientX: 5, clientY: 5, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__menu-ligacao").length, 0)
})

test("linha de condicao nao oferece Excluir: o editor nao sabe refazer", () => {
  const comCondicao = {
    versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, blocos: [
        { id: "b_c", tipo: "condicao", conteudo: { regras: [
          { se: { variavel: "v", vazio: true }, entao: "g2" }] } }] },
      { id: "g2", titulo: "b", posicao: { x: 400, y: 0 }, blocos: [] }
    ]
  }
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(comCondicao)
  const faixa = hospedeiro.porClasse("ed__seta-faixa").find((f) => f.dadosSeta.origens.includes("condicao"))
  faixa.disparar("contextmenu", { clientX: 10, clientY: 10 })
  assert.equal(hospedeiro.porClasse("ed__menu-excluir").length, 0)
  assert.match(hospedeiro.porClasse("ed__menu-aviso")[0].textContent, /condição/i)
})

test("arrastar o fundo nao e clicar na linha: a faixa nao move o canvas", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  const antes = canvas.vista()
  hospedeiro.porClasse("ed__seta-faixa")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 200, clientY: 100 })
  document.disparar("mouseup", {})
  assert.deepEqual(canvas.vista(), antes)
})

// --- apagar o grupo --------------------------------------------------------

test("botao direito no cartao abre o menu com Excluir grupo, e seleciona", () => {
  const hospedeiro = new Elemento("div")
  const selecoes = []
  criarCanvas({ elemento: hospedeiro, aoSelecionar: (s) => selecoes.push(s) }).desenhar(fluxo)
  let barrou = false
  hospedeiro.porClasse("ed__cartao")[0].disparar("contextmenu", {
    clientX: 340, clientY: 90, preventDefault() { barrou = true }
  })
  assert.equal(barrou, true)
  assert.deepEqual(selecoes.at(-1), { grupo: "g1", bloco: null })
  const menu = hospedeiro.porClasse("ed__menu-ligacao")[0]
  assert.ok(menu)
  assert.equal(menu.style.propriedades.left, "340px")
  assert.match(hospedeiro.porClasse("ed__menu-excluir")[0].textContent, /excluir grupo/i)
})

test("o botao diz quantos blocos vao embora", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cartao")[0].disparar("contextmenu", { clientX: 0, clientY: 0 })
  assert.match(hospedeiro.porClasse("ed__menu-excluir")[0].textContent, /1 bloco\b/,
    "sem desfazer, o tamanho do estrago precisa estar no botão")

  hospedeiro.porClasse("ed__cartao")[1].disparar("contextmenu", { clientX: 0, clientY: 0 })
  assert.equal(hospedeiro.porClasse("ed__menu-excluir")[0].textContent, "Excluir grupo",
    "grupo vazio não precisa anunciar zero blocos")
})

test("Excluir grupo avisa qual, e fecha o menu", () => {
  const hospedeiro = new Elemento("div")
  const apagados = []
  criarCanvas({ elemento: hospedeiro, aoApagarGrupo: (o) => apagados.push(o) }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cartao")[1].disparar("contextmenu", { clientX: 0, clientY: 0 })
  hospedeiro.porClasse("ed__menu-excluir")[0].disparar("click")
  assert.deepEqual(apagados, [{ grupo: "g2" }])
  assert.equal(hospedeiro.porClasse("ed__menu-ligacao").length, 0)
})

test("o menu do grupo nao abre o menu do navegador por cima", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__cartao")[0].disparar("contextmenu", { clientX: 0, clientY: 0 })
  let barrou = false
  hospedeiro.porClasse("ed__menu-ligacao")[0].disparar("contextmenu", { preventDefault() { barrou = true } })
  assert.equal(barrou, true)
})

// --- alça de arrasto no cabeçalho ------------------------------------------

test("o cabecalho tem uma alca livre depois do nome", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  const cabecalho = hospedeiro.porClasse("ed__cabecalho")[0]
  const alca = cabecalho.porClasse("ed__cabecalho-arrasto")[0]
  assert.ok(alca, "sem alça, pegar o cartão é pegar o nome")
  assert.match(alca.atributos.title || "", /arraste/i)
})

test("clicar na alca nao abre a caixa de renomear", () => {
  const { hospedeiro } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-arrasto")[0].disparar("click")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 0,
    "quem clica no vazio do cabeçalho quer selecionar, não renomear")
})

test("arrastar pela alca move o cartao, e nao o fundo", () => {
  const hospedeiro = new Elemento("div")
  const movidos = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoMover: (id, p) => movidos.push({ id, ...p }) })
  canvas.desenhar(fluxo)
  const antes = canvas.vista()

  hospedeiro.porClasse("ed__cabecalho-arrasto")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 120, clientY: 60 })
  document.disparar("mouseup", { clientX: 120, clientY: 60 })

  assert.equal(movidos.at(-1)?.id, "g1", "a alça move o cartão dela")
  assert.ok(movidos.at(-1).x > fluxo.grupos[0].posicao.x, "para onde o cursor foi")
  assert.deepEqual(canvas.vista(), antes, "e não arrasta o canvas junto")
})

test("comecar a arrastar fecha a caixa de renomear", () => {
  const { hospedeiro } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 1)

  // O arrasto segura o foco com preventDefault, então o blur nunca vem: quem
  // fecha a caixa é o próprio começo do arrasto.
  hospedeiro.porClasse("ed__palco")[0].disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 0)
  assert.equal(hospedeiro.porClasse("ed__cabecalho-titulo").length,
    hospedeiro.porClasse("ed__cartao").length, "todo cartão volta a mostrar o nome")
})

test("arrastar outro cartao tambem fecha a caixa aberta", () => {
  const { hospedeiro } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  hospedeiro.porClasse("ed__cabecalho")[1].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 0)
})

test("digitar dentro da caixa nao a fecha", () => {
  const { hospedeiro, edicoes } = montarEditavel()
  hospedeiro.porClasse("ed__cabecalho-titulo")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__titulo-campo")[0]
  campo.disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  campo.value = "Boas-vindas"
  campo.disparar("input")
  assert.equal(hospedeiro.porClasse("ed__titulo-campo").length, 1, "o cursor está nela")
  assert.deepEqual(edicoes.at(-1), { grupo: "g1", valor: "Boas-vindas" })
})

// --- o Start selecionável --------------------------------------------------

test("clicar no Start o deixa selecionado, e avisa quem escuta", () => {
  const hospedeiro = new Elemento("div")
  const selecoes = []
  criarCanvas({ elemento: hospedeiro, aoSelecionar: (s) => selecoes.push(s) }).desenhar(fluxo)
  const start = hospedeiro.porClasse("ed__evento")[0]
  start.disparar("click")

  assert.equal(hospedeiro.porClasse("ed__evento")[0].className.includes("ed__evento--ativo"), true,
    "clicar e nada acontecer parece defeito")
  assert.deepEqual(selecoes.at(-1), { grupo: null, bloco: null, evento: "inicio" })
})

test("selecionar um cartao larga o Start, e vice-versa", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxo)
  const ativo = (classe) => hospedeiro.porClasse(classe).filter((e) => e.className.includes("--ativo")).length

  hospedeiro.porClasse("ed__evento")[0].disparar("click")
  assert.equal(ativo("ed__evento"), 1)

  hospedeiro.porClasse("ed__cabecalho")[0].disparar("click")
  assert.equal(ativo("ed__evento"), 0, "o Start e um grupo são lugares diferentes do fluxo")
  assert.equal(ativo("ed__cartao"), 1)

  hospedeiro.porClasse("ed__evento")[0].disparar("click")
  assert.equal(ativo("ed__cartao"), 0)
})

test("clicar no fundo larga o Start tambem", () => {
  const hospedeiro = new Elemento("div")
  criarCanvas({ elemento: hospedeiro }).desenhar(fluxo)
  hospedeiro.porClasse("ed__evento")[0].disparar("click")
  hospedeiro.porClasse("ed__palco")[0].disparar("mousedown", { clientX: 5, clientY: 5, button: 0 })
  assert.equal(hospedeiro.porClasse("ed__evento")[0].className.includes("--ativo"), false)
})

test("o Start tem um play, e ele testa do comeco", () => {
  const hospedeiro = new Elemento("div")
  const testes = []
  criarCanvas({ elemento: hospedeiro, aoTestar: (g) => testes.push(g) }).desenhar(fluxo)
  const play = hospedeiro.porClasse("ed__play--evento")[0]
  assert.ok(play, "a largada do fluxo precisa de um play como os cartões")
  play.disparar("click")
  assert.deepEqual(testes, [null], "do começo, não de um grupo")
})

// --- o cartão inteiro é alça ------------------------------------------------

test("arrastar pelo rodape do cartao move o grupo, nao o fundo", () => {
  const hospedeiro = new Elemento("div")
  const movidos = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoMover: (id, p) => movidos.push({ id, ...p }) })
  canvas.desenhar(fluxo)
  const vista = canvas.vista()

  // O bloco agora é alça dele mesmo; o cartão se arrasta pelo que sobra —
  // cabeçalho, rodapé e as bordas.
  hospedeiro.porClasse("ed__rodape")[0].disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 90, clientY: 50 })
  document.disparar("mouseup", { clientX: 90, clientY: 50 })

  assert.equal(movidos.at(-1)?.id, "g1")
  assert.deepEqual(canvas.vista(), vista, "e o quadro fica onde estava")
})

test("clicar num bloco sem arrastar continua selecionando", () => {
  const hospedeiro = new Elemento("div")
  const selecoes = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoSelecionar: (s) => selecoes.push(s) })
  canvas.desenhar(fluxo)
  const bloco = hospedeiro.porClasse("ed__bloco")[0]
  bloco.disparar("mousedown", { clientX: 10, clientY: 10, button: 0 })
  document.disparar("mouseup", { clientX: 10, clientY: 10 })
  bloco.disparar("click")
  assert.deepEqual(selecoes.at(-1), { grupo: "g1", bloco: "b1" })
})

test("escrever na caixa do bloco nao arrasta o cartao", () => {
  const hospedeiro = new Elemento("div")
  const movidos = []
  const canvas = criarCanvas({
    elemento: hospedeiro, aoMover: (id, p) => movidos.push({ id, ...p }),
    aoEditarCampo: () => {}
  })
  canvas.desenhar(fluxo)
  hospedeiro.porClasse("ed__bloco")[0].disparar("click")
  const campo = hospedeiro.porClasse("ed__bloco-campo")[0]
  campo.disparar("mousedown", { clientX: 0, clientY: 0, button: 0 })
  document.disparar("mousemove", { clientX: 80, clientY: 40 })
  document.disparar("mouseup", {})
  assert.deepEqual(movidos, [], "quem escolhe onde pôr o cursor não quer mover o cartão")
})

// --- arrastar um bloco entre grupos ----------------------------------------

function montarComBlocos(extra = {}) {
  const comDois = {
    versao: 2,
    eventos: [{ tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" }],
    grupos: [
      { id: "g1", titulo: "Abertura", posicao: { x: 300, y: 40 }, proximo: "g2", blocos: [
        { id: "b1", tipo: "texto", conteudo: { texto: "Um" } },
        { id: "b2", tipo: "texto", conteudo: { texto: "Dois" } }] },
      { id: "g2", titulo: "Fim", posicao: { x: 800, y: 40 }, blocos: [
        { id: "b3", tipo: "texto", conteudo: { texto: "Três" } }] }
    ]
  }
  const hospedeiro = new Elemento("div")
  const movidos = []
  const soltos = []
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoMoverBloco: (o) => movidos.push(o),
    aoSoltarBlocoNoQuadro: (o) => soltos.push(o),
    ...extra
  })
  canvas.desenhar(comDois)
  return { hospedeiro, canvas, movidos, soltos, fluxo: comDois }
}

const blocoDe = (h, id) => h.porClasse("ed__bloco").find((b) => b.dadosBloco === id)

test("arrastar um bloco ate outro cartao o leva para la", () => {
  const { hospedeiro, movidos, fluxo: f } = montarComBlocos()
  const destino = caixas(cartoesDoFluxo(f)).get("g2")

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", { clientX: destino.x + 40, clientY: destino.y + destino.altura - 10 })
  document.disparar("mouseup", { clientX: destino.x + 40, clientY: destino.y + destino.altura - 10 })

  assert.deepEqual(movidos.at(-1), { de: "g1", bloco: "b1", para: "g2", antesDe: null })
})

test("soltar sobre um bloco entra acima dele", () => {
  const { hospedeiro, movidos, fluxo: f } = montarComBlocos()
  const destino = caixas(cartoesDoFluxo(f)).get("g2")
  const faixa = destino.blocos[0]
  const emCima = { clientX: destino.x + 40, clientY: destino.y + faixa.y + faixa.altura / 2 }

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", emCima)
  document.disparar("mouseup", emCima)

  assert.deepEqual(movidos.at(-1), { de: "g1", bloco: "b1", para: "g2", antesDe: "b3" })
})

test("soltar no quadro avisa para virar grupo novo, naquele ponto", () => {
  const { hospedeiro, soltos } = montarComBlocos()
  const vazio = { clientX: 200, clientY: 600 }

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", vazio)
  document.disparar("mouseup", vazio)

  assert.equal(soltos.length, 1)
  assert.equal(soltos[0].de, "g1")
  assert.equal(soltos[0].bloco, "b1")
  assert.deepEqual({ x: soltos[0].x, y: soltos[0].y }, { x: 200, y: 600 })
})

test("enquanto arrasta, o bloco apaga e o cartao de destino acende", () => {
  const { hospedeiro, fluxo: f } = montarComBlocos()
  const destino = caixas(cartoesDoFluxo(f)).get("g2")

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", { clientX: destino.x + 40, clientY: destino.y + 50 })

  assert.ok(hospedeiro.porClasse("ed__bloco-fantasma")[0], "sem fantasma, não se vê o que está indo")
  assert.equal(blocoDe(hospedeiro, "b1").className.includes("ed__bloco--saindo"), true)
  assert.equal(hospedeiro.porClasse("ed__cartao--recebendo").length, 1)

  document.disparar("mouseup", { clientX: destino.x + 40, clientY: destino.y + 50 })
  assert.equal(hospedeiro.porClasse("ed__bloco-fantasma").length, 0, "o fantasma precisa sumir")
  assert.equal(hospedeiro.porClasse("ed__cartao--recebendo").length, 0)
})

test("clicar no bloco sem andar continua sendo clique, nao arrasto", () => {
  const selecoes = []
  const { hospedeiro, movidos, soltos } = montarComBlocos({ aoSelecionar: (s) => selecoes.push(s) })
  const bloco = blocoDe(hospedeiro, "b1")
  bloco.disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", { clientX: 311, clientY: 61 })
  document.disparar("mouseup", { clientX: 311, clientY: 61 })
  bloco.disparar("click")

  assert.deepEqual(movidos, [])
  assert.deepEqual(soltos, [])
  assert.equal(hospedeiro.porClasse("ed__bloco-fantasma").length, 0)
  assert.deepEqual(selecoes.at(-1), { grupo: "g1", bloco: "b1" })
})

test("arrastar um bloco nao arrasta o cartao nem o quadro", () => {
  const movidosDeCartao = []
  const { hospedeiro, canvas } = montarComBlocos({ aoMover: (id, p) => movidosDeCartao.push({ id, ...p }) })
  const antes = canvas.vista()

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", { clientX: 500, clientY: 300 })
  document.disparar("mouseup", { clientX: 500, clientY: 300 })

  assert.deepEqual(movidosDeCartao, [], "o cartão ficou onde estava")
  assert.deepEqual(canvas.vista(), antes, "e o quadro também")
})

test("soltar o bloco em cima dele mesmo nao o manda para acima de si", () => {
  const { hospedeiro, movidos, fluxo: f } = montarComBlocos()
  const caixa = caixas(cartoesDoFluxo(f)).get("g1")
  const propria = caixa.blocos[0]
  const emCimaDele = {
    clientX: caixa.x + 40,
    clientY: caixa.y + propria.y + propria.altura / 2
  }
  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  document.disparar("mousemove", emCimaDele)
  document.disparar("mouseup", emCimaDele)
  assert.deepEqual(movidos.at(-1), { de: "g1", bloco: "b1", para: "g1", antesDe: null },
    "acima de si mesmo não é lugar nenhum")
})

test("soltar fora do quadro nao leva o bloco a lugar nenhum", () => {
  const { hospedeiro, movidos, soltos } = montarComBlocos()
  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.deslocamento = { left: 272, top: 57 }
  palco.clientWidth = 900
  palco.clientHeight = 600

  blocoDe(hospedeiro, "b1").disparar("mousedown", { clientX: 310, clientY: 60, button: 0 })
  // 100px: está na paleta, antes de o palco começar.
  document.disparar("mousemove", { clientX: 100, clientY: 300 })
  document.disparar("mouseup", { clientX: 100, clientY: 300 })

  assert.deepEqual(movidos, [])
  assert.deepEqual(soltos, [], "soltar na paleta não é soltar no quadro")
})

test("o bloco arrastado e uma copia dele mesmo, nao um adesivo com o nome", () => {
  const { hospedeiro } = montarComBlocos()
  const bloco = blocoDe(hospedeiro, "b1")
  bloco.deslocamento = { left: 300, top: 100 }
  bloco.clientWidth = 230
  bloco.clientHeight = 54

  bloco.disparar("mousedown", { clientX: 320, clientY: 115, button: 0, currentTarget: bloco })
  document.disparar("mousemove", { clientX: 600, clientY: 400 })

  const fantasma = hospedeiro.porClasse("ed__bloco-fantasma")[0]
  const copia = fantasma.porClasse("ed__bloco--copia")[0]
  assert.ok(copia, "o que se arrasta precisa ser o bloco, não o nome dele")
  assert.match(copia.textContent, /Um/, "com o conteúdo que está na tela")
  assert.match(fantasma.style.propriedades.width || "", /^\d+px$/, "e do tamanho dele")

  document.disparar("mouseup", { clientX: 600, clientY: 400 })
})

test("a copia fica presa onde a mao pegou", () => {
  const { hospedeiro } = montarComBlocos()
  const bloco = blocoDe(hospedeiro, "b1")
  bloco.deslocamento = { left: 300, top: 100 }
  bloco.clientWidth = 230
  bloco.clientHeight = 54
  // Pegou a 20px da esquerda e 15 do topo do bloco.
  bloco.disparar("mousedown", { clientX: 320, clientY: 115, button: 0, currentTarget: bloco })
  document.disparar("mousemove", { clientX: 600, clientY: 400 })

  const fantasma = hospedeiro.porClasse("ed__bloco-fantasma")[0]
  assert.equal(fantasma.style.propriedades.left, "580px")
  assert.equal(fantasma.style.propriedades.top, "385px")
  document.disparar("mouseup", { clientX: 600, clientY: 400 })
})

test("a copia nao leva os ouvintes do original", () => {
  const { hospedeiro, movidos } = montarComBlocos()
  const bloco = blocoDe(hospedeiro, "b1")
  bloco.disparar("mousedown", { clientX: 310, clientY: 60, button: 0, currentTarget: bloco })
  document.disparar("mousemove", { clientX: 600, clientY: 400 })

  const copia = hospedeiro.porClasse("ed__bloco--copia")[0]
  copia.disparar("mousedown", { clientX: 600, clientY: 400, button: 0 })
  document.disparar("mouseup", { clientX: 600, clientY: 400 })
  assert.equal(movidos.length <= 1, true, "clicar na cópia não pode começar outro arrasto")
})

// --- a caixa diz o que é, e o ⋯ dá conta dela ------------------------------

// Um grupo com três tipos diferentes, para provar que o nome na caixa é o do
// tipo e não uma palavra fixa.
const fluxoDeTipos = {
  versao: 2,
  eventos: [{ tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 300, y: 40 }, blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
      { id: "b2", tipo: "imagem", conteudo: { url: "foto.png" } },
      { id: "b3", tipo: "video", conteudo: { url: "https://youtu.be/abc" } }
    ] }
  ]
}

function montarComTipos() {
  const hospedeiro = new Elemento("div")
  const apagados = []
  const canvas = criarCanvas({
    elemento: hospedeiro,
    aoApagarBloco: (o) => apagados.push(o)
  })
  canvas.desenhar(fluxoDeTipos)
  return { hospedeiro, apagados }
}

const porClasse = (no, classe) => no.porClasse(classe)

test("cada bloco mostra o nome do tipo ao lado do icone", () => {
  const { hospedeiro } = montarComTipos()
  assert.deepEqual(porClasse(hospedeiro, "ed__bloco-tipo").map((e) => e.textContent),
    ["Texto", "Imagem", "Vídeo"],
    "o ícone sozinho obriga a decorar catorze formas")
})

test("o texto do bloco fica numa linha propria, embaixo do nome", () => {
  const { hospedeiro } = montarComTipos()
  const primeiro = porClasse(hospedeiro, "ed__bloco")[0]
  assert.deepEqual(primeiro.filhos.map((f) => f.className), ["ed__bloco-topo", "ed__bloco-resumo"])
  assert.equal(primeiro.porClasse("ed__bloco-resumo")[0].textContent, "Olá")
  assert.equal(primeiro.porClasse("ed__bloco-topo")[0].porClasse("ed__bloco-resumo").length, 0,
    "o texto ao lado do nome espremeria os dois")
})

test("o ⋯ do bloco abre as acoes dele: so a lixeira", () => {
  const { hospedeiro } = montarComTipos()
  porClasse(hospedeiro, "ed__bloco-mais")[0].disparar("click")
  const menu = porClasse(hospedeiro, "ed__menu-acoes")[0]
  assert.ok(menu, "o ⋯ precisa abrir a caixa de ações")
  assert.deepEqual(menu.porClasse("ed__acao-dica").map((e) => e.textContent), ["Excluir"],
    "tudo o que o bloco diz se edita no próprio cartão: não há para onde mandar ninguém")
})

test("o botao direito no bloco abre a mesma lixeira", () => {
  const { hospedeiro, apagados } = montarComTipos()
  porClasse(hospedeiro, "ed__bloco")[2].disparar("contextmenu", { clientX: 10, clientY: 10 })
  const menu = porClasse(hospedeiro, "ed__menu-acoes")[0]
  assert.ok(menu, "o gesto é o mesmo da linha e do grupo")
  menu.porClasse("ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(apagados, [{ grupo: "g1", bloco: "b3" }])
})

test("Excluir no ⋯ apaga aquele bloco, e so ele", () => {
  const { hospedeiro, apagados } = montarComTipos()
  porClasse(hospedeiro, "ed__bloco-mais")[1].disparar("click")
  porClasse(hospedeiro, "ed__acao--excluir")[0].disparar("click")
  assert.deepEqual(apagados, [{ grupo: "g1", bloco: "b2" }])
})



test("bolha de imagem abre a caixa ao lado, nao uma caixa de texto", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxoDeTipos)
  canvas.selecionar({ grupo: "g1", bloco: "b2" })

  assert.equal(hospedeiro.porClasse("ed__bloco-campo").length, 0,
    "imagem não se edita escrevendo: o que se tem na mão é um link ou um arquivo")
  const caixa = hospedeiro.porClasse("ed__midia")[0]
  assert.ok(caixa, "a bolha de imagem precisa da caixa")
  assert.deepEqual(caixa.porClasse("ed__midia-aba").map((a) => a.textContent), ["Link", "Upload"])
})

test("bolha de texto continua se editando no proprio cartao", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxoDeTipos)
  canvas.selecionar({ grupo: "g1", bloco: "b1" })
  assert.equal(hospedeiro.porClasse("ed__midia").length, 0)
  assert.equal(hospedeiro.porClasse("ed__bloco-campo").length, 1)
})

test("trocar de bloco troca a caixa, sem deixar a antiga pendurada", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxoDeTipos)
  canvas.selecionar({ grupo: "g1", bloco: "b2" })
  canvas.selecionar({ grupo: "g1", bloco: "b3" })
  assert.equal(hospedeiro.porClasse("ed__midia").length, 1)
  assert.equal(hospedeiro.porClasse("ed__midia")[0].porClasse("ed__midia-abas").length, 0,
    "a caixa agora é a do vídeo, que tem uma aba só")
})

test("bolha de midia vazia convida a clicar, em vez de uma linha em branco", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar({
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", titulo: "Grupo #1", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "video", conteudo: {} },
      { id: "b2", tipo: "imagem", conteudo: {} },
      { id: "b3", tipo: "imagem", conteudo: { url: "https://exemplo/a.png" } },
      { id: "b4", tipo: "texto", conteudo: { texto: "" } }
    ] }]
  })
  const resumos = hospedeiro.porClasse("ed__bloco-resumo")
  assert.deepEqual(resumos.map((r) => r.textContent),
    ["Clique para editar…", "Clique para editar…", "https://exemplo/a.png", ""],
    "só a mídia vazia convida: a fala vazia já se edita clicando e digitando")
  assert.deepEqual(resumos.map((r) => r.className.includes("--vazia")), [true, true, false, false],
    "o convite fica apagado, para não se confundir com o que a pessoa escreveu")
})

test("clicar no vazio do quadro larga a selecao e fecha a caixa da midia", () => {
  const hospedeiro = new Elemento("div")
  const selecionados = []
  const canvas = criarCanvas({ elemento: hospedeiro, aoSelecionar: (o) => selecionados.push(o) })
  canvas.desenhar(fluxoDeTipos)
  canvas.selecionar({ grupo: "g1", bloco: "b2" })
  assert.equal(hospedeiro.porClasse("ed__midia").length, 1)

  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.disparar("mousedown", { clientX: 600, clientY: 400, button: 0 })
  document.disparar("mouseup", {})
  assert.equal(hospedeiro.porClasse("ed__midia").length, 0, "a caixa fica aberta atrás do quadro")
  assert.deepEqual(selecionados.at(-1), { grupo: null, bloco: null })
})

test("arrastar o quadro nao larga a selecao: quem arrasta quer passear", () => {
  const hospedeiro = new Elemento("div")
  const canvas = criarCanvas({ elemento: hospedeiro })
  canvas.desenhar(fluxoDeTipos)
  canvas.selecionar({ grupo: "g1", bloco: "b2" })

  const palco = hospedeiro.porClasse("ed__palco")[0]
  palco.disparar("mousedown", { clientX: 600, clientY: 400, button: 0 })
  document.disparar("mousemove", { clientX: 700, clientY: 460 })
  document.disparar("mouseup", {})
  assert.equal(hospedeiro.porClasse("ed__midia").length, 1, "passear não é desmarcar")
})
