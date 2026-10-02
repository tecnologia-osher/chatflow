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
  definirProximoDoEvento, moverEvento, definirProximo, limparOpcoesVazias, removerGrupo, duplicarGrupo,
  nomeDoFluxo, definirNomeDoFluxo, moverBlocoEntreGrupos, blocoViraGrupo
} from "./edicoes.js"
import { validarFluxo } from "../motor/validar.js"
import { criarPreview } from "./preview.js"
import { iconeDoTipo, iconeDaAcao } from "./icones.js"
import { colunasDosResultados, valorNaColuna } from "./resultados.js"


const NOME_DA_CATEGORIA = {
  fala: "Bolhas", entrada: "Entrada", logica: "Lógica", conexao: "Conexão"
}

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

export function criarEditor({
  elemento, fluxo, cliente = "exemplo",
  aoBaixar = () => {},
  // Grava o fluxo onde ele mora. No desenvolvimento é o servidor local; no
  // dia em que houver conta e banco (sub-projeto 3), é a mesma porta.
  aoSalvar = null,
  // Onde ficam os projetos. A página ainda não existe, então o botão existe e
  // avisa — melhor que um botão que não faz nada e não diz por quê.
  aoVoltar = () => {},
  // Só os testes passam isto: sem espera de verdade, a conversa do preview
  // acontece de uma vez e a suíte não fica parada esperando o relógio.
  esperarNoTeste = undefined,
  // Busca os leads do cliente. Recebe a chave de leitura e devolve as linhas.
  aoBuscarLeads = null
}) {
  let atual = fluxo
  let selecao = { grupo: null, bloco: null }
  let recado = ""
  let detalhesAbertos = false
  // O retrato do fluxo como ele está gravado. Comparar com o de agora é o que
  // diz se há algo a salvar — mais honesto que marcar "sujo" em cada edição e
  // esquecer de marcar numa delas.
  let gravado = JSON.stringify(fluxo)
  let salvando = false
  let editandoNome = false
  let aba = "fluxo"
  let configuracoesAbertas = false

  // Desfazer e refazer. Guarda o fluxo inteiro a cada mudança — são alguns
  // kB, e um fluxo inteiro é mais simples e mais confiável que uma lista de
  // operações inversas, que erra justamente nas que mexem em várias coisas.
  const PASSOS_GUARDADOS = 60
  const desfazerPilha = []
  let refazerPilha = []
  let ultimaAssinatura = null

  // `assinatura` junta edições seguidas no mesmo campo num passo só: desfazer
  // letra por letra o que se digitou seria um castigo.
  function trocarFluxo(novo, assinatura = null) {
    if (novo === atual) return
    if (!assinatura || assinatura !== ultimaAssinatura) {
      desfazerPilha.push(atual)
      if (desfazerPilha.length > PASSOS_GUARDADOS) desfazerPilha.shift()
    }
    ultimaAssinatura = assinatura
    refazerPilha = []
    atual = novo
  }

  function desfazer() {
    if (!desfazerPilha.length) return
    refazerPilha.push(atual)
    atual = desfazerPilha.pop()
    depoisDeAndarNoTempo()
  }

  function refazer() {
    if (!refazerPilha.length) return
    desfazerPilha.push(atual)
    atual = refazerPilha.pop()
    depoisDeAndarNoTempo()
  }

  // Voltar no tempo pode ter apagado o que estava selecionado, e a próxima
  // edição não deve se juntar à que acabou de ser desfeita.
  function depoisDeAndarNoTempo() {
    ultimaAssinatura = null
    if (selecao.grupo && !atual.grupos.some((g) => g && g.id === selecao.grupo)) {
      selecao = { grupo: null, bloco: null }
      detalhesAbertos = false
    }
    redesenhar()
  }

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
  const areaConfiguracoes = el("div", "ed__area-config")
  const emBreve = el("div", "ed__em-breve ed__oculto")
  const areaResultados = el("section", "ed__resultados ed__oculto")
  centro.append(barra, palcoCanvas, emBreve, areaResultados, problemas)
  raiz.append(paleta, centro, areaPainel, areaPreview, areaConfiguracoes)
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
      trocarFluxo(definirCampo(atual, { grupo, bloco, campo, valor }), `campo:${grupo}:${bloco}:${campo}`)
      semRedesenharCartoes()
    },
    aoRenomearGrupo: ({ grupo, valor }) => {
      trocarFluxo(definirTitulo(atual, { grupo, valor }), `titulo:${grupo}`)
      semRedesenharCartoes()
    },
    aoEditarOpcao: ({ grupo, bloco, opcao, valor }) => {
      trocarFluxo(definirOpcao(atual, { grupo, bloco, opcao, campo: "label", valor }),
        `opcao:${grupo}:${bloco}:${opcao}`)
      semRedesenharCartoes()
    },
    aoAcrescentarOpcao: ({ grupo, bloco, apos }) => {
      // Varre antes de criar: se a linha anterior ficou vazia, ela sai agora.
      // Depois não pode varrer — a recém-nascida está vazia de propósito.
      trocarFluxo(limparOpcoesVazias(atual))
      const nova = proximoIdDeOpcao(atual, { grupo, bloco })
      trocarFluxo(acrescentarOpcao(atual, { grupo, bloco, apos }))
      desenharTudo()
      canvas.focarOpcao(bloco, nova)
    },
    aoRemoverOpcao: ({ grupo, bloco, opcao }) => {
      trocarFluxo(removerOpcao(atual, { grupo, bloco, opcao }))
      redesenhar()
    },
    aoLigarGrupo: ({ grupo, destino }) => {
      trocarFluxo(definirProximo(atual, { grupo, valor: destino }))
      redesenhar()
    },
    aoLigarEvento: ({ evento, destino }) => {
      trocarFluxo(definirProximoDoEvento(atual, { tipo: evento, destino }))
      redesenhar()
    },
    aoMoverEvento: ({ evento, x, y }) => {
      trocarFluxo(moverEvento(atual, { tipo: evento, x, y }), `moverEvento:${evento}`)
      redesenhar()
    },
    aoLigarOpcao: ({ grupo, bloco, opcao, destino }) => {
      trocarFluxo(definirOpcao(atual, { grupo, bloco, opcao, campo: "proximo", valor: destino }))
      redesenhar()
    },
    aoMoverBloco: ({ de, bloco, para, antesDe }) => {
      trocarFluxo(moverBlocoEntreGrupos(atual, { de, bloco, para, antesDe }))
      selecao = { grupo: para, bloco }
      redesenhar({ manterVista: true })
    },
    aoSoltarBlocoNoQuadro: ({ de, bloco, x, y }) => {
      const { fluxo: novo, grupo } = blocoViraGrupo(atual, { de, bloco, x, y })
      if (!grupo) return
      trocarFluxo(novo)
      selecao = { grupo, bloco }
      redesenhar({ manterVista: true })
    },
    aoDuplicarGrupo: ({ grupo }) => {
      const antes = new Set(atual.grupos.map((g) => g.id))
      trocarFluxo(duplicarGrupo(atual, { grupo }))
      const copia = atual.grupos.find((g) => !antes.has(g.id))
      // A cópia nasce selecionada: é nela que a pessoa vai mexer agora.
      if (copia) selecao = { grupo: copia.id, bloco: null }
      redesenhar()
    },
    aoApagarGrupo: ({ grupo }) => {
      trocarFluxo(removerGrupo(atual, { grupo }))
      // Seleção apontando para o que não existe mais deixaria o painel e a
      // paleta trabalhando num grupo fantasma.
      if (selecao.grupo === grupo) selecao = { grupo: null, bloco: null }
      detalhesAbertos = false
      redesenhar()
    },
    // Apagar a ligação é apagar o destino de quem a criou. Qual campo é
    // depende de onde a seta nasceu — e é a própria seta que diz.
    aoApagarLigacao: (seta) => {
      if (seta.evento) {
        trocarFluxo(definirProximoDoEvento(atual, { tipo: seta.evento, destino: "" }))
      } else if (seta.saida?.opcao) {
        trocarFluxo(definirOpcao(atual, {
          grupo: seta.de, bloco: seta.saida.bloco, opcao: seta.saida.opcao,
          campo: "proximo", valor: ""
        }))
      } else if (seta.saida?.bloco) {
        trocarFluxo(definirCampo(atual, {
          grupo: seta.de, bloco: seta.saida.bloco, campo: "destino", valor: ""
        }))
      } else {
        trocarFluxo(definirProximo(atual, { grupo: seta.de, valor: "" }))
      }
      redesenhar()
    },
    aoAbrirDetalhes: ({ grupo, bloco }) => {
      selecao = { grupo, bloco }
      detalhesAbertos = true
      redesenhar()
    },
    aoMover: (grupo, { x, y }) => {
      trocarFluxo(moverGrupo(atual, { grupo, x, y }), `mover:${grupo}`)
      redesenhar({ manterVista: true })
    },
    aoTestar: (grupo) => { preview.abrir(atual, grupo); sincronizarTestar() }
  })
  const preview = criarPreview({
    elemento: areaPreview, aoFechar: () => sincronizarTestar(), esperar: esperarNoTeste
  })
  const painel = criarPainel({
    elemento: areaPainel,
    aoEditar: (novo) => { trocarFluxo(novo); redesenhar() }
  })

  // --- barra -----------------------------------------------------------
  const ajustar = el("button", "ed__ajustar")
  ajustar.setAttribute("type", "button")
  ajustar.setAttribute("title", "Põe o fluxo inteiro na tela")
  const icArruma = iconeDaAcao("centralizar")
  if (icArruma) ajustar.append(icArruma)
  ajustar.append(el("span", null, "Centralizar"))
  ajustar.addEventListener("click", () => canvas.enquadrar())

  const testar = el("button", "ed__testar", "▶ Testar")
  testar.setAttribute("type", "button")
  testar.addEventListener("click", () => { preview.abrir(atual, null); sincronizarTestar() })

  // Com a aba de teste aberta, o botão não tem o que fazer: some, e volta
  // quando ela fecha. Um botão que não faz nada é pior que botão nenhum.
  function sincronizarTestar() {
    testar.className = preview.aberto() ? "ed__testar ed__oculto" : "ed__testar"
  }

  const salvar = el("button", "ed__salvar")
  salvar.setAttribute("type", "button")
  const palavraDoSalvar = el("span", null, "Salvar")
  salvar.addEventListener("click", () => guardar())

  function temMudancas() {
    return JSON.stringify(atual) !== gravado
  }

  // O botão conta três coisas: há o que salvar, está salvando, ou está tudo
  // guardado. Botão que diz sempre a mesma coisa não avisa nada.
  function sincronizarSalvar() {
    const mudou = temMudancas()
    // O ícone conta o mesmo que a palavra: disquete enquanto há o que
    // guardar, visto quando está tudo guardado.
    palavraDoSalvar.textContent = salvando ? "Salvando…" : mudou ? "Salvar" : "Salvo"
    salvar.replaceChildren()
    const icone = iconeDaAcao(mudou || salvando ? "salvar" : "salvo")
    if (icone) salvar.append(icone)
    salvar.append(palavraDoSalvar)
    salvar.className = `ed__salvar${mudou && !salvando ? " ed__salvar--pendente" : ""}`
    salvar.disabled = salvando || !mudou
  }

  async function guardar() {
    if (salvando || !temMudancas()) return
    const texto = JSON.stringify(atual, null, 2)
    if (!aoSalvar) return cair(texto, "Este editor está aberto sem servidor para gravar.")

    salvando = true
    sincronizarSalvar()
    try {
      await aoSalvar(texto)
      gravado = JSON.stringify(atual)
      recado = ""
    } catch (falha) {
      cair(texto, falha?.message || String(falha))
    } finally {
      salvando = false
      sincronizarSalvar()
      desenharPaleta()
    }
  }

  // Não deu para gravar: o arquivo desce para a pasta de downloads. Trabalho
  // perdido por um servidor fora do ar seria o pior resultado possível.
  function cair(texto, motivo) {
    aoBaixar(texto, "fluxo.json")
    recado = `Não consegui salvar (${motivo}). Baixei o fluxo.json para não perder o trabalho.`
    desenharPaleta()
  }

  // --- as três zonas do header -----------------------------------------
  // Esquerda: voltar, nome do projeto, desfazer/refazer. Meio: as abas.
  // Direita: testar, centralizar, salvar e a engrenagem.
  const esquerda = el("div", "ed__barra-lado")
  const meio = el("nav", "ed__abas")
  const direita = el("div", "ed__barra-lado")

  const voltar = el("button", "ed__voltar", "‹")
  voltar.setAttribute("type", "button")
  voltar.setAttribute("title", "Voltar aos projetos")
  voltar.setAttribute("aria-label", "Voltar aos projetos")
  voltar.addEventListener("click", () => aoVoltar())

  const nome = el("div", "ed__nome")

  // Enquanto a caixa do nome está aberta, qualquer mousedown fora dela fecha.
  // Na captura, porque o canvas para a propagação de tudo o que acontece
  // dentro dele — e aí o clique no quadro nunca chegaria até aqui.
  document.addEventListener("mousedown", (ev) => {
    if (!editandoNome) return
    if (ev.target && ev.target.className === "ed__nome-campo") return
    editandoNome = false
    desenharNome()
  }, true)

  function desenharNome() {
    nome.replaceChildren()
    if (editandoNome) {
      const campo = el("input", "ed__nome-campo")
      campo.setAttribute("type", "text")
      campo.value = nomeDoFluxo(atual)
      campo.addEventListener("input", () => {
        trocarFluxo(definirNomeDoFluxo(atual, campo.value), "nome")
        sincronizarSalvar()
      })
      campo.addEventListener("blur", () => { editandoNome = false; desenharNome() })
      // Clicar no quadro não tira o foco da caixa: o arrasto chama
      // preventDefault e segura o cursor onde está. Sem isto, a caixa do nome
      // fica aberta atrás de tudo o que se faz depois.
      campo.addEventListener("mousedown", (ev) => ev.stopPropagation?.())
      campo.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === "Escape") { editandoNome = false; desenharNome() }
      })
      nome.append(campo)
      campo.focus?.()
      campo.select?.()
      return
    }
    const texto = el("button", "ed__nome-texto", nomeDoFluxo(atual))
    texto.setAttribute("type", "button")
    texto.setAttribute("title", "Clique para renomear o projeto")
    texto.addEventListener("click", () => { editandoNome = true; desenharNome() })
    nome.append(texto)
  }

  const voltarPasso = el("button", "ed__passo ed__passo--desfazer")
  voltarPasso.setAttribute("type", "button")
  const icDesfazer = iconeDaAcao("desfazer", "ed__barra-icone ed__barra-icone--passo")
  if (icDesfazer) voltarPasso.append(icDesfazer)
  else voltarPasso.textContent = "↶"
  voltarPasso.setAttribute("title", "Desfazer")
  voltarPasso.setAttribute("aria-label", "Desfazer")
  voltarPasso.addEventListener("click", () => desfazer())

  const refazerPasso = el("button", "ed__passo ed__passo--refazer")
  refazerPasso.setAttribute("type", "button")
  const icRefazer = iconeDaAcao("refazer", "ed__barra-icone ed__barra-icone--passo")
  if (icRefazer) refazerPasso.append(icRefazer)
  else refazerPasso.textContent = "↷"
  refazerPasso.setAttribute("title", "Refazer")
  refazerPasso.setAttribute("aria-label", "Refazer")
  refazerPasso.addEventListener("click", () => refazer())

  function sincronizarPassos() {
    voltarPasso.disabled = desfazerPilha.length === 0
    refazerPasso.disabled = refazerPilha.length === 0
  }

  const ABAS = [["fluxo", "Fluxo"], ["tema", "Tema"], ["resultados", "Resultados"]]
  const botoesDeAba = new Map()
  for (const [chave, rotulo] of ABAS) {
    const botao = el("button", "ed__aba", rotulo)
    botao.setAttribute("type", "button")
    botao.addEventListener("click", () => {
      aba = chave
      sincronizarAbas()
      desenharConteudo()
    })
    botoesDeAba.set(chave, botao)
    meio.append(botao)
  }

  function sincronizarAbas() {
    for (const [chave, botao] of botoesDeAba) {
      botao.className = `ed__aba${chave === aba ? " ed__aba--ativa" : ""}`
    }
  }

  const engrenagem = el("button", "ed__engrenagem")
  engrenagem.setAttribute("type", "button")
  const icEngrenagem = iconeDaAcao("configuracoes", "ed__barra-icone ed__barra-icone--grande")
  if (icEngrenagem) engrenagem.append(icEngrenagem)
  else engrenagem.textContent = "⚙"
  engrenagem.setAttribute("title", "Configurações")
  engrenagem.setAttribute("aria-label", "Configurações")
  engrenagem.addEventListener("click", () => {
    configuracoesAbertas = !configuracoesAbertas
    desenharConfiguracoes()
  })

  // Ctrl+Z e Ctrl+Shift+Z, que é o que a mão faz sem pensar. Fica no
  // documento, mas não enquanto se digita: lá o desfazer do próprio campo é
  // o que a pessoa espera.
  document.addEventListener("keydown", (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || String(ev.key).toLowerCase() !== "z") return
    const alvo = ev.target
    const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA")
    if (digitando) return
    ev.preventDefault?.()
    if (ev.shiftKey) refazer()
    else desfazer()
  })

  esquerda.append(voltar, nome, voltarPasso, refazerPasso)
  direita.append(testar, ajustar, salvar, engrenagem)
  barra.append(esquerda, meio, direita)
  desenharNome()
  sincronizarAbas()

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
        const botao = el("button", `ed__tipo ed__tipo--${categoria}`)
        botao.setAttribute("type", "button")
        const icone = iconeDoTipo(definicao.tipo)
        if (icone) botao.append(icone)
        botao.append(el("span", "ed__tipo-rotulo", definicao.rotulo))
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
  function acrescentarNoGrupo(grupoId, tipo, apos = null, assinatura = null) {
    const antes = new Set((atual.grupos.find((g) => g.id === grupoId)?.blocos || []).map((b) => b.id))
    trocarFluxo(acrescentarBloco(atual, { grupo: grupoId, tipo, apos }), assinatura)
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

    // O fantasma é a própria caixa da paleta, do mesmo tamanho e com o mesmo
    // ícone: o que se vê sendo levado é a coisa, não o nome dela. E ele fica
    // preso onde a mão pegou — se a pessoa agarrou pela beirada, continua
    // pela beirada, em vez de saltar para o centro do cursor.
    const caixa = ev.currentTarget?.getBoundingClientRect?.() || null
    const presoEm = caixa
      ? { x: ev.clientX - caixa.left, y: ev.clientY - caixa.top }
      : { x: 20, y: 16 }

    const fantasma = el("div", `ed__fantasma ed__fantasma--tipo ed__tipo--${definicao.categoria}`)
    const icone = iconeDoTipo(definicao.tipo)
    if (icone) fantasma.append(icone)
    fantasma.append(el("span", "ed__tipo-rotulo", definicao.rotulo))
    if (caixa) {
      fantasma.style.setProperty("width", `${Math.round(caixa.width)}px`)
      fantasma.style.setProperty("height", `${Math.round(caixa.height)}px`)
    }
    let visivel = false

    function mover(e) {
      if (!visivel) { raiz.append(fantasma); visivel = true }
      fantasma.style.setProperty("left", `${e.clientX - presoEm.x}px`)
      fantasma.style.setProperty("top", `${e.clientY - presoEm.y}px`)
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

      // Criar o grupo e pôr o bloco dentro são duas edições, mas um gesto só:
      // a mesma assinatura junta as duas num passo de desfazer. Sem isso, o
      // primeiro desfazer deixaria um grupo vazio na tela.
      const antes = new Set(atual.grupos.map((g) => g.id))
      const umGesto = `arrastar:${Date.now()}`
      trocarFluxo(criarGrupo(atual, alvo.ponto), umGesto)
      const novo = atual.grupos.find((g) => !antes.has(g.id))
      acrescentarNoGrupo(novo.id, definicao.tipo, null, umGesto)
    }

    document.addEventListener("mousemove", mover)
    document.addEventListener("mouseup", soltar)
  }

  // A aba escolhida manda no que aparece embaixo do header. Tema e Resultados
  // ainda não existem: dizem isso, em vez de abrirem uma tela vazia que
  // parece quebrada.
  const EM_CONSTRUCAO = {
    tema: "As cores, a fonte e o retrato do chat ainda se editam em clientes/<cliente>/tema.json."
  }

  function desenharConteudo() {
    const fora = aba !== "fluxo"
    palcoCanvas.className = `ed__area-canvas${fora ? " ed__oculto" : ""}`
    emBreve.replaceChildren()
    emBreve.className = `ed__em-breve${fora && aba !== "resultados" ? "" : " ed__oculto"}`
    areaResultados.replaceChildren()
    areaResultados.className = `ed__resultados${aba === "resultados" ? "" : " ed__oculto"}`

    if (aba === "resultados") return desenharResultados()
    if (fora) {
      emBreve.append(
        el("h2", "ed__em-breve-titulo", botoesDeAba.get(aba).textContent),
        el("p", "ed__em-breve-texto", EM_CONSTRUCAO[aba])
      )
    }
  }

  // --- resultados --------------------------------------------------------
  // Uma linha por pessoa que entrou no chat, com o que ela respondeu até onde
  // chegou. Os dados vêm da planilha do cliente, por uma leitura protegida
  // por chave — a chave fica neste navegador, nunca no repositório.
  let leads = null
  let erroDosLeads = ""
  let buscandoLeads = false

  function desenharResultados() {
    areaResultados.replaceChildren()

    const topo = el("div", "ed__resultados-topo")
    topo.append(el("h2", "ed__resultados-titulo", "Resultados"))
    const atualizar = el("button", "ed__resultados-atualizar", buscandoLeads ? "Buscando…" : "Atualizar")
    atualizar.setAttribute("type", "button")
    atualizar.disabled = buscandoLeads
    atualizar.addEventListener("click", () => buscarLeads(true))
    topo.append(atualizar)
    areaResultados.append(topo)

    if (erroDosLeads) {
      const aviso = el("p", "ed__resultados-aviso", erroDosLeads)
      areaResultados.append(aviso)
    }

    if (!chaveDosResultados()) {
      areaResultados.append(formularioDaChave())
      return
    }

    if (leads === null) {
      areaResultados.append(el("p", "ed__resultados-vazio",
        buscandoLeads ? "Buscando os leads na planilha…" : "Clique em Atualizar para buscar os leads."))
      if (!buscandoLeads && !erroDosLeads) buscarLeads()
      return
    }

    if (!leads.length) {
      areaResultados.append(el("p", "ed__resultados-vazio",
        "Ninguém entrou no chat ainda — ou a planilha deste cliente está vazia."))
      return
    }

    const colunas = colunasDosResultados(atual, leads)
    const tabela = el("table", "ed__tabela")
    const cabecalho = el("tr", "ed__tabela-linha")
    for (const coluna of colunas) {
      const celula = el("th", `ed__tabela-cabecalho${coluna.extra ? " ed__tabela-cabecalho--extra" : ""}`,
        coluna.rotulo)
      if (coluna.extra) celula.setAttribute("title", "Veio da planilha e não está no fluxo")
      cabecalho.append(celula)
    }
    tabela.append(cabecalho)

    for (const linha of leads) {
      const no = el("tr", "ed__tabela-linha")
      for (const coluna of colunas) {
        no.append(el("td", "ed__tabela-celula", valorNaColuna(linha, coluna)))
      }
      tabela.append(no)
    }
    const rolagem = el("div", "ed__tabela-rolagem")
    rolagem.append(tabela)
    areaResultados.append(rolagem)
    areaResultados.append(el("p", "ed__resultados-conta",
      `${leads.length} ${leads.length === 1 ? "pessoa" : "pessoas"} · a mais recente primeiro`))
  }

  function formularioDaChave() {
    const caixa = el("form", "ed__chave")
    caixa.append(el("p", "ed__chave-texto",
      "Para ver os leads, cole a chave de leitura da planilha. Ela fica guardada só neste navegador."))
    const campo = el("input", "ed__chave-campo")
    campo.setAttribute("type", "password")
    campo.setAttribute("placeholder", "chave de leitura")
    const botao = el("button", "ed__chave-botao", "Ver os leads")
    botao.setAttribute("type", "submit")
    caixa.addEventListener("submit", (ev) => {
      ev.preventDefault?.()
      const valor = String(campo.value || "").trim()
      if (!valor) return
      guardarChave(valor)
      erroDosLeads = ""
      buscarLeads(true)
    })
    caixa.append(campo, botao)
    return caixa
  }

  const NOME_DA_CHAVE = `chatflow:chave-leitura:${cliente}`
  // A chave vive na memória desta sessão; o armazenamento do navegador é só
  // para não pedir de novo amanhã. Guardar só lá fazia a chave sumir no
  // instante seguinte em qualquer navegador que recuse armazenamento — e em
  // janela anônima, que é onde muita gente abre as coisas.
  let chaveNaMemoria = ""
  try {
    chaveNaMemoria = globalThis.localStorage?.getItem(NOME_DA_CHAVE) || ""
  } catch { /* sem armazenamento: começa sem chave e pede uma */ }

  function chaveDosResultados() {
    return chaveNaMemoria
  }

  function guardarChave(valor) {
    chaveNaMemoria = valor
    try {
      globalThis.localStorage?.setItem(NOME_DA_CHAVE, valor)
    } catch { /* a chave vale só esta sessão */ }
  }

  async function buscarLeads(forcar = false) {
    if (buscandoLeads) return
    if (!aoBuscarLeads) {
      erroDosLeads = "Este editor está aberto sem de onde buscar os leads."
      return desenharResultados()
    }
    if (!forcar && leads !== null) return

    buscandoLeads = true
    erroDosLeads = ""
    desenharResultados()
    try {
      leads = await aoBuscarLeads(chaveDosResultados())
    } catch (falha) {
      leads = null
      erroDosLeads = falha?.message || String(falha)
    } finally {
      buscandoLeads = false
      desenharResultados()
    }
  }

  // Configurações: por enquanto, o compasso da digitação, que é do fluxo e
  // não do cliente. Sai do mesmo lugar que o chat lê.
  function desenharConfiguracoes() {
    areaConfiguracoes.replaceChildren()
    if (!configuracoesAbertas) return

    const caixa = el("div", "ed__config")
    const topo = el("div", "ed__config-topo")
    topo.append(el("h2", "ed__config-titulo", "Configurações"))
    const fechar = el("button", "ed__config-fechar", "✕")
    fechar.setAttribute("type", "button")
    fechar.setAttribute("aria-label", "Fechar")
    fechar.addEventListener("click", () => { configuracoesAbertas = false; desenharConfiguracoes() })
    topo.append(fechar)
    caixa.append(topo)

    caixa.append(el("p", "ed__config-ajuda",
      "Quanto tempo o chat mostra os três pontinhos antes de cada fala."))

    const ritmo = atual.ritmo || {}
    for (const [campo, rotulo] of [
      ["piso", "Mínimo (ms)"], ["porCaractere", "Por caractere (ms)"], ["teto", "Máximo (ms)"]
    ]) {
      const linha = el("label", "ed__config-linha")
      linha.append(el("span", "ed__config-rotulo", rotulo))
      const campoNumero = el("input", "ed__config-campo")
      campoNumero.setAttribute("type", "number")
      campoNumero.setAttribute("min", "0")
      campoNumero.value = ritmo[campo] ?? ""
      campoNumero.addEventListener("input", () => {
        const valor = campoNumero.value.trim()
        const novo = { ...atual, ritmo: { ...(atual.ritmo || {}) } }
        if (valor === "") delete novo.ritmo[campo]
        else novo.ritmo[campo] = Number(valor)
        if (!Object.keys(novo.ritmo).length) delete novo.ritmo
        trocarFluxo(novo, `ritmo:${campo}`)
        sincronizarSalvar()
        preview.atualizar(atual)
      })
      linha.append(campoNumero)
      caixa.append(linha)
    }
    areaConfiguracoes.append(caixa)
  }

  function desenharProblemas() {
    sincronizarSalvar()
    sincronizarPassos()
    const relatorio = validarFluxo(atual, { destinos: {} })
    problemas.textContent = relatorio.valido ? "" : relatorio.erros.join(" · ")
  }

  // O painel nunca aparece sozinho: só quando alguém pede pelo ⋯ — do bloco
  // ou do grupo. Selecionar deixou de abri-lo, porque o cartão já resolve o
  // que ele oferecia: o nome se edita no lugar e o destino se arrasta pela
  // bolinha. Formulário que aparece sem ser chamado atrapalha.
  function precisaDePainel() {
    return !!(selecao.grupo && detalhesAbertos)
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
    // O canvas não redesenha, mas passa a conhecer o fluxo novo: sem isto o
    // próximo redesenho interno dele volta o texto que acabou de ser digitado.
    canvas.sincronizar(atual)
    desenharProblemas()
    preview.atualizar(atual)
  }

  // Redesenhar os cartões significa que o cursor saiu de onde estava: é a
  // hora de desfazer as opções que ninguém nomeou. O caminho normal é o blur
  // da própria caixa, mas quando o clique cai num cabeçalho o navegador
  // cancela o blur e o redesenho apaga a caixa sem avisar ninguém.
  function redesenhar() {
    trocarFluxo(limparOpcoesVazias(atual))
    desenharTudo()
  }

  function desenharTudo() {
    if (!editandoNome) desenharNome()
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
    temMudancas,
    salvar: guardar,
    selecao: () => ({ ...selecao }),
    vista: () => canvas.vista()
  }
}
