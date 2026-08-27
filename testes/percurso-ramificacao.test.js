import { test } from "node:test"
import assert from "node:assert/strict"
import {
  criarEstado, avancar, aplicarResposta, contexto,
  destinoDaResposta, avaliarRegra, destinoDaLogica
} from "../motor/percurso.js"

const blocoBotoes = {
  id: "b1",
  tipo: "entrada_botoes",
  salvar_em: "bem",
  conteudo: {
    opcoes: [
      { id: "o1", label: "Imóvel", pontos: 2, proximo: "g_imovel" },
      { id: "o2", label: "Automóvel", pontos: 2, proximo: "g_auto" },
      { id: "o3", label: "Ainda não sei", pontos: 0 }
    ]
  }
}

test("opcao com proximo devolve o destino dela", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Imóvel"), "g_imovel")
})

test("opcao sem proximo devolve null, para cair no proximo do grupo", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Ainda não sei"), null)
})

test("valor que nao corresponde a nenhuma opcao devolve null", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Outro"), null)
})

test("bloco que nao ramifica devolve null", () => {
  assert.equal(destinoDaResposta({ tipo: "entrada_texto", conteudo: {} }, "x"), null)
})

test("operadores de regra", () => {
  const ctx = { bem: "Imóvel", pontuacao: 7, obs: "" }
  assert.equal(avaliarRegra({ variavel: "bem", igual: "Imóvel" }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "bem", diferente: "Imóvel" }, ctx), false)
  assert.equal(avaliarRegra({ pontuacao: { maior_que: 5 } }, ctx), true)
  assert.equal(avaliarRegra({ pontuacao: { menor_que: 5 } }, ctx), false)
  assert.equal(avaliarRegra({ variavel: "bem", contem: "mó" }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "obs", vazio: true }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "bem", vazio: true }, ctx), false)
})

test("variavel inexistente conta como vazia", () => {
  assert.equal(avaliarRegra({ variavel: "nao_existe", vazio: true }, {}), true)
})

const fluxoCondicao = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  pontuacao: { ativa: true, faixas: { quente: 9, morno: 5 } },
  grupos: [
    {
      id: "g1",
      blocos: [
        {
          id: "c1",
          tipo: "condicao",
          conteudo: {
            regras: [
              { se: { pontuacao: { menor_que: 4 } }, entao: "g_frio" },
              { se: { variavel: "bem", igual: "Ainda não sei" }, entao: "g_ajuda" }
            ]
          }
        }
      ],
      proximo: "g_segue"
    },
    { id: "g_frio", blocos: [] },
    { id: "g_ajuda", blocos: [] },
    { id: "g_segue", blocos: [] }
  ]
}

test("condicao por pontuacao desvia", () => {
  const e = criarEstado(fluxoCondicao)
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_frio")
})

test("condicao por variavel desvia quando a primeira regra nao vale", () => {
  let e = criarEstado(fluxoCondicao)
  e = { ...e, pontuacao: 10, respostas: { bem: "Ainda não sei" } }
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_ajuda")
})

test("nenhuma regra verdadeira devolve null, para seguir o proximo do grupo", () => {
  let e = criarEstado(fluxoCondicao)
  e = { ...e, pontuacao: 10, respostas: { bem: "Imóvel" } }
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), null)
})

test("ir_para devolve o destino declarado", () => {
  const e = criarEstado(fluxoCondicao)
  const bloco = { id: "j1", tipo: "ir_para", conteudo: { destino: "g_segue" } }
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_segue")
})

test("percurso completo: escolha desvia o fluxo", () => {
  const fluxo = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    pontuacao: { ativa: true, faixas: { quente: 2 } },
    grupos: [
      { id: "g1", blocos: [blocoBotoes], proximo: "g_padrao" },
      { id: "g_imovel", blocos: [] },
      { id: "g_padrao", blocos: [] }
    ]
  }
  let e = criarEstado(fluxo)
  e = aplicarResposta(fluxo, e, "Imóvel")
  assert.equal(e.pontuacao, 2)
  e = avancar(fluxo, e, { destino: destinoDaResposta(blocoBotoes, "Imóvel") })
  assert.equal(e.grupoAtual, "g_imovel")
  assert.equal(contexto(fluxo, e).classificacao, "quente")
})
