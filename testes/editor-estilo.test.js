// O CSS não passa pelo dublê de DOM: ele não tem cascata, não calcula
// especificidade e não pinta nada. Então um punhado de armadilhas de folha de
// estilo só aparece no navegador — ou aqui, lendo o arquivo.
//
// Este teste nasceu de um botão que ficou invisível: `.ed__baixar` pintava a
// letra de branco e o fundo de azul, mas `.ed__barra button` tem
// especificidade maior e devolvia o fundo para branco. Texto branco em fundo
// branco, botão existindo e ninguém vendo.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../editor/editor.css", import.meta.url), "utf8")
const regras = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  seletor: m[1].trim().split("\n").at(-1).trim(),
  corpo: m[2]
}))

const peso = (seletor) => (seletor.match(/\.[a-z0-9_-]+/gi) || []).length

test("quem pinta a letra de branco pinta o fundo na mesma regra", () => {
  const soltas = regras
    .filter((r) => /color:\s*(#fff\b|#ffffff\b|white)/i.test(r.corpo) && !/background/i.test(r.corpo))
    .map((r) => r.seletor)
  assert.deepEqual(soltas, [],
    "letra branca sem fundo na mesma regra some assim que outra regra vencer o fundo")
})

test("variante de botao da barra vence a regra geral dos botoes", () => {
  const geral = regras.find((r) => r.seletor === ".ed__barra button")
  assert.ok(geral, "a regra geral dos botões da barra sumiu — este teste precisa dela")
  const pesoGeral = peso(geral.seletor) + 1 // o elemento conta menos que a classe, mas conta

  // Só as regras que miram um botão da barra: a regra da própria barra não
  // disputa com elas.
  for (const r of regras) {
    if (!/\.ed__(baixar|testar|ajustar)\b/.test(r.seletor)) continue
    if (!/background/i.test(r.corpo)) continue
    assert.ok(peso(r.seletor) >= pesoGeral,
      `"${r.seletor}" pinta fundo mas perde para ".ed__barra button": o fundo volta a branco`)
  }
})

test("a distancia da bolinha e a mesma no CSS e no modelo", async () => {
  // O CSS põe a bolinha a essa distância da borda; o modelo faz a linha nascer
  // nela. Mudar um e esquecer o outro reabre o vão entre a bolinha e o traço,
  // que foi exatamente o defeito relatado.
  const { MEDIDAS } = await import("../editor/modelo.js")
  const noCss = css.match(/--ed-conector-fora:\s*(\d+)px/)
  assert.ok(noCss, "a variável --ed-conector-fora sumiu do CSS")
  assert.equal(Number(noCss[1]), MEDIDAS.CARTAO_CONECTOR,
    "CSS e modelo discordando: a linha nasce fora da bolinha")
})

// O painel que se recolhe é feito de CSS: o JavaScript só põe a classe. Estes
// são os quatro pedaços sem os quais a classe não faz nada — e um painel que
// sai da tela e não volta é pior que um painel que nunca sai.
test("o painel solto sai da tela e volta pela beira", () => {
  assert.match(css, /\.ed__corpo--solto \.ed__paleta \{[^}]*transform: translateX\(/,
    "sem isto o cadeado aberto não recolhe nada")
  assert.match(css, /\.ed__corpo--espiando \.ed__paleta \{[^}]*transform: none/,
    "sem isto o painel sai e não volta mais")
  assert.match(css, /\.ed__corpo--solto \.ed__puxador \{[^}]*pointer-events: none/,
    "faixa que recebe mouse rouba os cliques do quadro embaixo dela")
  assert.match(css, /\.ed__puxador \{[^}]*display: none/,
    "preso, a pílula não tem o que fazer na tela")
  assert.match(css, /\.ed__paleta \{[^}]*transition: transform/,
    "sem transição ele pula, em vez de correr")
})

test("nada manda em grid-template-columns no .ed, que e uma grade de linhas", () => {
  // O header é irmão do corpo: duas linhas. Uma regra de colunas sobrando —
  // de uma media query antiga, por exemplo — põe o header dentro da primeira
  // coluna e espreme a barra inteira. Foi o que aconteceu abaixo de 1100px.
  const culpadas = regras.filter((r) =>
    /(^|[\s,])\.ed(\s*\{|,|$)/.test(r.seletor + " {") && /grid-template-columns/.test(r.corpo))
  assert.deepEqual(culpadas.map((r) => r.seletor), [])
  assert.match(css, /\.ed \{[^}]*grid-template-rows: auto 1fr/)
})
