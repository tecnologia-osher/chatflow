// O editor lê o fluxo e devolve o que o canvas desenha: cartões e setas.
// Lógica pura, sem DOM — é aqui que mora a chance de errar em silêncio.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  cartoes, setas, caixas, caixaDoBloco, caixaDaSaida, comConector, blocoEmCaixa,
  alturaDoCartao, MEDIDAS
} from "../editor/modelo.js"

// As medidas saíram do Chrome e são fracionárias (0.3rem = 4,8px). Comparar
// float por igualdade é brigar com a IEEE, não com o modelo: 79.2 calculado
// por somas vira 79.19999999999999.
function perto(a, b, recado, folga = 0.001) {
  assert.ok(Math.abs(a - b) <= folga, `${recado} (${a} vs ${b})`)
}


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

test("seta de opcao de botao e de condicao, cada uma do seu conector", () => {
  const s = setas(fluxo)
  // Duas saídas para o mesmo grupo são duas setas: elas partem de alturas
  // diferentes do cartão (a linha da opção e o rodapé), e juntá-las numa só
  // escondia uma das duas.
  const paraG3 = s.filter((x) => x.de === "g2" && x.para === "g3")
  assert.deepEqual(paraG3.map((x) => x.origens[0]).sort(), ["grupo", "opcao"])
  const daOpcao = paraG3.find((x) => x.origens[0] === "opcao")
  assert.deepEqual(daOpcao.saida, { bloco: "b_op", opcao: "o1" }, "a seta diz de qual bolinha saiu")
  assert.equal(paraG3.find((x) => x.origens[0] === "grupo").saida, null, "a saída do grupo não tem bloco")

  const daCondicao = s.find((x) => x.de === "g2" && x.para === "g_ajuda")
  assert.deepEqual(daCondicao.origens, ["condicao"])
  assert.deepEqual(daCondicao.saida, { bloco: "b_cond" })
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

test("o mesmo conector nao vira duas setas, mesmo com duas regras iguais", () => {
  const duasRegras = JSON.parse(JSON.stringify(fluxo))
  duasRegras.grupos[1].blocos[1].conteudo.regras.push(
    { se: { variavel: "bem", vazio: false }, entao: "g_ajuda" })
  const s = setas(duasRegras).filter((x) => x.de === "g2" && x.para === "g_ajuda")
  assert.equal(s.length, 1, "o bloco de condição tem uma bolinha só: duas setas dali seriam a mesma")
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
  perto(b - a, 2 * MEDIDAS.CARTAO_OPCAO, "duas opções a mais, duas linhas a mais")
  assert.ok(a > MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_RODAPE + 2 * MEDIDAS.CARTAO_OPCAO,
    "a linha do + botão também ocupa altura")
})

test("resumo que nao cabe numa linha deixa o bloco mais alto", () => {
  const curto = { id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "texto", resumo: "Oi" }] }
  const deDuas = { ...curto, blocos: [
    { id: "b", tipo: "texto", resumo: "a".repeat(MEDIDAS.CARTAO_CARACTERES_POR_LINHA + 1) }] }
  // Com folga: a soma em ponto flutuante devolve 18,700000000000003, e o que
  // está sendo verificado é a regra, não a última casa do binário.
  const aMais = caixas([deDuas]).get("g").altura - caixas([curto]).get("g").altura
  assert.ok(Math.abs(aMais - MEDIDAS.CARTAO_LINHA) < 0.001,
    `uma linha de texto a mais, uma linha de altura a mais: deu ${aMais}`)
})

test("todo cartao tem rodape, mais baixo quando nao ha padrao a nomear", () => {
  const base = { id: "g", titulo: "x", posicao: { x: 0, y: 0 } }
  const comBotoes = { ...base, blocos: [{ id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }] }] }
  const semBotoes = { ...base, blocos: [{ id: "b", tipo: "texto", resumo: "Oi" }] }
  assert.equal(caixas([semBotoes]).get("g").altura,
    MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_BLOCO + MEDIDAS.CARTAO_LINHA +
    MEDIDAS.CARTAO_RODAPE_SO_BOLINHA)
  assert.equal(caixas([comBotoes]).get("g").altura,
    MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_OPCOES_TOPO + 2 * MEDIDAS.CARTAO_OPCAO +
    MEDIDAS.CARTAO_RODAPE)
  assert.ok(MEDIDAS.CARTAO_RODAPE_SO_BOLINHA < MEDIDAS.CARTAO_RODAPE)
})

