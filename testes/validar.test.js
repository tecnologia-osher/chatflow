import { test } from "node:test"
import assert from "node:assert/strict"
import { validarFluxo } from "../motor/validar.js"
import { registrar, limpar } from "../motor/blocos/_registro.js"

function prepararCatalogo() {
  limpar()
  registrar({
    tipo: "texto", categoria: "fala", rotulo: "Texto",
    ramifica: false, salva_variavel: false, campos: []
  })
  registrar({
    tipo: "entrada_texto", categoria: "entrada", rotulo: "Entrada de texto",
    ramifica: false, salva_variavel: true, campos: []
  })
}

function fluxoValido() {
  return {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      {
        id: "g1",
        blocos: [
          { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
          { id: "b2", tipo: "entrada_texto", conteudo: {}, salvar_em: "nome" }
        ],
        proximo: "g2"
      },
      { id: "g2", blocos: [{ id: "b3", tipo: "texto", conteudo: { texto: "Fim" } }] }
    ]
  }
}

test("fluxo correto passa sem erros", () => {
  prepararCatalogo()
  assert.deepEqual(validarFluxo(fluxoValido()), { valido: true, erros: [] })
})

test("sem evento de inicio e invalido", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos = []
  const r = validarFluxo(f)
  assert.equal(r.valido, false)
  assert.match(r.erros.join(" "), /início/i)
})

test("inicio apontando para grupo inexistente", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos[0].proximo = "g_fantasma"
  assert.match(validarFluxo(f).erros.join(" "), /g_fantasma/)
})

test("ids de grupo duplicados", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[1].id = "g1"
  assert.match(validarFluxo(f).erros.join(" "), /duplicad/i)
})

test("ids de bloco duplicados dentro do mesmo grupo", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].blocos[1].id = "b1"
  assert.match(validarFluxo(f).erros.join(" "), /b1/)
})

test("proximo orfao", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].proximo = "g_nao_existe"
  assert.match(validarFluxo(f).erros.join(" "), /g_nao_existe/)
})

test("grupo inalcancavel", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos.push({ id: "g_orfao", blocos: [] })
  assert.match(validarFluxo(f).erros.join(" "), /g_orfao/)
})

test("grupo alcancado apenas por um evento nao e orfao", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push({ tipo: "invalido", apos_tentativas: 2, proximo: "g_ajuda" })
  f.grupos.push({
    id: "g_ajuda",
    blocos: [{ id: "b_aj", tipo: "texto", conteudo: { texto: "Vamos seguir." } }],
    proximo: "g2"
  })
  assert.deepEqual(validarFluxo(f).erros, [])
})

test("evento apontando para grupo inexistente e erro", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push({ tipo: "invalido", proximo: "g_nao_existe" })
  assert.match(validarFluxo(f).erros.join(" "), /g_nao_existe/)
})

test("ciclo com saida e aceito", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      {
        id: "g1",
        blocos: [{
          id: "b1", tipo: "entrada_texto", conteudo: {}, salvar_em: "x"
        }],
        proximo: "g2"
      },
      {
        id: "g2",
        blocos: [{
          id: "b2", tipo: "condicao",
          conteudo: { regras: [{ se: { variavel: "x", vazio: true }, entao: "g1" }] }
        }],
        proximo: "g3"
      },
      { id: "g3", blocos: [] }
    ]
  }
  registrar({
    tipo: "condicao", categoria: "logica", rotulo: "Condição",
    ramifica: true, salva_variavel: false, campos: []
  })
  assert.equal(validarFluxo(f).valido, true)
})

test("tipo de bloco fora do catalogo", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].blocos[0].tipo = "inventado"
  assert.match(validarFluxo(f).erros.join(" "), /inventado/)
})

test("input sem salvar_em", () => {
  prepararCatalogo()
  const f = fluxoValido()
  delete f.grupos[0].blocos[1].salvar_em
  assert.match(validarFluxo(f).erros.join(" "), /salvar_em|variável/i)
})

test("webhook apontando para destino inexistente", () => {
  prepararCatalogo()
  registrar({
    tipo: "webhook", categoria: "conexao", rotulo: "Webhook",
    ramifica: false, salva_variavel: false, campos: []
  })
  const f = fluxoValido()
  f.grupos[1].blocos.push({
    id: "b4", tipo: "webhook", conteudo: { destino: "crm" }
  })
  const r = validarFluxo(f, { destinos: { planilha: {} } })
  assert.match(r.erros.join(" "), /crm/)
})

test("acumula varios erros de uma vez", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].proximo = "g_x"
  f.grupos[0].blocos[0].tipo = "inventado"
  const texto = validarFluxo(f).erros.join(" ")
  assert.match(texto, /inventado/)
  assert.match(texto, /g_x/)
})

test("grupo nulo na lista de grupos nao lanca e gera erro", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [null]
  }
  let r
  assert.doesNotThrow(() => { r = validarFluxo(f) })
  assert.equal(r.valido, false)
  assert.match(r.erros.join(" "), /nul[oa]/i)
})

test("bloco nulo dentro de um grupo nao lanca e gera erro", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [{ id: "g1", blocos: [null] }]
  }
  let r
  assert.doesNotThrow(() => { r = validarFluxo(f) })
  assert.equal(r.valido, false)
  assert.match(r.erros.join(" "), /nul[oa]/i)
})

test("ciclo sem saida gera beco sem saida para cada grupo", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      { id: "g1", blocos: [], proximo: "g2" },
      { id: "g2", blocos: [], proximo: "g1" }
    ]
  }
  const r = validarFluxo(f)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some((e) => e.includes('"g1"') && /beco sem saída/i.test(e)))
  assert.ok(r.erros.some((e) => e.includes('"g2"') && /beco sem saída/i.test(e)))
})

test("inicio quebrado nao esconde becos sem saida alcancaveis por outro evento", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [
      { tipo: "inicio", proximo: "nope" },
      { tipo: "invalido", proximo: "g1" }
    ],
    grupos: [
      { id: "g1", blocos: [], proximo: "g2" },
      { id: "g2", blocos: [], proximo: "g1" }
    ]
  }
  const r = validarFluxo(f)
  const texto = r.erros.join(" ")
  assert.match(texto, /nope/)
  assert.ok(r.erros.some((e) => e.includes('"g1"') && /beco sem saída/i.test(e)))
  assert.ok(r.erros.some((e) => e.includes('"g2"') && /beco sem saída/i.test(e)))
})

test("evento nulo na lista de eventos nao lanca e gera erro", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push(null)
  let r
  assert.doesNotThrow(() => { r = validarFluxo(f) })
  assert.equal(r.valido, false)
  assert.match(r.erros.join(" "), /Evento nulo.*posição 1/)
})

test("evento nulo nao impede a checagem do resto do fluxo", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push(null)
  f.grupos[0].proximo = "g_nao_existe"
  const erros = validarFluxo(f).erros.join(" ")
  assert.match(erros, /Evento nulo/)
  assert.match(erros, /g_nao_existe/)
})
