import { pontuacaoAtiva, classificar } from "./pontuacao.js"

function acharGrupo(fluxo, id) {
  return (fluxo.grupos || []).find((g) => g.id === id) || null
}

function eventoInicio(fluxo) {
  return (fluxo.eventos || []).find((e) => e.tipo === "inicio") || null
}

function entrarNoGrupo(estado, idGrupo) {
  const historico =
    estado.historico[estado.historico.length - 1] === idGrupo
      ? estado.historico
      : [...estado.historico, idGrupo]
  return { ...estado, grupoAtual: idGrupo, indiceBloco: 0, historico }
}

export function criarEstado(fluxo) {
  const inicio = eventoInicio(fluxo)
  const base = {
    respostas: {},
    pontuacao: 0,
    grupoAtual: null,
    indiceBloco: 0,
    historico: [],
    terminou: false
  }
  if (!inicio || !inicio.proximo) return { ...base, terminou: true }
  const alvo = acharGrupo(fluxo, inicio.proximo)
  if (!alvo) return { ...base, terminou: true }
  return entrarNoGrupo(base, inicio.proximo)
}

export function blocoAtual(fluxo, estado) {
  if (estado.terminou || !estado.grupoAtual) return null
  const grupo = acharGrupo(fluxo, estado.grupoAtual)
  if (!grupo) return null
  return grupo.blocos[estado.indiceBloco] || null
}

export function avancar(fluxo, estado, { destino } = {}) {
  if (estado.terminou) return estado

  if (destino) {
    const alvo = acharGrupo(fluxo, destino)
    if (!alvo) return { ...estado, terminou: true }
    return entrarNoGrupo(estado, destino)
  }

  const grupo = acharGrupo(fluxo, estado.grupoAtual)
  if (!grupo) return { ...estado, terminou: true }

  const proximoIndice = estado.indiceBloco + 1
  if (proximoIndice < grupo.blocos.length) {
    return { ...estado, indiceBloco: proximoIndice }
  }

  if (!grupo.proximo) return { ...estado, terminou: true }
  const seguinte = acharGrupo(fluxo, grupo.proximo)
  if (!seguinte) return { ...estado, terminou: true }
  return entrarNoGrupo(estado, grupo.proximo)
}

export function aplicarResposta(fluxo, estado, valor) {
  const bloco = blocoAtual(fluxo, estado)
  if (!bloco) return estado

  const respostas = { ...estado.respostas }
  if (bloco.salvar_em) respostas[bloco.salvar_em] = valor

  let pontuacao = estado.pontuacao
  if (pontuacaoAtiva(fluxo)) {
    const opcoes = (bloco.conteudo && bloco.conteudo.opcoes) || []
    const escolhida = opcoes.find((o) => o.label === valor)
    if (escolhida && typeof escolhida.pontos === "number") {
      pontuacao += escolhida.pontos
    }
  }

  return { ...estado, respostas, pontuacao }
}

export function contexto(fluxo, estado) {
  const base = { ...estado.respostas, pontuacao: estado.pontuacao }
  if (pontuacaoAtiva(fluxo)) {
    base.classificacao = classificar(estado.pontuacao, fluxo.pontuacao.faixas)
  }
  return base
}
