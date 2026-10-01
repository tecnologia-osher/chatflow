// Pan, zoom e por onde a seta sai e chega. Matemática pura: erra em silêncio
// e só aparece como "o canvas está estranho", então vem coberta.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  criarVista, arrastar, aplicarZoom, paraMundo, paraTela, ancoras, enquadrar, caixaEm,
  pontaDaSeta, caminhoComCantos, ESCALA_MIN, ESCALA_MAX
} from "../editor/vista.js"

const perto = (a, b, tol = 0.001) =>
  assert.ok(Math.abs(a - b) < tol, `esperava ~${b}, veio ${a}`)

test("a vista comeca na origem, sem zoom", () => {
  const v = criarVista()
  assert.deepEqual(v, { x: 0, y: 0, escala: 1 })
})

test("arrastar desloca e nao mexe na escala", () => {
  const v = arrastar(criarVista(), { dx: 30, dy: -20 })
  assert.deepEqual(v, { x: 30, y: -20, escala: 1 })
})

test("arrastar nao modifica a vista recebida", () => {
  const v = criarVista()
  arrastar(v, { dx: 10, dy: 10 })
  assert.deepEqual(v, { x: 0, y: 0, escala: 1 })
})

test("tela e mundo sao o inverso um do outro", () => {
  const v = aplicarZoom(arrastar(criarVista(), { dx: 47, dy: -13 }), { delta: -3, ponto: { x: 200, y: 150 } })
  const mundo = paraMundo(v, { x: 321, y: 87 })
  const volta = paraTela(v, mundo)
  perto(volta.x, 321)
  perto(volta.y, 87)
})

test("o zoom mantem parado o ponto sob o cursor", () => {
  const v = arrastar(criarVista(), { dx: 12, dy: 34 })
  const cursor = { x: 400, y: 300 }
  const antes = paraMundo(v, cursor)

  const depois = paraMundo(aplicarZoom(v, { delta: -5, ponto: cursor }), cursor)

  perto(depois.x, antes.x)
  perto(depois.y, antes.y)
})

test("zoom para dentro aumenta a escala, para fora diminui", () => {
  const v = criarVista()
  assert.ok(aplicarZoom(v, { delta: -1, ponto: { x: 0, y: 0 } }).escala > 1)
  assert.ok(aplicarZoom(v, { delta: 1, ponto: { x: 0, y: 0 } }).escala < 1)
})

test("a escala tem teto e chao", () => {
  let v = criarVista()
  for (let i = 0; i < 100; i++) v = aplicarZoom(v, { delta: -10, ponto: { x: 0, y: 0 } })
  assert.equal(v.escala, ESCALA_MAX)
  for (let i = 0; i < 200; i++) v = aplicarZoom(v, { delta: 10, ponto: { x: 0, y: 0 } })
  assert.equal(v.escala, ESCALA_MIN)
})

// --- âncoras ---------------------------------------------------------------

const caixa = (x, y) => ({ x, y, largura: 260, altura: 120 })

test("destino a direita: sai pela direita, entra pela esquerda", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 0))
  assert.equal(a.de.lado, "direita")
  assert.equal(a.para.lado, "esquerda")
  perto(a.de.x, 260)
  perto(a.de.y, 60)
  perto(a.para.x, 500)
})

test("destino a esquerda: sai pela direita, onde esta a bolinha, e entra pela direita", () => {
  const a = ancoras(caixa(500, 0), caixa(0, 0))
  assert.equal(a.de.lado, "direita", "a bolinha fica na direita de todo cartão")
  assert.equal(a.para.lado, "direita")
})

test("indo para tras, a linha sai, contorna pela altura do meio e volta", () => {
  const origem = caixa(500, 0)
  const destino = caixa(0, 300)
  const a = ancoras(origem, destino)
  const foraDosDois = (p) =>
    !(p.x > origem.x && p.x < origem.x + origem.largura && p.y > origem.y && p.y < origem.y + origem.altura) &&
    !(p.x > destino.x && p.x < destino.x + destino.largura && p.y > destino.y && p.y < destino.y + destino.altura)
  assert.ok(a.pontos.every(foraDosDois),
    `a volta passou por dentro de um cartão: ${JSON.stringify(a.pontos)}`)
  const vertical = a.pontos.find((p, i) => i > 0 && Math.abs(p.x - a.pontos[i - 1].x) < 0.01)
  assert.ok(vertical.x > origem.x + origem.largura, "a descida acontece fora do cartão de origem")
})