test("resumo sem espaco onde quebrar conta as linhas igual, nao vira uma so", () => {
  // A URL do WhatsApp não tem espaço: ela quebra no meio da palavra e ocupa
  // três linhas no cartão. Enquanto o modelo contava uma, o cartão vinha 32px
  // mais baixo do que é — e no desenho o link saía pela direita.
  const link = "https://wa.me/5561999699829?text=Ola,%20vim%20do%20site%20e%20quero%20falar"
  const cartao = { id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "redirecionar", resumo: link }] }
  const linhas = Math.ceil(link.length / MEDIDAS.CARTAO_CARACTERES_POR_LINHA)
  assert.ok(linhas >= 3, "o link é longo o bastante para o teste valer")
  const esperado = MEDIDAS.CARTAO_CABECALHO + MEDIDAS.CARTAO_RODAPE_SO_BOLINHA +
    MEDIDAS.CARTAO_BLOCO + linhas * MEDIDAS.CARTAO_LINHA
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

test("caixaDaSaida acha a linha da opcao, a faixa do bloco e o rodape", () => {
  const cartao = {
    id: "g", titulo: "x", posicao: { x: 10, y: 20 },
    blocos: [
      { id: "b1", tipo: "texto", resumo: "Oi" },
      { id: "b2", tipo: "entrada_botoes", opcoes: [{ id: "o1" }, { id: "o2" }] }
    ]
  }
  const caixa = caixas([cartao]).get("g")

  const daOpcao2 = caixaDaSaida(caixa, { bloco: "b2", opcao: "o2" })
  const daOpcao1 = caixaDaSaida(caixa, { bloco: "b2", opcao: "o1" })
  perto(daOpcao2.y - daOpcao1.y, MEDIDAS.CARTAO_OPCAO,
    "cada opção uma linha abaixo da outra: é o que separa as setas")
  assert.ok(daOpcao1.y > caixa.y + MEDIDAS.CARTAO_CABECALHO, "a linha fica abaixo do cabeçalho")

  const doBloco = caixaDaSaida(caixa, { bloco: "b1" })
  assert.equal(doBloco.y, caixa.y + caixa.blocos[0].y)

  const doRodape = caixaDaSaida(caixa, null)
  assert.equal(doRodape.y, caixa.y + caixa.rodape.y, "sem bloco, a saída é o rodapé")
  assert.ok(doRodape.y > doOpcaoMaisBaixa(caixa), "o rodapé fica embaixo de tudo")

  function doOpcaoMaisBaixa(c) {
    const faixa = c.blocos.find((b) => b.opcoes?.length)
    return c.y + faixa.opcoes.at(-1).y
  }
})

test("caixaDaSaida de opcao que nao existe cai no bloco, e sem cartao da null", () => {
  const caixa = caixas([{ id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }] }] }]).get("g")
  assert.equal(caixaDaSaida(caixa, { bloco: "b", opcao: "o_sumiu" }).y, caixa.y + caixa.blocos[0].y)
  assert.equal(caixaDaSaida(null, null), null)
})

test("cada seta tem chave propria, estavel entre dois desenhos", () => {
  const a = setas(fluxo)
  const b = setas(JSON.parse(JSON.stringify(fluxo)))
  assert.deepEqual(a.map((s) => s.chave), b.map((s) => s.chave), "a chave não pode mudar sozinha")
  assert.equal(new Set(a.map((s) => s.chave)).size, a.length, "duas setas com a mesma chave viram uma")
  const daOpcao = a.find((s) => s.saida?.opcao === "o1")
  assert.notEqual(daOpcao.chave, a.find((s) => s.de === "g2" && s.origens[0] === "grupo").chave,
    "conectores diferentes do mesmo cartão precisam de chaves diferentes")
})

// --- as setas não devem passar por cima dos cartões -------------------------

// A reclamação que trouxe o roteamento ortogonal: a linha de "Idade" para
// "Objetivo" cortava em diagonal por dentro dos outros cartões. Com a virada
// no vão entre as colunas, ela corre no corredor. Vale para os fluxos
// versionados — é neles que o cliente abre o editor.
const { ancoras } = await import("../editor/vista.js")

function trechosDaSeta(mapa, seta) {
  const { partesDoDestino } = globalThis.__destino
  const origem = mapa.get(seta.de)
  const destino = mapa.get(partesDoDestino(seta.para).grupo)
  if (!origem || !destino) return null
  return ancoras(origem, destino).pontos
}

globalThis.__destino = await import("../motor/destino.js")

