// Leitura do fluxo para o canvas: cartões e setas. Lógica pura, sem DOM.
//
// O editor não conhece tipo de bloco nenhum: o rótulo e os campos saem do
// catálogo em motor/blocos. Tipo novo aparece aqui sozinho.

import { registrarTodos } from "../motor/blocos/index.js"
import { todos, obter } from "../motor/blocos/_registro.js"

if (todos().length === 0) registrarTodos()

const LARGURA = 380
const ALTURA = 260
const POR_LINHA = 3
const LIMITE_RESUMO = 80

// Um grupo sem posicao seria desenhado na origem, em cima dos outros. Espalha
// numa grade para que o fluxo continue legível enquanto ninguém arrastou nada.
function posicaoDe(grupo, indice) {
  const p = grupo.posicao
  if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y }
  return {
    x: 40 + (indice % POR_LINHA) * LARGURA,
    y: 40 + Math.floor(indice / POR_LINHA) * ALTURA
  }
}

function cortar(texto) {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim()
  return limpo.length > LIMITE_RESUMO ? limpo.slice(0, LIMITE_RESUMO - 1) + "…" : limpo
}

// O que o cartão mostra de cada bloco. Procura o primeiro campo que tenha
// conteúdo, na ordem em que o tipo os declara — é o que a pessoa escreveu.
function resumoDe(bloco, definicao) {
  const c = bloco.conteudo || {}
  if (Array.isArray(c.opcoes)) return cortar(c.opcoes.map((o) => o.label).join(" · "))
  if (Array.isArray(c.regras)) return cortar(`${c.regras.length} regra(s)`)

  for (const campo of definicao?.campos || []) {
    const valor = c[campo.nome]
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") return cortar(valor)
  }
  for (const valor of Object.values(c)) {
    if (typeof valor === "string" && valor.trim() !== "") return cortar(valor)
  }
  return ""
}

function definicaoDe(tipo) {
  try {
    return obter(tipo)
  } catch {
    return null
  }
}

// Qual campo a pessoa edita clicando direto no bloco do cartão. É o primeiro
// campo de texto que o tipo declara — para `texto` é a fala, para as entradas
// é o texto de exemplo. Tipo cujo conteúdo é lista (botões, condição) não tem
// principal: ali o que importa são os itens, e isso não cabe numa caixa só.
export function campoPrincipal(tipo) {
  const definicao = definicaoDe(tipo)
  if (!definicao) return null
  const campo = (definicao.campos || []).find((c) => c.tipo === "texto")
  return campo ? campo.nome : null
}

export function cartoes(fluxo) {
  return (fluxo?.grupos || []).filter(Boolean).map((grupo, indice) => ({
    id: grupo.id,
    titulo: grupo.titulo || grupo.id,
    posicao: posicaoDe(grupo, indice),
    proximo: grupo.proximo || null,
    blocos: (grupo.blocos || []).filter(Boolean).map((bloco) => {
      const definicao = definicaoDe(bloco.tipo)
      return {
        id: bloco.id,
        tipo: bloco.tipo,
        rotulo: definicao ? definicao.rotulo : bloco.tipo,
        categoria: definicao ? definicao.categoria : null,
        desconhecido: !definicao,
        resumo: resumoDe(bloco, definicao),
        campoPrincipal: campoPrincipal(bloco.tipo),
        // As opções sobem para o cartão: é lá que se escreve o que cada botão
        // vai dizer, empilhadas uma abaixo da outra.
        opcoes: Array.isArray(bloco.conteudo?.opcoes)
          ? bloco.conteudo.opcoes.filter(Boolean).map((o) => ({
            id: o.id, label: o.label ?? "", pontos: o.pontos, proximo: o.proximo || null
          }))
          : null,
        valorPrincipal: (bloco.conteudo || {})[campoPrincipal(bloco.tipo)] ?? "",
        salvar_em: bloco.salvar_em || null
      }
    })
  }))
}

// Toda saída que o grupo tem, com a origem de cada uma. A origem importa para
// o canvas desenhar diferente o que veio de uma opção e o que veio do grupo.
function saidasDoGrupo(grupo) {
  const saidas = []
  if (grupo.proximo) saidas.push({ para: grupo.proximo, origem: "grupo" })

  for (const bloco of grupo.blocos || []) {
    if (!bloco) continue
    const c = bloco.conteudo || {}
    if (bloco.tipo === "ir_para" && c.destino) saidas.push({ para: c.destino, origem: "ir_para" })
    for (const regra of c.regras || []) {
      if (regra && regra.entao) saidas.push({ para: regra.entao, origem: "condicao" })
    }
    for (const opcao of c.opcoes || []) {
      if (opcao && opcao.proximo) saidas.push({ para: opcao.proximo, origem: "opcao" })
    }
  }
  return saidas
}

