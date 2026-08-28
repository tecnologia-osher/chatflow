import { registrarTodos } from "./blocos/index.js"
import { todos, obter } from "./blocos/_registro.js"
import { validarFluxo } from "./validar.js"
import { interpolar } from "./interpolar.js"
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
  ritmo = { piso: 350, porCaractere: 10, teto: 1800 },
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  if (!elemento) throw new Error("criarChat precisa de um elemento onde montar.")

  const raiz = elementoCom("div", "cf")
  const thread = elementoCom("div", "cf__thread")
  const composer = elementoCom("div", "cf__composer")
  const erro = elementoCom("div", "cf__erro")
  raiz.append(thread, erro, composer)
  elemento.replaceChildren(raiz)

  for (const [nome, valor] of Object.entries(tema.cores || {})) {
    raiz.style.setProperty(`--cf-${nome}`, valor)
  }
  if (tema.fonte) raiz.style.fontFamily = tema.fonte

  const relatorio = validarFluxo(fluxo, { destinos: destinos.destinos || {} })
  if (!relatorio.valido) {
    const aviso = elementoCom("div", "cf__aviso", relatorio.erros.join(" · "))
    raiz.prepend(aviso)
    console.error("chatflow: fluxo inválido.", relatorio.erros)
    if (modo === "producao") return { reiniciar() {}, estado: () => null }
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

  function pausaDe(texto) {
    const { piso = 0, porCaractere = 0, teto = 0 } = ritmo || {}
    return Math.min(teto, piso + String(texto ?? "").length * porCaractere)
  }

  // Balão transitório com os três pontos. Não passa por dizer(): se entrasse
  // na transcrição, a retomada redesenharia pontinhos fantasmas no meio da
  // conversa já dita.
  function mostrarDigitando() {
    const bolha = elementoCom("div", "cf__bolha cf__digitando")
    bolha.setAttribute("aria-label", "digitando")
    for (let i = 0; i < 3; i++) bolha.append(elementoCom("span", "cf__ponto"))
    thread.append(bolha)
    thread.scrollTop = thread.scrollHeight
    return bolha
  }

  async function dizerComPausa(medida, item) {
    const espera = pausaDe(medida)
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

  function desenhar(item) {
    if (item.imagem !== undefined) {
      const bolha = elementoCom("div", "cf__bolha")
      const img = document.createElement("img")
      img.src = item.imagem
      img.alt = item.alternativo || ""
      bolha.append(img)
      thread.append(bolha)
    } else {
      const classe = item.lado === "pessoa" ? "cf__bolha cf__bolha--pessoa" : "cf__bolha"
      thread.append(elementoCom("div", classe, item.texto))
    }
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

  function limparComposer() {
    composer.replaceChildren()
    erro.textContent = ""
  }

  // Não limpa o composer: quem termina num redirecionamento precisa continuar
  // vendo o botão de saída enquanto o lead é enviado. Nos outros caminhos o
  // composer já foi esvaziado no começo de seguirInterno.
  async function finalizar() {
    await enviador.enviar({
      sessaoId,
      finalizadoEm: new Date().toISOString(),
      ...contexto(fluxo, estado),
      historico: estado.historico.join(" > ")
    })
  }

  // Enquanto o chat "digita", o composer já está vazio — mas um duplo clique
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
    const botao = elementoCom("button", "cf__botao", bloco.conteudo?.rotulo_botao || "Enviar")
    botao.type = "button"
    botao.addEventListener("click", () => responder(campo.value.trim()))
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); botao.click() }
    })
    composer.replaceChildren(campo, botao)
    campo.focus()
  }

  function pedirOpcao(bloco) {
    const botoes = (bloco.conteudo?.opcoes || []).map((opcao) => {
      const botao = elementoCom("button", "cf__botao cf__botao--opcao", opcao.label)
      botao.type = "button"
      botao.addEventListener("click", () => responder(opcao.label))
      return botao
    })
    composer.replaceChildren(...botoes)
  }

  function mostrarLink(bloco) {
    const url = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado))
    const link = elementoCom("a", "cf__botao", bloco.conteudo?.rotulo_botao || "Continuar")
    link.href = url
    if (bloco.conteudo?.nova_aba !== false) {
      link.target = "_blank"
      link.rel = "noopener noreferrer"
    }
    composer.replaceChildren(link)
  }

  async function seguir() {
    await seguirInterno()
    if (estado.terminou) sessao.limpar()
    // O sessaoId vai junto: sem ele, uma recarga geraria um id novo e os
    // eventos emitidos antes da recarga deixariam de casar com o lead final.
    else sessao.salvar({ estado, transcricao, sessaoId })
  }

  async function seguirInterno() {
    limparComposer()

    let guarda = 0
    while (!estado.terminou && guarda++ < 500) {
      const bloco = blocoAtual(fluxo, estado)
      if (!bloco) { estado = avancar(fluxo, estado); continue }

      enviador.enviarEvento({
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
        await dizerComPausa(alternativo, {
          lado: "bot",
          imagem: interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado)),
          alternativo
        })
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
        if (depois.terminou) { estado = depois; finalizar() }
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

    finalizar()
  }

  return {
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
