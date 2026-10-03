// Mídia que mora na pasta do cliente: o fluxo guarda o caminho de dentro da
// pasta, e quem carrega resolve.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ehRelativo, resolverCaminho, resolverMidia } from "../motor/midia.js"

test("o que ja aponta para fora nao e relativo", () => {
  for (const fora of ["https://exemplo/a.png", "http://exemplo/a.png", "//exemplo/a.png",
                      "data:image/png;base64,AAA", "/clientes/x/a.png", "blob:abc"]) {
    assert.equal(ehRelativo(fora), false, fora)
  }
})

test("caminho de dentro da pasta e relativo", () => {
  assert.equal(ehRelativo("imagens/foto.png"), true)
  assert.equal(ehRelativo("foto.png"), true)
})

test("vazio nao e caminho nenhum", () => {
  assert.equal(ehRelativo(""), false)
  assert.equal(ehRelativo(null), false)
  assert.equal(ehRelativo(undefined), false)
})

test("resolver junta a pasta, sem barra dobrada", () => {
  assert.equal(resolverCaminho("imagens/a.png", "../clientes/osher"), "../clientes/osher/imagens/a.png")
  assert.equal(resolverCaminho("imagens/a.png", "../clientes/osher/"), "../clientes/osher/imagens/a.png")
})

test("resolver nao toca no que ja e absoluto, nem sem pasta", () => {
  assert.equal(resolverCaminho("https://exemplo/a.png", "../clientes/osher"), "https://exemplo/a.png")
  assert.equal(resolverCaminho("imagens/a.png", ""), "imagens/a.png")
})

const fluxoCom = (url, tipo = "imagem") => ({
  versao: 2,
  grupos: [{ id: "g1", blocos: [
    { id: "b1", tipo: "texto", conteudo: { texto: "Oi" } },
    { id: "b2", tipo, conteudo: { url, alternativo: "foto" } }
  ] }]
})

test("a imagem da pasta do cliente ganha o caminho que o navegador busca", () => {
  const pronto = resolverMidia(fluxoCom("imagens/foto.png"), "../clientes/osher")
  assert.equal(pronto.grupos[0].blocos[1].conteudo.url, "../clientes/osher/imagens/foto.png")
  assert.equal(pronto.grupos[0].blocos[1].conteudo.alternativo, "foto", "o resto do bloco fica")
})

test("video tambem", () => {
  const pronto = resolverMidia(fluxoCom("videos/v.mp4", "video"), "../clientes/osher")
  assert.equal(pronto.grupos[0].blocos[1].conteudo.url, "../clientes/osher/videos/v.mp4")
})

test("o fluxo original nao e mexido: gravar caminho resolvido quebraria o projeto", () => {
  const original = fluxoCom("imagens/foto.png")
  const pronto = resolverMidia(original, "../clientes/osher")
  assert.equal(original.grupos[0].blocos[1].conteudo.url, "imagens/foto.png")
  assert.notEqual(pronto, original)
})

test("sem nada para resolver, devolve o mesmo fluxo", () => {
  const original = fluxoCom("https://exemplo/a.png")
  assert.equal(resolverMidia(original, "../clientes/osher"), original)
  assert.equal(resolverMidia(original, ""), original)
})

test("fluxo torto nao quebra", () => {
  assert.deepEqual(resolverMidia(null, "x"), null)
  assert.deepEqual(resolverMidia({ grupos: [null, { blocos: [null] }] }, "x"),
    { grupos: [null, { blocos: [null] }] })
})
