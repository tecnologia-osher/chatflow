// O editor lê o fluxo e devolve o que o canvas desenha: cartões e setas.
// Lógica pura, sem DOM — é aqui que mora a chance de errar em silêncio.

import { test } from "node:test"
import assert from "node:assert/strict"
import { cartoes, setas, caixas, caixaDoBloco, blocoEmCaixa, MEDIDAS } from "../editor/modelo.js"

const fluxo = {
  versao: 2,
  eventos: [
    { tipo: "inicio", posicao: { x: 40, y: 40 }, proximo: "g1" },
    { tipo: "invalido", posicao: { x: 40, y: 300 }, apos_tentativas: 2, proximo: "g_ajuda" }
  ],
  grupos: [
    {
      id: "g1", titulo: "Abertura", posicao: { x: 320, y: 40 },
      blocos: [
        { id: "b_ola", tipo: "texto", conteudo: { texto: "Olá. Tudo bem por aí?" } },
        { id: "b_nome", tipo: "entrada_texto", conteudo: { placeholder: "Seu nome" }, salvar_em: "nome" }
      ],
      proximo: "g2"
    },
    {
      id: "g2", titulo: "Escolha", posicao: { x: 700, y: 40 },
      blocos: [
        { id: "b_op", tipo: "entrada_botoes", salvar_em: "bem", conteudo: { opcoes: [
          { id: "o1", label: "Imóvel", proximo: "g3" },
          { id: "o2", label: "Não sei" }
        ] } },
        { id: "b_cond", tipo: "condicao", conteudo: { regras: [
          { se: { variavel: "bem", vazio: true }, entao: "g_ajuda" }
        ] } }
      ],
      proximo: "g3"
    },
    { id: "g3", titulo: "Fim", posicao: { x: 1080, y: 40 }, blocos: [] },
    { id: "g_ajuda", titulo: "Ajuda", posicao: { x: 320, y: 300 }, blocos: [], proximo: "g3" }
  ]
}

test("cada grupo vira um cartao com posicao e blocos", () => {
  const c = cartoes(fluxo)
  assert.deepEqual(c.map((x) => x.id), ["g1", "g2", "g3", "g_ajuda"])
  assert.deepEqual(c[0].posicao, { x: 320, y: 40 })
  assert.equal(c[0].titulo, "Abertura")
  assert.equal(c[0].blocos.length, 2)
})

test("grupo sem posicao ganha uma, para nao empilhar tudo na origem", () => {
  const sem = { ...fluxo, grupos: [{ id: "x", blocos: [] }, { id: "y", blocos: [] }] }
  const c = cartoes(sem)
  assert.ok(c[0].posicao && typeof c[0].posicao.x === "number")
  assert.notDeepEqual(c[0].posicao, c[1].posicao, "dois cartões no mesmo lugar ficam invisíveis")
})

test("cada bloco leva o rotulo do tipo e um resumo do que ele diz", () => {
  const [g1] = cartoes(fluxo)
  assert.equal(g1.blocos[0].rotulo, "Texto")
  assert.match(g1.blocos[0].resumo, /Olá/)
  assert.equal(g1.blocos[1].rotulo, "Texto")   // entrada_texto também se chama "Texto"
  assert.match(g1.blocos[1].resumo, /Seu nome/)
})

test("resumo longo e cortado para caber no cartao", () => {
  const longo = { ...fluxo, grupos: [{ id: "g", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "texto", conteudo: { texto: "x".repeat(200) } }] }] }
  assert.ok(cartoes(longo)[0].blocos[0].resumo.length < 90)
})

test("bloco de tipo desconhecido nao derruba o canvas", () => {
  const torto = { ...fluxo, grupos: [{ id: "g", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "inventado", conteudo: {} }] }] }
  const b = cartoes(torto)[0].blocos[0]
  assert.equal(b.rotulo, "inventado")
  assert.equal(b.desconhecido, true)
})

test("seta do proximo do grupo", () => {
  const s = setas(fluxo)
  const g1g2 = s.find((x) => x.de === "g1" && x.para === "g2")
  assert.ok(g1g2)
  assert.deepEqual(g1g2.origens, ["grupo"])
})

