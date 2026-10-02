// Edições do fluxo. Tudo puro e imutável: recebe fluxo, devolve fluxo novo.
// É aqui que um erro corromperia o arquivo do cliente em silêncio.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  definirCampo, definirSalvarEm, definirTitulo, definirProximo,
  moverGrupo, acrescentarBloco, removerBloco, moverBloco, criarGrupo,
  definirOpcao, acrescentarOpcao, removerOpcao, proximoIdDeOpcao,
  definirProximoDoEvento, moverEvento, limparOpcoesVazias, proximoNomeDeGrupo, removerGrupo, duplicarGrupo, nomeDoFluxo, definirNomeDoFluxo
} from "../editor/edicoes.js"
import { validarFluxo } from "../motor/validar.js"
import { registrarTodos } from "../motor/blocos/index.js"
import { limpar, todos } from "../motor/blocos/_registro.js"

if (todos().length === 0) registrarTodos()

const base = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 10, y: 20 }, proximo: "g2", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
      { id: "b2", tipo: "entrada_texto", conteudo: { placeholder: "Nome" }, salvar_em: "nome" }
    ] },
    { id: "g2", titulo: "Fim", posicao: { x: 400, y: 20 }, blocos: [] }
  ]
})

const bloco = (f, g, b) => f.grupos.find((x) => x.id === g).blocos.find((x) => x.id === b)
const grupo = (f, g) => f.grupos.find((x) => x.id === g)

test("nenhuma edicao modifica o fluxo recebido", () => {
  const f = base()
  const copia = JSON.parse(JSON.stringify(f))
  definirCampo(f, { grupo: "g1", bloco: "b1", campo: "texto", valor: "outro" })
  definirTitulo(f, { grupo: "g1", valor: "x" })
  moverGrupo(f, { grupo: "g1", x: 999, y: 999 })
  removerBloco(f, { grupo: "g1", bloco: "b1" })
  acrescentarBloco(f, { grupo: "g1", tipo: "texto" })
  criarGrupo(f, { x: 0, y: 0 })
  assert.deepEqual(f, copia)
})

test("definirCampo troca so o campo pedido", () => {
  const f = definirCampo(base(), { grupo: "g1", bloco: "b2", campo: "placeholder", valor: "Seu nome" })
  assert.equal(bloco(f, "g1", "b2").conteudo.placeholder, "Seu nome")
  assert.equal(bloco(f, "g1", "b2").salvar_em, "nome", "o resto do bloco não pode se perder")
  assert.equal(bloco(f, "g1", "b1").conteudo.texto, "Olá", "outro bloco não pode ser tocado")
})

test("campo vazio e removido, nao gravado como string vazia", () => {
  const f = definirCampo(base(), { grupo: "g1", bloco: "b2", campo: "placeholder", valor: "  " })
  assert.equal("placeholder" in bloco(f, "g1", "b2").conteudo, false,
    "campo em branco no JSON é ruído: ou tem valor ou não existe")
})

test("definirSalvarEm e definirTitulo", () => {
  let f = definirSalvarEm(base(), { grupo: "g1", bloco: "b2", valor: "primeiro_nome" })
  assert.equal(bloco(f, "g1", "b2").salvar_em, "primeiro_nome")
  f = definirTitulo(f, { grupo: "g1", valor: "Boas-vindas" })
  assert.equal(grupo(f, "g1").titulo, "Boas-vindas")
})

test("definirProximo liga e desliga", () => {
  let f = definirProximo(base(), { grupo: "g2", valor: "g1" })
  assert.equal(grupo(f, "g2").proximo, "g1")
  f = definirProximo(f, { grupo: "g2", valor: "" })
  assert.equal("proximo" in grupo(f, "g2"), false, "sem próximo o grupo termina o fluxo")
})

test("moverGrupo grava a posicao arredondada", () => {
  const f = moverGrupo(base(), { grupo: "g1", x: 133.7, y: 42.2 })
  assert.deepEqual(grupo(f, "g1").posicao, { x: 134, y: 42 })
})

