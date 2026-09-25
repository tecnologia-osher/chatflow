// Painel de propriedades. Lê os `campos` que o tipo declara e monta o
// formulário — nenhuma linha aqui conhece um tipo específico. Foi para isto
// que o catálogo guarda `campos` desde a primeira semana do motor.

import { obter } from "./catalogo.js"
import {
  definirCampo, definirSalvarEm, definirTitulo, definirProximo,
  definirOpcao, acrescentarOpcao, removerOpcao
} from "./edicoes.js"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

function linha(rotulo, controle) {
  const caixa = el("label", "ed__linha")
  caixa.append(el("span", "ed__rotulo", rotulo), controle)
  return caixa
}

function entrada(tipo, valor, aoMudar) {
  const campo = el("input", "ed__campo")
  if (tipo === "booleano") {
    campo.setAttribute("type", "checkbox")
    campo.checked = Boolean(valor)
    campo.addEventListener("change", () => aoMudar(campo.checked))
  } else {
    campo.setAttribute("type", tipo === "numero" ? "number" : "text")
    campo.value = valor ?? ""
    campo.addEventListener("input", () => aoMudar(campo.value))
  }
  return campo
}

function seletorDeGrupo(fluxo, exceto, valor, classe, aoMudar) {
  const sel = el("select", classe)
  const vazio = el("option", null, "— não liga —")
  vazio.value = ""
  sel.append(vazio)
  for (const g of fluxo.grupos || []) {
    if (!g || g.id === exceto) continue
    const o = el("option", null, g.titulo || g.id)
    o.value = g.id
    sel.append(o)
  }
  sel.value = valor || ""
  sel.addEventListener("change", () => aoMudar(sel.value))
  return sel
}

export function criarPainel({ elemento, aoEditar = () => {} }) {
  function mostrar({ fluxo, selecao }) {
    const corpo = el("div", "ed__painel")
    const emitir = (novo) => aoEditar(novo)

    if (!selecao || !selecao.grupo) {
      corpo.append(el("p", "ed__vazio", "Selecione um bloco ou um grupo no canvas para editar."))
      elemento.replaceChildren(corpo)
      return
    }

    const grupo = (fluxo.grupos || []).find((g) => g && g.id === selecao.grupo)
    if (!grupo) { elemento.replaceChildren(corpo); return }

    if (!selecao.bloco) {
      corpo.append(el("h2", "ed__titulo-painel", "Grupo"))
      corpo.append(linha("Título", entrada("texto", grupo.titulo || "", (v) =>
        emitir(definirTitulo(fluxo, { grupo: grupo.id, valor: v })))))
      corpo.append(linha("Próximo grupo", seletorDeGrupo(fluxo, grupo.id, grupo.proximo, "ed__proximo", (v) =>
        emitir(definirProximo(fluxo, { grupo: grupo.id, valor: v })))))
      elemento.replaceChildren(corpo)
      return
    }

    const bloco = (grupo.blocos || []).find((b) => b && b.id === selecao.bloco)
    if (!bloco) { elemento.replaceChildren(corpo); return }

    const definicao = obter(bloco.tipo)
    corpo.append(el("h2", "ed__titulo-painel", definicao ? definicao.rotulo : bloco.tipo))

    if (!definicao) {
      // Fluxo que cita tipo não registrado é exatamente o arquivo que precisa
      // ser aberto para ser consertado. O painel avisa em vez de sumir.
      corpo.append(el("p", "ed__aviso",
        `O tipo "${bloco.tipo}" não existe no catálogo. O bloco continua no fluxo, mas não roda.`))
      elemento.replaceChildren(corpo)
      return
    }

    for (const campo of definicao.campos) {
      if (campo.tipo === "lista" && campo.nome === "opcoes") {
        corpo.append(listaDeOpcoes(fluxo, grupo, bloco, emitir))
        continue
      }
      if (campo.tipo === "lista") {
        corpo.append(el("p", "ed__aviso",
          `"${campo.rotulo}" ainda se edita no arquivo. O editor visual chega numa próxima fatia.`))
        continue
      }
      corpo.append(linha(campo.rotulo, entrada(campo.tipo, (bloco.conteudo || {})[campo.nome], (v) =>
        emitir(definirCampo(fluxo, { grupo: grupo.id, bloco: bloco.id, campo: campo.nome, valor: v })))))
    }

    if (definicao.salva_variavel) {
      corpo.append(linha("Salvar na variável", entrada("texto", bloco.salvar_em, (v) =>
        emitir(definirSalvarEm(fluxo, { grupo: grupo.id, bloco: bloco.id, valor: v })))))
    }

    elemento.replaceChildren(corpo)
  }

  function listaDeOpcoes(fluxo, grupo, bloco, emitir) {
    const caixa = el("div", "ed__opcoes")
    caixa.append(el("span", "ed__rotulo", "Opções"))

    for (const opcao of (bloco.conteudo?.opcoes || []).filter(Boolean)) {
      const linhaOpcao = el("div", "ed__opcao")
      const editar = (campo) => (v) =>
        emitir(definirOpcao(fluxo, { grupo: grupo.id, bloco: bloco.id, opcao: opcao.id, campo, valor: v }))

      linhaOpcao.append(entrada("texto", opcao.label, editar("label")))
      linhaOpcao.append(entrada("numero", opcao.pontos, editar("pontos")))
      linhaOpcao.append(seletorDeGrupo(fluxo, null, opcao.proximo, "ed__opcao-destino", editar("proximo")))

      const apagar = el("button", "ed__remover-opcao", "×")
      apagar.setAttribute("type", "button")
      apagar.addEventListener("click", () =>
        emitir(removerOpcao(fluxo, { grupo: grupo.id, bloco: bloco.id, opcao: opcao.id })))
      linhaOpcao.append(apagar)

      caixa.append(linhaOpcao)
    }

    const mais = el("button", "ed__acrescentar-opcao", "Acrescentar opção")
    mais.setAttribute("type", "button")
    mais.addEventListener("click", () =>
      emitir(acrescentarOpcao(fluxo, { grupo: grupo.id, bloco: bloco.id })))
    caixa.append(mais)
    return caixa
  }

  return { mostrar }
}