test("destino abaixo e na mesma coluna: sai pela lateral, entra por cima", () => {
  const a = ancoras(caixa(0, 0), caixa(20, 400))
  // A saída é sempre lateral porque é lá que fica a bolinha. Sair por baixo
  // mandava a linha para dentro do cartão que estiver logo abaixo.
  assert.equal(a.de.lado, "direita")
  assert.equal(a.para.lado, "cima")
})



test("indo para o cartao de baixo, desce pelo lado antes de atravessar", () => {
  const origem = caixa(0, 0)
  const destino = caixa(20, 400)
  const a = ancoras(origem, destino)
  // Nenhum trecho pode voltar para dentro da faixa horizontal da origem
  // depois de sair dela: era isso que cruzava o cartão.
  const dentroDaOrigem = (p) =>
    p.x > origem.x && p.x < origem.x + origem.largura &&
    p.y > origem.y && p.y < origem.y + origem.altura
  assert.equal(a.pontos.slice(1).some(dentroDaOrigem), false,
    `algum trecho voltou para dentro do cartão: ${JSON.stringify(a.pontos)}`)
})

test("o caminho e um path SVG que comeca na ancora de saida", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 200))
  assert.match(a.caminho, /^M /)
  assert.match(a.caminho, / Q /, "os cantos são arredondados, não bicos nem diagonal")
  assert.ok(a.caminho.startsWith(`M ${a.de.x} ${a.de.y}`))
  assert.ok(a.caminho.endsWith(`${a.para.x} ${a.para.y}`))
})

test("o caminho e ortogonal: cada trecho e horizontal ou vertical", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 200))
  for (let i = 1; i < a.pontos.length; i++) {
    const p = a.pontos[i - 1]
    const q = a.pontos[i]
    const reto = Math.abs(p.x - q.x) < 0.01 || Math.abs(p.y - q.y) < 0.01
    assert.ok(reto, `trecho em diagonal de ${JSON.stringify(p)} a ${JSON.stringify(q)}`)
  }
})

test("a linha sai perpendicular da borda antes de virar", () => {
  const a = ancoras(caixa(0, 0), caixa(500, 200))
  assert.equal(a.ladoDe, "direita")
  assert.equal(a.pontos[1].y, a.de.y, "o primeiro trecho acompanha o lado de saída")
  assert.ok(a.pontos[1].x > a.de.x, "e sai para fora do cartão")
  assert.equal(a.pontos.at(-2).y, a.para.y, "o último trecho entra reto na outra borda")
})

test("a perna vertical corre no meio do vao entre as duas caixas", () => {
  const esquerda = caixa(0, 0)
  const direita = caixa(500, 400)
  const a = ancoras(esquerda, direita)
  const vertical = a.pontos.find((p, i) => i > 0 && Math.abs(p.x - a.pontos[i - 1].x) < 0.01)
  const vaoComeca = esquerda.x + esquerda.largura
  const vaoTermina = direita.x
  assert.ok(vertical.x > vaoComeca && vertical.x < vaoTermina,
    `a virada caiu em x=${vertical.x}, fora do vão ${vaoComeca}–${vaoTermina}: é assim que a linha passa por cima de um cartão`)
})

test("cantos nao estouram trechos curtos", () => {
  // Caixas quase encostadas: o raio precisa encolher, senão o arco passa do
  // fim do trecho e a linha dá um nó.
  const a = ancoras(caixa(0, 0), caixa(160, 20))
  assert.equal(/NaN|Infinity/.test(a.caminho), false, a.caminho)
  const numeros = a.caminho.match(/-?[\d.]+/g).map(Number)
  assert.ok(numeros.every(Number.isFinite))
})