test("acrescentarBloco usa o padrao declarado pelo tipo", () => {
  const f = acrescentarBloco(base(), { grupo: "g2", tipo: "entrada_texto" })
  const novo = grupo(f, "g2").blocos[0]
  assert.equal(novo.tipo, "entrada_texto")
  assert.equal(novo.conteudo.rotulo_botao, "Enviar", "o campo com padrao ja vem preenchido")
  assert.ok(novo.id, "bloco sem id quebra o validador")
})

test("acrescentarBloco de tipo que salva variavel ja nasce com salvar_em", () => {
  const f = acrescentarBloco(base(), { grupo: "g2", tipo: "entrada_email" })
  const novo = grupo(f, "g2").blocos[0]
  assert.ok(novo.salvar_em, "entrada sem salvar_em é erro de validação na hora de rodar")
  assert.deepEqual(validarFluxo(f).erros.filter((e) => e.includes(novo.id)), [])
})

test("acrescentarBloco entra depois do bloco indicado", () => {
  const f = acrescentarBloco(base(), { grupo: "g1", tipo: "texto", apos: "b1" })
  assert.deepEqual(grupo(f, "g1").blocos.map((b) => b.tipo), ["texto", "texto", "entrada_texto"])
})

test("ids novos nunca colidem com os existentes", () => {
  let f = base()
  const vistos = new Set(f.grupos.flatMap((g) => g.blocos.map((b) => b.id)))
  for (let i = 0; i < 30; i++) {
    f = acrescentarBloco(f, { grupo: "g1", tipo: "texto" })
    const id = grupo(f, "g1").blocos.at(-1).id
    assert.equal(vistos.has(id), false, `id repetido: ${id}`)
    vistos.add(id)
  }
})

test("removerBloco tira so ele", () => {
  const f = removerBloco(base(), { grupo: "g1", bloco: "b1" })
  assert.deepEqual(grupo(f, "g1").blocos.map((b) => b.id), ["b2"])
})

test("moverBloco sobe e desce, e nao sai da lista", () => {
  let f = moverBloco(base(), { grupo: "g1", bloco: "b2", direcao: -1 })
  assert.deepEqual(grupo(f, "g1").blocos.map((b) => b.id), ["b2", "b1"])
  f = moverBloco(f, { grupo: "g1", bloco: "b2", direcao: -1 })
  assert.deepEqual(grupo(f, "g1").blocos.map((b) => b.id), ["b2", "b1"], "no topo, subir não faz nada")
})

test("criarGrupo nasce com id unico e na posicao pedida", () => {
  const f = criarGrupo(base(), { x: 700, y: 300 })
  const novo = f.grupos.at(-1)
  assert.deepEqual(novo.posicao, { x: 700, y: 300 })
  assert.deepEqual(novo.blocos, [])
  assert.equal(f.grupos.filter((g) => g.id === novo.id).length, 1)
})

test("editar nao quebra o fluxo aos olhos do validador", () => {
  let f = base()
  f = definirCampo(f, { grupo: "g1", bloco: "b1", campo: "texto", valor: "Bom dia" })
  f = acrescentarBloco(f, { grupo: "g2", tipo: "texto" })
  f = definirTitulo(f, { grupo: "g2", valor: "Encerramento" })
  assert.deepEqual(validarFluxo(f).erros, [])
})

test("operacao sobre grupo ou bloco inexistente devolve o fluxo intacto", () => {
  const f = base()
  assert.deepEqual(definirCampo(f, { grupo: "nao_existe", bloco: "b1", campo: "texto", valor: "x" }), f)
  assert.deepEqual(removerBloco(f, { grupo: "g1", bloco: "nao_existe" }), f)
})

// --- opções do bloco de botões ---------------------------------------------

const comBotoes = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [{ id: "g1", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "entrada_botoes", salvar_em: "bem", conteudo: { opcoes: [
      { id: "o1", label: "Imóvel", pontos: 2, proximo: "g2" },
      { id: "o2", label: "Automóvel", pontos: 1 }
    ] } }] },
    { id: "g2", posicao: { x: 300, y: 0 }, blocos: [] }]
})
const opcoes = (f) => f.grupos[0].blocos[0].conteudo.opcoes

