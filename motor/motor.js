import { registrarTodos } from "./blocos/index.js"
import { todos, obter } from "./blocos/_registro.js"
import { validarFluxo } from "./validar.js"
import { interpolar } from "./interpolar.js"
import { fonteDeVideo } from "./video.js"
import { enderecoIncorporado, alturaIncorporada } from "./incorporar.js"
import { criarEnviador } from "./destinos.js"
import { criarSessao } from "./sessao.js"
import {
  criarEstado, blocoAtual, avancar, aplicarResposta, contexto,
  destinoDaResposta, destinoDaLogica, validarEntrada,
  registrarFalha, limparFalhas, destinoDeInvalido
} from "./percurso.js"

if (todos().length === 0) registrarTodos()

function elementoCom(tag, classe, texto) {
  const el = document.createElement(tag)
  if (classe) el.className = classe
  if (texto !== undefined) el.textContent = texto
  return el
}

// Atributos HTML do campo de entrada, declarados pelo próprio tipo de bloco.
// Ficam lá e não numa lista aqui dentro para que acrescentar um tipo novo não
// exija editar o motor. Em modo teste um fluxo inválido continua sendo
// montado, então um tipo fora do catálogo cai no padrão em vez de estourar.
function atributosDoCampo(tipo) {
  try {
    return obter(tipo).campo_html || { type: "text" }
  } catch {
    return { type: "text" }
  }
}

// Fontes já pedidas nesta página. Sem o registro, dois chats na mesma tela
// (ou um reiniciar) empilhariam <link> repetidos no <head>.
const fontesPedidas = new Set()

// A fonte é do cliente, não do motor: quem quiser uma fonte de fora declara a
// URL da folha no seu tema.json. Fora do navegador (a suíte roda num DOM de
// mentira, sem <head>) isto simplesmente não faz nada.
function pedirFonte(url) {
  if (!url || fontesPedidas.has(url)) return
  const cabeca = globalThis.document?.head
  if (!cabeca) return
  fontesPedidas.add(url)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = url
  cabeca.append(link)
}

// Põe o tema num elemento `.cf` já montado: as cores e a largura viram
// variáveis no próprio elemento, e a fonte é pedida uma vez.
//
// É o mesmo caminho que o chat usa ao nascer, separado porque o editor precisa
// trocar uma cor sem reiniciar a conversa — remontar o chat a cada arrastão no
// seletor de cor jogaria a pessoa de volta para a primeira pergunta.
//
// Lembra o que escreveu em cada elemento para poder apagar: cor devolvida à
// herança tem de voltar a herdar, e propriedade escrita no elemento ganha de
// qualquer folha de estilo.
const temaAplicado = new WeakMap()

export function aplicarTema(raiz, tema = {}) {
  if (!raiz) return
  const nomes = new Map()
  if (tema.largura) nomes.set("--cf-coluna", tema.largura)
  for (const [nome, valor] of Object.entries(tema.cores || {})) {
    nomes.set(`--cf-${nome}`, valor)
  }

  for (const antigo of temaAplicado.get(raiz) || []) {
    if (!nomes.has(antigo)) raiz.style.removeProperty(antigo)
  }
  for (const [nome, valor] of nomes) raiz.style.setProperty(nome, valor)
  temaAplicado.set(raiz, new Set(nomes.keys()))

  // Fonte vazia não vira `font-family: ""`: ficaria pior que não mexer.
  raiz.style.fontFamily = tema.fonte || ""
  pedirFonte(tema.fonte_url)
}

// Filtro de digitação declarado pelo tipo, se houver. Fica no tipo e não
// numa lista aqui dentro pelo mesmo motivo dos atributos do campo.
function filtroDoCampo(tipo) {
  try {
    return obter(tipo).filtrar_digitacao || null
  } catch {
    return null
  }
}

const RITMO_PADRAO = { piso: 350, porCaractere: 10, teto: 1800 }
const PAUSAS_POR_RODADA = 20

