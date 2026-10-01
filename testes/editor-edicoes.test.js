// Edições do fluxo. Tudo puro e imutável: recebe fluxo, devolve fluxo novo.
// É aqui que um erro corromperia o arquivo do cliente em silêncio.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  definirCampo, definirSalvarEm, definirTitulo, definirProximo,
  moverGrupo, acrescentarBloco, removerBloco, moverBloco, criarGrupo,
  definirOpcao, acrescentarOpcao, removerOpcao, proximoIdDeOpcao
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
