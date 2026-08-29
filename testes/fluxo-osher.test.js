import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { limpar } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"
import { validarFluxo } from "../motor/validar.js"
import {
  criarEstado, aplicarResposta, avancar, destinoDaResposta, destinoDaLogica,
  contexto, blocoAtual
} from "../motor/percurso.js"

const fluxo = JSON.parse(readFileSync(new URL("../clientes/osher/fluxo.json", import.meta.url)))
const destinos = JSON.parse(readFileSync(new URL("../clientes/osher/destinos.json", import.meta.url)))

function preparar() {
  limpar()
  registrarTodos()
}

test("o fluxo da Osher e valido", () => {
  preparar()
  const r = validarFluxo(fluxo, { destinos: destinos.destinos })
  assert.deepEqual(r.erros, [])
})

test("nao usa nenhuma palavra proibida em preferencias.md", () => {
  const texto = JSON.stringify(fluxo).toLowerCase()
  for (const proibida of ["contemplo fácil", "sinergia", "investimento", "resultado rápido", "juros altos"]) {
    assert.ok(!texto.includes(proibida), `o fluxo contém a palavra proibida "${proibida}"`)
  }
})

test("nao usa emoji nem exclamacao", () => {
  const texto = JSON.stringify(fluxo)
  assert.ok(!texto.includes("!"), "o fluxo contém exclamação")
  assert.ok(!/\p{Extended_Pictographic}/u.test(texto), "o fluxo contém emoji")
})

test("pergunta que pontua precisa discriminar entre as opcoes", () => {
  for (const grupo of fluxo.grupos) {
    for (const bloco of grupo.blocos) {
      const opcoes = bloco.conteudo?.opcoes
      if (!opcoes || opcoes.length < 2) continue
      // Uma pergunta ou pontua, e aí tem que separar os perfis, ou não pontua
      // e é só demográfica. O que não pode é pontuar todas igual: aí ela ocupa
      // tempo da pessoa sem informar nada a quem vai atender.
      const pontuadas = opcoes.filter((o) => typeof o.pontos === "number")
      if (pontuadas.length === 0) continue
      assert.equal(pontuadas.length, opcoes.length,
        `bloco "${bloco.id}": algumas opções pontuam e outras não`)
      assert.ok(new Set(pontuadas.map((o) => o.pontos)).size > 1,
        `bloco "${bloco.id}" não discrimina: todas as opções valem o mesmo`)
    }
  }
})

test("a pontuacao maxima do fluxo alcanca a faixa quente", () => {
  let maxima = 0
  for (const grupo of fluxo.grupos) {
    for (const bloco of grupo.blocos) {
      const pontos = (bloco.conteudo?.opcoes || [])
        .map((o) => o.pontos).filter((p) => typeof p === "number")
      if (pontos.length) maxima += Math.max(...pontos)
    }
  }
  assert.ok(maxima >= fluxo.pontuacao.faixas.quente,
    `máximo possível é ${maxima} e a faixa quente começa em ${fluxo.pontuacao.faixas.quente}: ninguém seria quente`)
  assert.ok(fluxo.pontuacao.faixas.quente > fluxo.pontuacao.faixas.morno,
    "a faixa quente precisa ser mais alta que a morna")
})

test("nao pergunta e-mail", () => {
  const tipos = fluxo.grupos.flatMap((g) => g.blocos.map((b) => b.tipo))
  assert.ok(!tipos.includes("entrada_email"))
})

test("todo caminho termina no botao de WhatsApp", () => {
  preparar()
  const terminais = fluxo.grupos.filter((g) => !g.proximo &&
    !g.blocos.some((b) => b.tipo === "condicao" || b.tipo === "ir_para"))
  assert.ok(terminais.length > 0, "o fluxo não tem nenhum grupo terminal")
  for (const grupo of terminais) {
    assert.ok(grupo.blocos.some((b) => b.tipo === "redirecionar"),
      `grupo "${grupo.id}" termina sem oferecer o WhatsApp`)
  }
})

test("o botao leva ao numero certo, com a mensagem pronta", () => {
  const link = fluxo.grupos.flatMap((g) => g.blocos)
    .find((b) => b.tipo === "redirecionar")
  const url = new URL(link.conteudo.url)
  assert.equal(url.pathname, "/5561999699829")
  assert.equal(url.searchParams.get("text"), "Olá, quero saber mais sobre o consórcio.")
})