test("seta de opcao de botao e de condicao", () => {
  const s = setas(fluxo)
  // A ordem das origens não é contrato — duas saídas para o mesmo grupo
  // viram uma seta só, dizendo de onde cada uma veio.
  assert.deepEqual(
    s.find((x) => x.de === "g2" && x.para === "g3").origens.slice().sort(),
    ["grupo", "opcao"]
  )
  assert.deepEqual(s.find((x) => x.de === "g2" && x.para === "g_ajuda").origens, ["condicao"])
})

test("os eventos entram como setas, com de nulo", () => {
  const s = setas(fluxo)
  const inicio = s.find((x) => x.evento === "inicio")
  assert.equal(inicio.de, null)
  assert.equal(inicio.para, "g1")
  assert.ok(s.some((x) => x.evento === "invalido" && x.para === "g_ajuda"))
})

test("destino inexistente vira seta marcada, nao some", () => {
  const quebrado = { ...fluxo, grupos: [
    { id: "g", posicao: { x: 0, y: 0 }, blocos: [], proximo: "g_fantasma" }] }
  const s = setas(quebrado).find((x) => x.para === "g_fantasma")
  assert.equal(s.orfa, true, "seta para o nada precisa aparecer, é assim que se vê o erro")
})

test("nao duplica seta quando dois caminhos levam ao mesmo grupo", () => {
  const s = setas(fluxo).filter((x) => x.de === "g2" && x.para === "g3")
  assert.equal(s.length, 1)
})

// --- caixas ----------------------------------------------------------------

test("a caixa do cartao cresce com a quantidade de blocos", () => {
  const mapa = caixas(cartoes(fluxo))
  assert.ok(mapa.get("g1").altura > mapa.get("g3").altura,
    "grupo com dois blocos precisa ser mais alto que um vazio")
  assert.equal(mapa.get("g1").x, 320)
  assert.ok(mapa.get("g1").largura > 0)
})

test("a caixa existe para todo cartao, inclusive o vazio", () => {
  const mapa = caixas(cartoes(fluxo))
  for (const c of cartoes(fluxo)) assert.ok(mapa.get(c.id), `sem caixa para ${c.id}`)
})

test("a caixa conta cada opcao empilhada, e o padrao que fecha a lista", () => {
  const comDuas = { id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }, { id: "o2" }] }] }
  const comQuatro = { ...comDuas, blocos: [
    { id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }, { id: "o2" }, { id: "o3" }, { id: "o4" }] }] }
  const [a, b] = [caixas([comDuas]).get("g").altura, caixas([comQuatro]).get("g").altura]
  assert.equal(b - a, 2 * MEDIDAS.CARTAO_OPCAO, "duas opções a mais, duas linhas a mais")
  assert.ok(a > MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_RODAPE + 2 * MEDIDAS.CARTAO_OPCAO,
    "a linha do + botão também ocupa altura")
})

test("resumo que nao cabe numa linha deixa o bloco mais alto", () => {
  const curto = { id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "texto", resumo: "Oi" }] }
  const longo = { ...curto, blocos: [
    { id: "b", tipo: "texto", resumo: "Bem-vindo à Osher Capital, queremos te conhecer melhor." }] }
  assert.equal(caixas([longo]).get("g").altura - caixas([curto]).get("g").altura,
    MEDIDAS.CARTAO_LINHA, "uma linha de texto a mais, uma linha de altura a mais")
})

test("todo cartao cobra o rodape, porque todo cartao tem uma saida", () => {
  const base = { id: "g", titulo: "x", posicao: { x: 0, y: 0 } }
  const comBotoes = { ...base, blocos: [{ id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }] }] }
  const semBotoes = { ...base, blocos: [{ id: "b", tipo: "texto", resumo: "Oi" }] }
  assert.equal(caixas([semBotoes]).get("g").altura,
    MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_BLOCO + MEDIDAS.CARTAO_LINHA + MEDIDAS.CARTAO_RODAPE)
  assert.equal(caixas([comBotoes]).get("g").altura,
    MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_OPCOES_TOPO + 2 * MEDIDAS.CARTAO_OPCAO +
    MEDIDAS.CARTAO_RODAPE)
})

