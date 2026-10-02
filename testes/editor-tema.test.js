// O tema como dado: a cascata das cores, os limites da largura e a promessa
// de que a aba Tema não deixou nenhuma cor do motor sem controle.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  COR_PADRAO, SEGUE, SECOES, LARGURA_PADRAO, LARGURA_MINIMA, LARGURA_MAXIMA,
  corValida, corDoTema, corHerdada, definirCor, soltarCor, definirDoTema,
  larguraEmRem, definirLargura, coresEditaveis
} from "../editor/tema.js"

const cssDoMotor = readFileSync(new URL("../motor/tema.css", import.meta.url), "utf8")

// --- a cascata -------------------------------------------------------------

test("a cor declarada no tema vence", () => {
  assert.equal(corDoTema({ cores: { acento: "#112233" } }, "acento"), "#112233")
})

test("cor sem valor proprio segue a que o CSS manda seguir", () => {
  assert.equal(corDoTema({ cores: { acento: "#112233" } }, "botao"), "#112233",
    "o botão sem cor própria é da cor do acento")
  assert.equal(corDoTema({ cores: { destaque: "#aabbcc" } }, "botao-opcao"), "#aabbcc")
  assert.equal(corDoTema({ cores: { texto: "#010203" } }, "placeholder"), "#010203")
})

test("cor propria do botao nao arrasta o acento, nem o contrario", () => {
  const tema = { cores: { acento: "#112233", botao: "#445566" } }
  assert.equal(corDoTema(tema, "botao"), "#445566")
  assert.equal(corDoTema(tema, "acento"), "#112233")
})

test("tema vazio cai no padrao do motor", () => {
  assert.equal(corDoTema({}, "acento"), COR_PADRAO.acento)
  assert.equal(corDoTema(undefined, "fundo"), COR_PADRAO.fundo)
  assert.equal(corDoTema({}, "botao"), COR_PADRAO.acento, "sem nada, o botão é o acento padrão")
})

test("cor que o seletor nao sabe mostrar vale como ausente", () => {
  assert.equal(corValida("rgba(0,0,0,.5)"), null)
  assert.equal(corValida("azul"), null)
  assert.equal(corValida(undefined), null)
  assert.equal(corDoTema({ cores: { acento: "rgba(0,0,0,.5)" } }, "acento"), COR_PADRAO.acento)
})

test("hex de tres digitos e maiusculas viram o formato do seletor", () => {
  assert.equal(corValida("#FFF"), "#ffffff")
  assert.equal(corValida("  #0C2340 "), "#0c2340")
  assert.equal(corDoTema({ cores: { fundo: "#ABC" } }, "fundo"), "#aabbcc")
})

test("corHerdada separa escolha de heranca", () => {
  assert.equal(corHerdada({ cores: { acento: "#112233" } }, "botao"), true)
  assert.equal(corHerdada({ cores: { botao: "#112233" } }, "botao"), false)
  assert.equal(corHerdada({}, "acento"), true, "o padrão do motor também é herança")
})

// --- edições ---------------------------------------------------------------

test("definirCor devolve tema novo e preserva o resto", () => {
  const antes = { marca: "Osher", cores: { acento: "#112233", texto: "#010203" } }
  const depois = definirCor(antes, "acento", "#445566")
  assert.equal(depois.cores.acento, "#445566")
  assert.equal(depois.cores.texto, "#010203")
  assert.equal(depois.marca, "Osher")
  assert.equal(antes.cores.acento, "#112233", "o tema de entrada foi mexido")
})

test("definirCor em tema sem cores cria o mapa", () => {
  assert.equal(definirCor({ marca: "X" }, "acento", "#445566").cores.acento, "#445566")
})

test("definirCor recusa o que nao e cor, em vez de gravar lixo", () => {
  const antes = { cores: { acento: "#112233" } }
  assert.equal(definirCor(antes, "acento", "azul"), antes)
})

test("soltarCor devolve a cor a heranca", () => {
  const tema = { cores: { acento: "#112233", botao: "#445566" } }
  const depois = soltarCor(tema, "botao")
  assert.equal("botao" in depois.cores, false, "a chave deveria sair do arquivo")
  assert.equal(corDoTema(depois, "botao"), "#112233")
  assert.equal(soltarCor(tema, "campo"), tema, "soltar o que já é herança não muda nada")
})

