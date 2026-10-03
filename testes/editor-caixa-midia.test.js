// A caixa flutuante da bolha de imagem e da de vídeo.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { criarCaixaDeMidia } = await import("../editor/caixa-midia.js")

function montar({ tipo = "imagem", conteudo = {}, subir = null } = {}) {
  const edicoes = []
  const no = criarCaixaDeMidia({
    tipo, conteudo,
    aoEditar: (campo, valor) => edicoes.push({ campo, valor }),
    aoSubir: subir
  })
  return { no, edicoes }
}

const porClasse = (no, classe) => no.porClasse(classe)

test("tipo sem caixa nao ganha caixa", () => {
  assert.equal(criarCaixaDeMidia({ tipo: "texto" }), null)
})

// --- imagem ----------------------------------------------------------------

test("a imagem abre com Link e Upload, e o campo do link na frente", () => {
  const { no } = montar({ conteudo: { url: "https://exemplo/foto.png" } })
  assert.deepEqual(porClasse(no, "ed__midia-aba").map((a) => a.textContent), ["Link", "Upload"])
  assert.equal(porClasse(no, "ed__midia-aba--ativa")[0].textContent, "Link")
  assert.equal(porClasse(no, "ed__midia-campo")[0].value, "https://exemplo/foto.png")
  assert.equal(porClasse(no, "ed__midia-campo")[0].atributos.placeholder, "Cole o link da imagem…")
})

test("escrever o link grava no bloco, letra por letra", () => {
  const { no, edicoes } = montar()
  const campo = porClasse(no, "ed__midia-campo")[0]
  campo.value = "https://exemplo/a.png"
  campo.disparar("input")
  assert.deepEqual(edicoes, [{ campo: "url", valor: "https://exemplo/a.png" }])
})

test("o abrir-ao-clicar comeca desligado e so pergunta o destino quando liga", () => {
  const { no, edicoes } = montar()
  const chave = () => porClasse(no, "ed__midia-chave")[0]
  assert.equal(chave().className.includes("--ligado"), false)
  assert.equal(porClasse(no, "ed__midia-interruptor")[0].porClasse("ed__midia-campo").length, 0)

  chave().disparar("click")
  assert.equal(chave().className.includes("--ligado"), true)
  const destino = porClasse(no, "ed__midia-interruptor")[0].porClasse("ed__midia-campo")[0]
  assert.ok(destino, "interruptor que liga e não pergunta para onde não liga nada")
  assert.equal(destino.atributos.placeholder, "Para onde a imagem leva…")

  destino.value = "https://osher"
  destino.disparar("input")
  assert.deepEqual(edicoes.at(-1), { campo: "link_ao_clicar", valor: "https://osher" })
})

test("bloco que ja tem link ao clicar abre com o interruptor ligado e o destino na tela", () => {
  const { no } = montar({ conteudo: { url: "a.png", link_ao_clicar: "https://osher" } })
  assert.equal(porClasse(no, "ed__midia-chave")[0].className.includes("--ligado"), true)
  assert.equal(porClasse(no, "ed__midia-interruptor")[0].porClasse("ed__midia-campo")[0].value,
    "https://osher")
})

test("desligar o abrir-ao-clicar apaga o destino", () => {
  const { no, edicoes } = montar({ conteudo: { link_ao_clicar: "https://osher" } })
  porClasse(no, "ed__midia-chave")[0].disparar("click")
  assert.deepEqual(edicoes.at(-1), { campo: "link_ao_clicar", valor: "" })
  assert.equal(porClasse(no, "ed__midia-interruptor")[0].porClasse("ed__midia-campo").length, 0)
})

// --- upload ----------------------------------------------------------------

test("sem quem guarde, a aba Upload diz isso em vez de oferecer o botao", () => {
  const { no } = montar({ subir: null })
  porClasse(no, "ed__midia-aba").find((a) => a.textContent === "Upload").disparar("click")
  assert.equal(porClasse(no, "ed__midia-arquivo").length, 0)
  assert.match(porClasse(no, "ed__midia-nota")[0].textContent, /precisa de servidor/)
})

