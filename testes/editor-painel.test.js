// O painel de propriedades. A prova da aposta de agosto: o formulário se
// desenha a partir dos `campos` que o tipo declara, sem código por tipo.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento } from "./apoio/navegador.js"
instalarNavegador()

const { criarPainel } = await import("../editor/painel.js")
const { obter } = await import("../editor/catalogo.js")

const fluxo = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 0, y: 0 }, proximo: "g2", blocos: [
      { id: "b_txt", tipo: "texto", conteudo: { texto: "Olá" } },
      { id: "b_num", tipo: "entrada_numero", conteudo: {}, salvar_em: "idade" },
      { id: "b_bot", tipo: "entrada_botoes", salvar_em: "bem", conteudo: { opcoes: [
        { id: "o1", label: "Imóvel", pontos: 2 }, { id: "o2", label: "Carro" }] } },
      { id: "b_torto", tipo: "inventado", conteudo: {} }
    ] },
    { id: "g2", titulo: "Fim", posicao: { x: 400, y: 0 }, blocos: [] }
  ]
}

function montar(selecao) {
  const hospedeiro = new Elemento("div")
  const edicoes = []
  const painel = criarPainel({ elemento: hospedeiro, aoEditar: (f) => edicoes.push(f) })
  painel.mostrar({ fluxo, selecao })
  return { hospedeiro, painel, edicoes }
}
const campos = (h) => h.porClasse("ed__campo")
const rotulos = (h) => h.porClasse("ed__rotulo").map((r) => r.textContent)

test("o formulario tem um campo por campo declarado pelo tipo", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: "b_num" })
  const declarados = obter("entrada_numero").campos.map((c) => c.rotulo)
  for (const r of declarados) assert.ok(rotulos(hospedeiro).includes(r), `faltou "${r}"`)
})

test("o valor atual aparece preenchido", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: "b_txt" })
  assert.equal(campos(hospedeiro)[0].value, "Olá")
})

test("editar um campo devolve o fluxo novo, sem tocar no recebido", () => {
  const { hospedeiro, edicoes } = montar({ grupo: "g1", bloco: "b_txt" })
  const campo = campos(hospedeiro)[0]
  campo.value = "Bom dia"
  campo.disparar("input")
  const novo = edicoes.at(-1)
  assert.equal(novo.grupos[0].blocos[0].conteudo.texto, "Bom dia")
  assert.equal(fluxo.grupos[0].blocos[0].conteudo.texto, "Olá", "o original não pode mudar")
})

test("campo booleano vira caixa de marcar", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: "b_bot" })
  assert.ok(campos(hospedeiro).some((c) => c.atributos.type === "checkbox"))
})

test("so tipo que salva variavel mostra o campo de variavel", () => {
  assert.ok(rotulos(montar({ grupo: "g1", bloco: "b_num" }).hospedeiro).some((r) => /variável/i.test(r)))
  assert.equal(rotulos(montar({ grupo: "g1", bloco: "b_txt" }).hospedeiro).some((r) => /variável/i.test(r)), false)
})

test("tipo desconhecido avisa em vez de quebrar", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: "b_torto" })
  assert.match(hospedeiro.textContent, /inventado/)
  assert.match(hospedeiro.textContent, /não existe|desconhecido/i)
})

// --- opções ---

test("cada opcao vira uma linha com rotulo, pontos e destino", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: "b_bot" })
  assert.equal(hospedeiro.porClasse("ed__opcao").length, 2)
})

test("editar o rotulo da opcao emite o fluxo novo", () => {
  const { hospedeiro, edicoes } = montar({ grupo: "g1", bloco: "b_bot" })
  const campo = hospedeiro.porClasse("ed__opcao")[0].porClasse("ed__campo")[0]
  campo.value = "Apartamento"
  campo.disparar("input")
  assert.equal(edicoes.at(-1).grupos[0].blocos[2].conteudo.opcoes[0].label, "Apartamento")
})

test("acrescentar opcao", () => {
  const { hospedeiro, edicoes } = montar({ grupo: "g1", bloco: "b_bot" })
  hospedeiro.porClasse("ed__acrescentar-opcao")[0].disparar("click")
  assert.equal(edicoes.at(-1).grupos[0].blocos[2].conteudo.opcoes.length, 3)
})

// --- grupo ---

test("selecionar o grupo mostra titulo e o seletor de proximo", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: null })
  assert.ok(rotulos(hospedeiro).some((r) => /título/i.test(r)))
  const seletor = hospedeiro.porClasse("ed__proximo")[0]
  assert.ok(seletor, "sem seletor de próximo não há como ligar grupos")
  assert.equal(seletor.value, "g2")
})

test("o seletor de proximo lista os outros grupos e a opcao de nao ligar", () => {
  const { hospedeiro } = montar({ grupo: "g1", bloco: null })
  const valores = hospedeiro.porClasse("ed__proximo")[0].filhos.map((o) => o.value)
  assert.ok(valores.includes(""), "precisa dar para desligar")
  assert.ok(valores.includes("g2"))
  assert.equal(valores.includes("g1"), false, "grupo não se liga a si mesmo pelo seletor")
})

test("trocar o proximo emite o fluxo novo", () => {
  const { hospedeiro, edicoes } = montar({ grupo: "g2", bloco: null })
  const seletor = hospedeiro.porClasse("ed__proximo")[0]
  seletor.value = "g1"
  seletor.disparar("change")
  assert.equal(edicoes.at(-1).grupos[1].proximo, "g1")
})

test("sem selecao, o painel diz o que fazer", () => {
  const { hospedeiro } = montar({ grupo: null, bloco: null })
  assert.match(hospedeiro.textContent, /selecione|clique/i)
})