test("definirDoTema grava e apaga campo de primeiro nivel", () => {
  assert.equal(definirDoTema({}, "marca", "Osher").marca, "Osher")
  const limpo = definirDoTema({ marca: "Osher", avatar: "logo.svg" }, "avatar", "")
  assert.equal("avatar" in limpo, false, "campo vazio deveria sair do tema")
  assert.equal(limpo.marca, "Osher")
})

// --- largura ---------------------------------------------------------------

test("a largura e lida em rem, venha em rem ou em px", () => {
  assert.equal(larguraEmRem({ largura: "60rem" }), 60)
  assert.equal(larguraEmRem({ largura: "640px" }), 40)
  assert.equal(larguraEmRem({}), Number.parseFloat(LARGURA_PADRAO))
  assert.equal(larguraEmRem({ largura: "nada" }), Number.parseFloat(LARGURA_PADRAO))
  assert.equal(larguraEmRem({ largura: "0rem" }), Number.parseFloat(LARGURA_PADRAO))
})

test("definirLargura escreve com unidade e respeita os limites", () => {
  assert.equal(definirLargura({}, 60).largura, "60rem")
  assert.equal(definirLargura({}, 500).largura, `${LARGURA_MAXIMA}rem`)
  assert.equal(definirLargura({}, 1).largura, `${LARGURA_MINIMA}rem`)
  const antes = { largura: "60rem" }
  assert.equal(definirLargura(antes, "nada"), antes)
})

// --- a aba nao esqueceu nada ----------------------------------------------

test("o padrao de cada cor e o mesmo do CSS do motor", () => {
  for (const [chave, valor] of Object.entries(COR_PADRAO)) {
    const linha = new RegExp(`--cf-${chave}:\\s*([^;]+);`).exec(cssDoMotor)
    assert.ok(linha, `--cf-${chave} não existe mais em motor/tema.css`)
    assert.equal(corValida(linha[1]), valor, `--cf-${chave} divergiu do editor`)
  }
})

test("cada cor que segue outra segue a mesma que o CSS manda", () => {
  for (const [chave, pai] of Object.entries(SEGUE)) {
    const linha = new RegExp(`--cf-${chave}:\\s*([^;]+);`).exec(cssDoMotor)
    assert.ok(linha, `--cf-${chave} não existe mais em motor/tema.css`)
    assert.equal(linha[1].trim(), `var(--cf-${pai})`,
      `--cf-${chave} não segue mais --cf-${pai}`)
  }
})

test("toda cor do motor tem controle na aba Tema", () => {
  const noCss = [...cssDoMotor.matchAll(/^\s*--cf-([a-z-]+):/gm)].map((m) => m[1])
  const semCor = new Set(["coluna", "icone-enviar"]) // não são cores
  const comControle = new Set(coresEditaveis())
  for (const nome of noCss) {
    if (semCor.has(nome)) continue
    assert.ok(comControle.has(nome), `--cf-${nome} não tem controle na aba Tema`)
  }
})

test("nenhum controle aponta para cor que o motor nao tem", () => {
  for (const chave of coresEditaveis()) {
    assert.match(cssDoMotor, new RegExp(`--cf-${chave}:`), `--cf-${chave} não existe no motor`)
  }
})

test("as secoes tem chave unica e nenhum controle sem rotulo", () => {
  const chaves = SECOES.map((s) => s.chave)
  assert.equal(new Set(chaves).size, chaves.length, "duas seções com a mesma chave")
  for (const secao of SECOES) {
    assert.ok(secao.titulo, `a seção ${secao.chave} está sem título`)
    assert.ok(secao.controles.length > 0, `a seção ${secao.chave} está vazia`)
    for (const c of secao.controles) {
      assert.ok(c.rotulo, `controle sem rótulo em ${secao.chave}`)
      assert.ok(["cor", "texto", "largura", "interruptor"].includes(c.tipo),
        `tipo de controle desconhecido: ${c.tipo}`)
      if (c.tipo !== "largura") assert.ok(c.chave, `controle sem chave em ${secao.chave}`)
    }
  }
})

test("todo controle resolve numa cor de verdade com tema vazio", () => {
  // Sem padrão e sem quem seguir, a cor cai no preto do último recurso e a
  // aba mostraria um campo preto para um chat que não tem nada de preto.
  for (const chave of coresEditaveis()) {
    const cor = corDoTema({}, chave)
    const temPadrao = chave in COR_PADRAO
    const segue = chave in SEGUE
    assert.ok(temPadrao || segue, `--cf-${chave} não tem padrão nem quem seguir`)
    assert.notEqual(cor, "#000000", `--cf-${chave} caiu no preto do último recurso`)
  }
})