test("definirOpcao troca so o campo daquela opcao", () => {
  const f = definirOpcao(comBotoes(), { grupo: "g1", bloco: "b", opcao: "o2", campo: "label", valor: "Carro" })
  assert.equal(opcoes(f)[1].label, "Carro")
  assert.equal(opcoes(f)[1].pontos, 1)
  assert.equal(opcoes(f)[0].label, "Imóvel")
})

test("pontos vira numero, nao texto do campo", () => {
  const f = definirOpcao(comBotoes(), { grupo: "g1", bloco: "b", opcao: "o2", campo: "pontos", valor: "3" })
  assert.strictEqual(opcoes(f)[1].pontos, 3, "pontuação em texto quebraria a soma")
})

test("pontos em branco some, e a opcao deixa de pontuar", () => {
  const f = definirOpcao(comBotoes(), { grupo: "g1", bloco: "b", opcao: "o1", campo: "pontos", valor: "" })
  assert.equal("pontos" in opcoes(f)[0], false)
})

test("acrescentar e remover opcao", () => {
  let f = acrescentarOpcao(comBotoes(), { grupo: "g1", bloco: "b" })
  assert.equal(opcoes(f).length, 3)
  assert.ok(opcoes(f)[2].id && opcoes(f)[2].label !== undefined)
  f = removerOpcao(f, { grupo: "g1", bloco: "b", opcao: "o1" })
  assert.deepEqual(opcoes(f).map((o) => o.id).slice(0, 1), ["o2"])
})

test("id de opcao novo nao colide", () => {
  let f = comBotoes()
  const vistos = new Set(opcoes(f).map((o) => o.id))
  for (let i = 0; i < 20; i++) {
    f = acrescentarOpcao(f, { grupo: "g1", bloco: "b" })
    const id = opcoes(f).at(-1).id
    assert.equal(vistos.has(id), false, `id repetido: ${id}`)
    vistos.add(id)
  }
})

test("a ultima opcao nao pode ser removida", () => {
  let f = removerOpcao(comBotoes(), { grupo: "g1", bloco: "b", opcao: "o1" })
  f = removerOpcao(f, { grupo: "g1", bloco: "b", opcao: "o2" })
  assert.equal(opcoes(f).length, 1, "botões sem nenhuma opção deixam a pessoa sem saída")
})

test("acrescentar opcao logo abaixo de uma existente", () => {
  const f = acrescentarOpcao(comBotoes(), { grupo: "g1", bloco: "b", apos: "o1" })
  assert.deepEqual(opcoes(f).map((o) => o.id), ["o1", "o3", "o2"])
})

test("a opcao nova nasce com rotulo vazio, pronta para digitar", () => {
  const f = acrescentarOpcao(comBotoes(), { grupo: "g1", bloco: "b", apos: "o1" })
  assert.equal(opcoes(f)[1].label, "")
})

test("proximoIdDeOpcao diz o id antes de acrescentar", () => {
  const f = comBotoes()
  const previsto = proximoIdDeOpcao(f, { grupo: "g1", bloco: "b" })
  const depois = acrescentarOpcao(f, { grupo: "g1", bloco: "b" })
  assert.equal(opcoes(depois).at(-1).id, previsto)
})

// --- ligar o evento --------------------------------------------------------

test("ligar o inicio num grupo", () => {
  const f = definirProximoDoEvento(base(), { tipo: "inicio", destino: "g2" })
  assert.equal(f.eventos.find((e) => e.tipo === "inicio").proximo, "g2")
})

test("fluxo sem evento de inicio ganha um ao ser ligado", () => {
  const semEvento = { versao: 2, grupos: [{ id: "g1", blocos: [] }] }
  const f = definirProximoDoEvento(semEvento, { tipo: "inicio", destino: "g1" })
  assert.equal(f.eventos.length, 1)
  assert.equal(f.eventos[0].tipo, "inicio")
  assert.equal(f.eventos[0].proximo, "g1")
})

