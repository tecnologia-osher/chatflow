// A caixa flutuante de uma bolha de mídia: abre ao lado do bloco, como no
// Typebot. Ela existe porque imagem e vídeo não se editam escrevendo — o que
// a pessoa tem na mão é um link, um arquivo, e um interruptor.

import { caixaDoTipo, problemaNoArquivo } from "./midia.js"
import { ALTURA_MINIMA, ALTURA_MAXIMA } from "../motor/incorporar.js"
import { preencher } from "./idioma.js"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

export function criarCaixaDeMidia({
  tipo,
  conteudo = {},
  t = preencher,
  // Grava um campo do bloco. Recebe (campo, valor).
  aoEditar = () => {},
  // Sobe um arquivo e devolve o caminho dele dentro da pasta do cliente.
  // Nulo quando não há quem guarde — e aí a aba Upload diz isso.
  aoSubir = null
}) {
  const molde = caixaDoTipo(tipo)
  if (!molde) return null

  const caixa = el("div", `ed__midia ed__midia--${tipo}`)
  // O que acontece aqui dentro é da caixa: sem isto, clicar num campo
  // selecionava o cartão atrás e o arrasto do bloco levava a caixa junto.
  for (const evento of ["mousedown", "click", "dblclick", "contextmenu"]) {
    caixa.addEventListener(evento, (ev) => ev.stopPropagation?.())
  }

  let aba = molde.abas[0].chave
  const corpo = el("div", "ed__midia-corpo")

  function desenhar() {
    caixa.replaceChildren()

    if (molde.abas.length > 1) {
      const tiras = el("div", "ed__midia-abas")
      for (const { chave, rotulo } of molde.abas) {
        const botao = el("button", `ed__midia-aba${chave === aba ? " ed__midia-aba--ativa" : ""}`, t(rotulo))
        botao.setAttribute("type", "button")
        botao.dadosAba = chave
        botao.addEventListener("click", () => { aba = chave; desenhar() })
        tiras.append(botao)
      }
      caixa.append(tiras)
    }

    corpo.replaceChildren()
    if (aba === "upload") corpo.append(...paraSubir())
    else corpo.append(campoDeTexto(molde.campo.nome, t(molde.campo.dica)))
    if (molde.nota) corpo.append(el("p", "ed__midia-nota", t(molde.nota)))
    caixa.append(corpo)

    if (molde.numero) caixa.append(linhaDoNumero())
    if (molde.interruptor) caixa.append(linhaDoInterruptor())
  }

  // Altura: menos, mais, e o número no meio — como no print, e como qualquer
  // campo de medida. Digitar também vale.
  function linhaDoNumero() {
    const { campo, rotulo, sufixo, padrao } = molde.numero
    const linha = el("div", "ed__midia-linha ed__midia-linha--numero")
    linha.append(el("span", "ed__midia-rotulo", t(rotulo)))

    const valor = () => {
      const bruto = Number.parseInt(conteudo[campo], 10)
      return Number.isFinite(bruto) ? bruto : padrao
    }
    const grupo = el("div", "ed__midia-numero")
    const entrada = el("input", "ed__midia-numero-campo")
    entrada.setAttribute("type", "number")
    entrada.setAttribute("min", String(ALTURA_MINIMA))
    entrada.setAttribute("max", String(ALTURA_MAXIMA))
    entrada.setAttribute("aria-label", t(rotulo))
    entrada.value = String(valor())

    const gravar = (novo) => {
      const preso = Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, novo))
      entrada.value = String(preso)
      conteudo = { ...conteudo, [campo]: preso }
      aoEditar(campo, preso)
    }
    const passo = (quanto) => {
      const botao = el("button", "ed__midia-passo", quanto > 0 ? "+" : "−")
      botao.setAttribute("type", "button")
      botao.setAttribute("aria-label", quanto > 0 ? t("Aumentar") : t("Diminuir"))
      botao.addEventListener("click", () => gravar(valor() + quanto))
      return botao
    }
    entrada.addEventListener("input", () => {
      const bruto = Number.parseInt(entrada.value, 10)
      if (!Number.isFinite(bruto)) return
      conteudo = { ...conteudo, [campo]: bruto }
      aoEditar(campo, bruto)
    })
    // Prender o número enquanto se digita tira o cursor do meio da conta; na
    // saída, sim: é quando o valor vira definitivo.
    entrada.addEventListener("change", () => gravar(valor()))

    grupo.append(passo(-20), entrada, passo(20))
    linha.append(grupo)
    if (sufixo) linha.append(el("span", "ed__midia-sufixo", sufixo))
    return linha
  }

  function campoDeTexto(campo, dica, valorInicial) {
    const entrada = el("input", "ed__midia-campo")
    entrada.setAttribute("type", "text")
    entrada.setAttribute("placeholder", dica)
    entrada.setAttribute("aria-label", dica)
    entrada.value = valorInicial !== undefined ? valorInicial : (conteudo[campo] || "")
    entrada.addEventListener("input", () => {
      conteudo = { ...conteudo, [campo]: entrada.value }
      aoEditar(campo, entrada.value)
    })
    return entrada
  }

  function paraSubir() {
    if (!aoSubir) {
      return [el("p", "ed__midia-nota",
        t("Subir arquivo precisa de servidor. Aberto assim, use o link."))]
    }
    const etiqueta = el("label", "ed__midia-subir")
    etiqueta.append(el("span", "ed__midia-subir-rotulo", t("Escolher uma imagem")))
    const campo = el("input", "ed__midia-arquivo")
    campo.setAttribute("type", "file")
    campo.setAttribute("accept", "image/*")
    const recado = el("p", "ed__midia-recado")
    campo.addEventListener("change", async () => {
      const arquivo = campo.files?.[0]
      const problema = problemaNoArquivo(arquivo)
      if (problema) { recado.textContent = t(problema); return }
      recado.textContent = t("Subindo…")
      try {
        const caminho = await aoSubir(arquivo)
        conteudo = { ...conteudo, url: caminho }
        aoEditar("url", caminho)
        recado.textContent = ""
        // Depois de subir, o que interessa é o endereço que ficou: a aba
        // Link mostra para onde a imagem foi parar.
        aba = "link"
        desenhar()
      } catch (falha) {
        recado.textContent = t("Não consegui subir ({motivo}).", { motivo: falha?.message || String(falha) })
      }
    })
    etiqueta.append(campo)
    return [etiqueta, recado]
  }

  function linhaDoInterruptor() {
    const { campo, rotulo, dica } = molde.interruptor
    const ligado = campo === "link_ao_clicar" ? Boolean(conteudo[campo]) : Boolean(conteudo[campo])
    const linha = el("div", "ed__midia-linha")
    const botao = el("button", `ed__midia-chave${ligado ? " ed__midia-chave--ligado" : ""}`)
    botao.setAttribute("type", "button")
    botao.setAttribute("aria-pressed", ligado ? "true" : "false")
    botao.setAttribute("aria-label", t(rotulo))
    botao.append(el("span", "ed__midia-chave-bola"))
    botao.addEventListener("click", () => {
      // Interruptor de link liga abrindo o campo; o de autoplay é o próprio
      // valor. Os dois desligam apagando o que havia.
      const novo = dica ? (ligado ? "" : " ") : !ligado
      conteudo = { ...conteudo, [campo]: novo }
      aoEditar(campo, novo)
      desenhar()
    })
    linha.append(botao, el("span", "ed__midia-rotulo", t(rotulo)))

    const caixaDaLinha = el("div", "ed__midia-interruptor")
    caixaDaLinha.append(linha)
    // Ligado, o campo do destino aparece logo abaixo: um interruptor que liga
    // e não pergunta para onde não liga nada.
    if (dica && ligado) {
      caixaDaLinha.append(campoDeTexto(campo, t(dica), String(conteudo[campo] || "").trim()))
    }
    return caixaDaLinha
  }

  desenhar()
  return caixa
}