for (const arquivo of arquivosDeFluxo) {
  const nome = arquivo.pathname.split("/").slice(-2).join("/")
  test(`nenhuma seta de ${nome} atravessa um cartao que nao e a sua ponta`, () => {
    const fluxo = JSON.parse(readFileSync(arquivo))
    const mapa = caixas(cartoes(fluxo))
    const invasoes = []
    for (const seta of setas(fluxo)) {
      const pontos = trechosDaSeta(mapa, seta)
      if (!pontos) continue
      const pontas = new Set([seta.de, globalThis.__destino.partesDoDestino(seta.para).grupo])
      for (let i = 1; i < pontos.length; i++) {
        // Amostra o trecho de 6 em 6 unidades: cartão tem 260 de largura, não
        // há como um trecho atravessá-lo sem cair numa dessas amostras.
        const p = pontos[i - 1], q = pontos[i]
        const passos = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 6)
        for (let k = 0; k <= passos; k++) {
          const x = p.x + ((q.x - p.x) * k) / passos
          const y = p.y + ((q.y - p.y) * k) / passos
          for (const [id, c] of mapa) {
            if (pontas.has(id)) continue
            if (x > c.x && x < c.x + c.largura && y > c.y && y < c.y + c.altura) {
              invasoes.push(`${seta.de} → ${seta.para} passa por ${id}`)
            }
          }
        }
      }
    }
    assert.deepEqual([...new Set(invasoes)], [])
  })
}

test("a caixa de saida chega ate o centro da bolinha, nao a borda do cartao", () => {
  const cartao = { id: "g", titulo: "x", posicao: { x: 100, y: 50 }, blocos: [
    { id: "b", tipo: "entrada_botoes", opcoes: [{ id: "o1" }] }] }
  const caixa = caixas([cartao]).get("g")

  // A bolinha fica para fora do cartão: a seta precisa nascer nela, senão
  // sobra um vão entre a bolinha e o começo do traço e a linha parece sair
  // do cartão.
  for (const saida of [{ bloco: "b", opcao: "o1" }, { bloco: "b" }, null]) {
    const daSaida = caixaDaSaida(caixa, saida)
    assert.equal(daSaida.x + daSaida.largura, caixa.x + caixa.largura + MEDIDAS.CARTAO_CONECTOR,
      `saída ${JSON.stringify(saida)} não alcançou a bolinha`)
  }
  assert.equal(comConector(caixa).largura, caixa.largura + MEDIDAS.CARTAO_CONECTOR)
  assert.equal(comConector(null), null)
})

test("esticar ate a bolinha nao mexe na altura nem no topo", () => {
  const caixa = caixas([{ id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [] }]).get("g")
  const esticada = comConector(caixa)
  assert.equal(esticada.altura, caixa.altura)
  assert.equal(esticada.y, caixa.y)
  assert.equal(esticada.x, caixa.x, "o cartão não anda: só a caixa da saída é mais larga")
})

test("caixa sem rodape, como a do Start, tambem nasce na bolinha", () => {
  // As caixas dos eventos não têm rodapé: a saída cai no fallback, que
  // precisa esticar igual, senão a seta do Start nasce longe da bolinha.
  const doStart = { x: 40, y: 40, largura: 190, altura: 48 }
  const daSaida = caixaDaSaida(doStart, null)
  assert.equal(daSaida.x + daSaida.largura, 40 + 190 + MEDIDAS.CARTAO_CONECTOR)
})

// --- o modelo preso à régua ------------------------------------------------
// O modelo existe para prever a altura de um cartão sem desenhá-lo: é dele que
// saem as âncoras das setas e a prova de que um cartão não cobre o outro.
// Número chutado aqui vira seta apontando para o lugar errado, e nenhum teste
// de relação entre constantes pega isso — só a régua pega.
//
// Medidas tiradas no Chrome em 03/10/2026, no fluxo da Osher a 1440px, já
// divididas pela escala do mundo. "Passo" é o que o cartão anda de um bloco
// para o começo do próximo, que é exatamente o que `alturaDoBloco` responde.
// O passo é a distância entre o topo de um bloco e o topo do próximo — não a
// altura mais as duas margens. Entre vizinhos as margens se fundem, e somar
// as duas dá 4,8px a mais por bloco, que num cartão de cinco blocos vira um
// erro de 24px. Medidos empilhando blocos iguais e lendo a diferença.
const MEDIDO_NO_CHROME = [
  { o: "bloco de uma linha curta", letras: 8, passo: 64.3 },
  { o: "bloco de uma linha", letras: 16, passo: 64.3 },
  { o: "bloco de uma linha cheia", letras: 26, passo: 64.3 },
  { o: "bloco que ainda cabe numa linha", letras: 28, passo: 64.3 },
  { o: "bloco que acabou de quebrar", letras: 29, passo: 83.0 },
  { o: "bloco de duas linhas", letras: 38, passo: 83.0 },
  { o: "bloco de duas linhas cheias", letras: 55, passo: 83.0 },
  { o: "bloco de tres linhas", letras: 60, passo: 101.7 }
]

