import { registrarTodos } from "./blocos/index.js"
import { todos } from "./blocos/_registro.js"
import { validarFluxo } from "./validar.js"
import { interpolar } from "./interpolar.js"
import { criarEnviador } from "./destinos.js"
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
  buscar = (...args) => fetch(...args)
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
    buscar
  })

  let estado = criarEstado(fluxo)
  let sessaoId = novaSessao()

  function falar(texto) {
    const bolha = elementoCom("div", "cf__bolha", interpolar(texto, contexto(fluxo, estado)))
    thread.append(bolha)
    thread.scrollTop = thread.scrollHeight
  }

  function ecoar(texto) {
    const bolha = elementoCom("div", "cf__bolha cf__bolha--pessoa", texto)
    thread.append(bolha)
    thread.scrollTop = thread.scrollHeight
  }

  function limparComposer() {
    composer.replaceChildren()
    erro.textContent = ""
  }

  async function finalizar() {
    limparComposer()
    await enviador.enviar({
      sessaoId,
      finalizadoEm: new Date().toISOString(),
      ...contexto(fluxo, estado),
      historico: estado.historico.join(" > ")
    })
  }

  function responder(valor, rotuloVisivel = valor) {
    const bloco = blocoAtual(fluxo, estado)
    const veredito = validarEntrada(bloco, valor)
    if (!veredito.ok) {
      erro.textContent = veredito.erro
      estado = registrarFalha(estado)
      const desvio = destinoDeInvalido(fluxo, estado)
      if (desvio) {
        estado = limparFalhas(estado)
        estado = avancar(fluxo, estado, { destino: desvio })
        seguir()
      }
      return
    }
    erro.textContent = ""
    estado = limparFalhas(estado)
    ecoar(rotuloVisivel)
    estado = aplicarResposta(fluxo, estado, valor)
    const destino = destinoDaResposta(bloco, valor)
    estado = avancar(fluxo, estado, destino ? { destino } : {})
    seguir()
  }

  function pedirTexto(bloco, definicaoTipo) {
    const campo = elementoCom("input", "cf__campo")
    campo.type = definicaoTipo === "entrada_numero" ? "text" : "text"
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

  function seguir() {
    limparComposer()

    let guarda = 0
    while (!estado.terminou && guarda++ < 500) {
      const bloco = blocoAtual(fluxo, estado)
      if (!bloco) { estado = avancar(fluxo, estado); continue }

      enviador.enviarEvento({
        sessaoId,
        grupoId: estado.grupoAtual,
        blocoId: bloco.id,
        em: new Date().toISOString()
      })

      if (bloco.tipo === "texto") { falar(bloco.conteudo?.texto || ""); estado = avancar(fluxo, estado); continue }

      if (bloco.tipo === "imagem") {
        const bolha = elementoCom("div", "cf__bolha")
        const img = document.createElement("img")
        img.src = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado))
        img.alt = bloco.conteudo?.alternativo || ""
        bolha.append(img)
        thread.append(bolha)
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
        enviador.enviar({ sessaoId, ...contexto(fluxo, estado) })
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "redirecionar") { mostrarLink(bloco); return }
      if (bloco.tipo === "entrada_botoes") { pedirOpcao(bloco); return }
      pedirTexto(bloco, bloco.tipo)
      return
    }

    finalizar()
  }

  return {
    reiniciar() {
      // Um envio que falhou numa tentativa anterior desta sessão é
      // retentado agora. Sem esta chamada a fila de `destinos.js` nunca
      // é drenada por ninguém e o lead se perde em silêncio.
      enviador.processarFila()
      estado = criarEstado(fluxo)
      sessaoId = novaSessao()
      thread.replaceChildren()
      seguir()
    },
    estado: () => estado
  }
}