async function preverEnvio(url) {
  console.warn(`chatflow: pré-visualização — nada foi enviado para ${url}.`)
  return { ok: true }
}

function novaSessao() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Math.random().toString(16).slice(2)}`
}

export function criarChat({
  elemento,
  fluxo,
  tema = {},
  destinos = {},
  modo = "producao",
  buscar = (...args) => fetch(...args),
  chaveSessao = "padrao",
  armazenamento = globalThis.localStorage,
  // Quanto o chat "digita" antes de cada fala. Proporcional ao texto: fala
  // curta espera pouco, longa espera mais, com teto para não irritar.
  // Zerar qualquer campo desliga a pausa.
  ritmo = {},
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  if (!elemento) throw new Error("criarChat precisa de um elemento onde montar.")

  const raiz = elementoCom("div", "cf")
  const thread = elementoCom("div", "cf__thread")
  const erro = elementoCom("div", "cf__erro")
  raiz.append(thread, erro)
  elemento.replaceChildren(raiz)

  aplicarTema(raiz, tema)

  // Retrato de quem fala do outro lado. O caminho já vem resolvido por quem
  // carregou o tema — o motor não sabe em que pasta o cliente mora.
  const avatar = tema.avatar || ""
  const nomeDeQuemFala = tema.marca ? `Logo ${tema.marca}` : ""

  const relatorio = validarFluxo(fluxo, { destinos: destinos.destinos || {} })
  if (!relatorio.valido) {
    const aviso = elementoCom("div", "cf__aviso", relatorio.erros.join(" · "))
    raiz.prepend(aviso)
    console.error("chatflow: fluxo inválido.", relatorio.erros)
    if (modo === "producao") return { raiz, reiniciar() {}, estado: () => null }
  }

  const enviador = criarEnviador({
    destinos: destinos.destinos || {},
    ao_finalizar: modo === "teste" ? [] : destinos.ao_finalizar || [],
    eventos: modo === "teste" ? null : destinos.eventos || null,
    // Em pré-visualização o cadeado fica no transporte, não na configuração.
    // O bloco "webhook" fala com destinos.destinos por enviarPara, sem passar
    // por ao_finalizar, e dispararia de verdade. Trocando só o transporte,
    // nada sai para a rede e os avisos de configuração continuam dizendo a
    // verdade sobre o destinos.json de quem está editando.
    buscar: modo === "teste" ? preverEnvio : buscar
  })

  const sessao = criarSessao({ chave: chaveSessao, armazenamento })

  let estado = criarEstado(fluxo)
  let sessaoId = novaSessao()
  // A conversa já dita. Sem ela, retomar devolveria a pessoa a uma tela em
  // branco com um campo solto: o estado sabe onde parou, mas não o que foi
  // falado até ali.
  let transcricao = []

  // Mesclado com o padrão, não destruturado com zeros: `ritmo: { piso: 500 }`
  // não pode desligar a pausa em silêncio por omitir os outros campos.
  const compasso = { ...RITMO_PADRAO, ...(ritmo || {}) }

  // Quantas falas ainda podem pausar nesta rodada. Um fluxo legítimo diz duas
  // ou três coisas antes de perguntar algo; um fluxo em laço diria quinhentas.
  // Sem este teto, a guarda de laço levaria minutos repetindo a mesma bolha
  // antes de avisar que o fluxo travou.
  let pausasRestantes = 0

  function pausaDe(texto) {
    const { piso, porCaractere, teto } = compasso
    return Math.min(teto, piso + String(texto ?? "").length * porCaractere)
  }

  // Balão transitório com os três pontos. Não passa por dizer(): se entrasse
  // na transcrição, a retomada redesenharia pontinhos fantasmas no meio da
  // conversa já dita.
  function mostrarDigitando() {
    const bolha = elementoCom("div", "cf__bolha cf__digitando")
    bolha.setAttribute("aria-label", "digitando")
    for (let i = 0; i < 3; i++) bolha.append(elementoCom("span", "cf__ponto"))
    const linha = linhaDe("bot")
    linha.append(bolha)
    thread.append(linha)
    thread.scrollTop = thread.scrollHeight
    return linha
  }

  async function dizerComPausa(medida, item) {
    const espera = pausasRestantes-- > 0 ? pausaDe(medida) : 0
    if (espera > 0) {
      const indicador = mostrarDigitando()
      try {
        await esperar(espera)
      } finally {
        indicador.remove()
      }
    }
    dizer(item)
  }

  // Uma fala é uma linha: quem é do chat leva o retrato à esquerda, quem é da
  // pessoa vai para a direita. O lado mora na linha e não na bolha para que a
  // bolha continue com a largura do texto que carrega.
  function linhaDe(lado) {
    const daPessoa = lado === "pessoa"
    const linha = elementoCom("div", daPessoa ? "cf__linha cf__linha--pessoa" : "cf__linha")
    if (!daPessoa && avatar) {
      const foto = document.createElement("img")
      foto.className = "cf__avatar"
      foto.src = avatar
      foto.alt = nomeDeQuemFala
      linha.append(foto)
    }
    return linha
  }

  function desenhar(item) {
    const linha = linhaDe(item.lado)
    if (item.imagem !== undefined) {
      const bolha = elementoCom("div", "cf__bolha")
      const img = document.createElement("img")
      img.src = item.imagem
      img.alt = item.alternativo || ""
      if (item.link) {
        // Imagem que leva a algum lugar: abre em outra aba, para a conversa
        // não ser abandonada no meio. `noopener` porque a página de destino
        // não tem nada que fazer com esta.
        const laco = document.createElement("a")
        laco.href = item.link
        laco.target = "_blank"
        laco.rel = "noopener noreferrer"
        laco.className = "cf__imagem-link"
        laco.append(img)
        bolha.append(laco)
      } else {
        bolha.append(img)
      }
      linha.append(bolha)
    } else if (item.audio !== undefined) {
      const bolha = elementoCom("div", "cf__bolha cf__bolha--audio")
      const som = document.createElement("audio")
      som.src = item.audio.src
      som.className = "cf__audio"
      som.setAttribute("controls", "")
      som.setAttribute("preload", "none")
      // Começar sozinho é um pedido, não uma garantia: o navegador segura o
      // som até a pessoa tocar na tela. Os controles ficam ali de qualquer
      // jeito, para ela poder dar play.
      if (item.audio.autoplay) som.setAttribute("autoplay", "")
      bolha.append(som)
      linha.append(bolha)
    } else if (item.incorporado !== undefined) {
      const bolha = elementoCom("div", "cf__bolha cf__bolha--incorporado")
      const quadro = document.createElement("iframe")
      quadro.src = item.incorporado.src
      quadro.className = "cf__incorporado"
      quadro.style.height = `${item.incorporado.altura}px`
      // Caixa de outra origem dentro da conversa: sem permissão para abrir
      // janela nem mexer no topo, e sem acesso de volta a esta página.
      quadro.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups")
      quadro.setAttribute("loading", "lazy")
      quadro.setAttribute("title", item.alternativo || "")
      bolha.append(quadro)
      linha.append(bolha)
    } else if (item.video !== undefined) {
      const bolha = elementoCom("div", "cf__bolha cf__bolha--video")
      if (item.video.tipo === "incorporado") {
        const quadro = document.createElement("iframe")
        quadro.src = item.video.src
        quadro.className = "cf__video"
        quadro.setAttribute("allow", "accelerometer; autoplay; encrypted-media; picture-in-picture")
        quadro.setAttribute("allowfullscreen", "")
        quadro.setAttribute("title", item.alternativo || "Vídeo")
        bolha.append(quadro)
      } else {
        const filme = document.createElement("video")
        filme.src = item.video.src
        filme.className = "cf__video"
        filme.setAttribute("controls", "")
        filme.setAttribute("playsinline", "")
        if (item.video.autoplay) {
          filme.setAttribute("autoplay", "")
          filme.setAttribute("muted", "")
        }
        bolha.append(filme)
      }
      linha.append(bolha)
    } else {
      const classe = item.lado === "pessoa" ? "cf__bolha cf__bolha--pessoa" : "cf__bolha"
      linha.append(elementoCom("div", classe, item.texto))
    }
    thread.append(linha)
    thread.scrollTop = thread.scrollHeight
  }

  function dizer(item) {
    transcricao.push(item)
    desenhar(item)
  }

  async function falar(texto) {
    const pronto = interpolar(texto, contexto(fluxo, estado))
    await dizerComPausa(pronto, { lado: "bot", texto: pronto })
  }

  function ecoar(texto) {
    dizer({ lado: "pessoa", texto })
  }

  // O que a pessoa pode acionar agora fica na conversa, mas fora da
  // transcrição: é um convite a responder, não uma fala já dita. Se entrasse,
  // retomar a sessão redesenharia campos e botões mortos no meio do que já
  // foi conversado.
  let entradaNaTela = null

  function limparEntrada() {
    if (!entradaNaTela) return
    entradaNaTela.remove()
    entradaNaTela = null
  }

  // Pendura na conversa, do lado de quem responde, os controles de uma
  // pergunta: os botões de uma escolha, ou o campo de texto e o enviar.
  function oferecer(controles, classe) {
    const linha = linhaDe("pessoa")
    const caixa = elementoCom("div", classe)
    caixa.append(...controles)
    linha.append(caixa)
    thread.append(linha)
    entradaNaTela = linha
    thread.scrollTop = thread.scrollHeight
  }

  function limparComposer() {
    limparEntrada()
    erro.textContent = ""
  }

  // Não limpa nada da tela: quem termina num redirecionamento precisa
  // continuar vendo o botão de saída enquanto o lead é enviado. Nos outros
  // caminhos a entrada já foi retirada no começo de seguirInterno.
  async function finalizar() {
    await enviador.enviar({
      sessaoId,
      finalizadoEm: new Date().toISOString(),
      ...contexto(fluxo, estado),
      historico: estado.historico.join(" > ")
    })
  }

  // Enquanto o chat "digita", a entrada já saiu da tela — mas um duplo clique
  // rápido pode disparar dois responder() antes disso. A guarda fecha a porta.
  let ocupado = false

  function correr() {
    ocupado = true
    return seguir().finally(() => { ocupado = false })
  }

  function responder(valor, rotuloVisivel = valor) {
    if (ocupado) return
    const bloco = blocoAtual(fluxo, estado)
    const veredito = validarEntrada(bloco, valor)
    if (!veredito.ok) {
      erro.textContent = veredito.erro
      estado = registrarFalha(estado)
      const desvio = destinoDeInvalido(fluxo, estado)
      if (desvio) {
        estado = limparFalhas(estado)
        estado = avancar(fluxo, estado, { destino: desvio })
        correr()
      }
      return
    }
    erro.textContent = ""
    estado = limparFalhas(estado)
    ecoar(rotuloVisivel)
    estado = aplicarResposta(fluxo, estado, valor)
    const destino = destinoDaResposta(bloco, valor)
    estado = avancar(fluxo, estado, destino ? { destino } : {})
    correr()
  }

  function pedirTexto(bloco) {
    const campo = elementoCom("input", "cf__campo")
    for (const [nome, valor] of Object.entries(atributosDoCampo(bloco.tipo))) {
      campo.setAttribute(nome, valor)
    }
    campo.placeholder = interpolar(bloco.conteudo?.placeholder || "", contexto(fluxo, estado))

    // O que o tipo não aceita nem chega a aparecer no campo. O cursor é
    // recolocado onde estava, descontando o que foi recusado antes dele —
    // sem isso ele salta para o fim a cada tecla no meio do número.
    const filtrar = filtroDoCampo(bloco.tipo)
    if (filtrar) {
      campo.addEventListener("input", () => {
        const antes = campo.value
        const depois = filtrar(antes)
        if (depois === antes) return
        // Onde o cursor cai é onde termina o mesmo prefixo depois de
        // tratado: vale para um filtro que tira caracteres e para uma
        // máscara que acrescenta. Sem isto o cursor salta para o fim a cada
        // tecla digitada no meio do número.
        const posicao = campo.selectionStart ?? depois.length
        const novaPosicao = filtrar(antes.slice(0, posicao)).length
        campo.value = depois
        campo.setSelectionRange?.(novaPosicao, novaPosicao)
      })
    }
    const rotulo = bloco.conteudo?.rotulo_botao || "Enviar"
    // O rótulo fica no botão e também no aria-label: a folha troca o texto
    // por um ícone, e sem o rótulo o botão viraria um quadrado mudo para
    // quem navega por leitor de tela.
    const botao = elementoCom("button", "cf__botao cf__botao--enviar", rotulo)
    botao.type = "button"
    botao.setAttribute("aria-label", rotulo)
    botao.addEventListener("click", () => responder(campo.value.trim()))
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); botao.click() }
    })
    oferecer([campo, botao], "cf__entrada")
    campo.focus()
  }

  function pedirOpcao(bloco) {
    const botoes = (bloco.conteudo?.opcoes || []).map((opcao) => {
      const botao = elementoCom("button", "cf__botao cf__botao--opcao", opcao.label)
      botao.type = "button"
      botao.addEventListener("click", () => responder(opcao.label))
      return botao
    })
    oferecer(botoes, "cf__opcoes")
  }

  function mostrarLink(bloco) {
    const url = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado))
    const link = elementoCom("a", "cf__botao cf__botao--opcao", bloco.conteudo?.rotulo_botao || "Continuar")
    link.href = url
    if (bloco.conteudo?.nova_aba !== false) {
      link.target = "_blank"
      link.rel = "noopener noreferrer"
    }
    oferecer([link], "cf__opcoes")
  }

  async function seguir() {
    try {
      await seguirInterno()
    } catch (falha) {
      // Sem isto a promessa rejeitada morre no console e o chat congela sem
      // dizer nada — a pessoa fica olhando uma tela que não responde mais.
      console.error("chatflow: a conversa parou por um erro.", falha)
      erro.textContent =
        "Tivemos um problema ao continuar a conversa. Recarregue a página para tentar de novo."
      return
    }
    if (estado.terminou) sessao.limpar()
    // O sessaoId vai junto: sem ele, uma recarga geraria um id novo e os
    // eventos emitidos antes da recarga deixariam de casar com o lead final.
    else sessao.salvar({ estado, transcricao, sessaoId })
  }

  async function seguirInterno() {
    limparComposer()
    pausasRestantes = PAUSAS_POR_RODADA

    let guarda = 0
    while (!estado.terminou && guarda++ < 500) {
      const bloco = blocoAtual(fluxo, estado)
      if (!bloco) { estado = avancar(fluxo, estado); continue }

      enviador.enviarEvento({
        // As respostas vêm primeiro de propósito: quem abandona no meio nunca
        // chega ao envio final, então este é o único lugar por onde o parcial
        // sai do navegador. Vir primeiro deixa as chaves de controle abaixo
        // vencerem, caso um cliente batize um campo com o nome de uma delas.
        ...contexto(fluxo, estado),
        // Marca que separa evento de funil de lead finalizado no destino.
        // A chave é em inglês porque é o contrato que o receptor já espera;
        // sem ela, um destino que recebe os dois num endereço só não tem
        // como distinguir e mistura tudo no mesmo lugar.
        event: true,
        sessaoId,
        grupoId: estado.grupoAtual,
        blocoId: bloco.id,
        em: new Date().toISOString()
      })

      if (bloco.tipo === "texto") {
        await falar(bloco.conteudo?.texto || "")
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "imagem") {
        const alternativo = bloco.conteudo?.alternativo || ""
        const link = interpolar(bloco.conteudo?.link_ao_clicar || "", contexto(fluxo, estado)).trim()
        await dizerComPausa(alternativo, {
          lado: "bot",
          imagem: interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado)),
          alternativo,
          ...(link ? { link } : {})
        })
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "audio") {
        const endereco = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado)).trim()
        if (endereco) {
          await dizerComPausa("", {
            lado: "bot",
            audio: { src: endereco, autoplay: !!bloco.conteudo?.autoplay }
          })
        }
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "incorporar") {
        const endereco = enderecoIncorporado(
          interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado)))
        // Endereço que não é endereço não vira quadro em branco: o bloco é
        // pulado e a conversa segue, como no vídeo.
        if (endereco) {
          await dizerComPausa("", {
            lado: "bot",
            incorporado: { src: endereco, altura: alturaIncorporada(bloco.conteudo?.altura) }
          })
        }
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "video") {
        const alternativo = bloco.conteudo?.alternativo || ""
        const fonte = fonteDeVideo(
          interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado)),
          { autoplay: !!bloco.conteudo?.autoplay }
        )
        // Endereço que ninguém sabe tocar não vira caixa preta: o bloco é
        // pulado, e o fluxo segue. Quem acusa o endereço vazio é o validador.
        if (fonte) {
          await dizerComPausa(alternativo, {
            lado: "bot",
            video: { ...fonte, autoplay: !!bloco.conteudo?.autoplay },
            alternativo
          })
        }
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "condicao" || bloco.tipo === "ir_para") {
        const destino = destinoDaLogica(fluxo, estado, bloco)
        estado = avancar(fluxo, estado, destino ? { destino } : {})
        continue
      }

      if (bloco.tipo === "definir_variavel") {
        const ctx = contexto(fluxo, estado)
        const bruto = interpolar(String(bloco.conteudo?.valor ?? ""), ctx)
        const atual = estado.respostas[bloco.salvar_em]
        const operacao = bloco.conteudo?.operacao || "atribuir"
        let novo = bruto
        if (operacao === "somar") novo = Number(atual || 0) + Number(bruto || 0)
        if (operacao === "concatenar") novo = `${atual ?? ""}${bruto}`
        estado = { ...estado, respostas: { ...estado.respostas, [bloco.salvar_em]: novo } }
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "webhook") {
        enviador.enviarPara(bloco.conteudo?.destino, { sessaoId, ...contexto(fluxo, estado) })
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "redirecionar") {
        mostrarLink(bloco)
        // Um redirecionamento é uma despedida. Se não há nada depois dele, o
        // fluxo acabou aqui e o lead precisa sair agora: sem isto o caminho
        // mais quente — o único que termina em redirecionamento — seria
        // justamente o que nunca chega ao destino.
        const depois = avancar(fluxo, estado)
        if (depois.terminou) { estado = depois; await finalizar() }
        return
      }
      if (bloco.tipo === "entrada_botoes") { pedirOpcao(bloco); return }
      pedirTexto(bloco)
      return
    }

    if (!estado.terminou) {
      const mensagem = `O fluxo parece estar em loop e foi interrompido no grupo "${estado.grupoAtual}".`
      console.error(`chatflow: ${mensagem}`)
      erro.textContent = mensagem
      return
    }

    await finalizar()
  }

  return {
    // O elemento que o chat montou. Quem muda o tema de fora escreve nele —
    // as variáveis têm de ficar no próprio `.cf`, que declara os padrões.
    raiz,
    reiniciar({ retomar = true } = {}) {
      // Um envio que falhou numa tentativa anterior desta sessão é
      // retentado agora. Sem esta chamada a fila de `destinos.js` nunca
      // é drenada por ninguém e o lead se perde em silêncio.
      enviador.processarFila()
      const guardado = retomar ? sessao.carregar() : null
      thread.replaceChildren()
      if (guardado && guardado.estado) {
        estado = guardado.estado
        sessaoId = guardado.sessaoId || sessaoId
        transcricao = Array.isArray(guardado.transcricao) ? guardado.transcricao : []
        for (const item of transcricao) desenhar(item)
      } else {
        estado = criarEstado(fluxo)
        sessaoId = novaSessao()
        transcricao = []
      }
      return correr()
    },
    estado: () => estado
  }
}
