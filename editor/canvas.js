// O canvas: cartões, setas, pan, zoom e arrastar grupo.
//
// Não mede nada do DOM. O tamanho do cartão vem de `caixas()` e a matemática
// da vista vem de `vista.js` — o que sobra aqui é traduzir isso em elemento.

import {
  cartoes, setas, caixas, caixaDoBloco, caixaDaSaida, comConector, blocoEmCaixa,
  eventosDoCanvas, caixasDeEventos
} from "./modelo.js"
import { partesDoDestino, montarDestino } from "../motor/destino.js"
import {
  criarVista, arrastar, aplicarZoom, paraMundo, ancoras, enquadrar, caixaEm, pontaDaSeta
} from "./vista.js"

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
  aoSelecionarLigacao = () => {}, aoApagarLigacao = () => {}, aoApagarGrupo = () => {},
  aoDuplicarGrupo = () => {},
  aoEditarCampo = () => {}, aoRenomearGrupo = () => {},
  aoEditarOpcao = () => {}, aoAcrescentarOpcao = () => {}, aoRemoverOpcao = () => {},
  aoAbrirDetalhes = () => {}, aoLigarOpcao = () => {},
  aoLigarEvento = () => {}, aoMoverEvento = () => {}, aoLigarGrupo = () => {}
}) {
  const palco = el("div", "ed__palco")
  const mundo = el("div", "ed__mundo")
  const tela = svg("svg", "ed__setas")
  const camadaEventos = el("div", "ed__eventos")
  const camadaCartoes = el("div", "ed__cartoes")
  mundo.append(tela, camadaEventos, camadaCartoes)
  palco.append(mundo)
  elemento.replaceChildren(palco)

  let vista = criarVista()
  let fluxoAtual = null
  let selecao = { grupo: null, bloco: null }
  const FOLGA_DO_CLIQUE = 3
  const nosDeCartoes = new Map()
  let setaSelecionada = null
  let menuAberto = null
  let editandoTitulo = null
  // Se o último mousedown virou arrasto. O clique no nome consulta isto.
  let arrastou = false
  let caixasAtuais = new Map()
  let caixasEventoAtuais = new Map()
  let fioTemporario = null

  // clientX/clientY são da JANELA; o palco começa depois da paleta e da
  // barra. Sem descontar a origem dele, o zoom ancora no ponto errado e a
  // ligação é solta num grupo que não é o que está sob o cursor.
  function noPalco(ev) {
    const caixa = palco.getBoundingClientRect?.() || { left: 0, top: 0 }
    return { x: ev.clientX - caixa.left, y: ev.clientY - caixa.top }
  }

  function aplicarVista() {
    mundo.style.setProperty("transform",
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`)
  }

  // --- arrasto: um só mecanismo para o fundo e para o cartão ---------------
  // O que muda entre os dois é o que fazer com o deslocamento. Escrever duas
  // vezes convidaria a corrigir um e esquecer o outro.
  function iniciarArrasto(ev, aoDeslocar) {
    if (ev.button !== undefined && ev.button !== 0) return
    // Arrastar é sair de perto: a caixa de renomear fecha. Ela não fechava
    // sozinha porque o preventDefault abaixo segura o foco onde está, e sem
    // perder o foco não há blur — a caixa ficava aberta atrás do arrasto.
    if (editandoTitulo) {
      editandoTitulo = null
      desenhar(fluxoAtual)
    }
    ev.preventDefault?.()
    ev.stopPropagation?.()
    const inicio = { x: ev.clientX, y: ev.clientY }
    arrastou = false

    function mover(e) {
      const dx = e.clientX - inicio.x
      const dy = e.clientY - inicio.y
      // Tremida de mão não é arrasto: sem a folga, clicar no nome para
      // renomear sairia movendo o cartão um pixel e o clique se perderia.
      if (Math.abs(dx) > FOLGA_DO_CLIQUE || Math.abs(dy) > FOLGA_DO_CLIQUE) arrastou = true
      aoDeslocar(dx, dy)
    }
    function soltar() {
      document.removeEventListener("mousemove", mover)
      document.removeEventListener("mouseup", soltar)
    }
    document.addEventListener("mousemove", mover)
    document.addEventListener("mouseup", soltar)
  }

  palco.addEventListener("mousedown", (ev) => {
    limparLigacao()
    const base = { x: vista.x, y: vista.y }
    iniciarArrasto(ev, (dx, dy) => {
      vista = { ...vista, x: base.x + dx, y: base.y + dy }
      aplicarVista()
    })
  })

  palco.addEventListener("wheel", (ev) => {
    ev.preventDefault?.()
    fecharMenu()
    vista = aplicarZoom(vista, { delta: ev.deltaY, ponto: noPalco(ev) })
    aplicarVista()
  })

  // Arrastar a ligação: um fio acompanha o cursor e, ao soltar, o grupo que
  // estiver embaixo vira o destino. Soltar no vazio não faz nada — apagar uma
  // ligação por acidente seria pior que exigir um clique a mais no painel.
  // De onde o fio nasce: a borda do cartão (ou do Start), na altura da
  // bolinha que foi puxada. É assim que a seta pronta sai, e o fio precisa
  // sair igual — senão ele muda de lugar ao ser soltado.
  function caixaDaOrigem(origem, partida) {
    if (origem.grupo) {
      return caixaDaSaida(caixasAtuais.get(origem.grupo), origem) ||
        { x: partida.x, y: partida.y, largura: 0, altura: 0 }
    }
    return comConector(caixasEventoAtuais.get(origem.evento)) ||
      { x: partida.x, y: partida.y, largura: 0, altura: 0 }
  }

  function iniciarLigacao(ev, origem, avisar = (o, destino) => aoLigarOpcao({ ...o, destino })) {
    if (ev.button !== undefined && ev.button !== 0) return
    ev.preventDefault?.()
    ev.stopPropagation?.()
    const partida = paraMundo(vista, noPalco(ev))

    function mover(e) {
      const ponto = paraMundo(vista, noPalco(e))
      const alvo = alvoDaLigacao(ponto)
      marcarAlvo(alvo)
      // Grudado, o fio mira a mesma caixa que a seta de verdade vai mirar: o
      // cartão, ou a faixa do bloco. Solto, mira o cursor.
      const mira = alvo
        ? caixaDoBloco(caixasAtuais.get(alvo.grupo), alvo.bloco)
        : { x: ponto.x, y: ponto.y, largura: 0, altura: 0 }
      fioTemporario = { caixaDeOrigem: caixaDaOrigem(origem, partida), alvo: mira }
      desenharFio()
    }
    function soltar(e) {
      document.removeEventListener("mousemove", mover)
      document.removeEventListener("mouseup", soltar)
      fioTemporario = null
      desenharFio()
      marcarAlvo(null)
      const alvo = alvoDaLigacao(paraMundo(vista, noPalco(e)))
      if (alvo) avisar(origem, montarDestino(alvo.grupo, alvo.bloco))
    }
    document.addEventListener("mousemove", mover)
    document.addEventListener("mouseup", soltar)
  }

  // O fio que acompanha o cursor é desenhado com a mesma matemática da seta
  // de verdade: sai perpendicular à borda do cartão de origem, pelo lado que
  // olha para o cursor, e curva até ele. Era uma reta, e por isso o desenho
  // mudava de forma no instante em que a ligação era feita.
  function selecionarLigacao(seta) {
    setaSelecionada = seta.chave
    fecharMenu()
    desenhar(fluxoAtual)
    aoSelecionarLigacao(seta)
  }

  function limparLigacao() {
    if (!setaSelecionada && !menuAberto) return
    setaSelecionada = null
    fecharMenu()
    desenhar(fluxoAtual)
  }

  function fecharMenu() {
    menuAberto?.remove()
    menuAberto = null
  }

  // O menu da ligação mora no palco, não no mundo: assim não cresce nem
  // encolhe com o zoom, e aparece onde a pessoa clicou.
  function abrirMenuDaLigacao(ev, seta) {
    fecharMenu()
    const onde = noPalco(ev)
    const menu = el("div", "ed__menu-ligacao")
    menu.style.setProperty("left", `${onde.x}px`)
    menu.style.setProperty("top", `${onde.y}px`)
    menu.addEventListener("mousedown", (e) => e.stopPropagation?.())

    // Caminho que o editor não sabe refazer não ganha botão de apagar: ficar
    // sem a ligação e sem como recriá-la é pior que não poder apagar.
    if (seta.origens.includes("condicao")) {
      menu.append(el("span", "ed__menu-aviso",
        "Este caminho vem de uma regra de condição, que ainda não se edita aqui."))
    } else {
      const apagar = el("button", "ed__menu-excluir", "Excluir")
      apagar.setAttribute("type", "button")
      apagar.addEventListener("click", (e) => {
        e.stopPropagation?.()
        fecharMenu()
        setaSelecionada = null
        aoApagarLigacao(seta)
      })
      menu.append(apagar)
    }
    palco.append(menu)
    menuAberto = menu
  }

  const LIXEIRA = "M3 5h10M6.5 5V3.5h3V5M4.5 5l.6 7.5h5.8L11.5 5"
  const DUPLICAR = "M5.5 2.5h6a1 1 0 0 1 1 1v6M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"

  function iconeDeAcao(classe, caminho, rotulo, aoClicar) {
    const botao = el("button", `ed__acao ${classe}`)
    botao.setAttribute("type", "button")
    botao.setAttribute("aria-label", rotulo)
    const desenho = document.createElementNS(SVG, "svg")
    desenho.setAttribute("class", "ed__acao-icone")
    desenho.setAttribute("viewBox", "0 0 16 16")
    const traco = svg("path")
    traco.setAttribute("d", caminho)
    desenho.append(traco)
    botao.append(desenho)
    // Dica própria, não a do navegador: a nativa demora um segundo para
    // aparecer e não dá para alinhar com o menu.
    botao.append(el("span", "ed__acao-dica", rotulo))
    botao.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
    botao.addEventListener("click", (ev) => {
      ev.stopPropagation?.()
      fecharMenu()
      aoClicar()
    })
    return botao
  }

  // As ações do grupo, numa caixa flutuante acima do ⋯. Ela abre para dentro
  // do cartão — a borda direita encosta no botão e o resto cresce para a
  // esquerda — senão vazaria para fora do canvas em qualquer cartão da ponta.
  function abrirAcoesDoGrupo(ev, cartao) {
    fecharMenu()
    const onde = noPalco(ev)
    const menu = el("div", "ed__menu-ligacao ed__menu-acoes")
    menu.style.setProperty("left", `${onde.x}px`)
    menu.style.setProperty("top", `${onde.y}px`)
    menu.addEventListener("mousedown", (e) => e.stopPropagation?.())
    menu.addEventListener("contextmenu", (e) => e.preventDefault?.())
    menu.append(
      iconeDeAcao("ed__acao--duplicar", DUPLICAR, "Duplicar", () => aoDuplicarGrupo({ grupo: cartao.id })),
      iconeDeAcao("ed__acao--excluir", LIXEIRA, "Excluir", () => aoApagarGrupo({ grupo: cartao.id }))
    )
    palco.append(menu)
    menuAberto = menu
  }

  function abrirMenuDoGrupo(ev, cartao) {
    fecharMenu()
    const onde = noPalco(ev)
    const menu = el("div", "ed__menu-ligacao")
    menu.style.setProperty("left", `${onde.x}px`)
    menu.style.setProperty("top", `${onde.y}px`)
    menu.addEventListener("mousedown", (e) => e.stopPropagation?.())
    menu.addEventListener("contextmenu", (e) => e.preventDefault?.())

    const quantos = cartao.blocos.length
    // O número de blocos no botão é o peso do que vai embora. Sem desfazer no
    // editor, a pessoa merece saber o tamanho do estrago antes de clicar.
    const apagar = el("button", "ed__menu-excluir",
      quantos ? `Excluir grupo (${quantos} ${quantos === 1 ? "bloco" : "blocos"})` : "Excluir grupo")
    apagar.setAttribute("type", "button")
    apagar.addEventListener("click", (e) => {
      e.stopPropagation?.()
      fecharMenu()
      aoApagarGrupo({ grupo: cartao.id })
    })
    menu.append(apagar)
    palco.append(menu)
    menuAberto = menu
  }

  function desenharFio() {
    for (const classe of ["ed__seta--arrastando", "ed__ponta--arrastando"]) {
      const antigo = tela.porClasse ? tela.porClasse(classe)[0] : tela.querySelector(`.${classe}`)
      if (antigo) antigo.remove()
    }
    if (!fioTemporario) return
    const { caixaDeOrigem, alvo } = fioTemporario
    const { caminho, para, ladoPara } = ancoras(caixaDeOrigem, alvo)

    const linha = svg("path", "ed__seta ed__seta--arrastando")
    linha.setAttribute("d", caminho)
    linha.setAttribute("fill", "none")
    tela.append(linha)

    const ponta = svg("path", "ed__ponta ed__ponta--arrastando")
    ponta.setAttribute("d", pontaDaSeta(para, ladoPara))
    tela.append(ponta)
  }

  // O ímã só pega quando o ponteiro entra no cartão — como no Typebot, que
  // acende o alvo no mouseenter do bloco, não a uma distância. A folga é de
  // alguns pixels de tela, para a borda não exigir pontaria de um pixel; mais
  // que isso o fio salta antes de a pessoa chegar, e parece que ele decidiu
  // por ela.
  const IMA_NA_TELA = 10

  // Em cima do cartão, o ímã mira o bloco sob o cursor — é o que deixa uma
  // ligação entrar no meio do grupo, para reaproveitar o miolo dele. No
  // cabeçalho, no rodapé, ou chegando por fora pela folga do ímã, o alvo é o
  // grupo inteiro: apontar para o nome do cartão é pedir o fluxo todo.
  function alvoDaLigacao(ponto) {
    const exato = caixaEm(caixasAtuais, ponto)
    if (exato) {
      return { grupo: exato, bloco: blocoEmCaixa(caixasAtuais.get(exato), ponto) }
    }
    const margem = IMA_NA_TELA / (vista.escala || 1)
    const perto = caixaEm(caixasAtuais, ponto, margem)
    return perto ? { grupo: perto, bloco: null } : null
  }

  function marcarAlvo(alvo) {
    for (const [grupo, no] of nosDeCartoes) {
      const base = no.className.replace(" ed__cartao--alvo", "")
      no.className = grupo === alvo?.grupo ? `${base} ed__cartao--alvo` : base
    }
    for (const bloco of acharNaCamada("ed__bloco")) {
      const base = bloco.className.replace(" ed__bloco--alvo", "")
      const acertou = alvo?.bloco && bloco.dadosBloco === alvo.bloco && bloco.dadosGrupo === alvo.grupo
      bloco.className = acertou ? `${base} ed__bloco--alvo` : base
    }
  }

  function desenharSetas(lista, mapa) {
    tela.replaceChildren()
    for (const seta of lista) {
      const origem = seta.de ? mapa.get(seta.de) : null

      // Ligação para grupo que não existe: desenha um toco saindo da origem,
      // apontando para o vazio. Some com ela e o erro fica invisível — foi
      // justamente para vê-lo que o modelo marca a seta como órfã.
      const { grupo: idDestino, bloco: blocoDestino } = partesDoDestino(seta.para)
      const destino = caixaDoBloco(mapa.get(idDestino), blocoDestino) || (origem && {
        x: origem.x + origem.largura + 90, y: origem.y + origem.altura / 2,
        largura: 1, altura: 1
      })
      if (!destino) continue

      // A seta parte da altura do conector de onde ela sai: a linha daquela
      // opção, ou o rodapé do grupo. É a mesma conta do fio que se arrasta.
      const caixaDeSaida = caixaDaSaida(origem, seta.saida) ||
        comConector(caixasEventoAtuais.get(seta.evento)) || {
        x: destino.x - 260, y: destino.y - 120, largura: 200, altura: 60
      }
      const { caminho, para: fim, ladoPara } = ancoras(caixaDeSaida, destino)
      const classes = ["ed__seta", `ed__seta--${seta.origens[0]}`]
      if (seta.orfa) classes.push("ed__seta--orfa")
      if (seta.evento) classes.push("ed__seta--evento")
      if (seta.chave === setaSelecionada) classes.push("ed__seta--selecionada")

      const linha = svg("path", classes.join(" "))
      linha.setAttribute("d", caminho)
      linha.setAttribute("fill", "none")
      tela.append(linha)

      // Uma faixa larga e invisível por cima da linha: 2px de traço não se
      // acerta com o mouse. É ela que recebe o clique.
      const faixa = svg("path", "ed__seta-faixa")
      faixa.setAttribute("d", caminho)
      faixa.setAttribute("fill", "none")
      faixa.dadosSeta = seta
      faixa.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
      faixa.addEventListener("click", (ev) => {
        ev.stopPropagation?.()
        selecionarLigacao(seta)
      })
      faixa.addEventListener("contextmenu", (ev) => {
        ev.preventDefault?.()
        ev.stopPropagation?.()
        selecionarLigacao(seta)
        abrirMenuDaLigacao(ev, seta)
      })
      tela.append(faixa)

      const ponta = svg("path", classes.map((c) => c.replace("ed__seta", "ed__ponta")).join(" "))
      ponta.setAttribute("d", pontaDaSeta(fim, ladoPara))
      tela.append(ponta)
    }
  }

  function desenharEventos(lista, mapa) {
    camadaEventos.replaceChildren()
    for (const evento of lista) {
      const caixa = mapa.get(evento.tipo)
      const no = el("div", `ed__evento ed__evento--${evento.tipo}`)
      no.style.setProperty("transform", `translate(${caixa.x}px, ${caixa.y}px)`)
      no.style.setProperty("width", `${caixa.largura}px`)
      if (evento.icone) no.append(el("span", "ed__evento-icone", evento.icone))
      no.append(el("span", "ed__evento-rotulo", evento.rotulo))

      no.addEventListener("mousedown", (ev) => {
        const base = { x: caixa.x, y: caixa.y }
        iniciarArrasto(ev, (dx, dy) => aoMoverEvento({
          evento: evento.tipo, x: base.x + dx / vista.escala, y: base.y + dy / vista.escala
        }))
      })

      const ponto = el("span", `ed__evento-ponto${evento.proximo ? " ed__evento-ponto--ligado" : ""}`)
      ponto.setAttribute("title", evento.proximo
        ? `Começa em ${evento.proximo} — arraste para mudar`
        : "Arraste até o primeiro grupo")
      ponto.addEventListener("mousedown", (ev) => {
        iniciarLigacao(ev, { evento: evento.tipo }, (origem, destino) => aoLigarEvento({ ...origem, destino }))
      })
      no.append(ponto)

      camadaEventos.append(no)
    }
  }

  function desenharCartoes(lista, mapa) {
    nosDeCartoes.clear()
    camadaCartoes.replaceChildren()
    for (const cartao of lista) {
      const caixa = mapa.get(cartao.id)
      // Com botões no cartão, a saída é o caminho de quem escolheu uma opção
      // sem destino próprio: "padrão". Sem botões não há escolha nenhuma, é
      // só o que vem depois — chamar isso de padrão nomeia uma decisão que
      // não existe.
      const temBotoes = cartao.blocos.some((b) => b.opcoes)
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
        titulo.setAttribute("title", "Clique para renomear")
        // Um clique só, no próprio nome. O mousedown não é parado: arrastar
        // pelo nome continua movendo o cartão, e aí o clique não conta.
        titulo.addEventListener("click", (ev) => {
          ev.stopPropagation?.()
          if (arrastou) return
          editandoTitulo = cartao.id
          desenhar(fluxoAtual)
        })
        cabecalho.append(titulo)
        // O nome ocupa só o que as letras pedem; o resto do cabeçalho é a
        // alça de arrasto. Com o nome esticado até o fim, qualquer ponto para
        // pegar o cartão era também um ponto para renomeá-lo sem querer.
        const alca = el("div", "ed__cabecalho-arrasto")
        alca.setAttribute("title", "Arraste para mover o grupo")
        cabecalho.append(alca)
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

      const mais = el("button", "ed__cabecalho-mais", "⋯")
      mais.setAttribute("type", "button")
      mais.setAttribute("title", "Ações do grupo")
      mais.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
      mais.addEventListener("click", (ev) => {
        ev.stopPropagation?.()
        abrirAcoesDoGrupo(ev, cartao)
      })
      cabecalho.append(mais)
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
        // De quem é este bloco: o realce do ímã procura por aqui, sem ter de
        // decorar a ordem em que os cartões foram desenhados.
        noBloco.dadosGrupo = cartao.id
        noBloco.dadosBloco = bloco.id
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

      // A saída do grupo. No chatflow quem segue adiante é o grupo inteiro —
      // só os botões ramificam por opção — então é uma bolinha por cartão, no
      // canto de baixo, longe das bolinhas das opções.
      // A saída do grupo É o padrão: no motor, opção de botão sem destino
      // próprio segue por aqui. Nomear o que já existe evita criar um segundo
      // controle para o mesmo valor — dois lugares para dizer a mesma coisa
      // viram dois lugares para discordar.
      const rodape = el("div", "ed__rodape")
      rodape.setAttribute("title", temBotoes
        ? "Padrão: quem escolher uma opção sem destino próprio segue por aqui"
        : "Para onde o grupo segue quando termina")
      rodape.append(el("span", "ed__rodape-rotulo", temBotoes ? "padrão" : "seguinte"))
      rodape.append(pontoDeSaida(cartao))
      no.append(rodape)

      // Mesmo gesto da linha: esquerdo seleciona (o cabeçalho já fazia),
      // direito abre o menu no ponto clicado.
      no.addEventListener("contextmenu", (ev) => {
        ev.preventDefault?.()
        ev.stopPropagation?.()
        selecao = { grupo: cartao.id, bloco: null }
        setaSelecionada = null
        desenhar(fluxoAtual)
        aoSelecionar({ grupo: cartao.id, bloco: null })
        abrirMenuDoGrupo(ev, cartao)
      })

      nosDeCartoes.set(cartao.id, no)
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
      // Botão que ninguém nomeou não é botão. Quem clicou no padrão sem
      // querer, ou desistiu no meio, sai de perto e a linha se desfaz —
      // sem precisar apagar nada. A última opção é protegida em edicoes.js.
      campo.addEventListener("blur", () => {
        if (campo.value.trim() === "") {
          aoRemoverOpcao({ grupo: cartao.id, bloco: bloco.id, opcao: opcao.id })
        }
      })
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

      // O círculo fica para fora do cartão e é a alça da ligação: arrasta-se
      // dele até o grupo para onde essa resposta deve levar.
      const ponto = el("span", `ed__opcao-ponto${opcao.proximo ? " ed__opcao-ponto--ligado" : ""}`)
      ponto.setAttribute("title", opcao.proximo
        ? `Vai para ${opcao.proximo} — arraste para mudar`
        : "Arraste até um grupo para ligar")
      ponto.addEventListener("mousedown", (ev) => {
        iniciarLigacao(ev, { grupo: cartao.id, bloco: bloco.id, opcao: opcao.id })
      })
      linhaOpcao.append(ponto)

      caixa.append(linhaOpcao)
    }

    // Fecha a lista com um "+ botão": um trabalho só, acrescentar. A saída do
    // grupo mora no rodapé do cartão — juntar as duas coisas numa linha fazia
    // o clique criar botão e a bolinha mandar o fluxo, e ninguém adivinha isso.
    const linhaNova = el("div", "ed__opcao-cartao ed__opcao-cartao--nova")
    const mais = el("button", "ed__opcao-nova", "+ botão")
    mais.setAttribute("type", "button")
    mais.setAttribute("title", "Acrescenta um botão nesta lista")
    // preventDefault segura o cursor onde está. Sem isso o clique daqui tira
    // o foco da caixa vazia, ela se desfaz, o cartão é redesenhado e este
    // mesmo clique morre no caminho — a pessoa clica e nada acontece.
    mais.addEventListener("mousedown", (ev) => {
      ev.preventDefault?.()
      ev.stopPropagation?.()
    })
    mais.addEventListener("click", (ev) => {
      ev.stopPropagation?.()
      aoAcrescentarOpcao({ grupo: cartao.id, bloco: bloco.id, apos: bloco.opcoes.at(-1)?.id })
    })
    linhaNova.append(mais)
    caixa.append(linhaNova)
    return caixa
  }

  function pontoDeSaida(cartao) {
    const saida = el("span", `ed__grupo-ponto${cartao.proximo ? " ed__grupo-ponto--ligado" : ""}`)
    saida.setAttribute("title", cartao.proximo
      ? `Segue para ${cartao.proximo} — arraste para mudar`
      : "Arraste até o grupo seguinte")
    saida.addEventListener("mousedown", (ev) => {
      iniciarLigacao(ev, { grupo: cartao.id }, (origem, destino) => aoLigarGrupo({ ...origem, destino }))
    })
    return saida
  }

  function desenhar(fluxo) {
    fluxoAtual = fluxo
    const lista = cartoes(fluxo)
    const mapa = caixas(lista)
    const listaEventos = eventosDoCanvas(fluxo)
    caixasAtuais = mapa
    caixasEventoAtuais = caixasDeEventos(listaEventos)
    desenharSetas(setas(fluxo), mapa)
    desenharEventos(listaEventos, caixasEventoAtuais)
    desenharCartoes(lista, mapa)
    aplicarVista()
    // Depois de tudo pendurado na página, nunca antes: `focus()` em elemento
    // que ainda não está no documento não faz nada, e quem clicou no nome
    // ficaria com a caixa aberta sem cursor — o dublê de DOM não distingue
    // isso, então quem prova este pedaço é o navegador.
    if (editandoTitulo) {
      const campo = acharNaCamada("ed__titulo-campo")[0]
      campo?.focus?.()
      // Nome inteiro selecionado: quem clica para renomear quer trocar o nome,
      // não acrescentar letra no fim de "Grupo #1".
      campo?.select?.()
    }
  }

  function acharNaCamada(classe) {
    return camadaCartoes.porClasse
      ? camadaCartoes.porClasse(classe)
      : [...camadaCartoes.querySelectorAll(`.${classe}`)]
  }

  return {
    desenhar,
    // Põe todo o fluxo na tela. Chamado na abertura e pelo botão da barra —
    // nunca em cada redesenho, senão brigaria com quem está arrastando.
    enquadrar() {
      if (!fluxoAtual) return
      vista = enquadrar([
        ...caixas(cartoes(fluxoAtual)).values(),
        ...caixasDeEventos(eventosDoCanvas(fluxoAtual)).values()
      ], {
        largura: palco.clientWidth || elemento.clientWidth || 0,
        altura: palco.clientHeight || elemento.clientHeight || 0
      })
      aplicarVista()
    },
    // Põe o cursor numa opção depois de redesenhar: quem aperta Enter espera
    // continuar digitando, não caçar a caixa nova com o mouse.
    focarOpcao(blocoId, opcaoId) {
      const campo = acharNaCamada("ed__opcao-campo")
        .find((c) => c.dadosBloco === blocoId && c.dadosOpcao === opcaoId)
      if (campo) campo.focus()
    },
    // Onde um ponto da janela cai no fluxo. Quem arrasta um tipo da paleta
    // precisa saber se soltou no palco, em que ponto do fluxo foi, e se havia
    // um cartão ali — a paleta não conhece zoom nem deslocamento.
    alvoDe(ev) {
      const area = palco.getBoundingClientRect?.() || { left: 0, top: 0, right: 0, bottom: 0 }
      const dentro = ev.clientX >= area.left && ev.clientX <= area.right &&
        ev.clientY >= area.top && ev.clientY <= area.bottom
      const ponto = paraMundo(vista, noPalco(ev))
      return {
        dentro,
        ponto,
        grupo: dentro && fluxoAtual ? caixaEm(caixas(cartoes(fluxoAtual)), ponto) : null
      }
    },
    // O fluxo mudou, mas os cartões não vão ser redesenhados agora: é o caso
    // de quem está digitando, porque recriar a caixa jogaria o cursor para o
    // fim. Ainda assim o canvas precisa saber do novo fluxo — qualquer
    // redesenho interno depois (clicar numa linha, começar um arrasto) usaria
    // o fluxo do último desenho e repintaria o texto velho por cima.
    sincronizar(fluxo) {
      fluxoAtual = fluxo
      caixasAtuais = caixas(cartoes(fluxo))
      caixasEventoAtuais = caixasDeEventos(eventosDoCanvas(fluxo))
    },
    vista: () => ({ ...vista }),
    selecionar(nova) {
      selecao = { grupo: nova.grupo ?? null, bloco: nova.bloco ?? null }
      if (fluxoAtual) desenhar(fluxoAtual)
    }
  }
}