test("mover o evento grava a posicao", () => {
  const f = moverEvento(base(), { tipo: "inicio", x: 12.6, y: 80.2 })
  assert.deepEqual(f.eventos.find((e) => e.tipo === "inicio").posicao, { x: 13, y: 80 })
})

test("ligar evento nao modifica o fluxo recebido", () => {
  const f = base()
  const copia = JSON.parse(JSON.stringify(f))
  definirProximoDoEvento(f, { tipo: "inicio", destino: "g2" })
  moverEvento(f, { tipo: "inicio", x: 1, y: 1 })
  assert.deepEqual(f, copia)
})

test("grupo novo nao nasce em cima de outro", async () => {
  const { cartoes, caixas } = await import("../editor/modelo.js")
  let f = { versao: 2, eventos: [], grupos: [] }
  for (let i = 0; i < 4; i++) f = criarGrupo(f, { x: 80, y: 80 })

  const lista = [...caixas(cartoes(f)).values()]
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j]
      const cruza = a.x < b.x + b.largura && b.x < a.x + a.largura &&
        a.y < b.y + b.altura && b.y < a.y + a.altura
      assert.equal(cruza, false, `o grupo ${i + 1} nasceu sobre o ${j + 1}`)
    }
  }

  // Encostados também não serve: dois cabeçalhos colados viram um bloco só
  // aos olhos de quem vai arrastar.
  const empilhados = lista.slice().sort((a, b) => a.y - b.y)
  for (let i = 1; i < empilhados.length; i++) {
    const folga = empilhados[i].y - (empilhados[i - 1].y + empilhados[i - 1].altura)
    assert.ok(folga >= 20, `folga de ${folga} entre os cartões ${i} e ${i + 1}`)
  }
})

test("quando o lugar pedido esta livre, o grupo nasce exatamente ali", () => {
  const f = criarGrupo({ versao: 2, eventos: [], grupos: [
    { id: "g1", titulo: "x", posicao: { x: 900, y: 900 }, blocos: [] }] }, { x: 80, y: 80 })
  assert.deepEqual(f.grupos.at(-1).posicao, { x: 80, y: 80 })
})

const comOpcoes = (...labels) => ({ versao: 2, eventos: [], grupos: [
  { id: "g1", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "bb", tipo: "entrada_botoes", salvar_em: "v",
      conteudo: { opcoes: labels.map((label, i) => ({ id: `o${i + 1}`, label })) } }] }] })

const labelsDe = (f) => f.grupos[0].blocos[0].conteudo.opcoes.map((o) => o.label)

test("limpar vazias tira a linha sem texto", () => {
  assert.deepEqual(labelsDe(limparOpcoesVazias(comOpcoes("Sim", ""))), ["Sim"])
})

test("limpar vazias trata so-espaco como vazio", () => {
  assert.deepEqual(labelsDe(limparOpcoesVazias(comOpcoes("Sim", "   "))), ["Sim"])
})

test("limpar vazias nao esvazia o bloco: a ultima fica", () => {
  const f = limparOpcoesVazias(comOpcoes(""))
  assert.equal(labelsDe(f).length, 1, "bloco de botões sem botão é fluxo inválido")
})

test("sem nada a limpar, o fluxo volta igual e sem copia nova", () => {
  const f = comOpcoes("Sim", "Não")
  assert.equal(limparOpcoesVazias(f), f,
    "copiar sem motivo faz qualquer comparação por identidade mentir")
})

test("limpar vazias nao mexe em bloco sem opcoes", () => {
  const f = { versao: 2, eventos: [], grupos: [
    { id: "g1", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "" } }] }] }
  assert.equal(limparOpcoesVazias(f), f)
})

test("o numero do grupo novo conta os que ja existem, com nome proprio ou nao", () => {
  const seisComNome = { versao: 2, eventos: [], grupos: ["Abertura", "Contato", "Idade", "Objetivo", "Valor", "Fim"]
    .map((titulo, i) => ({ id: `g${i + 1}`, titulo, posicao: { x: 0, y: i * 400 }, blocos: [] })) }
  assert.equal(proximoNomeDeGrupo(seisComNome), "Grupo #7",
    "seis grupos na tela e o novo saindo como #1 parece que o editor não os viu")
})