test("resumo sem espaco onde quebrar conta as linhas igual, nao vira uma so", () => {
  // A URL do WhatsApp não tem espaço: ela quebra no meio da palavra e ocupa
  // três linhas no cartão. Enquanto o modelo contava uma, o cartão vinha 32px
  // mais baixo do que é — e no desenho o link saía pela direita.
  const link = "https://wa.me/5561999699829?text=Ola,%20vim%20do%20site%20e%20quero%20falar"
  const cartao = { id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "redirecionar", resumo: link }] }
  const esperado = MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_RODAPE +
    MEDIDAS.CARTAO_BLOCO + 3 * MEDIDAS.CARTAO_LINHA
  assert.equal(caixas([cartao]).get("g").altura, esperado)
})

// --- campo principal -------------------------------------------------------

test("o campo principal e o primeiro texto que o tipo declara", async () => {
  const { campoPrincipal } = await import("../editor/modelo.js")
  assert.equal(campoPrincipal("texto"), "texto")
  assert.equal(campoPrincipal("entrada_texto"), "placeholder")
  assert.equal(campoPrincipal("ir_para"), "destino")
  assert.equal(campoPrincipal("redirecionar"), "url")
})

test("tipo sem campo de texto nao tem principal", async () => {
  const { campoPrincipal } = await import("../editor/modelo.js")
  assert.equal(campoPrincipal("condicao"), null, "regras se editam em lista, não numa caixa")
  assert.equal(campoPrincipal("entrada_botoes"), null, "o que importa nos botões são as opções")
  assert.equal(campoPrincipal("inventado"), null)
})

test("o cartao diz qual campo cada bloco edita direto", () => {
  const c = cartoes(fluxo)
  assert.equal(c[0].blocos[0].campoPrincipal, "texto")
  assert.equal(c[1].blocos[0].campoPrincipal, null)   // entrada_botoes
})

// --- eventos como cartões --------------------------------------------------

test("o inicio vira um cartao proprio, com bandeira", async () => {
  const { eventosDoCanvas } = await import("../editor/modelo.js")
  const inicio = eventosDoCanvas(fluxo).find((e) => e.tipo === "inicio")
  assert.ok(inicio)
  assert.equal(inicio.rotulo, "Start")
  assert.equal(inicio.icone, "⚑")
  assert.deepEqual(inicio.posicao, { x: 40, y: 40 })
  assert.equal(inicio.proximo, "g1")
})

test("fluxo do zero ja nasce com o Start na tela", async () => {
  const { eventosDoCanvas } = await import("../editor/modelo.js")
  const vazio = { versao: 2, grupos: [] }
  const eventos = eventosDoCanvas(vazio)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0].tipo, "inicio")
  assert.equal(eventos[0].proximo, null, "nasce sem destino, esperando ser ligado")
  assert.ok(Number.isFinite(eventos[0].posicao.x), "sem posição gravada, ganha uma")
})

test("os outros eventos tambem aparecem, com o proprio rotulo", async () => {
  const { eventosDoCanvas } = await import("../editor/modelo.js")
  const invalido = eventosDoCanvas(fluxo).find((e) => e.tipo === "invalido")
  assert.ok(invalido, "quem edita precisa ver para onde vai quem erra a resposta")
  assert.equal(invalido.rotulo, "Resposta inválida")
})

test("a caixa do evento serve de ancora para a seta", async () => {
  const { eventosDoCanvas, caixasDeEventos } = await import("../editor/modelo.js")
  const mapa = caixasDeEventos(eventosDoCanvas(fluxo))
  assert.ok(mapa.get("inicio").largura > 0 && mapa.get("inicio").altura > 0)
})

// --- os fluxos que o editor abre de verdade --------------------------------

// Cartão que cobre cartão não recebe clique: foi assim que o "padrão" do grupo
// de idade ficou inalcançável, escondido embaixo do cartão seguinte. Vale para
// todo fluxo versionado aqui — o do cliente e o exemplo, que é o que abre
// quando ninguém diz `?cliente=`.
const { readFileSync, readdirSync } = await import("node:fs")

const arquivosDeFluxo = [
  new URL("../exemplos/captacao-simples.json", import.meta.url),
  ...readdirSync(new URL("../clientes", import.meta.url), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => new URL(`../clientes/${e.name}/fluxo.json`, import.meta.url))
]

for (const arquivo of arquivosDeFluxo) {
  const nome = arquivo.pathname.split("/").slice(-2).join("/")
  test(`nenhum cartao cobre outro em ${nome}`, () => {
    const lista = [...caixas(cartoes(JSON.parse(readFileSync(arquivo)))).entries()]
      .map(([id, c]) => ({ id, ...c }))
    assert.ok(lista.length > 0, "fluxo sem grupos não prova nada")
    const colisoes = []
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i], b = lista[j]
        if (a.x < b.x + b.largura && b.x < a.x + a.largura &&
            a.y < b.y + b.altura && b.y < a.y + a.altura) colisoes.push(`${a.id} x ${b.id}`)
      }
    }
    assert.deepEqual(colisoes, [])
  })
}