test("percorrer o fluxo inteiro chega ao fim e classifica como quente", () => {
  preparar()
  let estado = criarEstado(fluxo)
  const respostas = { nome: "Ana", whatsapp: "(61) 99969-9829" }
  let guarda = 0

  while (!estado.terminou && guarda++ < 200) {
    const bloco = blocoAtual(fluxo, estado)
    if (!bloco) { estado = avancar(fluxo, estado); continue }

    if (bloco.tipo === "entrada_botoes") {
      const opcoes = bloco.conteudo.opcoes
      const escolhida = opcoes.reduce((a, b) => ((b.pontos ?? 0) > (a.pontos ?? 0) ? b : a))
      estado = aplicarResposta(fluxo, estado, escolhida.label)
      const destino = destinoDaResposta(bloco, escolhida.label)
      estado = avancar(fluxo, estado, destino ? { destino } : {})
      continue
    }
    if (bloco.tipo.startsWith("entrada_")) {
      estado = aplicarResposta(fluxo, estado, respostas[bloco.salvar_em] || "x")
      estado = avancar(fluxo, estado)
      continue
    }
    if (bloco.tipo === "condicao" || bloco.tipo === "ir_para") {
      const destino = destinoDaLogica(fluxo, estado, bloco)
      estado = avancar(fluxo, estado, destino ? { destino } : {})
      continue
    }
    estado = avancar(fluxo, estado)
  }

  assert.equal(estado.terminou, true)
  assert.equal(contexto(fluxo, estado).classificacao, "quente")
  assert.equal(estado.respostas.idade, "25-34")
  assert.equal(estado.respostas.objetivo, "Investir em imóveis")
})


test("o fluxo declara o proprio ritmo de digitacao", () => {
  assert.deepEqual(fluxo.ritmo, { piso: 1000, porCaractere: 0, teto: 1000 },
    "a Osher quer um segundo fixo antes de cada fala")
})

test("as tres classificacoes sao alcancaveis", () => {
  // Faixa que ninguém atinge é rótulo morto: o vendedor perde o sinal que a
  // pontuação existe para dar. Este teste enumera todas as combinações de
  // resposta e confere que quente, morno e frio acontecem de verdade.
  const perguntas = fluxo.grupos.flatMap((g) => g.blocos)
    .map((b) => (b.conteudo?.opcoes || []).map((o) => o.pontos).filter((p) => typeof p === "number"))
    .filter((p) => p.length)

  let combinacoes = [[]]
  for (const opcoes of perguntas) {
    combinacoes = combinacoes.flatMap((c) => opcoes.map((v) => [...c, v]))
  }
  const { quente, morno } = fluxo.pontuacao.faixas
  const classificar = (n) => (n >= quente ? "quente" : n >= morno ? "morno" : "frio")
  const alcancadas = new Set(combinacoes.map((c) => classificar(c.reduce((a, b) => a + b, 0))))

  for (const faixa of ["quente", "morno", "frio"]) {
    assert.ok(alcancadas.has(faixa),
      `nenhuma combinação de respostas resulta em "${faixa}": a faixa é inalcançável`)
  }
})

// ---------------------------------------------------------------------------
// O lead precisa chegar com contato
//
// Este caso existe porque o contrário aconteceu em produção: o fluxo tinha um
// evento "invalido" que, depois de duas tentativas, dizia "seguir sem esse
// dado" e saltava para a idade. Quem errava o telefone virava um lead sem
// telefone; quem errava o nome perdia o nome E o telefone, porque o salto
// caía depois do grupo de contato. Nos dois casos o lead era enviado,
// pontuado e distribuído a um vendedor que não tinha para quem ligar.
// ---------------------------------------------------------------------------

test("errar o telefone nao deixa a pessoa passar sem telefone", async () => {
  preparar()
  const { montarChat } = await import("./apoio/chat.js")
  const chat = await montarChat({
    fluxo,
    destinos: { destinos: { p: { url: "https://exemplo.invalido/p" } }, ao_finalizar: ["p"] },
    chaveSessao: "osher-telefone"
  })
  await chat.digitar("Gustavo")
  await chat.digitar("61982")     // curto demais
  await chat.digitar("6198")      // de novo

  assert.ok(chat.campo(), "o chat desistiu de pedir o telefone")
  assert.equal(chat.erro(), "Digite um telefone com DDD.")
  assert.equal(chat.leads().length, 0, "mandou um lead sem esperar o telefone")

  await chat.digitar("61982286044")
  assert.ok(
    chat.bolhas().some((b) => b.includes("idade")),
    `o telefone válido não destravou o fluxo: ${JSON.stringify(chat.bolhas())}`
  )
})

test("errar o nome nao pula a pergunta do telefone", async () => {
  preparar()
  const { montarChat } = await import("./apoio/chat.js")
  const chat = await montarChat({ fluxo, chaveSessao: "osher-nome" })
  await chat.digitar("")
  await chat.digitar("")

  assert.ok(
    !chat.bolhas().some((b) => b.includes("idade")),
    "errar o nome levou o fluxo adiante, e o telefone junto"
  )
  await chat.digitar("Gustavo")
  assert.ok(
    chat.bolhas().some((b) => b.includes("telefone")),
    `o telefone deixou de ser perguntado: ${JSON.stringify(chat.bolhas())}`
  )
})

test("nenhum caminho do fluxo dispensa nome ou telefone", () => {
  preparar()
  const escape = (fluxo.eventos || []).find((e) => e.tipo === "invalido")
  assert.equal(escape, undefined,
    "voltou o desvio que deixa o lead passar sem os dados de contato")
})