test("grupo que aponta para si mesmo nao vira caminho degenerado", () => {
  const c = caixa(100, 100)
  const a = ancoras(c, c)
  assert.ok(a.caminho.length > 10)
  assert.notEqual(a.de.lado, a.para.lado, "entrada e saída no mesmo lado desenham uma linha invisível")
})

// --- enquadrar -------------------------------------------------------------

test("enquadrar poe todo o conteudo dentro da area visivel", () => {
  const caixas = [caixa(0, 0), caixa(320, 1020), caixa(900, 400)]
  const v = enquadrar(caixas, { largura: 1000, altura: 800 })
  for (const c of caixas) {
    const a = paraTela(v, { x: c.x, y: c.y })
    const b = paraTela(v, { x: c.x + c.largura, y: c.y + c.altura })
    assert.ok(a.x >= -0.5 && a.y >= -0.5, `canto superior fora: ${JSON.stringify(a)}`)
    assert.ok(b.x <= 1000.5 && b.y <= 800.5, `canto inferior fora: ${JSON.stringify(b)}`)
  }
})

test("enquadrar centra o conteudo", () => {
  const caixas = [caixa(0, 0)]
  const v = enquadrar(caixas, { largura: 1000, altura: 800 })
  const centro = paraTela(v, { x: 130, y: 60 })   // centro da caixa 260x120
  perto(centro.x, 500, 1)
  perto(centro.y, 400, 1)
})

test("fluxo pequeno nao e ampliado alem do tamanho natural", () => {
  const v = enquadrar([caixa(0, 0)], { largura: 2000, altura: 2000 })
  assert.equal(v.escala, 1, "ampliar um fluxo de um cartão só deixaria tudo gigante")
})

test("fluxo grande e reduzido ate caber, respeitando o chao da escala", () => {
  const v = enquadrar([caixa(0, 0), caixa(20000, 20000)], { largura: 800, altura: 600 })
  assert.ok(v.escala < 1)
  assert.ok(v.escala >= ESCALA_MIN)
})

test("sem caixa nenhuma devolve a vista inicial", () => {
  assert.deepEqual(enquadrar([], { largura: 800, altura: 600 }), criarVista())
})

test("area sem tamanho ainda devolve vista utilizavel", () => {
  const v = enquadrar([caixa(0, 0)], { largura: 0, altura: 0 })
  assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && v.escala > 0)
})

// --- quem está sob o ponto -------------------------------------------------

test("caixaEm acha o grupo sob o ponto", () => {
  const mapa = new Map([["g1", caixa(0, 0)], ["g2", caixa(400, 200)]])
  assert.equal(caixaEm(mapa, { x: 10, y: 10 }), "g1")
  assert.equal(caixaEm(mapa, { x: 500, y: 250 }), "g2")
})

test("ponto no vazio nao e grupo nenhum", () => {
  const mapa = new Map([["g1", caixa(0, 0)]])
  assert.equal(caixaEm(mapa, { x: 999, y: 999 }), null)
})

test("a borda conta como dentro", () => {
  const mapa = new Map([["g1", caixa(0, 0)]])
  assert.equal(caixaEm(mapa, { x: 260, y: 120 }), "g1")
})

test("com caixas sobrepostas, a de cima vence", () => {
  const mapa = new Map([["debaixo", caixa(0, 0)], ["emcima", caixa(10, 10)]])
  assert.equal(caixaEm(mapa, { x: 50, y: 50 }), "emcima",
    "a última desenhada é a que a pessoa vê e acha que está clicando")
})

// --- ponta da seta ---------------------------------------------------------

test("a ponta aponta para dentro da caixa que recebe a ligacao", () => {
  // Entrando pela esquerda, o bico fica no ponto e a base à esquerda dele.
  const d = pontaDaSeta({ x: 100, y: 50 }, "esquerda", 10)
  const pontos = d.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.deepEqual(pontos.slice(0, 2), [100, 50], "o bico fica no ponto de encontro")
  assert.ok(pontos[2] < 100 && pontos[4] < 100, "a base fica atrás do bico")
  assert.notEqual(pontos[3], pontos[5], "a base tem largura")
})

