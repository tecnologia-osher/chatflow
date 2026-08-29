import { pontuacaoAtiva, classificar } from "./pontuacao.js"
import { obter } from "./blocos/_registro.js"

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
    terminou: false,
    tentativas: 0
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

export function destinoDaResposta(bloco, valor) {
  const opcoes = (bloco && bloco.conteudo && bloco.conteudo.opcoes) || []
  const escolhida = opcoes.find((o) => o.label === valor)
  return (escolhida && escolhida.proximo) || null
}

function estaVazio(valor) {
  return valor === undefined || valor === null || valor === ""
}

export function avaliarRegra(regra, ctx) {
  if (!regra || typeof regra !== "object") return false

  if (regra.pontuacao && typeof regra.pontuacao === "object") {
    const pontos = ctx.pontuacao ?? 0
    if ("maior_que" in regra.pontuacao) return pontos > regra.pontuacao.maior_que
    if ("menor_que" in regra.pontuacao) return pontos < regra.pontuacao.menor_que
    if ("igual" in regra.pontuacao) return pontos === regra.pontuacao.igual
    return false
  }

  if (typeof regra.variavel === "string") {
    const valor = ctx[regra.variavel]
    if ("vazio" in regra) return regra.vazio === estaVazio(valor)
    if ("igual" in regra) return valor === regra.igual
    if ("diferente" in regra) return valor !== regra.diferente
    if ("contem" in regra) return String(valor ?? "").includes(String(regra.contem))
    if ("maior_que" in regra) return Number(valor) > Number(regra.maior_que)
    if ("menor_que" in regra) return Number(valor) < Number(regra.menor_que)
  }

  return false
}

export function destinoDaLogica(fluxo, estado, bloco) {
  if (!bloco) return null

  if (bloco.tipo === "ir_para") {
    return (bloco.conteudo && bloco.conteudo.destino) || null
  }

  if (bloco.tipo === "condicao") {
    const ctx = contexto(fluxo, estado)
    const regras = (bloco.conteudo && bloco.conteudo.regras) || []
    for (const item of regras) {
      if (avaliarRegra(item.se, ctx)) return item.entao || null
    }
    return null
  }

  return null
}

export function validarEntrada(bloco, valor) {
  if (!bloco || !bloco.tipo) return { ok: true, erro: null }
  let definicao
  try {
    definicao = obter(bloco.tipo)
  } catch {
    return { ok: true, erro: null }
  }
  if (typeof definicao.validar !== "function") return { ok: true, erro: null }
  const veredito = definicao.validar(valor)
  // Um validador pode devolver o motivo em vez de só dizer "não". A frase
  // certa depende do que a pessoa digitou — "faltam dois números" e "esse DDD
  // não existe" mandam corrigir coisas diferentes, e uma mensagem genérica
  // faz ela tentar de novo às cegas. Quem devolve só true/false continua
  // valendo, com a mensagem fixa do tipo.
  if (typeof veredito === "string") return { ok: false, erro: veredito }
  if (veredito) return { ok: true, erro: null }
  return { ok: false, erro: definicao.erro || "Resposta inválida." }
}

export function registrarFalha(estado) {
  return { ...estado, tentativas: (estado.tentativas || 0) + 1 }
}

export function limparFalhas(estado) {
  return { ...estado, tentativas: 0 }
}

export function destinoDeInvalido(fluxo, estado) {
  const evento = (fluxo.eventos || []).find((e) => e.tipo === "invalido")
  if (!evento || !evento.proximo) return null
  const limite = typeof evento.apos_tentativas === "number" ? evento.apos_tentativas : 1
  return (estado.tentativas || 0) >= limite ? evento.proximo : null
}
