// A lista de fontes da aba Tema. O que vale provar aqui é que escolher uma
// fonte escreve a família e a folha juntas, e que fonte escrita à mão no
// tema.json não é atropelada pela lista.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  FONTES, PADRAO_DO_SISTEMA, familiaPrincipal, fonteDoTema, definirFonte, urlDaAmostra
} from "../editor/fontes.js"

test("a lista comeca pelo padrao do sistema, que nao baixa nada", () => {
  assert.equal(FONTES[0], PADRAO_DO_SISTEMA)
  assert.equal(PADRAO_DO_SISTEMA.url, "", "fonte do sistema com folha faria a conversa esperar a rede")
})

test("toda fonte da lista tem nome, familia e folha propria", () => {
  const nomes = FONTES.map((f) => f.nome)
  assert.equal(new Set(nomes).size, nomes.length, "dois itens com o mesmo nome")
  for (const fonte of FONTES) {
    assert.ok(fonte.nome, "fonte sem nome")
    assert.match(fonte.familia, /sans-serif|serif/, `${fonte.nome} sem pilha de reserva`)
    if (fonte === PADRAO_DO_SISTEMA) continue
    assert.match(fonte.url, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/, `${fonte.nome} sem folha`)
    assert.match(fonte.url, /display=swap/, `${fonte.nome} sem display=swap: a conversa abriria em branco`)
    assert.equal(familiaPrincipal(fonte.familia), fonte.nome.toLowerCase(),
      `a família de ${fonte.nome} não começa por ela mesma`)
  }
})

test("familiaPrincipal pega o primeiro nome, sem aspas", () => {
  assert.equal(familiaPrincipal("'Open Sans', system-ui, sans-serif"), "open sans")
  assert.equal(familiaPrincipal('"DM Sans", sans-serif'), "dm sans")
  assert.equal(familiaPrincipal("  Roboto  "), "roboto")
  assert.equal(familiaPrincipal(undefined), "")
})

test("a fonte e reconhecida pelo primeiro nome, nao pela pilha inteira", () => {
  // A pilha de reserva de quem escreveu o tema à mão quase nunca é igual à
  // nossa; comparar o texto todo diria "personalizada" para uma fonte que
  // está na lista, e a pessoa não acharia a própria fonte nela.
  assert.equal(fonteDoTema({ fonte: "'Open Sans', sans-serif" }).nome, "Open Sans")
  assert.equal(fonteDoTema({ fonte: '"Poppins", Arial, sans-serif' }).nome, "Poppins")
})

test("tema sem fonte e o padrao do sistema, nao personalizado", () => {
  assert.equal(fonteDoTema({}), PADRAO_DO_SISTEMA)
  assert.equal(fonteDoTema({ fonte: "" }), PADRAO_DO_SISTEMA)
})

test("fonte de fora da lista nao e reconhecida, para a aba nao a apagar", () => {
  assert.equal(fonteDoTema({ fonte: "'Comic Sans MS', cursive" }), null)
})

test("escolher a fonte escreve a familia e a folha juntas", () => {
  const depois = definirFonte({ cores: { acento: "#112233" } }, "Poppins")
  assert.match(depois.fonte, /^'Poppins'/)
  assert.match(depois.fonte_url, /family=Poppins/)
  assert.equal(depois.cores.acento, "#112233", "o resto do tema tem de ficar")
})

test("voltar ao padrao do sistema tira a folha do tema", () => {
  const antes = { fonte: "'Poppins', sans-serif", fonte_url: "https://exemplo/poppins" }
  const depois = definirFonte(antes, "Padrão do sistema")
  assert.equal("fonte_url" in depois, false,
    "folha órfã faz o navegador baixar uma fonte que ninguém usa")
  assert.equal(antes.fonte_url, "https://exemplo/poppins", "o tema de entrada foi mexido")
})

test("nome que nao existe na lista nao muda nada", () => {
  const antes = { fonte: "'Poppins', sans-serif" }
  assert.equal(definirFonte(antes, "Fonte Que Não Existe"), antes)
})

test("escolher a fonte que o cliente ja usa nao muda o arquivo", () => {
  const osher = JSON.parse(readFileSync(new URL("../clientes/osher/tema.json", import.meta.url), "utf8"))
  const depois = definirFonte(osher, fonteDoTema(osher).nome)
  assert.equal(depois.fonte, osher.fonte, "a lista reescreveria a pilha do cliente")
  assert.equal(depois.fonte_url, osher.fonte_url, "a lista reescreveria a folha do cliente")
})

test("a amostra pede todas as fontes da lista num endereco so", () => {
  const url = urlDaAmostra()
  for (const fonte of FONTES) {
    if (!fonte.url) continue
    assert.match(url, new RegExp(`family=${fonte.nome.replace(/ /g, "\\+")}:`), `${fonte.nome} fora da amostra`)
  }
  assert.equal(url.split("?").length, 2, "mais de um ponto de interrogação não é endereço válido")
})
