// A caixa flutuante de uma opção: o que cada escolha carrega além do texto do
// botão. Na Escolha com imagem é a figura; nos Cartões, figura, título e
// descrição.
//
// Ela se monta a partir do `campos_da_opcao` que o próprio tipo declara, e não
// de uma lista escrita aqui dentro. É a mesma ideia da caixa das bolhas de
// mídia: um tipo novo ganha caixa sem que o editor saiba o nome dele.

import { obter } from "../motor/blocos/_registro.js"
import { problemaNoArquivo, ARQUIVOS } from "./midia.js"
import { preencher } from "./idioma.js"

function el(tag, classe, texto) {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

export function camposDaOpcao(tipo) {
  try {
    const campos = obter(tipo).campos_da_opcao
    return Array.isArray(campos) && campos.length ? campos : null
  } catch {
    return null
  }
}

export function criarCaixaDeOpcao({
  tipo,
  opcao = {},
  t = preencher,
  // Grava um campo desta opção. Recebe (campo, valor).
  aoEditar = () => {},
  // Sobe um arquivo e devolve o caminho dele. Nulo quando não há quem guarde.
  aoSubir = null
}) {
  const campos = camposDaOpcao(tipo)
  if (!campos) return null

  const caixa = el("div", `ed__midia ed__midia--opcao ed__midia--${tipo}`)
  // O que acontece aqui dentro é da caixa: sem isto, clicar num campo
  // selecionava o cartão atrás e o arrasto do bloco levava a caixa junto.
  for (const evento of ["mousedown", "click", "dblclick", "contextmenu"]) {
    caixa.addEventListener(evento, (ev) => ev.stopPropagation?.())
  }

  let valores = { ...opcao }

  for (const campo of campos) {
    const bloco = el("div", "ed__midia-corpo")
    bloco.append(el("span", "ed__midia-rotulo", t(campo.rotulo)))
    const entrada = campoDeTexto(campo)
    bloco.append(entrada)
    // Na figura, o link e o arquivo aparecem juntos: são dois caminhos para a
    // mesma coisa, e esconder um atrás de aba numa caixa deste tamanho só
    // acrescenta um clique.
    if (campo.tipo === "imagem") bloco.append(...paraSubir(campo, entrada))
    caixa.append(bloco)
  }

  function campoDeTexto(campo) {
    const dica = t(campo.dica || campo.rotulo)
    const entrada = el("input", "ed__midia-campo")
    entrada.setAttribute("type", "text")
    entrada.setAttribute("placeholder", dica)
    entrada.setAttribute("aria-label", dica)
    entrada.value = valores[campo.nome] || ""
    entrada.addEventListener("input", () => {
      valores = { ...valores, [campo.nome]: entrada.value }
      aoEditar(campo.nome, entrada.value)
    })
    entrada.dadosCampo = campo.nome
    return entrada
  }

  function paraSubir(campo, entrada) {
    if (!aoSubir) return []
    const regra = ARQUIVOS.imagem
    const etiqueta = el("label", "ed__midia-subir")
    etiqueta.append(el("span", "ed__midia-subir-rotulo", t(regra.escolher)))
    const seletor = el("input", "ed__midia-arquivo")
    seletor.setAttribute("type", "file")
    seletor.setAttribute("accept", regra.aceita)
    const recado = el("p", "ed__midia-recado")
    seletor.addEventListener("change", async () => {
      const arquivo = seletor.files?.[0]
      const problema = problemaNoArquivo(arquivo, "imagem")
      if (problema) { recado.textContent = t(problema); return }
      recado.textContent = t("Subindo…")
      try {
        const caminho = await aoSubir(arquivo)
        valores = { ...valores, [campo.nome]: caminho }
        aoEditar(campo.nome, caminho)
        recado.textContent = ""
        // O campo mostra para onde a figura foi parar: sem isto a caixa
        // parece não ter feito nada. A referência vem de cima, e não de uma
        // busca por seletor — no navegador de verdade `dadosCampo` é uma
        // propriedade de objeto, que nenhum seletor CSS enxerga.
        entrada.value = caminho
      } catch (falha) {
        recado.textContent = t("Não consegui subir ({motivo}).", { motivo: falha?.message || String(falha) })
      }
    })
    etiqueta.append(seletor)
    return [etiqueta, recado]
  }

  return caixa
}