test("a ponta gira com o lado de chegada", () => {
  const porCima = pontaDaSeta({ x: 100, y: 50 }, "cima", 10)
  const pontos = porCima.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.deepEqual(pontos.slice(0, 2), [100, 50])
  assert.ok(pontos[3] < 50 && pontos[5] < 50, "entrando por cima, a base fica acima")
  assert.notEqual(pontos[2], pontos[4], "a base tem largura")
})

test("lado desconhecido nao derruba o desenho", () => {
  assert.match(pontaDaSeta({ x: 0, y: 0 }, undefined, 8), /^M 0 0 L/)
})

test("ancoras dizem por onde a seta sai e por onde chega", () => {
  const a = { x: 0, y: 0, largura: 100, altura: 50 }
  const b = { x: 400, y: 0, largura: 100, altura: 50 }
  const { ladoDe, ladoPara } = ancoras(a, b)
  assert.equal(ladoDe, "direita")
  assert.equal(ladoPara, "esquerda")
})

// --- ímã -------------------------------------------------------------------

test("com margem, chegar perto do cartao ja conta como acertar", () => {
  const mapa = new Map([["g1", { x: 100, y: 100, largura: 60, altura: 40 }]])
  const quaseEmCima = { x: 90, y: 110 }
  assert.equal(caixaEm(mapa, quaseEmCima), null, "sem ímã, só o encaixe exato")
  assert.equal(caixaEm(mapa, quaseEmCima, 20), "g1", "com ímã, 10px fora conta")
  assert.equal(caixaEm(mapa, { x: 40, y: 110 }, 20), null, "longe continua longe")
})

test("com pouco vao, a virada fica no vao e nao dentro dos cartoes", () => {
  // Vão de 20px entre os dois: menor que o toco. Virar na ponta do toco
  // colocaria a perna vertical dentro de um dos cartões.
  const esquerda = caixa(0, 0)
  const direita = caixa(280, 300)
  const a = ancoras(esquerda, direita)
  const vertical = a.pontos.find((p, i) => i > 0 && Math.abs(p.x - a.pontos[i - 1].x) < 0.01)
  assert.ok(vertical.x > esquerda.x + esquerda.largura && vertical.x < direita.x,
    `a virada caiu em x=${vertical.x}, e o vão é ${esquerda.x + esquerda.largura}–${direita.x}`)
})

test("indo para o cartao de baixo, a linha afasta antes de descer", () => {
  // Mesma coluna: sai pela direita, desce no corredor e entra por cima. Se o
  // toco não existisse, ela viraria rente à borda e pareceria saída torta.
  const origem = caixa(0, 0)
  const a = ancoras(origem, caixa(20, 400))
  const primeiroCanto = a.pontos[1]
  assert.equal(primeiroCanto.y, a.de.y, "o primeiro trecho é horizontal")
  assert.ok(primeiroCanto.x - a.de.x >= 15,
    `virou a ${primeiroCanto.x - a.de.x}px da borda`)
  assert.ok(primeiroCanto.x > origem.x + origem.largura, "e fora do cartão")
})

test("caminhoComCantos nunca passa do fim de um trecho curto", () => {
  // Trechos de 8px com raio 10: o arco tem de encolher.
  const pontos = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 16, y: 8 }]
  const d = caminhoComCantos(pontos, 10)
  const paradas = [...d.matchAll(/L (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
  for (const p of paradas) {
    assert.ok(p.x >= -0.01 && p.x <= 16.01 && p.y >= -0.01 && p.y <= 8.01,
      `o caminho saiu da polilinha em ${JSON.stringify(p)}: ${d}`)
  }
})

test("linha reta nao tem canto: nada a arredondar", () => {
  // Cartões lado a lado, na mesma altura: o caminho é uma reta.
  const a = ancoras(caixa(0, 0), caixa(500, 0))
  assert.equal(a.pontos.length, 2, `canto onde não há virada: ${JSON.stringify(a.pontos)}`)
  assert.equal(/Q/.test(a.caminho), false, a.caminho)
})
