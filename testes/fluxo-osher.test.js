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

test("nenhuma pergunta de escolha da a mesma pontuacao para todas as opcoes", () => {
  for (const grupo of fluxo.grupos) {
    for (const bloco of grupo.blocos) {
      const opcoes = bloco.conteudo?.opcoes
      if (!opcoes || opcoes.length < 2) continue
      const pontos = new Set(opcoes.map((o) => o.pontos))
      assert.ok(pontos.size > 1, `bloco "${bloco.id}" não discrimina: todas as opções valem o mesmo`)
    }
  }
})

test("nao pergunta e-mail", () => {
  const tipos = fluxo.grupos.flatMap((g) => g.blocos.map((b) => b.tipo))
  assert.ok(!tipos.includes("entrada_email"))
})

test("caminho de quem so pesquisa encerra sem chegar ao fim quente", () => {
  preparar()
  let estado = criarEstado(fluxo)
  const respostas = { nome: "Ana", whatsapp: "(61) 98228-6044" }
  let guarda = 0

  while (!estado.terminou && guarda++ < 200) {
    const bloco = blocoAtual(fluxo, estado)
    if (!bloco) { estado = avancar(fluxo, estado); continue }

    if (bloco.tipo === "entrada_botoes") {
      const opcoes = bloco.conteudo.opcoes
      const escolhida = opcoes.find((o) => o.pontos === 0) || opcoes[opcoes.length - 1]
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
  assert.notEqual(contexto(fluxo, estado).classificacao, "quente")
})