// --- faixa de cada bloco ---------------------------------------------------

const cartaoDeTres = {
  id: "g", titulo: "x", posicao: { x: 100, y: 50 },
  blocos: [
    { id: "b1", tipo: "texto", resumo: "Oi" },
    { id: "b2", tipo: "texto", resumo: "Qual seu WhatsApp?" },
    { id: "b3", tipo: "texto", resumo: "Obrigado" }
  ]
}

test("a caixa do cartao traz a faixa de cada bloco, em ordem e sem buraco", () => {
  const caixa = caixas([cartaoDeTres]).get("g")
  assert.deepEqual(caixa.blocos.map((b) => b.id), ["b1", "b2", "b3"])
  assert.equal(caixa.blocos[0].y, MEDIDAS.CARTAO_CABECALHO, "a primeira faixa começa sob o cabeçalho")
  for (let i = 1; i < caixa.blocos.length; i++) {
    assert.equal(caixa.blocos[i].y, caixa.blocos[i - 1].y + caixa.blocos[i - 1].altura,
      "faixa com buraco faz a seta chegar no lugar errado")
  }
})

test("caixaDoBloco devolve a faixa daquele bloco, no fluxo", () => {
  const caixa = caixas([cartaoDeTres]).get("g")
  const faixa = caixaDoBloco(caixa, "b2")
  assert.equal(faixa.x, caixa.x)
  assert.equal(faixa.y, caixa.y + caixa.blocos[1].y)
  assert.equal(faixa.altura, caixa.blocos[1].altura)
  assert.ok(faixa.altura < caixa.altura, "a faixa é menor que o cartão")
})

test("caixaDoBloco sem bloco, ou com bloco que nao existe, devolve o cartao", () => {
  const caixa = caixas([cartaoDeTres]).get("g")
  assert.deepEqual(caixaDoBloco(caixa, null), caixa)
  assert.deepEqual(caixaDoBloco(caixa, "b_sumiu"), caixa)
  assert.equal(caixaDoBloco(null, "b1"), null)
})

test("blocoEmCaixa acha o bloco sob o ponto", () => {
  const caixa = caixas([cartaoDeTres]).get("g")
  const meioDe = (i) => ({ x: caixa.x + 10, y: caixa.y + caixa.blocos[i].y + caixa.blocos[i].altura / 2 })
  assert.equal(blocoEmCaixa(caixa, meioDe(0)), "b1")
  assert.equal(blocoEmCaixa(caixa, meioDe(1)), "b2")
  assert.equal(blocoEmCaixa(caixa, meioDe(2)), "b3")
})

test("cabecalho e rodape nao sao bloco: ali o alvo e o grupo", () => {
  const caixa = caixas([cartaoDeTres]).get("g")
  assert.equal(blocoEmCaixa(caixa, { x: caixa.x + 10, y: caixa.y + 5 }), null, "cabeçalho")
  assert.equal(blocoEmCaixa(caixa, { x: caixa.x + 10, y: caixa.y + caixa.altura - 5 }), null, "rodapé")
})

test("seta para bloco que existe nao e orfa; para bloco que nao existe, e", () => {
  const base = {
    versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      { id: "g1", titulo: "a", posicao: { x: 0, y: 0 }, proximo: "g2#b_um", blocos: [] },
      { id: "g2", titulo: "b", posicao: { x: 400, y: 0 }, blocos: [
        { id: "b_um", tipo: "texto", conteudo: { texto: "Um" } }] }
    ]
  }
  const boa = setas(base).find((s) => s.de === "g1")
  assert.equal(boa.orfa, false)
  assert.equal(boa.para, "g2#b_um", "a seta guarda o destino inteiro")

  const quebrada = JSON.parse(JSON.stringify(base))
  quebrada.grupos[0].proximo = "g2#b_sumiu"
  assert.equal(setas(quebrada).find((s) => s.de === "g1").orfa, true,
    "bloco que não existe mais leva o lead para o lugar errado: tem de aparecer")
})