test("numero ja usado e pulado, para dois grupos nao saírem iguais", () => {
  // Dois grupos: o próximo seria o #3, mas alguém já se chama assim.
  const f = { versao: 2, eventos: [], grupos: [
    { id: "g1", titulo: "Grupo #3", posicao: { x: 0, y: 0 }, blocos: [] },
    { id: "g2", titulo: "Abertura", posicao: { x: 0, y: 400 }, blocos: [] }] }
  assert.equal(proximoNomeDeGrupo(f), "Grupo #4")
})

test("fluxo vazio comeca no Grupo #1", () => {
  assert.equal(proximoNomeDeGrupo({ versao: 2, eventos: [], grupos: [] }), "Grupo #1")
})

// --- apagar um grupo -------------------------------------------------------

const comReferencias = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }, { tipo: "invalido", proximo: "g2" }],
  grupos: [
    { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, proximo: "g2", blocos: [
      { id: "b_bot", tipo: "entrada_botoes", salvar_em: "v", conteudo: { opcoes: [
        { id: "o1", label: "Sim", proximo: "g2#b_fala" },
        { id: "o2", label: "Não", proximo: "g3" }] } },
      { id: "b_ir", tipo: "ir_para", conteudo: { destino: "g2" } },
      { id: "b_cond", tipo: "condicao", conteudo: { regras: [
        { se: { variavel: "v", vazio: true }, entao: "g2" }] } }] },
    { id: "g2", titulo: "b", posicao: { x: 400, y: 0 }, blocos: [
      { id: "b_fala", tipo: "texto", conteudo: { texto: "Oi" } }] },
    { id: "g3", titulo: "c", posicao: { x: 800, y: 0 }, blocos: [] }
  ]
})

test("remover o grupo tira o cartao e todo destino que apontava para ele", () => {
  const f = removerGrupo(comReferencias(), { grupo: "g2" })
  assert.deepEqual(f.grupos.map((g) => g.id), ["g1", "g3"])

  const g1 = f.grupos[0]
  assert.equal("proximo" in g1, false, "a saída do grupo apontava para g2")
  assert.equal("proximo" in g1.blocos[0].conteudo.opcoes[0], false, "a opção apontava para g2#b_fala")
  assert.equal(g1.blocos[0].conteudo.opcoes[1].proximo, "g3", "a opção que ia para g3 continua")
  assert.equal("destino" in g1.blocos[1].conteudo, false, "o ir_para apontava para g2")
  assert.equal("entao" in g1.blocos[2].conteudo.regras[0], false, "a regra apontava para g2")
  assert.equal("proximo" in f.eventos[1], false, "o evento invalido apontava para g2")
  assert.equal(f.eventos[0].proximo, "g1", "o início não era para g2")
})

test("remover grupo nao toca no fluxo recebido", () => {
  const antes = comReferencias()
  const copia = JSON.parse(JSON.stringify(antes))
  removerGrupo(antes, { grupo: "g2" })
  assert.deepEqual(antes, copia)
})

test("remover grupo que ninguem aponta so tira o cartao", () => {
  const f = removerGrupo(comReferencias(), { grupo: "g3" })
  assert.deepEqual(f.grupos.map((g) => g.id), ["g1", "g2"])
  assert.equal(f.grupos[0].proximo, "g2")
  assert.equal("proximo" in f.grupos[0].blocos[0].conteudo.opcoes[1], false, "essa ia para g3")
})

test("remover grupo inexistente nao muda nada de verdade", () => {
  const f = removerGrupo(comReferencias(), { grupo: "g_nada" })
  assert.deepEqual(f.grupos.map((g) => g.id), ["g1", "g2", "g3"])
  assert.equal(f.grupos[0].proximo, "g2")
})

test("o fluxo sem o grupo apagado continua valido quando sobra caminho", () => {
  const f = removerGrupo(comReferencias(), { grupo: "g3" })
  const r = validarFluxo(f, { destinos: {} })
  assert.equal(r.erros.some((e) => /g3/.test(e)), false, `sobrou referência a g3: ${r.erros.join(" | ")}`)
})