export function setas(fluxo) {
  const grupos = (fluxo?.grupos || []).filter(Boolean)
  const existe = new Set(grupos.map((g) => g.id))
  const porPar = new Map()

  function juntar(de, para, origem, evento) {
    const chave = `${evento || ""}|${de || ""}|${para}`
    const atual = porPar.get(chave)
    if (atual) {
      if (!atual.origens.includes(origem)) atual.origens.push(origem)
      return
    }
    // Seta órfã continua sendo desenhada de propósito: sumir com ela
    // esconderia justamente o erro que a pessoa precisa ver.
    porPar.set(chave, { de: de ?? null, para, origens: [origem], orfa: !existe.has(para), evento: evento || null })
  }

  for (const evento of (fluxo?.eventos || []).filter(Boolean)) {
    if (evento.proximo) juntar(null, evento.proximo, "evento", evento.tipo)
  }
  for (const grupo of grupos) {
    for (const { para, origem } of saidasDoGrupo(grupo)) juntar(grupo.id, para, origem)
  }
  return [...porPar.values()]
}

// --- tamanho do cartão -----------------------------------------------------

// O canvas não mede nada: o tamanho é calculado. Medir exigiria o elemento já
// desenhado, e aí as setas só saberiam onde ancorar depois de um quadro — o
// desenho apareceria torto e se corrigiria sozinho, que é pior que estar fixo.
const CARTAO_LARGURA = 260
const CARTAO_CABECALHO = 44
const CARTAO_BLOCO = 52
// O rodapé é a faixa onde mora a saída do grupo. Sem faixa própria, a
// bolinha disputava altura com as das opções e as duas se sobrepunham.
const CARTAO_RODAPE = 26

export function caixas(listaDeCartoes) {
  const mapa = new Map()
  for (const cartao of listaDeCartoes) {
    mapa.set(cartao.id, {
      x: cartao.posicao.x,
      y: cartao.posicao.y,
      largura: CARTAO_LARGURA,
      altura: CARTAO_CABECALHO + cartao.blocos.length * CARTAO_BLOCO + CARTAO_RODAPE
    })
  }
  return mapa
}

export const MEDIDAS = { CARTAO_LARGURA, CARTAO_CABECALHO, CARTAO_BLOCO, CARTAO_RODAPE }


// --- eventos como cartões --------------------------------------------------

const ROTULO_DO_EVENTO = {
  inicio: "Start",
  invalido: "Resposta inválida",
  comando: "Comando",
  resposta: "Resposta"
}
const ICONE_DO_EVENTO = { inicio: "\u2691" }

const EVENTO_LARGURA = 190
const EVENTO_ALTURA = 48

// O início deixa de ser uma seta que nasce do nada e vira um cartão. Um fluxo
// começado do zero já aparece com ele, sem destino, esperando a ligação —
// senão não há de onde puxar a primeira seta.
export function eventosDoCanvas(fluxo) {
  const declarados = (fluxo?.eventos || []).filter(Boolean)
  const temInicio = declarados.some((e) => e.tipo === "inicio")
  const lista = temInicio ? declarados : [{ tipo: "inicio" }, ...declarados]

  return lista.map((evento, indice) => ({
    tipo: evento.tipo,
    rotulo: ROTULO_DO_EVENTO[evento.tipo] || evento.tipo,
    icone: ICONE_DO_EVENTO[evento.tipo] || "",
    posicao: evento.posicao && typeof evento.posicao.x === "number"
      ? { x: evento.posicao.x, y: evento.posicao.y }
      : { x: 40, y: 40 + indice * 120 },
    proximo: evento.proximo || null
  }))
}

export function caixasDeEventos(listaDeEventos) {
  const mapa = new Map()
  for (const evento of listaDeEventos) {
    mapa.set(evento.tipo, {
      x: evento.posicao.x, y: evento.posicao.y,
      largura: EVENTO_LARGURA, altura: EVENTO_ALTURA
    })
  }
  return mapa
}
