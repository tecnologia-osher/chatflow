// O editor inteiro: paleta, canvas, painel e preview.
//
// O fluxo é o único estado. Toda edição devolve um fluxo novo e a tela é
// redesenhada a partir dele — não há estado espalhado que possa divergir.

import { criarCanvas } from "./canvas.js"
import { criarPainel } from "./painel.js"
import { todos } from "./catalogo.js"
import { acrescentarBloco, criarGrupo, moverGrupo } from "./edicoes.js"
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

  const raiz = el("div", "ed")
  const paleta = el("aside", "ed__paleta")
  const centro = el("main", "ed__centro")
  const barra = el("header", "ed__barra")
  const palcoCanvas = el("div", "ed__area-canvas")
  const problemas = el("div", "ed__problemas")
  const lateral = el("aside", "ed__lateral")
  const areaPainel = el("div", "ed__area-painel")
  lateral.append(areaPainel)
  // O preview vive fora da coluna: aparece sobreposto quando pedido, para o
  // canvas ficar com a tela inteira enquanto se monta o fluxo.
  const areaPreview = el("div", "ed__area-preview")
  centro.append(barra, palcoCanvas, problemas)
  raiz.append(paleta, centro, lateral, areaPreview)
  elemento.replaceChildren(raiz)

  const canvas = criarCanvas({
    elemento: palcoCanvas,
    aoSelecionar: (nova) => { selecao = nova; recado = ""; desenharPainel(); desenharPaleta() },
    aoMover: (grupo, { x, y }) => { atual = moverGrupo(atual, { grupo, x, y }); redesenhar({ manterVista: true }) },
    aoTestar: (grupo) => preview.abrir(atual, grupo)
  })
  const preview = criarPreview({ elemento: areaPreview })
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

  const testar = el("button", "ed__testar", "▶ Testar")
  testar.setAttribute("type", "button")
  testar.addEventListener("click", () => preview.abrir(atual, null))

  const baixar = el("button", "ed__baixar", "Baixar fluxo.json")
  baixar.setAttribute("type", "button")
  baixar.addEventListener("click", () => aoBaixar(JSON.stringify(atual, null, 2), "fluxo.json"))

  barra.append(el("span", "ed__marca", `chatflow · ${cliente}`), testar, criar, baixar)

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

  function desenharPainel() {
    painel.mostrar({ fluxo: atual, selecao })
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

  return {
    fluxo: () => atual,
    selecao: () => ({ ...selecao })
  }
}