// --- duplicar um grupo -----------------------------------------------------

test("duplicar cria um grupo igual, com id novo e nome marcado", () => {
  const f = duplicarGrupo(comReferencias(), { grupo: "g1" })
  assert.equal(f.grupos.length, 4)
  const copia = f.grupos.at(-1)
  assert.notEqual(copia.id, "g1")
  assert.equal(copia.titulo, "a (cópia)")
  assert.deepEqual(copia.blocos.map((b) => b.tipo), ["entrada_botoes", "ir_para", "condicao"])
  assert.equal(copia.blocos[0].conteudo.opcoes[1].proximo, "g3", "os destinos de fora continuam")
})

test("a copia nasce em lugar livre, nao em cima do original", async () => {
  const { cartoes, caixas } = await import("../editor/modelo.js")
  const f = duplicarGrupo(comReferencias(), { grupo: "g1" })
  const lista = [...caixas(cartoes(f)).values()]
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j]
      const cruza = a.x < b.x + b.largura && b.x < a.x + a.largura &&
        a.y < b.y + b.altura && b.y < a.y + a.altura
      assert.equal(cruza, false, "a cópia nasceu sobre outro cartão")
    }
  }
})

test("destino que apontava para o proprio grupo passa a apontar para a copia", () => {
  const base = comReferencias()
  base.grupos[0].proximo = "g1"
  base.grupos[0].blocos[0].conteudo.opcoes[0].proximo = "g1#b_ir"
  const f = duplicarGrupo(base, { grupo: "g1" })
  const copia = f.grupos.at(-1)
  assert.equal(copia.proximo, copia.id, "o laço do original mandaria o lead de volta para o original")
  assert.equal(copia.blocos[0].conteudo.opcoes[0].proximo, `${copia.id}#b_ir`)
})

test("duplicar nao mexe no original nem no fluxo recebido", () => {
  const antes = comReferencias()
  const copia = JSON.parse(JSON.stringify(antes))
  const f = duplicarGrupo(antes, { grupo: "g1" })
  assert.deepEqual(antes, copia)
  assert.deepEqual(f.grupos[0], copia.grupos[0])
})

test("duplicar grupo que nao existe nao inventa cartao", () => {
  const f = duplicarGrupo(comReferencias(), { grupo: "g_nada" })
  assert.equal(f.grupos.length, 3)
})

test("o fluxo com a copia continua valido", () => {
  const f = duplicarGrupo(comReferencias(), { grupo: "g2" })
  const r = validarFluxo(f, { destinos: {} })
  // A cópia não é alcançável até ser ligada — isso é esperado e aparece no
  // aviso. O que não pode é id duplicado ou destino quebrado.
  assert.equal(r.erros.some((e) => /duplicad|não existe/.test(e)), false, r.erros.join(" | "))
})

// --- nome do projeto -------------------------------------------------------

test("fluxo sem nome se chama My Chatflow", () => {
  assert.equal(nomeDoFluxo({ versao: 2, grupos: [] }), "My Chatflow")
  assert.equal(nomeDoFluxo({ versao: 2, nome: "   ", grupos: [] }), "My Chatflow",
    "nome só de espaço é o mesmo que nome nenhum")
  assert.equal(nomeDoFluxo(null), "My Chatflow")
})

test("definir o nome guarda no fluxo, e apagar tira o campo", () => {
  const f = definirNomeDoFluxo({ versao: 2, grupos: [] }, "Osher 01")
  assert.equal(f.nome, "Osher 01")
  assert.equal(nomeDoFluxo(f), "Osher 01")
  assert.equal("nome" in definirNomeDoFluxo(f, ""), false,
    "nome vazio sai do arquivo em vez de virar string vazia")
})

test("definir o nome nao mexe no resto", () => {
  const antes = { versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }], grupos: [
    { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, blocos: [] }] }
  const copia = JSON.parse(JSON.stringify(antes))
  const f = definirNomeDoFluxo(antes, "Novo")
  assert.deepEqual(antes, copia)
  assert.deepEqual(f.grupos, copia.grupos)
})
