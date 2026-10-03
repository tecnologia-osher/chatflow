// A página de projetos, na parte que é dado puro: o id da pasta, o retrato do
// cartão, o fluxo que nasce do zero e o catálogo de modelos.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  idDeProjeto, projetoDoFluxo, fluxoDoZero, fluxoDoModelo, modeloPorId,
  categoriasDeModelos, separarIcone, MODELOS
} from "../editor/projetos.js"
import { NOME_PADRAO } from "../editor/edicoes.js"
import { validarFluxo } from "../motor/validar.js"
// O catálogo já se registra ao importar o editor; registrar de novo explode.

// --- o id da pasta ---------------------------------------------------------

test("o nome vira um id que serve de pasta e de URL", () => {
  assert.equal(idDeProjeto("Osher Consórcio"), "osher-consorcio")
  assert.equal(idDeProjeto("  Quiz do Verão!  "), "quiz-do-verao")
  assert.equal(idDeProjeto("Ação 2026"), "acao-2026")
})

test("nome que nao sobra nada vira um id generico, nao uma pasta sem nome", () => {
  assert.equal(idDeProjeto("***"), "projeto")
  assert.equal(idDeProjeto(""), "projeto")
  assert.equal(idDeProjeto(null), "projeto")
})

test("id ja tomado ganha sufixo, em vez de escrever por cima do outro", () => {
  assert.equal(idDeProjeto("Quiz", ["quiz"]), "quiz-2")
  assert.equal(idDeProjeto("Quiz", ["quiz", "quiz-2"]), "quiz-3")
  assert.equal(idDeProjeto("Quiz", ["outro"]), "quiz")
})

test("id nao fica gigante por causa de um nome gigante", () => {
  assert.ok(idDeProjeto("a".repeat(200)).length <= 40)
})

// --- o cartão --------------------------------------------------------------

test("o cartao se descreve pelo proprio fluxo", () => {
  assert.deepEqual(projetoDoFluxo("osher", { nome: "🤝 Osher Capital", publicado: true }),
    { id: "osher", nome: "Osher Capital", icone: "🤝", publicado: true })
})

test("so tem icone quem digitou um emoji no nome", () => {
  assert.deepEqual(projetoDoFluxo("x", { nome: "Chatflow inicial" }),
    { id: "x", nome: "Chatflow inicial", icone: "", publicado: false })
})

test("fluxo sem nome ainda vira um cartao legivel", () => {
  assert.deepEqual(projetoDoFluxo("novo", {}),
    { id: "novo", nome: NOME_PADRAO, icone: "", publicado: false })
  assert.deepEqual(projetoDoFluxo("novo", null),
    { id: "novo", nome: NOME_PADRAO, icone: "", publicado: false })
})

// --- o emoji do nome -------------------------------------------------------

test("o emoji do comeco do nome vira o icone, e sai do nome", () => {
  assert.deepEqual(separarIcone("🤝 Osher Capital"), { icone: "🤝", nome: "Osher Capital" })
  assert.deepEqual(separarIcone("🧲Captação"), { icone: "🧲", nome: "Captação" })
})

test("emoji de varias partes conta como um so", () => {
  // Família é três pessoas costuradas por ZWJ; cortar no meio deixaria metade
  // do desenho no ícone e metade no nome.
  assert.deepEqual(separarIcone("👨‍👩‍👧 Família"), { icone: "👨‍👩‍👧", nome: "Família" })
  assert.deepEqual(separarIcone("☺️ Oi"), { icone: "☺️", nome: "Oi" })
})

test("sem emoji no comeco, nao ha icone", () => {
  assert.deepEqual(separarIcone("Chatflow inicial"), { icone: "", nome: "Chatflow inicial" })
  assert.deepEqual(separarIcone("Osher 🤝"), { icone: "", nome: "Osher 🤝" },
    "emoji no fim é parte do nome, não ícone")
  assert.deepEqual(separarIcone(""), { icone: "", nome: "" })
  assert.deepEqual(separarIcone(null), { icone: "", nome: "" })
})

test("nome que e so o emoji continua sendo o nome", () => {
  assert.deepEqual(separarIcone("🧲"), { icone: "", nome: "🧲" },
    "o cartão ficaria com um desenho e nenhuma palavra")
})

// --- o fluxo que nasce ----------------------------------------------------

test("o fluxo do zero abre no editor e passa pelo validador", () => {
  const fluxo = fluxoDoZero({ nome: "Meu chat" })
  const r = validarFluxo(fluxo, { destinos: {} })
  assert.equal(r.valido, true, `projeto novo nascendo inválido: ${r.erros.join(" | ")}`)
  assert.equal(fluxo.nome, "Meu chat")
  assert.equal(fluxo.grupos.length, 1, "um grupo para a pessoa ter onde escrever")
  assert.ok(fluxo.eventos.some((e) => e.tipo === "inicio" && e.proximo === "g1"),
    "sem o início ligado, o editor abre com faixa de erro")
})

test("o fluxo do zero nasce com nome padrao quando ninguem escolheu", () => {
  assert.equal(fluxoDoZero().nome, NOME_PADRAO)
  assert.equal("icone" in fluxoDoZero(), false, "ícone é o que a pessoa digitar, não um campo")
})

// --- modelos ---------------------------------------------------------------

test("todo modelo tem o que a galeria precisa mostrar", () => {
  const ids = MODELOS.map((m) => m.id)
  assert.equal(new Set(ids).size, ids.length, "dois modelos com o mesmo id")
  for (const m of MODELOS) {
    for (const campo of ["id", "categoria", "nome", "icone", "descricao", "arquivo"]) {
      assert.ok(m[campo], `modelo ${m.id} sem ${campo}`)
    }
    assert.match(m.arquivo, /\.json$/)
  }
})

test("as categorias saem dos modelos, na ordem em que aparecem", () => {
  const modelos = [
    { id: "a", categoria: "Marketing", nome: "A", icone: "1", descricao: "d", arquivo: "a.json" },
    { id: "b", categoria: "Produto", nome: "B", icone: "2", descricao: "d", arquivo: "b.json" },
    { id: "c", categoria: "Marketing", nome: "C", icone: "3", descricao: "d", arquivo: "c.json" }
  ]
  assert.deepEqual(categoriasDeModelos(modelos).map((c) => [c.nome, c.modelos.map((m) => m.id)]),
    [["Marketing", ["a", "c"]], ["Produto", ["b"]]])
})

test("modeloPorId acha o modelo, e nao inventa um quando nao existe", () => {
  assert.equal(modeloPorId(MODELOS[0].id).nome, MODELOS[0].nome)
  assert.equal(modeloPorId("nao-existe"), null)
})

test("o fluxo do modelo leva o nome do modelo e deixa para tras o publicado", () => {
  const modelo = { id: "x", nome: "Captação", icone: "🧲" }
  const gerado = fluxoDoModelo(modelo, { versao: 2, nome: "Osher 01", icone: "🤝", publicado: true, grupos: [] })
  assert.equal(gerado.nome, "Captação")
  assert.equal("publicado" in gerado, false, "o projeto novo não nasce no ar porque o modelo estava")
  assert.equal("icone" in gerado, false, "o ícone da galeria é da galeria")
  assert.equal(gerado.versao, 2)
})