test("subir uma imagem grava o caminho e volta para o Link, que mostra onde ela foi parar", async () => {
  const { no, edicoes } = montar({ subir: async () => "imagens/foto.png" })
  porClasse(no, "ed__midia-aba").find((a) => a.textContent === "Upload").disparar("click")
  const campo = porClasse(no, "ed__midia-arquivo")[0]
  campo.files = [{ name: "foto.png", type: "image/png", size: 1000 }]
  campo.disparar("change")
  await assentar()

  assert.deepEqual(edicoes, [{ campo: "url", valor: "imagens/foto.png" }])
  assert.equal(porClasse(no, "ed__midia-aba--ativa")[0].textContent, "Link")
  assert.equal(porClasse(no, "ed__midia-campo")[0].value, "imagens/foto.png")
})

test("arquivo que a conversa nao mostra e recusado antes de subir", async () => {
  let subiu = false
  const { no, edicoes } = montar({ subir: async () => { subiu = true; return "x" } })
  porClasse(no, "ed__midia-aba").find((a) => a.textContent === "Upload").disparar("click")
  const campo = porClasse(no, "ed__midia-arquivo")[0]
  campo.files = [{ name: "a.pdf", type: "application/pdf", size: 10 }]
  campo.disparar("change")
  await assentar()
  assert.equal(subiu, false, "mandar para o servidor o que já se sabe que não serve é viagem perdida")
  assert.match(porClasse(no, "ed__midia-recado")[0].textContent, /Formato/)
  assert.deepEqual(edicoes, [])
})

test("upload que falha diz o motivo e nao grava caminho nenhum", async () => {
  const { no, edicoes } = montar({ subir: async () => { throw new Error("disco cheio") } })
  porClasse(no, "ed__midia-aba").find((a) => a.textContent === "Upload").disparar("click")
  const campo = porClasse(no, "ed__midia-arquivo")[0]
  campo.files = [{ name: "a.png", type: "image/png", size: 10 }]
  campo.disparar("change")
  await assentar()
  assert.match(porClasse(no, "ed__midia-recado")[0].textContent, /disco cheio/)
  assert.deepEqual(edicoes, [])
})

// --- vídeo -----------------------------------------------------------------

test("o video tem uma aba so, a nota do que o motor abre e o autoplay", () => {
  const { no, edicoes } = montar({ tipo: "video", conteudo: { url: "https://youtu.be/abc" } })
  assert.equal(porClasse(no, "ed__midia-abas").length, 0, "uma aba só não é escolha nenhuma")
  assert.equal(porClasse(no, "ed__midia-campo")[0].value, "https://youtu.be/abc")
  assert.match(porClasse(no, "ed__midia-nota")[0].textContent, /YouTube/)

  const chave = porClasse(no, "ed__midia-chave")[0]
  assert.equal(chave.className.includes("--ligado"), false)
  chave.disparar("click")
  assert.deepEqual(edicoes, [{ campo: "autoplay", valor: true }])
})

test("video que ja comeca sozinho abre com o interruptor ligado", () => {
  const { no, edicoes } = montar({ tipo: "video", conteudo: { url: "x", autoplay: true } })
  const chave = porClasse(no, "ed__midia-chave")[0]
  assert.equal(chave.className.includes("--ligado"), true)
  chave.disparar("click")
  assert.deepEqual(edicoes, [{ campo: "autoplay", valor: false }])
})

test("o que se faz dentro da caixa nao vaza para o cartao atras dela", () => {
  const { no } = montar()
  let vazou = false
  const pai = new Elemento("div")
  pai.append(no)
  pai.addEventListener("mousedown", () => { vazou = true })
  porClasse(no, "ed__midia-campo")[0].disparar("mousedown")
  assert.equal(vazou, false, "clicar num campo selecionava o cartão e arrastava o bloco")
})
