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
  nomeDoFluxo, definirNomeDoFluxo
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
  esperarNoTeste = undefined
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
  centro.append(barra, palcoCanvas, emBreve, problemas)
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
  const ajustar = el("button", "ed__ajustar", "Centralizar")
  ajustar.setAttribute("type", "button")
  ajustar.setAttribute("title", "Põe o fluxo inteiro na tela")
  ajustar.addEventListener("click", () => canvas.enquadrar())

  const testar = el("button", "ed__testar", "▶ Testar")
  testar.setAttribute("type", "button")
  testar.addEventListener("click", () => { preview.abrir(atual, null); sincronizarTestar() })

  // Com a aba de teste aberta, o botão não tem o que fazer: some, e volta
  // quando ela fecha. Um botão que não faz nada é pior que botão nenhum.
  function sincronizarTestar() {
    testar.className = preview.aberto() ? "ed__testar ed__oculto" : "ed__testar"
  }

  const salvar = el("button", "ed__salvar", "Salvar")
  salvar.setAttribute("type", "button")
  salvar.addEventListener("click", () => guardar())

  function temMudancas() {
    return JSON.stringify(atual) !== gravado
  }

  // O botão conta três coisas: há o que salvar, está salvando, ou está tudo
  // guardado. Botão que diz sempre a mesma coisa não avisa nada.
  function sincronizarSalvar() {
    const mudou = temMudancas()
    salvar.textContent = salvando ? "Salvando…" : mudou ? "Salvar" : "Salvo"
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

  const voltarPasso = el("button", "ed__passo ed__passo--desfazer", "↶")
  voltarPasso.setAttribute("type", "button")
  voltarPasso.setAttribute("title", "Desfazer")
  voltarPasso.setAttribute("aria-label", "Desfazer")
  voltarPasso.addEventListener("click", () => desfazer())

  const refazerPasso = el("button", "ed__passo ed__passo--refazer", "↷")
  refazerPasso.setAttribute("type", "button")
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

  const engrenagem = el("button", "ed__engrenagem", "⚙")
  engrenagem.setAttribute("type", "button")
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
    tema: "As cores, a fonte e o retrato do chat ainda se editam em clientes/<cliente>/tema.json.",
    resultados: "Os resultados moram na planilha do cliente e no CRM. Trazer para cá é o sub-projeto 4."
  }

  function desenharConteudo() {
    const fora = aba !== "fluxo"
    palcoCanvas.className = `ed__area-canvas${fora ? " ed__oculto" : ""}`
    emBreve.replaceChildren()
    emBreve.className = `ed__em-breve${fora ? "" : " ed__oculto"}`
    if (fora) {
      emBreve.append(
        el("h2", "ed__em-breve-titulo", botoesDeAba.get(aba).textContent),
        el("p", "ed__em-breve-texto", EM_CONSTRUCAO[aba])
      )
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
