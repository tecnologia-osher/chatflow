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
  definirOpcao, acrescentarOpcao, removerOpcao, proximoIdDeOpcao,
  definirProximoDoEvento, moverEvento, definirProximo, limparOpcoesVazias
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
      // Redesenho inteiro, e não só painel e paleta: trocar de seleção é
      // trocar de lugar na tela, e é aí que a opção que ninguém nomeou sai.
      redesenhar()
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
      // Varre antes de criar: se a linha anterior ficou vazia, ela sai agora.
      // Depois não pode varrer — a recém-nascida está vazia de propósito.
      atual = limparOpcoesVazias(atual)
      const nova = proximoIdDeOpcao(atual, { grupo, bloco })
      atual = acrescentarOpcao(atual, { grupo, bloco, apos })
      desenharTudo()
      canvas.focarOpcao(bloco, nova)
    },
    aoRemoverOpcao: ({ grupo, bloco, opcao }) => {
      atual = removerOpcao(atual, { grupo, bloco, opcao })
      redesenhar()
    },
    aoLigarGrupo: ({ grupo, destino }) => {
      atual = definirProximo(atual, { grupo, valor: destino })
      redesenhar()
    },
    aoLigarEvento: ({ evento, destino }) => {
      atual = definirProximoDoEvento(atual, { tipo: evento, destino })
      redesenhar()
    },
    aoMoverEvento: ({ evento, x, y }) => {
      atual = moverEvento(atual, { tipo: evento, x, y })
      redesenhar()
    },
    aoLigarOpcao: ({ grupo, bloco, opcao, destino }) => {
      atual = definirOpcao(atual, { grupo, bloco, opcao, campo: "proximo", valor: destino })
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

  barra.append(el("span", "ed__marca", `chatflow · ${cliente}`), testar, ajustar, baixar)

  // --- paleta ----------------------------------------------------------
  function desenharPaleta() {
    const caixa = el("div", "ed__paleta-corpo")
    caixa.append(el("div", "ed__recado", recado))
    // O gesto não se descobre sozinho: sem o botão "Novo grupo", alguém tem
    // de dizer que é arrastando daqui que um grupo nasce.
    caixa.append(el("p", "ed__dica", "Arraste um tipo até o quadro para criar um grupo. Solte sobre um cartão para pôr o bloco nele."))

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
        botao.addEventListener("mousedown", (ev) => arrastarTipo(ev, definicao))
        botao.addEventListener("click", () => {
          if (!selecao.grupo) {
            // Sem grupo escolhido não há onde pôr o bloco — e agora há um
            // gesto melhor que escolher: arrastar até o quadro.
            recado = "Arraste o tipo até o quadro para criar um grupo, ou selecione um grupo antes de clicar."
            desenharPaleta()
            return
          }
          acrescentarNoGrupo(selecao.grupo, definicao.tipo, selecao.bloco)
        })
        grade.append(botao)
      }
      caixa.append(grade)
    }
    paleta.replaceChildren(caixa)
  }

  // O mesmo caminho para o clique e para o arrasto: o bloco entra no grupo e
  // nasce selecionado, pronto para escrever.
  function acrescentarNoGrupo(grupoId, tipo, apos = null) {
    const antes = new Set((atual.grupos.find((g) => g.id === grupoId)?.blocos || []).map((b) => b.id))
    atual = acrescentarBloco(atual, { grupo: grupoId, tipo, apos })
    const grupo = atual.grupos.find((g) => g.id === grupoId)
    const novo = (grupo?.blocos || []).find((b) => !antes.has(b.id))
    selecao = { grupo: grupoId, bloco: novo ? novo.id : null }
    recado = ""
    redesenhar()
  }

  // Arrastar um tipo da paleta até o quadro. Solto no vazio, cria um grupo
  // ali mesmo com o bloco dentro; solto sobre um cartão, entra nele. É o que
  // substituiu o botão "Novo grupo": grupo vazio não serve para nada, e o
  // gesto diz onde ele deve ficar.
  function arrastarTipo(ev, definicao) {
    if (ev.button !== undefined && ev.button !== 0) return
    ev.preventDefault?.()
    const fantasma = el("div", "ed__fantasma", definicao.rotulo)
    let visivel = false

    function mover(e) {
      if (!visivel) { raiz.append(fantasma); visivel = true }
      fantasma.style.setProperty("left", `${e.clientX + 14}px`)
      fantasma.style.setProperty("top", `${e.clientY + 14}px`)
    }

    function soltar(e) {
      document.removeEventListener("mousemove", mover)
      document.removeEventListener("mouseup", soltar)
      fantasma.remove()
      // Soltar fora do palco não faz nada — inclusive o clique seco na
      // própria paleta, que termina onde começou e cai aqui.
      const alvo = canvas.alvoDe(e)
      if (!alvo.dentro) return
      if (alvo.grupo) { acrescentarNoGrupo(alvo.grupo, definicao.tipo); return }

      const antes = new Set(atual.grupos.map((g) => g.id))
      atual = criarGrupo(atual, alvo.ponto)
      const novo = atual.grupos.find((g) => !antes.has(g.id))
      acrescentarNoGrupo(novo.id, definicao.tipo)
    }

    document.addEventListener("mousemove", mover)
    document.addEventListener("mouseup", soltar)
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

  // Redesenhar os cartões significa que o cursor saiu de onde estava: é a
  // hora de desfazer as opções que ninguém nomeou. O caminho normal é o blur
  // da própria caixa, mas quando o clique cai num cabeçalho o navegador
  // cancela o blur e o redesenho apaga a caixa sem avisar ninguém.
  function redesenhar() {
    atual = limparOpcoesVazias(atual)
    desenharTudo()
  }

  function desenharTudo() {
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
