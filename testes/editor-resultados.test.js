// As colunas da aba Resultados saem do fluxo; os valores, da planilha.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  variaveisDoFluxo, colunasDosResultados, valorNaColuna, quando, COLUNAS_FIXAS
} from "../editor/resultados.js"

const fluxo = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Contato", blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Oi" } },
      { id: "b2", tipo: "entrada_texto", salvar_em: "nome", conteudo: { rotulo: "Seu nome" } },
      { id: "b3", tipo: "entrada_telefone", salvar_em: "telefone", conteudo: { rotulo: "Seu WhatsApp" } }] },
    { id: "g2", titulo: "Idade", blocos: [
      { id: "b4", tipo: "entrada_botoes", salvar_em: "idade", conteudo: { opcoes: [{ id: "o1", label: "25-34" }] } }] }
  ]
}

test("as variaveis saem na ordem em que o chat pergunta", () => {
  assert.deepEqual(variaveisDoFluxo(fluxo).map((v) => v.chave), ["nome", "telefone", "idade"])
})

test("a coluna se chama como a pergunta, nao como a variavel", () => {
  const [nome, telefone] = variaveisDoFluxo(fluxo)
  assert.equal(nome.rotulo, "Seu nome")
  assert.equal(telefone.rotulo, "Seu WhatsApp")
})

test("bloco sem salvar_em nao vira coluna", () => {
  assert.equal(variaveisDoFluxo(fluxo).some((v) => v.chave === "b1"), false,
    "fala do chat não é resposta de ninguém")
})

test("a mesma variavel em dois blocos vira uma coluna so", () => {
  const repetido = JSON.parse(JSON.stringify(fluxo))
  repetido.grupos[1].blocos.push({ id: "b5", tipo: "entrada_texto", salvar_em: "nome", conteudo: {} })
  assert.equal(variaveisDoFluxo(repetido).filter((v) => v.chave === "nome").length, 1)
})

test("as colunas comecam por quando e situacao", () => {
  const colunas = colunasDosResultados(fluxo)
  assert.deepEqual(colunas.slice(0, 2).map((c) => c.chave), ["atualizadoEm", "situacao"])
  assert.deepEqual(colunas.slice(0, 2).map((c) => c.rotulo), ["Quando", "Situação"])
})

test("coluna que veio da planilha e nao esta no fluxo aparece no fim", () => {
  const linhas = [{ nome: "Ana", classificacao: "quente" }]
  const colunas = colunasDosResultados(fluxo, linhas)
  const extra = colunas.find((c) => c.chave === "classificacao")
  assert.ok(extra, "esconder dado que existe é pior que uma coluna a mais")
  assert.equal(colunas.at(-1).chave, "classificacao")
  assert.equal(extra.extra, true)
})

test("as colunas de controle da planilha nao viram coluna na tela", () => {
  const linhas = [{ sessaoId: "s1", ultimoGrupo: "g1", ultimoBloco: "b2", nome: "Ana" }]
  const chaves = colunasDosResultados(fluxo, linhas).map((c) => c.chave)
  for (const interna of ["sessaoId", "ultimoGrupo", "ultimoBloco"]) {
    assert.equal(chaves.includes(interna), false, `${interna} é maquinário, não resposta`)
  }
})

test("coluna repetida na planilha nao duplica", () => {
  const linhas = [{ extra: 1 }, { extra: 2 }]
  assert.equal(colunasDosResultados(fluxo, linhas).filter((c) => c.chave === "extra").length, 1)
})

test("a data vira dia e hora de gente", () => {
  assert.equal(quando("2026-10-02T14:05:00.000Z").length, 11, "dd/mm hh:mm")
  assert.match(quando("2026-10-02T14:05:00.000Z"), /^\d{2}\/\d{2} \d{2}:\d{2}$/)
})

test("data estranha aparece como veio, em vez de sumir a linha", () => {
  assert.equal(quando("ontem de manhã"), "ontem de manhã")
  assert.equal(quando(""), "")
  assert.equal(quando(undefined), "")
})

test("valor que falta aparece vazio, e nao como undefined", () => {
  const coluna = { chave: "nome", rotulo: "Seu nome" }
  assert.equal(valorNaColuna({}, coluna), "")
  assert.equal(valorNaColuna({ nome: null }, coluna), "")
  assert.equal(valorNaColuna({ nome: 0 }, coluna), "0", "zero é resposta, não vazio")
})

test("o valor da coluna de data passa pelo formato", () => {
  const coluna = COLUNAS_FIXAS[0]
  assert.match(valorNaColuna({ atualizadoEm: "2026-10-02T14:05:00.000Z" }, coluna),
    /^\d{2}\/\d{2} \d{2}:\d{2}$/)
})
