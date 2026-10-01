// O editor inteiro: paleta, canvas, painel e preview.
//
// O fluxo é o único estado. Toda edição devolve um fluxo novo e a tela é
// redesenhada a partir dele — não há estado espalhado que possa divergir.

import { criarCanvas } from "./canvas.js"
import { criarPainel } from "./painel.js"
import { todos } from "./catalogo.js"
import { campoPrincipal } from "./modelo.js"
import {
  acrescentarBloco, criarGrupo, moverGrupo, definirCampo, definirTitulo,
  definirOpcao, acrescentarOpcao, removerOpcao, proximoIdDeOpcao
} from "./edicoes.js"
import { validarFluxo } from "../motor/validar.js"
import { criarPreview } from "./preview.js"

const NOME_DA_CATEGORIA = {
  fala: "Fala", entrada: "Entrada", logica: "Lógica", conexao: "Conexão"
}

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

export function criarEditor({ elemento, fluxo, cliente = "exemplo", aoBaixar = () => {} }) {
  let atual = fluxo
  let selecao = { grupo: null, bloco: null }
  let recado = ""
  let detalhesAbertos = false

  const raiz = el("div", "ed")
  const paleta = el("aside", "ed__paleta")
  const centro = el("main", "ed__centro")
  const barra = el("header", "ed__barra")
  const palcoCanvas = el("div", "ed__area-canvas")
  const problemas = el("div", "ed__problemas")
  // Nem painel nem preview ocupam coluna: os dois flutuam e só existem
  // enquanto são necessários. O canvas fica com o resto da tela.
  const areaPainel = el("div", "ed__area-painel")
  const areaPreview = el("div", "ed__area-preview")
  centro.append(barra, palcoCanvas, problemas)
  raiz.append(paleta, centro, areaPainel, areaPreview)
  elemento.replaceChildren(raiz)

  const canvas = criarCanvas({
    elemento: palcoCanvas,
    aoSelecionar: (nova) => {
      selecao = nova
      recado = ""
      detalhesAbertos = false
      desenharPainel()
      desenharPaleta()
    },
    aoEditarCampo: ({ grupo, bloco, campo, valor }) => {
      atual = definirCampo(atual, { grupo, bloco, campo, valor })
      semRedesenharCartoes()
    },
    aoRenomearGrupo: ({ grupo, valor }) => {
      atual = definirTitulo(atual, { grupo, valor })
      semRedesenharCartoes()
    },
    aoEditarOpcao: ({ grupo, bloco, opcao, valor }) => {
      atual = definirOpcao(atual, { grupo, bloco, opcao, campo: "label", valor })
      semRedesenharCartoes()
    },
    aoAcrescentarOpcao: ({ grupo, bloco, apos }) => {
      const nova = proximoIdDeOpcao(atual, { grupo, bloco })
      atual = acrescentarOpcao(atual, { grupo, bloco, apos })
      redesenhar()
      canvas.focarOpcao(bloco, nova)
    },
    aoRemoverOpcao: ({ grupo, bloco, opcao }) => {
      atual = removerOpcao(atual, { grupo, bloco, opcao })
      redesenhar()
    },
    aoAbrirDetalhes: ({ grupo, bloco }) => {
      selecao = { grupo, bloco }
      detalhesAbertos = true
      redesenhar()
    },
    aoMover: (grupo, { x, y }) => { atual = moverGrupo(atual, { grupo, x, y }); redesenhar({ manterVista: true }) },
    aoTestar: (grupo) => { preview.abrir(atual, grupo); sincronizarTestar() }
  })
  const preview = criarPreview({ elemento: areaPreview, aoFechar: () => sincronizarTestar() })
  const painel = criarPainel({
    elemento: areaPainel,
    aoEditar: (novo) => { atual = novo; redesenhar() }
  })

  // --- barra -----------------------------------------------------------
  const criar = el("button", "ed__criar-grupo", "Novo grupo")
  criar.setAttribute("type", "button")
  criar.addEventListener("click", () => {
    const antes = new Set(atual.grupos.map((g) => g.id))
    atual = criarGrupo(atual, { x: 80, y: 80 })
    const novo = atual.grupos.find((g) => !antes.has(g.id))
    selecao = { grupo: novo.id, bloco: null }
    redesenhar()
  })

  const ajustar = el("button", "ed__ajustar", "Ajustar à tela")
  ajustar.setAttribute("type", "button")
  ajustar.addEventListener("click", () => canvas.enquadrar())

  const testar = el("button", "ed__testar", "▶ Testar")
  testar.setAttribute("type", "button")
  testar.addEventListener("click", () => { preview.abrir(atual, null); sincronizarTestar() })

  // Com a aba de teste aberta, o botão não tem o que fazer: some, e volta
  // quando ela fecha. Um botão que não faz nada é pior que botão nenhum.
  function sincronizarTestar() {
    testar.className = preview.aberto() ? "ed__testar ed__oculto" : "ed__testar"
  }

  const baixar = el("button", "ed__baixar", "Baixar fluxo.json")
  baixar.setAttribute("type", "button")
  baixar.addEventListener("click", () => aoBaixar(JSON.stringify(atual, null, 2), "fluxo.json"))

  barra.append(el("span", "ed__marca", `chatflow · ${cliente}`), criar, testar, ajustar, baixar)

  // --- paleta ----------------------------------------------------------
  function desenharPaleta() {
    const caixa = el("div", "ed__paleta-corpo")
    caixa.append(el("div", "ed__recado", recado))

    const porCategoria = new Map()
    for (const definicao of todos()) {
      if (!porCategoria.has(definicao.categoria)) porCategoria.set(definicao.categoria, [])
      porCategoria.get(definicao.categoria).push(definicao)
    }

    for (const [categoria, lista] of porCategoria) {
      caixa.append(el("h3", "ed__categoria", NOME_DA_CATEGORIA[categoria] || categoria))
      const grade = el("div", "ed__grade")
      for (const definicao of lista) {
        const botao = el("button", `ed__tipo ed__tipo--${categoria}`, definicao.rotulo)
        botao.setAttribute("type", "button")
        botao.addEventListener("click", () => {
          if (!selecao.grupo) {
            // Sem grupo escolhido não há onde pôr o bloco. Dizer isso é melhor
            // que criar um grupo por conta própria no meio do canvas.
            recado = "Selecione um grupo no canvas antes de acrescentar um bloco."
            desenharPaleta()
            return
          }
          const antes = new Set((atual.grupos.find((g) => g.id === selecao.grupo).blocos || []).map((b) => b.id))
          atual = acrescentarBloco(atual, { grupo: selecao.grupo, tipo: definicao.tipo, apos: selecao.bloco })
          const grupo = atual.grupos.find((g) => g.id === selecao.grupo)
          const novo = grupo.blocos.find((b) => !antes.has(b.id))
          selecao = { grupo: selecao.grupo, bloco: novo.id }
          recado = ""
          redesenhar()
        })
        grade.append(botao)
      }
      caixa.append(grade)
    }
    paleta.replaceChildren(caixa)
  }

  function desenharProblemas() {
    const relatorio = validarFluxo(atual, { destinos: {} })
    problemas.textContent = relatorio.valido ? "" : relatorio.erros.join(" · ")
  }

  // O painel só aparece quando há algo que a caixa do cartão não resolve:
  // o grupo (para ligar o próximo) ou um bloco cujo conteúdo é lista.
  // O painel deixou de aparecer sozinho ao clicar num bloco: o cartão resolve
  // o texto e as opções. Ele volta quando o grupo é selecionado (para ligar o
  // próximo) ou quando alguém pede os detalhes pelo ⋯.
  function precisaDePainel() {
    if (!selecao.grupo) return false
    if (!selecao.bloco) return true
    return detalhesAbertos
  }

  function desenharPainel() {
    if (!precisaDePainel()) { areaPainel.replaceChildren(); return }
    painel.mostrar({ fluxo: atual, selecao, aoFechar: () => {
      selecao = { grupo: null, bloco: null }
      detalhesAbertos = false
      areaPainel.replaceChildren()
      canvas.selecionar({ grupo: null, bloco: null })
    } })
  }

  // Edição dentro do cartão: refaz tudo menos os cartões, para a caixa de
  // texto não ser recriada a cada tecla e o cursor não saltar para o fim.
  function semRedesenharCartoes() {
    desenharProblemas()
    preview.atualizar(atual)
  }

  function redesenhar() {
    canvas.desenhar(atual)
    canvas.selecionar(selecao)
    desenharPainel()
    desenharPaleta()
    desenharProblemas()
    preview.atualizar(atual)
  }

  redesenhar()
  // O fluxo da Osher é mais alto que a tela. Abrir mostrando só o topo faz
  // parecer que o editor cortou o trabalho.
  canvas.enquadrar()

  return {
    fluxo: () => atual,
    selecao: () => ({ ...selecao }),
    vista: () => canvas.vista()
  }
}
