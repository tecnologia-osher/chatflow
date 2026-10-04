// A caixa das bolhas de mídia, na parte que é dado: que campos cada tipo tem,
// e o que entra como arquivo.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CAIXAS, temCaixa, caixaDoTipo, nomeDeArquivo, problemaNoArquivo,
  TIPOS_DE_IMAGEM, LIMITE_DA_IMAGEM
} from "../editor/midia.js"

test("so as bolhas de midia tem caixa propria", () => {
  assert.equal(temCaixa("imagem"), true)
  assert.equal(temCaixa("video"), true)
  assert.equal(temCaixa("incorporar"), true)
  assert.equal(temCaixa("texto"), false, "a fala se escreve no cartão, não numa caixa")
  assert.equal(temCaixa("entrada_botoes"), false)
  assert.equal(caixaDoTipo("texto"), null)
})

test("a caixa da imagem tem link e upload, e o abrir ao clicar", () => {
  const caixa = caixaDoTipo("imagem")
  assert.deepEqual(caixa.abas.map((a) => a.rotulo), ["Link", "Upload"])
  assert.equal(caixa.campo.nome, "url")
  assert.equal(caixa.interruptor.campo, "link_ao_clicar")
})

test("a caixa do video tem link e autoplay, e diz o que o motor abre", () => {
  const caixa = caixaDoTipo("video")
  assert.deepEqual(caixa.abas.map((a) => a.rotulo), ["Link"])
  assert.equal(caixa.interruptor.campo, "autoplay")
  assert.match(caixa.nota, /YouTube/)
  assert.match(caixa.nota, /Vimeo/)
  assert.doesNotMatch(caixa.nota, /TikTok/i,
    "prometer o que o motor não abre é mentir na própria tela")
})

test("toda caixa diz o campo que edita e tem dica no lugar do texto", () => {
  for (const [tipo, caixa] of Object.entries(CAIXAS)) {
    assert.ok(caixa.campo?.nome, `${tipo} sem campo`)
    assert.ok(caixa.campo?.dica, `${tipo} sem dica`)
    assert.ok(caixa.abas?.length, `${tipo} sem aba`)
    // Interruptor ou número: cada bolha tem o seu segundo controle, e nenhuma
    // fica só com o campo de endereço.
    assert.ok(caixa.interruptor?.rotulo || caixa.numero?.rotulo, `${tipo} sem segundo controle`)
  }
})

test("a caixa do incorporar tem o endereco, a recomendacao e a altura", () => {
  const caixa = caixaDoTipo("incorporar")
  assert.deepEqual(caixa.abas.map((a) => a.rotulo), ["Link"])
  assert.match(caixa.campo.dica, /código/, "o que os serviços dão de copiar é o código")
  assert.match(caixa.nota, /PDFs/)
  assert.match(caixa.nota, /iframes/)
  assert.match(caixa.nota, /sites/)
  assert.equal(caixa.numero.campo, "altura")
  assert.equal(caixa.numero.padrao, 400)
  assert.equal(caixa.interruptor, undefined, "altura não é interruptor")
})

// --- o arquivo que sobe ----------------------------------------------------

test("o nome do arquivo vira caminho seguro dentro da pasta", () => {
  assert.equal(nomeDeArquivo("Foto do Imóvel.PNG"), "foto-do-imovel.png")
  assert.equal(nomeDeArquivo("ação 2026.jpg"), "acao-2026.jpg")
})

test("nome que tenta sair da pasta nao sai", () => {
  assert.equal(nomeDeArquivo("../../etc/senha.png"), "etc-senha.png")
  assert.equal(nomeDeArquivo("/raiz.png"), "raiz.png")
  assert.doesNotMatch(nomeDeArquivo("../a.png"), /\.\./)
})

test("nome vazio ainda vira um arquivo", () => {
  assert.equal(nomeDeArquivo(""), "imagem")
  assert.equal(nomeDeArquivo("***"), "imagem")
})

test("nome gigante nao vira caminho gigante", () => {
  assert.ok(nomeDeArquivo("a".repeat(300) + ".png").length <= 50)
})

test("formato que a conversa nao mostra e recusado antes de subir", () => {
  assert.match(problemaNoArquivo({ type: "application/pdf", size: 10 }), /Formato/)
  assert.match(problemaNoArquivo({ type: "video/mp4", size: 10 }), /Formato/)
  assert.equal(problemaNoArquivo({ type: "image/png", size: 10 }), null)
  for (const tipo of TIPOS_DE_IMAGEM) {
    assert.equal(problemaNoArquivo({ type: tipo, size: 10 }), null, tipo)
  }
})

test("imagem grande demais e recusada, com o limite na frase", () => {
  assert.match(problemaNoArquivo({ type: "image/png", size: LIMITE_DA_IMAGEM + 1 }), /2 MB/)
  assert.equal(problemaNoArquivo({ type: "image/png", size: LIMITE_DA_IMAGEM }), null)
})

test("sem arquivo nenhum, diz isso em vez de quebrar", () => {
  assert.match(problemaNoArquivo(null), /Nenhum arquivo/)
})

// --- a bolha de áudio ------------------------------------------------------

test("a caixa do audio tem link, upload, a recomendacao e o autoplay", () => {
  const caixa = caixaDoTipo("audio")
  assert.deepEqual(caixa.abas.map((a) => a.rotulo), ["Link", "Upload"])
  assert.equal(caixa.campo.dica, "Cole o link do áudio…")
  assert.match(caixa.nota, /\.mp3/)
  assert.match(caixa.nota, /\.wav/)
  assert.equal(caixa.interruptor.campo, "autoplay")
  assert.equal(caixa.arquivo, "audio", "o que ela sobe é áudio, não imagem")
})

test("cada especie de arquivo tem as suas regras", () => {
  assert.equal(problemaNoArquivo({ type: "audio/mpeg", size: 10 }, "audio"), null)
  assert.match(problemaNoArquivo({ type: "audio/mpeg", size: 10 }, "imagem"), /Formato/,
    "áudio não entra onde se espera imagem")
  assert.match(problemaNoArquivo({ type: "image/png", size: 10 }, "audio"), /não toca/,
    "imagem não entra onde se espera áudio")
})

test("o audio pode ser maior que a imagem, mas nao infinito", () => {
  assert.equal(problemaNoArquivo({ type: "audio/mpeg", size: 4 * 1024 * 1024 }, "audio"), null,
    "4 MB de voz é um áudio normal")
  assert.match(problemaNoArquivo({ type: "audio/mpeg", size: 6 * 1024 * 1024 }, "audio"), /5 MB/)
  assert.match(problemaNoArquivo({ type: "image/png", size: 4 * 1024 * 1024 }, "imagem"), /2 MB/,
    "a imagem continua com o limite dela")
})

test("especie desconhecida cai nas regras da imagem, em vez de aceitar tudo", () => {
  assert.match(problemaNoArquivo({ type: "application/pdf", size: 10 }, "sei-la"), /PNG/,
    "na dúvida, a regra mais apertada: a da imagem")
})
