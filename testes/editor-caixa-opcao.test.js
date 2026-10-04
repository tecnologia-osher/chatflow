// A caixa de uma opção: o que cada escolha carrega além do texto do botão.
// Escolha com imagem tem figura; Cartões têm figura, título e descrição. A
// caixa é montada a partir do que o tipo declara em `campos_da_opcao`, e não
// de uma lista escrita aqui dentro — tipo novo ganha caixa sem mexer nela.

import { test } from "node:test"
import assert from "node:assert/strict"
import { instalarNavegador, Elemento, assentar } from "./apoio/navegador.js"
instalarNavegador()

const { criarCaixaDeOpcao } = await import("../editor/caixa-opcao.js")
const { registrarTodos } = await import("../motor/blocos/index.js")
const { limpar } = await import("../motor/blocos/_registro.js")
limpar(); registrarTodos()

function montar({ tipo = "entrada_imagens", opcao = { id: "o1", label: "Carro" }, subir = null } = {}) {
  const edicoes = []
  const no = criarCaixaDeOpcao({
    tipo, opcao,
    aoEditar: (campo, valor) => edicoes.push({ campo, valor }),
    aoSubir: subir
  })
  const hospedeiro = new Elemento("div")
  if (no) hospedeiro.append(no)
  return { no, hospedeiro, edicoes }
}

const rotulos = (h) => h.porClasse("ed__midia-rotulo").map((e) => e.textContent)
const campos = (h) => h.porClasse("ed__midia-campo")

test("tipo que nao declara campos de opcao nao ganha caixa", () => {
  assert.equal(montar({ tipo: "entrada_botoes" }).no, null,
    "um botão é só o texto dele: caixa vazia seria um clique que não leva a nada")
})

test("a escolha com imagem pede so a figura", () => {
  const { hospedeiro } = montar()
  assert.deepEqual(rotulos(hospedeiro), ["Imagem"])
  assert.equal(campos(hospedeiro).length, 1)
  assert.equal(campos(hospedeiro)[0].atributos.placeholder, "Cole o link da imagem…")
})

test("o cartao pede figura, titulo e descricao, nessa ordem", () => {
  const { hospedeiro } = montar({ tipo: "entrada_cartoes" })
  assert.deepEqual(rotulos(hospedeiro), ["Imagem", "Título", "Descrição"])
})

test("a caixa abre com o que a opcao ja tem escrito", () => {
  const { hospedeiro } = montar({
    tipo: "entrada_cartoes",
    opcao: { id: "o1", label: "Ir", imagem: "a.png", titulo: "Plano", descricao: "Leve" }
  })
  assert.deepEqual(campos(hospedeiro).map((c) => c.value), ["a.png", "Plano", "Leve"])
})

test("escrever grava no campo daquela opcao, letra por letra", () => {
  const { hospedeiro, edicoes } = montar({ tipo: "entrada_cartoes" })
  const titulo = campos(hospedeiro)[1]
  titulo.value = "Plano Leve"
  titulo.disparar("input")
  assert.deepEqual(edicoes, [{ campo: "titulo", valor: "Plano Leve" }])
})

test("sem quem guarde arquivo, a caixa oferece so o link", () => {
  const { hospedeiro } = montar()
  assert.equal(hospedeiro.porClasse("ed__midia-subir").length, 0,
    "oferecer upload sem servidor é um botão que não faz nada")
})

test("com quem guarde, a figura tambem se sobe do computador", async () => {
  const { hospedeiro, edicoes } = montar({ subir: async () => "imagens/carro.png" })
  const campo = hospedeiro.porClasse("ed__midia-arquivo")[0]
  assert.ok(campo, "faltou o seletor de arquivo")
  campo.files = [{ name: "carro.png", type: "image/png", size: 100 }]
  campo.disparar("change")
  await assentar()
  assert.deepEqual(edicoes, [{ campo: "imagem", valor: "imagens/carro.png" }])
})

test("arquivo que nao e imagem e recusado antes de subir", async () => {
  let subiu = false
  const { hospedeiro, edicoes } = montar({ subir: async () => { subiu = true; return "x" } })
  const campo = hospedeiro.porClasse("ed__midia-arquivo")[0]
  campo.files = [{ name: "voz.mp3", type: "audio/mpeg", size: 100 }]
  campo.disparar("change")
  await assentar()
  assert.equal(subiu, false)
  assert.equal(edicoes.length, 0)
  assert.match(hospedeiro.porClasse("ed__midia-recado")[0].textContent, /Formato/)
})

test("o que se faz dentro da caixa nao vaza para o cartao atras dela", () => {
  const { no } = montar()
  let vazou = false
  const falso = { stopPropagation: () => { vazou = true } }
  for (const evento of ["mousedown", "click", "dblclick", "contextmenu"]) {
    vazou = false
    no.disparar(evento, falso)
    assert.equal(vazou, true, `${evento} chegou no cartão e mexeu na seleção`)
  }
})

test("depois de subir, o campo mostra para onde a figura foi", async () => {
  const { hospedeiro } = montar({ subir: async () => "imagens/carro.png" })
  const seletor = hospedeiro.porClasse("ed__midia-arquivo")[0]
  seletor.files = [{ name: "carro.png", type: "image/png", size: 100 }]
  seletor.disparar("change")
  await assentar()
  assert.equal(hospedeiro.porClasse("ed__midia-campo")[0].value, "imagens/carro.png",
    "campo vazio depois de subir faz a caixa parecer que não fez nada")
})
