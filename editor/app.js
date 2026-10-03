// O editor inteiro: paleta, canvas e preview.
//
// O fluxo é o único estado. Toda edição devolve um fluxo novo e a tela é
// redesenhada a partir dele — não há estado espalhado que possa divergir.

import { criarCanvas } from "./canvas.js"
import { todos } from "./catalogo.js"
import { campoPrincipal } from "./modelo.js"
import {
  acrescentarBloco, criarGrupo, moverGrupo, definirCampo, definirTitulo,
  definirOpcao, acrescentarOpcao, removerOpcao, proximoIdDeOpcao,
  definirProximoDoEvento, moverEvento, definirProximo, limparOpcoesVazias, removerGrupo, duplicarGrupo,
  removerBloco,
  nomeDoFluxo, definirNomeDoFluxo, moverBlocoEntreGrupos, blocoViraGrupo
} from "./edicoes.js"
import { validarFluxo } from "../motor/validar.js"
import { criarPreview } from "./preview.js"
import { iconeDoTipo, iconeDaAcao } from "./icones.js"
import { colunasDosResultados, valorNaColuna, quando } from "./resultados.js"
import {
  SECOES as SECOES_DO_TEMA, LARGURA_MINIMA, LARGURA_MAXIMA,
  corDoTema, corHerdada, definirCor, soltarCor, definirDoTema,
  larguraEmRem, definirLargura
} from "./tema.js"
import { FONTES, fonteDoTema, definirFonte, urlDaAmostra } from "./fontes.js"
import { criarChat, aplicarTema } from "../motor/motor.js"
import { resolverMidia } from "../motor/midia.js"
import { criarTradutor, idiomaValido, IDIOMAS, PADRAO as IDIOMA_PADRAO } from "./idioma.js"


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
  aoBuscarLeads = null,
  // Guarda uma imagem que a pessoa subiu e devolve o caminho dela dentro da
  // pasta do cliente. Nulo quando não há quem guarde — e aí a bolha de imagem
  // só aceita link.
  aoSubirImagem = null,
  // O tema do chat deste cliente, e onde gravá-lo. Sem gravador, a aba Tema
  // ainda edita e mostra — só não salva, e diz isso.
  tema = {},
  aoSalvarTema = null,
  // Onde este navegador guarda o que é dele: a chave de leitura e a última
  // leitura dos leads. Injetável porque a suíte precisa de um de mentira — e
  // porque em janela anônima ele simplesmente não existe.
  armazenamento = globalThis.localStorage,
  // Onde mora a pasta do cliente, vista desta página. O tema fala em caminhos
  // relativos a ela ("avatar": "logo.svg"); quem sabe traduzir é quem abriu o
  // editor, não o tema.
  pastaDoCliente = ""
}) {
  let atual = fluxo
  let temaAtual = tema

  // O idioma desta tela. É da pessoa, não do projeto: fica neste navegador e
  // vale para qualquer cliente que ela abrir. O que o lead lê é outra coisa —
  // está escrito no fluxo, e não se traduz sozinho.
  // Começa em português, que é o idioma em que o editor é escrito; seguir o
  // navegador abriria em inglês para quem só tem o sistema em inglês.
  const NOME_DO_IDIOMA = "chatflow:idioma"
  let idioma = IDIOMA_PADRAO
  try {
    const guardado = armazenamento?.getItem(NOME_DO_IDIOMA)
    if (idiomaValido(guardado)) idioma = guardado
  } catch { /* sem armazenamento: vale o idioma do navegador */ }

  // Que seções da coluna da esquerda estão fechadas, por aba. Guardado aqui
  // e não no projeto: dobrar "Lógica" é arrumação de quem edita, não uma
  // decisão do fluxo. Guarda-se o que está FECHADO para que seção nova nasça
  // aberta — ninguém descobre um grupo que já abre dobrado.
  // Painel preso ou solto. Preso é o que sempre foi: a coluna fica na tela.
  // Solto, ela se recolhe para a esquerda e volta quando o mouse chega perto
  // da borda — quem trabalha num fluxo largo ganha a tela inteira.
  const NOME_DO_LADO = "chatflow:lado-preso"
  let ladoPreso = true
  try {
    const guardado = armazenamento?.getItem(NOME_DO_LADO)
    if (guardado === "nao") ladoPreso = false
  } catch { /* sem armazenamento: o painel fica preso, como sempre esteve */ }

  const NOME_DAS_SECOES = "chatflow:secoes"
  const secoesFechadas = { fluxo: new Set(), tema: new Set() }
  try {
    const guardado = JSON.parse(armazenamento?.getItem(NOME_DAS_SECOES) || "{}")
    for (const onde of Object.keys(secoesFechadas)) {
      if (Array.isArray(guardado[onde])) secoesFechadas[onde] = new Set(guardado[onde])
    }
  } catch { /* sem armazenamento ou cópia estragada: tudo aberto */ }

  function guardarSecoes() {
    try {
      armazenamento?.setItem(NOME_DAS_SECOES, JSON.stringify({
        fluxo: [...secoesFechadas.fluxo], tema: [...secoesFechadas.tema]
      }))
    } catch { /* vale só esta sessão */ }
  }

  // Uma seção dobrável: o título é o botão, e a seta conta o estado. Fechada,
  // o corpo não é desenhado — some da tela e some do caminho do teclado.
  function secaoDobravel({ onde, chave, titulo, nota, classe = "", montarCorpo }) {
    const aberta = !secoesFechadas[onde].has(chave)
    const caixa = el("section",
      `ed__secao ed__secao--${chave}${classe ? ` ${classe}` : ""}${aberta ? "" : " ed__secao--fechada"}`)

    const topo = el("button", "ed__secao-topo")
    topo.setAttribute("type", "button")
    topo.setAttribute("aria-expanded", aberta ? "true" : "false")
    topo.append(el("span", "ed__categoria", titulo))
    const seta = iconeDaAcao("seta", "ed__secao-seta")
    if (seta) topo.append(seta)
    else topo.append(el("span", "ed__secao-seta", aberta ? "⌄" : "›"))
    topo.addEventListener("click", () => {
      if (aberta) secoesFechadas[onde].add(chave)
      else secoesFechadas[onde].delete(chave)
      guardarSecoes()
      desenharLado()
    })
    caixa.append(topo)

    if (aberta) {
      const corpo = el("div", "ed__secao-corpo")
      if (nota) corpo.append(el("p", "ed__tema-nota", nota))
      montarCorpo(corpo)
      caixa.append(corpo)
    }
    return caixa
  }

  let traduzir = criarTradutor(idioma)
  // Indireto de propósito: canvas e preview recebem esta função uma
  // vez e seguem traduzindo certo depois que o idioma muda.
  const t = (frase, valores) => traduzir(frase, valores)
  let selecao = { grupo: null, bloco: null }
  let recado = ""
  // O retrato do fluxo como ele está gravado. Comparar com o de agora é o que
  // diz se há algo a salvar — mais honesto que marcar "sujo" em cada edição e
  // esquecer de marcar numa delas.
  let gravado = JSON.stringify(fluxo)
  let temaGravado = JSON.stringify(tema)
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
  // Um passo guarda o fluxo E o tema: são duas abas do mesmo projeto, e
  // desfazer que só valesse numa delas seria uma armadilha.
  function agora() {
    return { fluxo: atual, tema: temaAtual }
  }

  function registrarPasso(assinatura) {
    if (!assinatura || assinatura !== ultimaAssinatura) {
      desfazerPilha.push(agora())
      if (desfazerPilha.length > PASSOS_GUARDADOS) desfazerPilha.shift()
    }
    ultimaAssinatura = assinatura
    refazerPilha = []
  }

  function trocarFluxo(novo, assinatura = null) {
    if (novo === atual) return
    registrarPasso(assinatura)
    atual = novo
  }

  function trocarTema(novo, assinatura = null) {
    if (novo === temaAtual) return
    registrarPasso(assinatura)
    temaAtual = novo
  }

  function voltarPara(passo) {
    atual = passo.fluxo
    temaAtual = passo.tema
    depoisDeAndarNoTempo()
  }

  function desfazer() {
    if (!desfazerPilha.length) return
    refazerPilha.push(agora())
    voltarPara(desfazerPilha.pop())
  }

  function refazer() {
    if (!refazerPilha.length) return
    desfazerPilha.push(agora())
    voltarPara(refazerPilha.pop())
  }

  // Voltar no tempo pode ter apagado o que estava selecionado, e a próxima
  // edição não deve se juntar à que acabou de ser desfeita.
  function depoisDeAndarNoTempo() {
    ultimaAssinatura = null
    // O interruptor do retrato volta a seguir o tema: depois de desfazer,
    // quem manda é o que o tema diz, não o último clique.
    retratoAberto = null
    if (selecao.grupo && !atual.grupos.some((g) => g && g.id === selecao.grupo)) {
      selecao = { grupo: null, bloco: null }
    }
    redesenhar()
  }

  const raiz = el("div", "ed")
  const paleta = el("aside", "ed__paleta")
  const centro = el("main", "ed__centro")
  const barra = el("header", "ed__barra")
  const palcoCanvas = el("div", "ed__area-canvas")
  const problemas = el("div", "ed__problemas")
  // O preview não ocupa coluna: flutua e só existe enquanto é necessário.
  // O canvas fica com o resto da tela.
  const areaPreview = el("div", "ed__area-preview")
  const areaConfiguracoes = el("div", "ed__area-config")
  const emBreve = el("div", "ed__em-breve ed__oculto")
  const areaResultados = el("section", "ed__resultados ed__oculto")
  const areaTema = el("section", "ed__tema ed__oculto")
  centro.append(palcoCanvas, emBreve, areaResultados, areaTema, problemas)
  // O header é irmão do corpo, não mora dentro da coluna do meio: era isso
  // que fazia as abas deslizarem quando a coluna da esquerda sumia na aba
  // Resultados. E a paleta flutua por cima do quadro, sem empurrar nada.
  const corpo = el("div", "ed__corpo")
  // A pílula que fica na beira da tela quando o painel está recolhido: é o
  // alvo do mouse para trazê-lo de volta, e a única pista de que ele existe.
  const puxador = el("span", "ed__puxador")
  puxador.append(el("span", "ed__puxador-marca"))
  corpo.append(puxador, paleta, centro)
  raiz.append(barra, corpo, areaPreview, areaConfiguracoes)
  elemento.replaceChildren(raiz)

  const canvas = criarCanvas({
    elemento: palcoCanvas, t,
    // O quadro ocupa a tela inteira; a paleta flutua sobre a esquerda dele.
    tapado: () => (paleta.className.includes("ed__oculto") ? null : paleta.getBoundingClientRect?.()),
    aoSubirImagem,
    aoSelecionar: (nova) => {
      selecao = nova
      recado = ""
      // Redesenho inteiro, e não só a paleta: trocar de seleção é trocar de
      // lugar na tela, e é aí que a opção que ninguém nomeou sai.
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
      // Seleção apontando para o que não existe mais deixaria a paleta
      // trabalhando num grupo fantasma.
      if (selecao.grupo === grupo) selecao = { grupo: null, bloco: null }
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
    aoApagarBloco: ({ grupo, bloco }) => {
      trocarFluxo(removerBloco(atual, { grupo, bloco }))
      // O bloco que se foi não pode continuar selecionado: a seleção fica no
      // grupo, que é onde a pessoa está olhando.
      if (selecao.bloco === bloco) selecao = { grupo, bloco: null }
      redesenhar()
    },
    aoMover: (grupo, { x, y }) => {
      trocarFluxo(moverGrupo(atual, { grupo, x, y }), `mover:${grupo}`)
      redesenhar({ manterVista: true })
    },
    aoTestar: (grupo) => { preview.abrir(atual, grupo); sincronizarTestar() }
  })
  const preview = criarPreview({
    tema: () => temaParaOChat(),
    elemento: areaPreview, aoFechar: () => sincronizarTestar(), esperar: esperarNoTeste, t,
    pasta: pastaDoCliente
  })
  // --- barra -----------------------------------------------------------
  const ajustar = el("button", "ed__ajustar")
  ajustar.setAttribute("type", "button")
  const icArruma = iconeDaAcao("centralizar")
  if (icArruma) ajustar.append(icArruma)
  const palavraDoAjustar = el("span", null)
  ajustar.append(palavraDoAjustar)
  ajustar.addEventListener("click", () => canvas.enquadrar())

  const testar = el("button", "ed__testar")
  testar.setAttribute("type", "button")
  testar.addEventListener("click", () => { preview.abrir(atual, null); sincronizarTestar() })

  // Com a aba de teste aberta, o botão não tem o que fazer: some, e volta
  // quando ela fecha. Um botão que não faz nada é pior que botão nenhum.
  function sincronizarTestar() {
    testar.className = preview.aberto() ? "ed__testar ed__oculto" : "ed__testar"
  }

  const salvar = el("button", "ed__salvar")
  salvar.setAttribute("type", "button")
  const palavraDoSalvar = el("span", null)
  salvar.addEventListener("click", () => guardar())

  function temMudancas() {
    return fluxoMudou() || temaMudou()
  }

  const fluxoMudou = () => JSON.stringify(atual) !== gravado
  const temaMudou = () => JSON.stringify(temaAtual) !== temaGravado

  // O botão conta três coisas: há o que salvar, está salvando, ou está tudo
  // guardado. Botão que diz sempre a mesma coisa não avisa nada.
  function sincronizarSalvar() {
    const mudou = temMudancas()
    // O ícone conta o mesmo que a palavra: disquete enquanto há o que
    // guardar, visto quando está tudo guardado.
    palavraDoSalvar.textContent = t(salvando ? "Salvando…" : mudou ? "Salvar" : "Salvo")
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
    const textoDoTema = JSON.stringify(temaAtual, null, 2)
    if (!aoSalvar) return cair(texto, t("Este editor está aberto sem servidor para gravar."))

    salvando = true
    sincronizarSalvar()
    try {
      // Cada arquivo só vai se mudou: salvar o tema a cada mexida no fluxo
      // daria commit de tema em dia que ninguém tocou no tema.
      if (fluxoMudou()) {
        await aoSalvar(texto)
        gravado = JSON.stringify(atual)
      }
      if (temaMudou()) {
        if (!aoSalvarTema) throw new Error(t("este editor não sabe gravar o tema"))
        await aoSalvarTema(textoDoTema)
        temaGravado = JSON.stringify(temaAtual)
      }
      recado = ""
    } catch (falha) {
      // O que falhou é o que ainda está diferente do gravado.
      const doTema = temaMudou() && !fluxoMudou()
      cair(doTema ? textoDoTema : texto, falha?.message || String(falha),
        doTema ? "tema.json" : "fluxo.json")
    } finally {
      salvando = false
      sincronizarSalvar()
      desenharLado()
    }
  }

  // Não deu para gravar: o arquivo desce para a pasta de downloads. Trabalho
  // perdido por um servidor fora do ar seria o pior resultado possível.
  function cair(texto, motivo, nomeDoArquivo = "fluxo.json") {
    aoBaixar(texto, nomeDoArquivo)
    recado = t("Não consegui salvar ({motivo}). Baixei o {arquivo} para não perder o trabalho.",
      { motivo, arquivo: nomeDoArquivo })
    desenharLado()
  }

  // --- as três zonas do header -----------------------------------------
  // Esquerda: voltar, nome do projeto, desfazer/refazer. Meio: as abas.
  // Direita: testar, centralizar, salvar e a engrenagem.
  const esquerda = el("div", "ed__barra-lado")
  const meio = el("nav", "ed__abas")
  const direita = el("div", "ed__barra-lado")

  const voltar = el("button", "ed__voltar", "‹")
  voltar.setAttribute("type", "button")
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
    texto.setAttribute("title", t("Clique para renomear o projeto"))
    texto.addEventListener("click", () => { editandoNome = true; desenharNome() })
    nome.append(texto)
  }

  const voltarPasso = el("button", "ed__passo ed__passo--desfazer")
  voltarPasso.setAttribute("type", "button")
  const icDesfazer = iconeDaAcao("desfazer", "ed__barra-icone ed__barra-icone--passo")
  if (icDesfazer) voltarPasso.append(icDesfazer)
  else voltarPasso.textContent = "↶"
  voltarPasso.addEventListener("click", () => desfazer())

  const refazerPasso = el("button", "ed__passo ed__passo--refazer")
  refazerPasso.setAttribute("type", "button")
  const icRefazer = iconeDaAcao("refazer", "ed__barra-icone ed__barra-icone--passo")
  if (icRefazer) refazerPasso.append(icRefazer)
  else refazerPasso.textContent = "↷"
  refazerPasso.addEventListener("click", () => refazer())

  function sincronizarPassos() {
    voltarPasso.disabled = desfazerPilha.length === 0
    refazerPasso.disabled = refazerPilha.length === 0
  }

  const ABAS = [["fluxo", "Fluxo"], ["tema", "Tema"], ["resultados", "Resultados"]]
  const botoesDeAba = new Map()
  for (const [chave, rotulo] of ABAS) {
    const botao = el("button", "ed__aba", t(rotulo))
    botao.setAttribute("type", "button")
    botao.addEventListener("click", () => {
      aba = chave
      // O clique foi no header, longe da beira: a aba nova abre com o painel
      // recolhido, não com um espiar que sobrou da aba anterior.
      espiando = false
      sincronizarAbas()
      desenharLado()
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

  // Toda palavra fixa da barra num lugar só: trocar de idioma é chamar isto
  // de novo, em vez de caçar elemento por elemento pela tela.
  function aplicarIdiomaNaBarra() {
    ajustar.setAttribute("title", t("Põe o fluxo inteiro na tela"))
    palavraDoAjustar.textContent = t("Centralizar")
    testar.textContent = t("▶ Testar")
    voltar.setAttribute("title", t("Voltar aos projetos"))
    voltar.setAttribute("aria-label", t("Voltar aos projetos"))
    voltarPasso.setAttribute("title", t("Desfazer"))
    voltarPasso.setAttribute("aria-label", t("Desfazer"))
    refazerPasso.setAttribute("title", t("Refazer"))
    refazerPasso.setAttribute("aria-label", t("Refazer"))
    engrenagem.setAttribute("title", t("Configurações"))
    engrenagem.setAttribute("aria-label", t("Configurações"))
    for (const [chave, rotulo] of ABAS) botoesDeAba.get(chave).textContent = t(rotulo)
    sincronizarSalvar()
  }

  esquerda.append(voltar, nome, voltarPasso, refazerPasso)
  direita.append(testar, ajustar, salvar, engrenagem)
  barra.append(esquerda, meio, direita)
  aplicarIdiomaNaBarra()
  desenharNome()
  sincronizarAbas()

  // O lado esquerdo serve à aba aberta: na do fluxo são os tipos de bloco,
  // na do tema são as seções de cor. Paleta de blocos na aba Tema seria só
  // ruído com gesto que não leva a nada.
  // De quão longe o mouse já chama o painel de volta, e quanto ele pode se
  // afastar do painel aberto antes de ele ir embora. Encostar na pílula é
  // mira demais para um gesto que se faz o tempo todo: 80px é um terço da
  // largura do painel, perto o bastante para não atrapalhar quem trabalha na
  // beira esquerda do quadro.
  const PERTO_DA_BEIRA = 80
  const FOLGA_DO_PAINEL = 24
  let espiando = false

  function sincronizarLado() {
    const solto = aba !== "resultados" && !ladoPreso
    corpo.className =
      `ed__corpo${solto ? " ed__corpo--solto" : ""}${solto && espiando ? " ed__corpo--espiando" : ""}`
  }

  // O painel volta por proximidade, não por encostar: enquanto está fora da
  // tela basta o mouse chegar perto da beira; aberto, ele só se recolhe
  // quando o mouse se afasta dele. Medir o painel só quando ele está na tela
  // deixa o caso comum — painel recolhido — em uma comparação de números. E
  // preso, ou sem painel, nem isso: o mouse passa sem custo nenhum.
  document.addEventListener("mousemove", (ev) => {
    if (ladoPreso || aba === "resultados") return
    const limite = espiando
      ? (paleta.getBoundingClientRect?.()?.right ?? 0) + FOLGA_DO_PAINEL
      : PERTO_DA_BEIRA
    const perto = ev.clientX <= limite
    if (perto === espiando) return
    espiando = perto
    sincronizarLado()
  })

  function desenharLado() {
    const semLado = aba === "resultados"
    paleta.className = `ed__paleta${semLado ? " ed__oculto" : ""}`
    sincronizarLado()
    if (aba === "tema") return desenharLadoDoTema()
    if (aba === "resultados") return paleta.replaceChildren()
    desenharPaleta()
  }

  // Cadeado no alto da coluna: fechado, ela fica onde está; aberto, ela se
  // recolhe sozinha quando o mouse sai.
  function cadeadoDoLado() {
    const botao = el("button", `ed__trava${ladoPreso ? " ed__trava--presa" : ""}`)
    botao.setAttribute("type", "button")
    botao.setAttribute("aria-pressed", ladoPreso ? "true" : "false")
    const dica = ladoPreso
      ? t("Soltar o painel: ele se recolhe quando o mouse sai")
      : t("Prender o painel no lugar")
    botao.setAttribute("title", dica)
    botao.setAttribute("aria-label", dica)
    const icone = iconeDaAcao(ladoPreso ? "cadeado" : "cadeado_aberto", "ed__trava-icone")
    if (icone) botao.append(icone)
    else botao.textContent = ladoPreso ? "🔒" : "🔓"
    botao.addEventListener("click", () => {
      ladoPreso = !ladoPreso
      // Quem acabou de soltar está com o mouse em cima do cadeado, dentro do
      // painel: ele fica até o mouse sair, em vez de fugir de baixo da mão.
      espiando = !ladoPreso
      try { armazenamento?.setItem(NOME_DO_LADO, ladoPreso ? "sim" : "nao") } catch { /* vale esta sessão */ }
      desenharLado()
    })
    return botao
  }

  // --- paleta ----------------------------------------------------------
  // O cadeado numa faixa própria, no alto: flutuando, o título da primeira
  // seção subia para o lado dele e a coluna começava torta.
  function topoDoLado() {
    const topo = el("div", "ed__lado-topo")
    topo.append(cadeadoDoLado())
    return topo
  }

  function desenharPaleta() {
    const caixa = el("div", "ed__paleta-corpo")
    caixa.append(topoDoLado())
    caixa.append(el("div", "ed__recado", recado))

    const porCategoria = new Map()
    for (const definicao of todos()) {
      if (!porCategoria.has(definicao.categoria)) porCategoria.set(definicao.categoria, [])
      porCategoria.get(definicao.categoria).push(definicao)
    }

    for (const [categoria, lista] of porCategoria) {
      caixa.append(secaoDobravel({
        onde: "fluxo",
        chave: categoria,
        titulo: t(NOME_DA_CATEGORIA[categoria] || categoria),
        montarCorpo: (corpo) => corpo.append(gradeDeTipos(lista, categoria))
      }))
    }
    paleta.replaceChildren(caixa)
  }

  function gradeDeTipos(lista, categoria) {
      const grade = el("div", "ed__grade")
      for (const definicao of lista) {
        const botao = el("button", `ed__tipo ed__tipo--${categoria}`)
        botao.setAttribute("type", "button")
        const icone = iconeDoTipo(definicao.tipo)
        if (icone) botao.append(icone)
        botao.append(el("span", "ed__tipo-rotulo", t(definicao.rotulo)))
        botao.addEventListener("mousedown", (ev) => arrastarTipo(ev, definicao))
        botao.addEventListener("click", () => {
          if (!selecao.grupo) {
            // Sem grupo escolhido não há onde pôr o bloco — e agora há um
            // gesto melhor que escolher: arrastar até o quadro.
            recado = t("Arraste o tipo até o quadro para criar um grupo, ou selecione um grupo antes de clicar.")
            desenharPaleta()
            return
          }
          acrescentarNoGrupo(selecao.grupo, definicao.tipo, selecao.bloco)
        })
        grade.append(botao)
      }
      return grade
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
    fantasma.append(el("span", "ed__tipo-rotulo", t(definicao.rotulo)))
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

  // A aba escolhida manda no que aparece embaixo do header. Nenhuma está "em
  // breve" hoje; a caixa fica porque a próxima aba vai nascer vazia e é
  // melhor dizer isso do que abrir uma tela que parece quebrada.
  const EM_CONSTRUCAO = {}

  function desenharConteudo() {
    const fora = aba !== "fluxo"
    palcoCanvas.className = `ed__area-canvas${fora ? " ed__oculto" : ""}`
    emBreve.replaceChildren()
    const temRecado = fora && EM_CONSTRUCAO[aba]
    emBreve.className = `ed__em-breve${temRecado ? "" : " ed__oculto"}`
    areaResultados.replaceChildren()
    areaResultados.className = `ed__resultados${aba === "resultados" ? "" : " ed__oculto"}`
    areaTema.className = `ed__tema${aba === "tema" ? "" : " ed__oculto"}`
    // Sair da aba desmonta a conversa de exemplo: chat vivo escondido atrás
    // de outra aba continua contando o tempo e pedindo fonte.
    if (aba !== "tema") desmontarChatDoTema()

    if (aba === "resultados") return desenharResultados()
    if (aba === "tema") return desenharTema()
    if (temRecado) {
      emBreve.append(
        el("h2", "ed__em-breve-titulo", botoesDeAba.get(aba).textContent),
        el("p", "ed__em-breve-texto", EM_CONSTRUCAO[aba])
      )
    }
  }

  // --- a aba Tema --------------------------------------------------------
  // À esquerda, as seções com os controles; no meio, uma conversa de verdade
  // rodando o fluxo deste projeto. Mexer numa cor muda a conversa na hora,
  // sem reiniciá-la: o motor escreve as cores no próprio elemento do chat.
  let chatDoTema = null
  let palcoDoTema = null

  // Imagem do tema é relativa à pasta do cliente; o chat precisa do caminho
  // que funciona desta página.
  function temaParaOChat() {
    const avatar = temaAtual.avatar
    if (!avatar || !pastaDoCliente || /^(https?:)?\/\/|^data:|^\//.test(avatar)) return temaAtual
    return { ...temaAtual, avatar: `${pastaDoCliente}/${avatar}` }
  }

  // Sair da aba desmonta a conversa: chat vivo escondido atrás de outra aba
  // continua contando o tempo e desenhando falas que ninguém vê.
  function desmontarChatDoTema() {
    chatDoTema = null
    palcoDoTema = null
    areaTema.replaceChildren()
  }

  function desenharTema() {
    areaTema.replaceChildren()
    const topo = el("div", "ed__tema-topo")
    topo.append(el("h2", "ed__tema-titulo", t("A conversa do seu jeito")))
    const reiniciar = el("button", "ed__tema-reiniciar", t("Reiniciar a conversa"))
    reiniciar.setAttribute("type", "button")
    reiniciar.addEventListener("click", () => montarChatDoTema())
    topo.append(reiniciar)

    palcoDoTema = el("div", "ed__tema-palco")
    areaTema.append(topo, palcoDoTema)
    montarChatDoTema()
  }

  function montarChatDoTema() {
    if (!palcoDoTema) return
    chatDoTema = criarChat({
      elemento: palcoDoTema,
      fluxo: resolverMidia(atual, pastaDoCliente),
      tema: temaParaOChat(),
      modo: "teste",
      armazenamento: undefined,
      ritmo: atual.ritmo,
      esperar: esperarNoTeste,
      buscar: async () => { throw new Error("a aba Tema não envia nada") }
    })
    chatDoTema.reiniciar({ retomar: false })
  }

  // Uma cor, uma largura ou uma fonte não precisam remontar nada: o motor
  // reescreve as variáveis no elemento do chat e a conversa continua de onde
  // estava. Retrato e marca, sim — o chat os lê ao nascer.
  function temaMexido({ remontar = false } = {}) {
    if (temaAtual.avatar) retratoGuardado = temaAtual.avatar
    sincronizarCores()
    sincronizarSalvar()
    if (!chatDoTema) return
    if (remontar) montarChatDoTema()
    else aplicarTema(chatDoTema.raiz, temaParaOChat())
  }

  // O retrato tem interruptor, e desligar é esvaziar o campo. Guardar o
  // caminho aqui deixa religar sem ter de digitar de novo — e não suja o
  // tema.json com chave que o chat não usa.
  let retratoGuardado = tema.avatar || ""
  // Enquanto ninguém mexe no interruptor, ele segue o tema. Depois de mexido,
  // manda ele: ligar sem imagem nenhuma tem de abrir o campo, senão o
  // interruptor parece quebrado — volta sozinho para "desligado" porque não
  // havia caminho para pôr.
  let retratoAberto = null
  const mostrandoRetrato = () => (retratoAberto === null ? Boolean(temaAtual.avatar) : retratoAberto)

  // Cada seletor de cor da tela, pela chave que ele edita. Trocar o acento
  // muda a cor do botão, que o segue — e o seletor do botão tem de mostrar
  // isso na hora, senão o painel diz azul enquanto a conversa está vinho.
  const camposDeCor = new Map()
  const camposDeTexto = new Map()

  function sincronizarCores() {
    for (const [chave, { campo, soltar }] of camposDeCor) {
      const cor = corDoTema(temaAtual, chave)
      if (campo.value !== cor) {
        campo.value = cor
        campo.setAttribute("value", cor)
      }
      soltar.disabled = corHerdada(temaAtual, chave)
    }
  }

  function desenharLadoDoTema() {
    pedirAmostraDasFontes()
    camposDeCor.clear()
    camposDeTexto.clear()
    const caixa = el("div", "ed__paleta-corpo")
    caixa.append(topoDoLado())
    caixa.append(el("div", "ed__recado", recado))

    for (const secao of SECOES_DO_TEMA) {
      const bloco = secaoDobravel({
        onde: "tema",
        chave: secao.chave,
        titulo: t(secao.titulo),
        nota: secao.nota ? t(secao.nota) : "",
        montarCorpo: (corpo) => {
          for (const controle of secao.controles) {
            // O caminho da imagem só aparece com o retrato ligado: campo vazio
            // embaixo de um interruptor desligado só faz perguntar para quê.
            if (controle.chave === "avatar" && controle.tipo === "texto" && !mostrandoRetrato()) continue
            corpo.append(linhaDoTema(controle))
          }
        },
        classe: `ed__tema-secao ed__tema-secao--${secao.chave}`
      })
      caixa.append(bloco)
    }

    paleta.replaceChildren(caixa)
  }

  function linhaDoTema(controle) {
    const linha = el("div", `ed__tema-linha ed__tema-linha--${controle.tipo}`)
    linha.append(el("span", "ed__tema-rotulo", t(controle.rotulo)))
    const direita = el("span", "ed__tema-controle")

    if (controle.tipo === "cor") direita.append(...controleDeCor(controle))
    else if (controle.tipo === "fonte") direita.append(controleDeFonte())
    else if (controle.tipo === "largura") direita.append(...controleDeLargura())
    else if (controle.tipo === "interruptor") direita.append(interruptorDoRetrato())
    else direita.append(controleDeTexto(controle))

    linha.append(direita)
    return linha
  }

  function controleDeCor(controle) {
    const campo = el("input", "ed__tema-cor")
    campo.setAttribute("type", "color")
    campo.setAttribute("aria-label", t(controle.rotulo))
    campo.value = corDoTema(temaAtual, controle.chave)
    campo.setAttribute("value", campo.value)

    // Herdada mostra a cor que a pessoa vê e um botão para devolvê-la à
    // herança. Sem o botão, escolher uma cor por engano seria definitivo.
    const soltar = el("button", "ed__tema-soltar", "↺")
    soltar.setAttribute("type", "button")
    soltar.setAttribute("title", t("Voltar ao padrão"))
    soltar.setAttribute("aria-label", `${t(controle.rotulo)}: ${t("Voltar ao padrão")}`)
    soltar.disabled = corHerdada(temaAtual, controle.chave)

    campo.addEventListener("input", () => {
      // Arrastar o seletor dispara um evento por tom: a assinatura junta
      // todos num passo de desfazer só.
      trocarTema(definirCor(temaAtual, controle.chave, campo.value), `cor:${controle.chave}`)
      temaMexido()
    })
    soltar.addEventListener("click", () => {
      trocarTema(soltarCor(temaAtual, controle.chave))
      temaMexido()
    })
    camposDeCor.set(controle.chave, { campo, soltar })
    return [campo, soltar]
  }

  // A lista de fontes. Cada nome aparece na sua própria letra — é o que
  // permite escolher pela cara em vez de pelo nome.
  const PERSONALIZADA = "personalizada"

  function controleDeFonte() {
    const lista = el("select", "ed__tema-lista")
    lista.setAttribute("aria-label", t("Fonte"))
    const escolhida = fonteDoTema(temaAtual)

    for (const fonte of FONTES) {
      const opcao = el("option", "ed__tema-opcao", t(fonte.nome))
      opcao.setAttribute("value", fonte.nome)
      opcao.style.setProperty("font-family", fonte.familia)
      lista.append(opcao)
    }
    // Fonte escrita à mão no tema.json não some da tela só porque não está na
    // lista: ela aparece como está, escolhida, e só sai se a pessoa trocar.
    if (!escolhida) {
      const opcao = el("option", "ed__tema-opcao", t("Personalizada: {fonte}", { fonte: temaAtual.fonte }))
      opcao.setAttribute("value", PERSONALIZADA)
      lista.append(opcao)
    }

    lista.value = escolhida ? escolhida.nome : PERSONALIZADA
    lista.addEventListener("change", () => {
      if (lista.value === PERSONALIZADA) return
      trocarTema(definirFonte(temaAtual, lista.value))
      desenharLadoDoTema()
      temaMexido()
    })
    return lista
  }

  // As folhas de todas as fontes da lista, pedidas uma vez quando a aba abre:
  // sem elas a lista mostraria quinze nomes na mesma letra.
  let amostraPedida = false
  function pedirAmostraDasFontes() {
    if (amostraPedida) return
    const cabeca = globalThis.document?.head
    if (!cabeca) return
    amostraPedida = true
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = urlDaAmostra()
    cabeca.append(link)
  }

  function controleDeLargura() {
    const campo = el("input", "ed__tema-faixa")
    campo.setAttribute("type", "range")
    campo.setAttribute("min", String(LARGURA_MINIMA))
    campo.setAttribute("max", String(LARGURA_MAXIMA))
    campo.setAttribute("step", "1")
    campo.setAttribute("aria-label", t("Largura máxima da conversa"))
    campo.value = String(larguraEmRem(temaAtual))
    const medida = el("span", "ed__tema-medida", `${larguraEmRem(temaAtual)}rem`)
    campo.addEventListener("input", () => {
      trocarTema(definirLargura(temaAtual, campo.value), "largura")
      medida.textContent = `${larguraEmRem(temaAtual)}rem`
      temaMexido()
    })
    return [campo, medida]
  }

  function controleDeTexto(controle) {
    const campo = el("input", "ed__tema-texto")
    campo.setAttribute("type", "text")
    campo.setAttribute("aria-label", t(controle.rotulo))
    if (controle.dica) campo.setAttribute("placeholder", controle.dica)
    campo.value = temaAtual[controle.chave] || ""

    // O retrato e a marca o chat lê ao nascer, então remontam — mas só quando
    // a pessoa termina de escrever. Remontar a cada letra do caminho da
    // imagem jogaria a conversa para a primeira pergunta em cada tecla.
    const remontaNoFim = controle.chave === "avatar" || controle.chave === "marca"
    campo.addEventListener("input", () => {
      const valor = String(campo.value || "").trim()
      trocarTema(definirDoTema(temaAtual, controle.chave, valor), `tema:${controle.chave}`)
      temaMexido({ remontar: !remontaNoFim })
    })
    if (remontaNoFim) campo.addEventListener("change", () => temaMexido({ remontar: true }))
    camposDeTexto.set(controle.chave, campo)
    return campo
  }

  function interruptorDoRetrato() {
    const ligado = mostrandoRetrato()
    const botao = el("button", `ed__tema-chave${ligado ? " ed__tema-chave--ligado" : ""}`)
    botao.setAttribute("type", "button")
    botao.setAttribute("aria-pressed", ligado ? "true" : "false")
    botao.setAttribute("aria-label", t("Mostrar retrato"))
    botao.append(el("span", "ed__tema-chave-bola"))
    botao.addEventListener("click", () => {
      retratoAberto = !ligado
      trocarTema(definirDoTema(temaAtual, "avatar", retratoAberto ? retratoGuardado : ""))
      desenharLadoDoTema()
      temaMexido({ remontar: true })
      // Ligado sem imagem, o campo recém-aberto é o próximo passo: o cursor
      // já vai para ele.
      if (retratoAberto && !temaAtual.avatar) {
        const campo = camposDeTexto.get("avatar")
        campo?.focus?.()
      }
    })
    return botao
  }

  // --- resultados --------------------------------------------------------
  // Uma linha por pessoa que entrou no chat, com o que ela respondeu até onde
  // chegou. Os dados vêm da planilha do cliente, por uma leitura protegida
  // por chave — a chave fica neste navegador, nunca no repositório.
  let leads = null
  let erroDosLeads = ""
  let buscandoLeads = false
  // Quando a cópia guardada foi lida da planilha, e se esta sessão já foi lá
  // uma vez. A busca leva alguns segundos; sem a cópia, abrir a aba era
  // encarar um "buscando…" toda vez, inclusive para só conferir um telefone.
  let lidoEm = ""
  let buscouNestaSessao = false

  const NOME_DOS_LEADS = `chatflow:leads:${cliente}`
  // Quantas linhas a cópia guarda quando a planilha não cabe inteira. O
  // armazenamento do navegador é pequeno (alguns MB) e é compartilhado com o
  // resto; a tabela abre pelas mais recentes, que é o que se olha.
  const LEADS_GUARDADOS = 200

  function lerLeadsGuardados() {
    try {
      const cru = armazenamento?.getItem(NOME_DOS_LEADS)
      if (!cru) return null
      const guardado = JSON.parse(cru)
      if (!Array.isArray(guardado?.linhas)) return null
      return guardado
    } catch {
      // Cópia estragada não pode impedir a aba de abrir: ela é um atalho,
      // não a fonte.
      return null
    }
  }

  function guardarLeads(linhas, em) {
    if (!armazenamento) return
    const escrever = (lista) =>
      armazenamento.setItem(NOME_DOS_LEADS, JSON.stringify({ em, linhas: lista }))
    try {
      escrever(linhas)
    } catch {
      // Não coube. Guarda as mais recentes; se nem isso couber, desiste em
      // silêncio — a aba continua funcionando, só sem atalho.
      try {
        escrever(linhas.slice(0, LEADS_GUARDADOS))
      } catch {
        try { armazenamento.removeItem(NOME_DOS_LEADS) } catch { /* nada a fazer */ }
      }
    }
  }

  function esquecerLeads() {
    leads = null
    lidoEm = ""
    buscouNestaSessao = false
    try { armazenamento?.removeItem(NOME_DOS_LEADS) } catch { /* nada a fazer */ }
  }

  // A cópia guardada entra como se já tivesse sido lida: a tabela aparece no
  // mesmo instante em que a aba abre, e a planilha é consultada por baixo.
  const guardadoAoAbrir = lerLeadsGuardados()
  if (guardadoAoAbrir) {
    leads = guardadoAoAbrir.linhas
    lidoEm = guardadoAoAbrir.em || ""
  }

  function desenharResultados() {
    desenharTabelaDeResultados()
    // A busca vem depois de a tela estar montada, nunca no meio: chamada no
    // meio do desenho, ela redesenha por dentro e a tabela sai duplicada.
    if (!buscouNestaSessao && !buscandoLeads && !erroDosLeads && chaveDosResultados()) buscarLeads()
  }

  function desenharTabelaDeResultados() {
    areaResultados.replaceChildren()

    const topo = el("div", "ed__resultados-topo")
    topo.append(el("h2", "ed__resultados-titulo", t("Resultados")))
    if (chaveDosResultados() && !erroDosLeads) {
      const trocar = el("button", "ed__resultados-trocar", t("Trocar chave"))
      trocar.setAttribute("type", "button")
      trocar.addEventListener("click", () => {
        // Trocar a chave é dizer que este navegador não deveria mais estar
        // vendo isto: a cópia guardada vai junto.
        guardarChave("")
        esquecerLeads()
        erroDosLeads = ""
        desenharResultados()
      })
      topo.append(trocar)
    }

    const atualizar = el("button", "ed__resultados-atualizar", t(buscandoLeads ? "Buscando…" : "Atualizar"))
    atualizar.setAttribute("type", "button")
    atualizar.disabled = buscandoLeads
    atualizar.addEventListener("click", () => buscarLeads())
    topo.append(atualizar)
    areaResultados.append(topo)

    if (erroDosLeads) {
      areaResultados.append(el("p", "ed__resultados-aviso", erroDosLeads))
    }

    // O campo volta sempre que não há chave ou que a leitura falhou: era aí
    // que a pessoa precisava trocar a chave e não tinha onde colar.
    if (!chaveDosResultados() || erroDosLeads) {
      areaResultados.append(formularioDaChave())
      if (!erroDosLeads) return
    }

    if (leads === null) {
      areaResultados.append(el("p", "ed__resultados-vazio",
        t(buscandoLeads ? "Buscando os leads na planilha…" : "Clique em Atualizar para buscar os leads.")))
      return
    }

    // A tabela aparece mesmo sem ninguém: as colunas saem do fluxo, então ela
    // já mostra o que vai ser perguntado. Quando o primeiro lead cair, ele
    // entra como uma linha embaixo do cabeçalho — nada muda de lugar.
    const colunas = colunasDosResultados(atual, leads)
    const tabela = el("table", "ed__tabela")
    const cabecalho = el("tr", "ed__tabela-linha")
    for (const coluna of colunas) {
      const celula = el("th", `ed__tabela-cabecalho${coluna.extra ? " ed__tabela-cabecalho--extra" : ""}`,
        t(coluna.rotulo))
      if (coluna.extra) celula.setAttribute("title", t("Veio da planilha e não está no fluxo"))
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

    if (!leads.length) {
      const no = el("tr", "ed__tabela-linha")
      const celula = el("td", "ed__tabela-celula ed__tabela-celula--vazia",
        t("Ninguém entrou no chat ainda. Quando alguém entrar, aparece aqui."))
      celula.setAttribute("colspan", String(colunas.length))
      no.append(celula)
      tabela.append(no)
    }
    const rolagem = el("div", "ed__tabela-rolagem")
    rolagem.append(tabela)
    areaResultados.append(rolagem)
    const pessoas = leads.length
      ? `${t(leads.length === 1 ? "{n} pessoa" : "{n} pessoas", { n: leads.length })} · ${t("a mais recente primeiro")}`
      : ""
    // Dizer quando foi lido é o que separa "a planilha está assim" de "esta é
    // uma cópia de antes": sem a hora, dado velho passa por dado de agora.
    const leitura = buscandoLeads
      ? t("buscando na planilha…")
      : lidoEm ? t("lido em {quando}", { quando: quando(lidoEm) }) : ""
    const rodape = [pessoas, leitura].filter(Boolean).join(" · ")
    if (rodape) areaResultados.append(el("p", "ed__resultados-conta", rodape))
  }

  function formularioDaChave() {
    const caixa = el("form", "ed__chave")
    caixa.append(el("p", "ed__chave-texto", t(erroDosLeads
      ? "Cole a chave de leitura da planilha — a que está nas propriedades do script, em CHAVE_LEITURA."
      : "Para ver os leads, cole a chave de leitura da planilha. Ela fica guardada só neste navegador.")))
    const campo = el("input", "ed__chave-campo")
    campo.setAttribute("type", "password")
    campo.setAttribute("placeholder", t("chave de leitura"))
    const botao = el("button", "ed__chave-botao", t("Ver os leads"))
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
    chaveNaMemoria = armazenamento?.getItem(NOME_DA_CHAVE) || ""
  } catch { /* sem armazenamento: começa sem chave e pede uma */ }

  function chaveDosResultados() {
    return chaveNaMemoria
  }

  function guardarChave(valor) {
    chaveNaMemoria = valor
    try {
      armazenamento?.setItem(NOME_DA_CHAVE, valor)
    } catch { /* a chave vale só esta sessão */ }
  }

  async function buscarLeads() {
    if (buscandoLeads) return
    if (!aoBuscarLeads) {
      erroDosLeads = t("Este editor está aberto sem de onde buscar os leads.")
      return desenharResultados()
    }

    buscandoLeads = true
    buscouNestaSessao = true
    erroDosLeads = ""
    desenharResultados()
    try {
      leads = await aoBuscarLeads(chaveDosResultados())
      lidoEm = new Date().toISOString()
      guardarLeads(leads, lidoEm)
    } catch (falha) {
      // A cópia guardada fica na tela: ela é velha, mas é verdade — e some
      // junto com a chave quando a pessoa troca a chave. Apagá-la aqui
      // deixaria quem perdeu a rede sem nada.
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
    topo.append(el("h2", "ed__config-titulo", t("Configurações")))
    const fechar = el("button", "ed__config-fechar", "✕")
    fechar.setAttribute("type", "button")
    fechar.setAttribute("aria-label", t("Fechar"))
    fechar.addEventListener("click", () => { configuracoesAbertas = false; desenharConfiguracoes() })
    topo.append(fechar)
    caixa.append(topo)

    // O idioma vem primeiro: quem abriu a engrenagem sem entender a tela é
    // quem mais precisa dele.
    const linhaIdioma = el("label", "ed__config-linha ed__config-linha--idioma")
    linhaIdioma.append(el("span", "ed__config-rotulo", t("Idioma do editor")))
    const listaIdioma = el("select", "ed__tema-lista")
    for (const { chave, nome } of IDIOMAS) {
      const opcao = el("option", "ed__tema-opcao", nome)
      opcao.setAttribute("value", chave)
      listaIdioma.append(opcao)
    }
    listaIdioma.value = idioma
    listaIdioma.addEventListener("change", () => trocarIdioma(listaIdioma.value))
    linhaIdioma.append(listaIdioma)
    caixa.append(linhaIdioma)
    caixa.append(el("p", "ed__config-ajuda",
      t("Vale só para esta tela: a conversa do lead segue no idioma em que você a escreveu.")))

    caixa.append(el("h3", "ed__config-secao", t("Digitação")))
    caixa.append(el("p", "ed__config-ajuda",
      t("Quanto tempo o chat mostra os três pontinhos antes de cada fala.")))

    const ritmo = atual.ritmo || {}
    for (const [campo, rotulo] of [
      ["piso", "Mínimo (ms)"], ["porCaractere", "Por caractere (ms)"], ["teto", "Máximo (ms)"]
    ]) {
      const linha = el("label", "ed__config-linha")
      linha.append(el("span", "ed__config-rotulo", t(rotulo)))
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

  // Trocar de idioma redesenha tudo: as palavras fixas da barra, o lado, o
  // conteúdo da aba aberta e o painel. Nada guarda texto traduzido, então
  // redesenhar é o bastante.
  function trocarIdioma(novo) {
    if (!idiomaValido(novo) || novo === idioma) return
    idioma = novo
    traduzir = criarTradutor(idioma)
    try { armazenamento?.setItem(NOME_DO_IDIOMA, idioma) } catch { /* vale esta sessão */ }
    aplicarIdiomaNaBarra()
    desenharTudo()
    desenharConteudo()
    desenharConfiguracoes()
  }

  function desenharProblemas() {
    sincronizarSalvar()
    sincronizarPassos()
    const relatorio = validarFluxo(atual, { destinos: {} })
    problemas.textContent = relatorio.valido ? "" : relatorio.erros.join(" · ")
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
    desenharLado()
    desenharProblemas()
    preview.atualizar(atual)
  }

  redesenhar()
  // O fluxo da Osher é mais alto que a tela. Abrir mostrando só o topo faz
  // parecer que o editor cortou o trabalho.
  canvas.enquadrar()

  return {
    fluxo: () => atual,
    tema: () => temaAtual,
    temMudancas,
    salvar: guardar,
    selecao: () => ({ ...selecao }),
    vista: () => canvas.vista()
  }
}
