import { test } from "node:test"
import assert from "node:assert/strict"
import { criarEstado, blocoAtual, avancar, aplicarResposta, contexto } from "../motor/percurso.js"

const fluxo = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    {
      id: "g1",
      titulo: "Abertura",
      blocos: [
        { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
        { id: "b2", tipo: "entrada_texto", conteudo: {}, salvar_em: "nome" }
      ],
      proximo: "g2"
    },
    {
      id: "g2",
      titulo: "Fim",
      blocos: [{ id: "b3", tipo: "texto", conteudo: { texto: "Obrigado" } }]
    }
  ]
}

function fluxoComOpcoes(pontuacao) {
  return {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    ...(pontuacao ? { pontuacao } : {}),
    grupos: [
      {
        id: "g1",
        titulo: "Pergunta",
        blocos: [
          {
            id: "b1",
            tipo: "escolha_unica",
            conteudo: {
              opcoes: [
                { label: "Sim", pontos: 10 },
                { label: "Não", pontos: 0 }
              ]
            }
          }
        ]
      }
    ]
  }
}

test("estado inicial aponta para o grupo do evento de inicio", () => {
  const e = criarEstado(fluxo)
  assert.equal(e.grupoAtual, "g1")
  assert.equal(e.indiceBloco, 0)
  assert.equal(e.terminou, false)
  assert.deepEqual(e.respostas, {})
})

test("evento de inicio aponta para grupo inexistente encerra o fluxo", () => {
  const fluxoQuebrado = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "inexistente" }],
    grupos: []
  }
  const e = criarEstado(fluxoQuebrado)
  assert.equal(e.terminou, true)
  assert.deepEqual(e.historico, [])
})

test("blocoAtual devolve o primeiro bloco do grupo", () => {
  assert.equal(blocoAtual(fluxo, criarEstado(fluxo)).id, "b1")
})

test("avancar caminha pelos blocos do grupo em ordem", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  assert.equal(blocoAtual(fluxo, e).id, "b2")
})

test("ao esgotar os blocos, segue o proximo do grupo", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.equal(e.grupoAtual, "g2")
  assert.equal(blocoAtual(fluxo, e).id, "b3")
})

test("grupo sem proximo encerra o fluxo", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.equal(e.terminou, true)
  assert.equal(blocoAtual(fluxo, e), null)
})

test("historico registra os grupos visitados sem repetir em sequencia", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.deepEqual(e.historico, ["g1", "g2"])
})

test("aplicarResposta grava na variavel e nao avanca", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  const depois = aplicarResposta(fluxo, e, "Ana")
  assert.equal(depois.respostas.nome, "Ana")
  assert.equal(blocoAtual(fluxo, depois).id, "b2")
})

test("nao modifica o estado recebido", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  const copia = JSON.parse(JSON.stringify(e))
  avancar(fluxo, e)
  aplicarResposta(fluxo, e, "Ana")
  assert.deepEqual(e, copia)
})

test("avancar com destino salta para o grupo indicado", () => {
  const e = criarEstado(fluxo)
  const depois = avancar(fluxo, e, { destino: "g2" })
  assert.equal(depois.grupoAtual, "g2")
  assert.equal(depois.indiceBloco, 0)
})

test("contexto expoe as respostas", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = aplicarResposta(fluxo, e, "Ana")
  assert.equal(contexto(fluxo, e).nome, "Ana")
})

test("aplicarResposta soma os pontos da opcao escolhida quando a pontuacao esta ativa", () => {
  const fluxoPontuado = fluxoComOpcoes({ ativa: true, faixas: { quente: 10, morno: 5 } })
  const e = criarEstado(fluxoPontuado)
  const depois = aplicarResposta(fluxoPontuado, e, "Sim")
  assert.equal(depois.pontuacao, 10)
  assert.equal(contexto(fluxoPontuado, depois).classificacao, "quente")
})

test("aplicarResposta nao soma pontos quando a pontuacao esta inativa", () => {
  const fluxoSemPontuacao = fluxoComOpcoes(undefined)
  const e = criarEstado(fluxoSemPontuacao)
  const depois = aplicarResposta(fluxoSemPontuacao, e, "Sim")
  assert.equal(depois.pontuacao, 0)
  assert.equal(contexto(fluxoSemPontuacao, depois).classificacao, undefined)
})