test("a altura de cada bloco bate com a regua do navegador", () => {
  for (const caso of MEDIDO_NO_CHROME) {
    const cartao = { id: "g", titulo: "x", posicao: { x: 0, y: 0 },
      blocos: [{ id: "b", tipo: "texto", resumo: "a".repeat(caso.letras) }] }
    const previsto = caixas([cartao]).get("g").blocos[0].altura
    assert.ok(Math.abs(previsto - caso.passo) <= 2,
      `${caso.o} (${caso.letras} letras): modelo diz ${previsto}, o Chrome mediu ${caso.passo}`)
  }
})

test("a altura de um cartao inteiro bate com a regua do navegador", () => {
  // O cartão "Abertura" da Osher: três falas, sem botões. 280,2px no Chrome.
  const abertura = { id: "g", titulo: "Abertura", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b1", tipo: "texto", resumo: "a".repeat(55) },
    { id: "b2", tipo: "texto", resumo: "a".repeat(16) },
    { id: "b3", tipo: "texto", resumo: "a".repeat(8) }
  ] }
  assert.ok(Math.abs(alturaDoCartao(abertura) - 280.2) <= 3,
    `o modelo diz ${alturaDoCartao(abertura)}, o Chrome mediu 280.2`)

  // O cartão "Idade": uma fala e um bloco de quatro botões. 381,8px.
  const idade = { id: "g", titulo: "Idade", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b1", tipo: "texto", resumo: "a".repeat(15) },
    { id: "b2", tipo: "entrada_botoes", opcoes: [{ id: "o1" }, { id: "o2" }, { id: "o3" }, { id: "o4" }] }
  ] }
  assert.ok(Math.abs(alturaDoCartao(idade) - 381.8) <= 3,
    `o modelo diz ${alturaDoCartao(idade)}, o Chrome mediu 381.8`)
})

test("o lapis da opcao nao engorda a linha dela", () => {
  // A escolha visual ganhou um botão dentro de cada linha de opção. Medidos no
  // Chrome, os dois cartões dão 317,52px — o lápis é mais baixo que o campo e
  // não empurra nada. Se um dia empurrar, o modelo passa a mentir sobre a
  // altura e as setas chegam no lugar errado.
  const quatro = (tipo) => ({ id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b", tipo, opcoes: [1, 2, 3, 4].map((k) => ({ id: `o${k}` })) }] })
  for (const tipo of ["entrada_botoes", "entrada_imagens", "entrada_cartoes"]) {
    assert.ok(Math.abs(alturaDoCartao(quatro(tipo)) - 317.5) <= 3,
      `${tipo}: o modelo diz ${alturaDoCartao(quatro(tipo))}, o Chrome mediu 317.5`)
  }
})

test("o cartao leva o conteudo do bloco, para a caixa de midia editar", () => {
  const [cartao] = cartoes({
    versao: 2,
    grupos: [{ id: "g", titulo: "x", blocos: [
      { id: "b", tipo: "imagem", conteudo: { url: "foto.png", link_ao_clicar: "https://osher" } }] }]
  })
  assert.deepEqual(cartao.blocos[0].conteudo, { url: "foto.png", link_ao_clicar: "https://osher" })
})

test("bloco sem conteudo nao quebra quem le o conteudo", () => {
  const [cartao] = cartoes({
    versao: 2, grupos: [{ id: "g", titulo: "x", blocos: [{ id: "b", tipo: "imagem" }] }]
  })
  assert.deepEqual(cartao.blocos[0].conteudo, {})
})

test("a caixa do cartao diz onde a seta encosta: a altura do nome", () => {
  const caixa = caixas([{ id: "g", titulo: "Abertura", posicao: { x: 100, y: 200 },
    blocos: [{ id: "b", tipo: "texto", resumo: "Oi" }] }]).get("g")
  assert.equal(caixa.ancoraY, 200 + MEDIDAS.CARTAO_CABECALHO / 2)
  assert.ok(caixa.ancoraY < caixa.y + caixa.altura / 2,
    "a âncora fica no cabeçalho, acima do meio do cartão")
})

test("a faixa de um bloco nao diz altura: ali o meio e o lugar certo", () => {
  const caixa = caixas([{ id: "g", titulo: "x", posicao: { x: 0, y: 0 }, blocos: [
    { id: "b1", tipo: "texto", resumo: "Oi" },
    { id: "b2", tipo: "texto", resumo: "Tchau" }] }]).get("g")
  assert.equal(caixaDoBloco(caixa, "b2").ancoraY, undefined)
})
