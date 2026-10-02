// Pré-visualização sob demanda. Fica fechada por padrão para o canvas ter a
// tela inteira, e abre pelo botão Testar — da origem ou de uma etapa.

import { criarChat } from "../motor/motor.js"

const EVENTO_DE_ORIGEM = "origem_do_fluxo"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

// Repontar o `inicio` deixaria os grupos anteriores sem ninguém apontando
// para eles, e o validador os acusaria de inalcançáveis — o preview abriria
// com uma faixa de erro para quem só queria testar do meio. O evento extra
// mantém o grafo inteiro alcançável; o motor ignora tipo que não conhece.
export function fluxoComecandoEm(fluxo, grupoId) {
  if (!grupoId) return fluxo
  const grupos = fluxo?.grupos || []
  if (!grupos.some((g) => g && g.id === grupoId)) return fluxo

  const eventos = fluxo.eventos || []
  const inicio = eventos.find((e) => e && e.tipo === "inicio")
  if (!inicio || inicio.proximo === grupoId) return fluxo

  return {
    ...fluxo,
    eventos: [
      ...eventos.map((e) => (e === inicio ? { ...e, proximo: grupoId } : e)),
      { tipo: EVENTO_DE_ORIGEM, proximo: inicio.proximo }
    ]
  }
}

export function criarPreview({ elemento, aoFechar = () => {}, esperar, tema = () => ({}) } = {}) {
  let aberto = false
  let fluxoAtual = null
  let comecarEm = null
  let chat = null

  function fechar() {
    aberto = false
    chat = null
    elemento.replaceChildren()
    aoFechar()
  }

  function montar() {
    const painel = el("div", "ed__preview")
    const barra = el("header", "ed__preview-barra")

    const grupo = (fluxoAtual.grupos || []).find((g) => g && g.id === comecarEm)
    barra.append(el("span", "ed__preview-titulo",
      comecarEm ? `Teste · a partir de ${grupo?.titulo || comecarEm}` : "Teste · do início"))

    const reiniciar = el("button", "ed__preview-reiniciar", "Reiniciar")
    reiniciar.setAttribute("type", "button")
    reiniciar.addEventListener("click", () => abrir(fluxoAtual, comecarEm))

    const fecharBotao = el("button", "ed__preview-fechar", "✕")
    fecharBotao.setAttribute("type", "button")
    fecharBotao.addEventListener("click", fechar)

    barra.append(reiniciar, fecharBotao)
    painel.append(barra)

    if (comecarEm) {
      painel.append(el("p", "ed__preview-nota",
        "Começando do meio: as respostas anteriores não existem, então as variáveis delas aparecem vazias."))
    }

    const palco = el("div", "ed__preview-chat")
    painel.append(palco)
    elemento.replaceChildren(painel)

    chat = criarChat({
      elemento: palco,
      fluxo: fluxoComecandoEm(fluxoAtual, comecarEm),
      // O tema é do cliente: testar com as cores do motor mostraria um chat
      // que não existe em lugar nenhum.
      tema: tema(),
      modo: "teste",
      armazenamento: undefined,
      // O compasso é o do próprio fluxo, como no chat de verdade: testar é
      // ver o que o lead vê, e o lead vê os três pontinhos. Zerado, como
      // estava, a conversa inteira aparecia pronta na tela de uma vez.
      ritmo: fluxoAtual.ritmo,
      esperar,
      buscar: async () => { throw new Error("o preview não envia nada") }
    })
    chat.reiniciar({ retomar: false })
  }

  function abrir(fluxo, grupoId = null) {
    fluxoAtual = fluxo
    comecarEm = grupoId || null
    aberto = true
    montar()
  }

  return {
    abrir,
    fechar,
    aberto: () => aberto,
    // Refaz só se já estiver aberto: editar com o preview fechado não deve
    // abri-lo sozinho.
    atualizar(fluxo) {
      fluxoAtual = fluxo
      if (aberto) montar()
    }
  }
}
