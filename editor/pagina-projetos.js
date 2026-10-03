// A primeira página: a lista dos chats que existem e os três caminhos para
// criar mais um. É a porta de entrada do produto — o editor é o que há depois
// de escolher um projeto.
//
// Quem guarda os projetos entra por fora (`aoListar`, `aoCriar`, `aoAbrir`):
// hoje é o servidor de bancada escrevendo pastas; no sub-projeto 3 será a
// conta de alguém. A página não sabe a diferença.

import { criarTradutor, idiomaValido, PADRAO as IDIOMA_PADRAO } from "./idioma.js"
import { MODELOS, categoriasDeModelos, modeloPorId, idDeProjeto } from "./projetos.js"
import { criarChat } from "../motor/motor.js"

// O nome do produto não se traduz nem muda: é nome, não frase.
const NOME_DO_PRODUTO = "chatflow"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

export function criarPaginaDeProjetos({
  elemento,
  // Devolve a lista de projetos: [{ id, nome, icone, publicado }].
  aoListar = async () => [],
  // Cria um projeto e devolve o id dele. Recebe { nome, fluxo }.
  aoCriar = null,
  // Abre o editor daquele projeto. A página não conhece URL.
  aoAbrir = () => {},
  // Busca o fluxo de um modelo, para a amostra e para a criação.
  aoLerModelo = async () => null,
  armazenamento = globalThis.localStorage,
  // Só os testes passam: sem espera de verdade a amostra do modelo roda de uma vez.
  esperarNoTeste = undefined
}) {
  let idioma = IDIOMA_PADRAO
  try {
    const guardado = armazenamento?.getItem("chatflow:idioma")
    if (idiomaValido(guardado)) idioma = guardado
  } catch { /* sem armazenamento: português */ }
  const t = criarTradutor(idioma)

  let projetos = []
  let carregando = true
  let recado = ""
  let tela = "lista"          // lista | criar | modelos
  let modeloEscolhido = MODELOS[0]?.id || null
  let chatDaAmostra = null

  const raiz = el("div", "pr")
  elemento.replaceChildren(raiz)

  function desenhar() {
    if (tela === "modelos") return desenharModelos()
    desenharLista()
    if (tela === "criar") raiz.append(caixaDeCriar())
  }

  // --- a lista -----------------------------------------------------------
  function desenharLista() {
    soltarAmostra()
    raiz.replaceChildren()
    const topo = el("header", "pr__topo")
    topo.append(el("h1", "pr__titulo", NOME_DO_PRODUTO))
    raiz.append(topo)

    if (recado) raiz.append(el("p", "pr__recado", recado))

    const grade = el("div", "pr__grade")
    const novo = el("button", "pr__novo")
    novo.setAttribute("type", "button")
    novo.append(el("span", "pr__novo-mais", "+"))
    novo.append(el("span", "pr__novo-rotulo", t("Criar um chatflow")))
    novo.addEventListener("click", () => { tela = "criar"; desenhar() })
    grade.append(novo)

    if (carregando) {
      grade.append(el("p", "pr__vazio", t("Procurando os seus chats…")))
    } else if (!projetos.length) {
      grade.append(el("p", "pr__vazio", t("Nenhum chat ainda. Crie o primeiro aqui ao lado.")))
    }

    for (const projeto of projetos) grade.append(cartaoDoProjeto(projeto))
    raiz.append(grade)
  }

  function cartaoDoProjeto(projeto) {
    const cartao = el("button", "pr__cartao")
    cartao.setAttribute("type", "button")
    cartao.dadosProjeto = projeto.id

    const topo = el("div", "pr__cartao-topo")
    // No ar é informação de peso: diz qual destes chats está recebendo gente
    // agora. Sem isso, dois cartões iguais escondem qual é o de verdade.
    if (projeto.publicado) topo.append(el("span", "pr__selo", t("No ar")))
    cartao.append(topo)

    // Só há ícone se a pessoa digitou um emoji no nome. Sem ele, o cartão é
    // o nome — e não um desenho genérico repetido em todos.
    if (projeto.icone) cartao.append(el("span", "pr__cartao-icone", projeto.icone))
    cartao.append(el("span", "pr__cartao-nome", projeto.nome))
    cartao.addEventListener("click", () => aoAbrir(projeto.id))
    return cartao
  }

  // --- criar -------------------------------------------------------------
  function caixaDeCriar() {
    const fundo = el("div", "pr__fundo")
    fundo.addEventListener("click", (ev) => {
      if (ev.target === fundo) { tela = "lista"; desenhar() }
    })

    const caixa = el("div", "pr__caixa")
    caixa.append(el("h2", "pr__caixa-titulo", t("Criar um chatflow")))

    const opcao = (classe, rotulo, explicacao, aoClicar) => {
      const botao = el("button", `pr__opcao ${classe}`)
      botao.setAttribute("type", "button")
      botao.append(el("span", "pr__opcao-rotulo", rotulo))
      botao.append(el("span", "pr__opcao-nota", explicacao))
      botao.addEventListener("click", aoClicar)
      return botao
    }

    caixa.append(opcao("pr__opcao--zero", t("Começar do zero"),
      t("Um grupo vazio, e o fluxo é seu."), () => criarDoZero()))
    caixa.append(opcao("pr__opcao--modelo", t("Começar de um modelo"),
      t("Fluxos semiprontos, para ajustar em vez de escrever."), () => { tela = "modelos"; desenhar() }))

    // Importar é a porta de volta: quem exportou um fluxo (ou recebeu um)
    // entra por aqui, sem precisar mexer em pasta nenhuma.
    const importar = el("label", "pr__opcao pr__opcao--arquivo")
    importar.append(el("span", "pr__opcao-rotulo", t("Importar um arquivo")))
    importar.append(el("span", "pr__opcao-nota", t("Um fluxo.json que você já tem.")))
    const campo = el("input", "pr__arquivo")
    campo.setAttribute("type", "file")
    campo.setAttribute("accept", "application/json,.json")
    campo.addEventListener("change", () => importarArquivo(campo))
    importar.append(campo)
    caixa.append(importar)

    const fechar = el("button", "pr__fechar", "✕")
    fechar.setAttribute("type", "button")
    fechar.setAttribute("aria-label", t("Fechar"))
    fechar.addEventListener("click", () => { tela = "lista"; desenhar() })
    caixa.append(fechar)

    fundo.append(caixa)
    return fundo
  }

  // --- modelos -----------------------------------------------------------
  function desenharModelos() {
    raiz.replaceChildren()
    const topo = el("header", "pr__topo")
    const voltar = el("button", "pr__voltar", "‹")
    voltar.setAttribute("type", "button")
    voltar.setAttribute("aria-label", t("Voltar"))
    voltar.addEventListener("click", () => { tela = "lista"; desenhar() })
    topo.append(voltar, el("h1", "pr__titulo", t("Modelos")))
    raiz.append(topo)

    const corpo = el("div", "pr__modelos")
    const lista = el("nav", "pr__modelos-lista")
    for (const categoria of categoriasDeModelos()) {
      lista.append(el("h2", "pr__categoria", categoria.nome))
      for (const modelo of categoria.modelos) {
        const botao = el("button", `pr__modelo${modelo.id === modeloEscolhido ? " pr__modelo--ativo" : ""}`)
        botao.setAttribute("type", "button")
        botao.dadosModelo = modelo.id
        botao.append(el("span", "pr__modelo-icone", modelo.icone))
        botao.append(el("span", "pr__modelo-nome", modelo.nome))
        botao.addEventListener("click", () => { modeloEscolhido = modelo.id; desenharModelos() })
        lista.append(botao)
      }
    }
    corpo.append(lista)

    const palco = el("div", "pr__amostra")
    corpo.append(palco)
    raiz.append(corpo)

    const modelo = modeloPorId(modeloEscolhido)
    if (!modelo) return
    const rodape = el("footer", "pr__modelo-rodape")
    rodape.append(el("span", "pr__modelo-icone", modelo.icone))
    const texto = el("div", "pr__modelo-texto")
    texto.append(el("h3", "pr__modelo-titulo", modelo.nome))
    texto.append(el("p", "pr__modelo-descricao", modelo.descricao))
    rodape.append(texto)
    const usar = el("button", "pr__usar", t("Usar este modelo"))
    usar.setAttribute("type", "button")
    usar.addEventListener("click", () => criarDoModelo(modelo))
    rodape.append(usar)
    raiz.append(rodape)

    mostrarAmostra(modelo, palco)
  }

  // A amostra é o chat de verdade, rodando o fluxo do modelo em modo teste:
  // ler a conversa é a única maneira honesta de escolher um modelo.
  async function mostrarAmostra(modelo, palco) {
    soltarAmostra()
    const fluxo = await aoLerModelo(modelo)
    if (!fluxo) { palco.replaceChildren(el("p", "pr__vazio", t("Não consegui abrir este modelo."))); return }
    chatDaAmostra = criarChat({
      elemento: palco,
      fluxo,
      modo: "teste",
      armazenamento: undefined,
      ritmo: fluxo.ritmo,
      esperar: esperarNoTeste,
      buscar: async () => { throw new Error("a amostra não envia nada") }
    })
    chatDaAmostra.reiniciar({ retomar: false })
  }

  function soltarAmostra() { chatDaAmostra = null }

  // --- criação ------------------------------------------------------------
  async function criar(nome, fluxo) {
    if (!aoCriar) {
      recado = t("Este chatflow está aberto sem servidor para criar projetos.")
      tela = "lista"
      return desenhar()
    }
    recado = ""
    try {
      const id = await aoCriar({ nome, fluxo })
      aoAbrir(id)
    } catch (falha) {
      recado = t("Não consegui criar ({motivo}).", { motivo: falha?.message || String(falha) })
      tela = "lista"
      desenhar()
    }
  }

  async function criarDoZero() {
    const { fluxoDoZero } = await import("./projetos.js")
    const fluxo = fluxoDoZero()
    await criar(fluxo.nome, fluxo)
  }

  async function criarDoModelo(modelo) {
    const { fluxoDoModelo } = await import("./projetos.js")
    const conteudo = await aoLerModelo(modelo)
    if (!conteudo) {
      recado = t("Não consegui abrir este modelo.")
      tela = "lista"
      return desenhar()
    }
    const fluxo = fluxoDoModelo(modelo, conteudo)
    await criar(fluxo.nome, fluxo)
  }

  async function importarArquivo(campo) {
    const arquivo = campo.files?.[0]
    if (!arquivo) return
    try {
      const fluxo = JSON.parse(await arquivo.text())
      if (!Array.isArray(fluxo?.grupos)) throw new Error(t("isto não parece um fluxo do chatflow"))
      await criar(fluxo.nome || arquivo.name.replace(/\.json$/i, ""), fluxo)
    } catch (falha) {
      recado = t("Não consegui importar ({motivo}).", { motivo: falha?.message || String(falha) })
      tela = "lista"
      desenhar()
    }
  }

  async function carregar() {
    carregando = true
    desenhar()
    try {
      projetos = await aoListar()
    } catch (falha) {
      recado = t("Não consegui listar os projetos ({motivo}).", { motivo: falha?.message || String(falha) })
      projetos = []
    } finally {
      carregando = false
      desenhar()
    }
  }

  carregar()

  return {
    projetos: () => projetos,
    tela: () => tela,
    recarregar: carregar,
    // Os testes precisam de um id livre sem perguntar ao servidor.
    idLivre: (nome) => idDeProjeto(nome, projetos.map((p) => p.id))
  }
}
