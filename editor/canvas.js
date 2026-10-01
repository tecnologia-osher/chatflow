// O canvas: cartões, setas, pan, zoom e arrastar grupo.
//
// Não mede nada do DOM. O tamanho do cartão vem de `caixas()` e a matemática
// da vista vem de `vista.js` — o que sobra aqui é traduzir isso em elemento.

import { cartoes, setas, caixas } from "./modelo.js"
import { criarVista, arrastar, aplicarZoom, paraMundo, ancoras, enquadrar } from "./vista.js"

const SVG = "http://www.w3.org/2000/svg"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

function svg(tag, classe) {
  const e = document.createElementNS(SVG, tag)
  // Em SVG, `className` é somente leitura. Atribuir lança TypeError e leva o
  // render inteiro junto — a página abre em branco com um erro no console.
  if (classe) e.setAttribute("class", classe)
  return e
}

export function criarCanvas({
  elemento, aoSelecionar = () => {}, aoMover = () => {}, aoTestar = () => {},
  aoEditarCampo = () => {}, aoRenomearGrupo = () => {},
  aoEditarOpcao = () => {}, aoAcrescentarOpcao = () => {}, aoRemoverOpcao = () => {},
  aoAbrirDetalhes = () => {}
}) {
  const palco = el("div", "ed__palco")
  const mundo = el("div", "ed__mundo")
  const tela = svg("svg", "ed__setas")
  const camadaCartoes = el("div", "ed__cartoes")
  mundo.append(tela, camadaCartoes)
  palco.append(mundo)
  elemento.replaceChildren(palco)

  let vista = criarVista()
  let fluxoAtual = null
  let selecao = { grupo: null, bloco: null }
  let editandoTitulo = null

  function aplicarVista() {
    mundo.style.setProperty("transform",
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`)
  }

  // --- arrasto: um só mecanismo para o fundo e para o cartão ---------------
  // O que muda entre os dois é o que fazer com o deslocamento. Escrever duas
  // vezes convidaria a corrigir um e esquecer o outro.
  function iniciarArrasto(ev, aoDeslocar) {
    if (ev.button !== undefined && ev.button !== 0) return
    ev.preventDefault?.()
    ev.stopPropagation?.()
    const inicio = { x: ev.clientX, y: ev.clientY }

    function mover(e) {
      aoDeslocar(e.clientX - inicio.x, e.clientY - inicio.y)
    }
    function soltar() {
      document.removeEventListener("mousemove", mover)
      document.removeEventListener("mouseup", soltar)
    }
    document.addEventListener("mousemove", mover)
    document.addEventListener("mouseup", soltar)
  }

  palco.addEventListener("mousedown", (ev) => {
    const base = { x: vista.x, y: vista.y }
    iniciarArrasto(ev, (dx, dy) => {
      vista = { ...vista, x: base.x + dx, y: base.y + dy }
      aplicarVista()
    })
  })

  palco.addEventListener("wheel", (ev) => {
    ev.preventDefault?.()
    vista = aplicarZoom(vista, { delta: ev.deltaY, ponto: { x: ev.clientX, y: ev.clientY } })
    aplicarVista()
  })

  function desenharSetas(lista, mapa) {
    tela.replaceChildren()
    for (const seta of lista) {
      const origem = seta.de ? mapa.get(seta.de) : null

      // Ligação para grupo que não existe: desenha um toco saindo da origem,
      // apontando para o vazio. Some com ela e o erro fica invisível — foi
      // justamente para vê-lo que o modelo marca a seta como órfã.
      const destino = mapa.get(seta.para) || (origem && {
        x: origem.x + origem.largura + 90, y: origem.y + origem.altura / 2,
        largura: 1, altura: 1
      })
      if (!destino) continue

      const caixaDeSaida = origem || {
        x: destino.x - 260, y: destino.y - 120, largura: 200, altura: 60
      }
      const { caminho } = ancoras(caixaDeSaida, destino)
      const classes = ["ed__seta", `ed__seta--${seta.origens[0]}`]
      if (seta.orfa) classes.push("ed__seta--orfa")
      if (seta.evento) classes.push("ed__seta--evento")

      const linha = svg("path", classes.join(" "))
      linha.setAttribute("d", caminho)
      linha.setAttribute("fill", "none")
      tela.append(linha)
    }
  }

  function desenharCartoes(lista, mapa) {
    camadaCartoes.replaceChildren()
    for (const cartao of lista) {
      const caixa = mapa.get(cartao.id)
      const ativo = selecao.grupo === cartao.id && !selecao.bloco
      const no = el("div", `ed__cartao${ativo ? " ed__cartao--ativo" : ""}`)
      no.style.setProperty("transform", `translate(${caixa.x}px, ${caixa.y}px)`)
      no.style.setProperty("width", `${caixa.largura}px`)

      const cabecalho = el("div", "ed__cabecalho")
      if (editandoTitulo === cartao.id) {
        const campo = el("input", "ed__titulo-campo")
        campo.setAttribute("type", "text")
        campo.value = cartao.titulo
        // O cabeçalho é a alça de arrasto. Sem parar aqui, clicar para pôr o
        // cursor no meio da palavra sairia arrastando o grupo.
        campo.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
        campo.addEventListener("click", (ev) => ev.stopPropagation?.())
        campo.addEventListener("input", () => aoRenomearGrupo({ grupo: cartao.id, valor: campo.value }))
        campo.addEventListener("blur", () => { editandoTitulo = null; desenhar(fluxoAtual) })
        cabecalho.append(campo)
      } else {
        const titulo = el("span", "ed__cabecalho-titulo", cartao.titulo)
        titulo.addEventListener("dblclick", (ev) => {
          ev.stopPropagation?.()
          editandoTitulo = cartao.id
          desenhar(fluxoAtual)
        })
        cabecalho.append(titulo)
      }

      // Testar a partir daqui. Para o clique e o mousedown: sem isso ele
      // selecionaria o grupo e começaria um arrasto junto.
      const play = el("button", "ed__play", "▶")
      play.setAttribute("type", "button")
      play.setAttribute("title", `Testar a partir de ${cartao.titulo}`)
      play.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
      play.addEventListener("click", (ev) => {
        ev.stopPropagation?.()
        aoTestar(cartao.id)
      })
      cabecalho.append(play)
      cabecalho.addEventListener("click", () => {
        selecao = { grupo: cartao.id, bloco: null }
        desenhar(fluxoAtual)
        aoSelecionar({ grupo: cartao.id, bloco: null })
      })
      cabecalho.addEventListener("mousedown", (ev) => {
        const base = { x: caixa.x, y: caixa.y }
        iniciarArrasto(ev, (dx, dy) => {
          // O deslocamento é de tela; a posição é de fluxo. Sem dividir pela
          // escala, o cartão foge do cursor assim que há zoom.
          aoMover(cartao.id, { x: base.x + dx / vista.escala, y: base.y + dy / vista.escala })
        })
      })
      no.append(cabecalho)

      for (const bloco of cartao.blocos) {
        const ativoB = selecao.bloco === bloco.id
        const classes = ["ed__bloco", `ed__bloco--${bloco.categoria || "desconhecido"}`]
        if (ativoB) classes.push("ed__bloco--ativo")
        if (bloco.desconhecido) classes.push("ed__bloco--desconhecido")
        const noBloco = el("div", classes.join(" "))
        const topo = el("div", "ed__bloco-topo")
        topo.append(el("span", "ed__bloco-rotulo", bloco.rotulo))

        // O que não cabe no cartão — pontuação, destino, texto do botão de
        // enviar — continua a um clique daqui, sem aparecer sozinho.
        const mais = el("button", "ed__bloco-mais", "⋯")
        mais.setAttribute("type", "button")
        mais.setAttribute("title", "Mais opções deste bloco")
        mais.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
        mais.addEventListener("click", (ev) => {
          ev.stopPropagation?.()
          aoAbrirDetalhes({ grupo: cartao.id, bloco: bloco.id })
        })
        topo.append(mais)
        noBloco.append(topo)

        if (bloco.opcoes) {
          noBloco.append(listaDeOpcoes(cartao, bloco))
        } else if (ativoB && bloco.campoPrincipal) {
          // Edita ali mesmo. Para o caso comum — a fala do chat — é tudo o
          // que a pessoa precisa, e não tira os olhos do fluxo.
          const campo = el("textarea", "ed__bloco-campo")
          campo.value = bloco.valorPrincipal
          campo.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
          campo.addEventListener("click", (ev) => ev.stopPropagation?.())
          campo.addEventListener("input", () => aoEditarCampo({
            grupo: cartao.id, bloco: bloco.id, campo: bloco.campoPrincipal, valor: campo.value
          }))
          noBloco.append(campo)
        } else {
          noBloco.append(el("span", "ed__bloco-resumo", bloco.resumo))
        }
        noBloco.addEventListener("click", (ev) => {
          ev.stopPropagation?.()
          selecao = { grupo: cartao.id, bloco: bloco.id }
          desenhar(fluxoAtual)
          aoSelecionar({ grupo: cartao.id, bloco: bloco.id })
        })
        no.append(noBloco)
      }

      camadaCartoes.append(no)
    }
  }

  // As opções do bloco de botões moram no cartão: é onde se escreve o que
  // cada botão vai dizer. Enter abre a próxima, Backspace numa vazia a tira —
  // escrever uma lista não deve exigir ir e voltar de um painel.
  function listaDeOpcoes(cartao, bloco) {
    const caixa = el("div", "ed__opcoes-cartao")
    for (const opcao of bloco.opcoes) {
      const linhaOpcao = el("div", "ed__opcao-cartao")

      const campo = el("input", "ed__opcao-campo")
      campo.setAttribute("type", "text")
      campo.setAttribute("placeholder", "Escreva o botão")
      campo.value = opcao.label
      campo.dadosOpcao = opcao.id
      campo.dadosBloco = bloco.id
      campo.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
      campo.addEventListener("click", (ev) => ev.stopPropagation?.())
      campo.addEventListener("input", () => aoEditarOpcao({
        grupo: cartao.id, bloco: bloco.id, opcao: opcao.id, valor: campo.value
      }))
      campo.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault?.()
          aoAcrescentarOpcao({ grupo: cartao.id, bloco: bloco.id, apos: opcao.id })
        }
        if (ev.key === "Backspace" && campo.value === "") {
          ev.preventDefault?.()
          aoRemoverOpcao({ grupo: cartao.id, bloco: bloco.id, opcao: opcao.id })
        }
      })
      linhaOpcao.append(campo)

      const ponto = el("span", `ed__opcao-ponto${opcao.proximo ? " ed__opcao-ponto--ligado" : ""}`)
      ponto.setAttribute("title", opcao.proximo ? `Vai para ${opcao.proximo}` : "Sem destino")
      linhaOpcao.append(ponto)

      caixa.append(linhaOpcao)
    }
    return caixa
  }

  function desenhar(fluxo) {
    fluxoAtual = fluxo
    const lista = cartoes(fluxo)
    const mapa = caixas(lista)
    desenharSetas(setas(fluxo), mapa)
    desenharCartoes(lista, mapa)
    aplicarVista()
  }

  return {
    desenhar,
    // Põe todo o fluxo na tela. Chamado na abertura e pelo botão da barra —
    // nunca em cada redesenho, senão brigaria com quem está arrastando.
    enquadrar() {
      if (!fluxoAtual) return
      vista = enquadrar([...caixas(cartoes(fluxoAtual)).values()], {
        largura: palco.clientWidth || elemento.clientWidth || 0,
        altura: palco.clientHeight || elemento.clientHeight || 0
      })
      aplicarVista()
    },
    // Põe o cursor numa opção depois de redesenhar: quem aperta Enter espera
    // continuar digitando, não caçar a caixa nova com o mouse.
    focarOpcao(blocoId, opcaoId) {
      const alvo = camadaCartoes.porClasse
        ? camadaCartoes.porClasse("ed__opcao-campo")
        : [...camadaCartoes.querySelectorAll(".ed__opcao-campo")]
      const campo = alvo.find((c) => c.dadosBloco === blocoId && c.dadosOpcao === opcaoId)
      if (campo) campo.focus()
    },
    vista: () => ({ ...vista }),
    selecionar(nova) {
      selecao = { grupo: nova.grupo ?? null, bloco: nova.bloco ?? null }
      if (fluxoAtual) desenhar(fluxoAtual)
    }
  }
}
