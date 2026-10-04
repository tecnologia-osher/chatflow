// Avaliação, Escolha com imagem e Cartões: três entradas que o motor precisou
// aprender a desenhar, porque nenhuma delas é um campo de texto.

import { test } from "node:test"
import assert from "node:assert/strict"
import { montarChat, assentar } from "./apoio/chat.js"

const destinos = () => ({
  destinos: { planilha: { url: "https://exemplo.invalido/p" } },
  ao_finalizar: ["planilha"], eventos: "planilha"
})

const comBloco = (bloco, depois = []) => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g" }],
  grupos: [{ id: "g", blocos: [bloco, ...depois] }]
})

// --- Avaliação --------------------------------------------------------------

test("a avaliacao desenha uma estrela por nota, cinco por padrao", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_avaliacao", salvar_em: "nota", conteudo: {} }),
    destinos: destinos()
  })
  const estrelas = hospedeiro.porClasse("cf__estrela")
  assert.equal(estrelas.length, 5)
  assert.deepEqual([...new Set(estrelas.map((e) => e.textContent))], ["★"],
    "botão sem estrela desenhada é um retângulo em branco")
  assert.equal(estrelas[0].atributos["aria-label"], "1 de 5",
    "quem usa leitor de tela precisa saber qual nota está dando")
})

test("quem pede dez estrelas recebe dez", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_avaliacao", salvar_em: "nota",
      conteudo: { maximo: 10 } }),
    destinos: destinos()
  })
  assert.equal(hospedeiro.porClasse("cf__estrela").length, 10)
})

test("maximo absurdo nao vira uma fileira infinita de estrelas", async () => {
  for (const [pedido, esperado] of [[0, 5], [1, 3], [2, 3], [99, 10], [-4, 5], ["abacaxi", 5]]) {
    const { hospedeiro } = await montarChat({
      fluxo: comBloco({ id: "b", tipo: "entrada_avaliacao", salvar_em: "nota",
        conteudo: { maximo: pedido } }),
      destinos: destinos()
    })
    assert.equal(hospedeiro.porClasse("cf__estrela").length, esperado,
      `pediu ${JSON.stringify(pedido)} estrelas`)
  }
})

test("tocar na terceira estrela guarda tres e segue a conversa", async () => {
  const chat = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_avaliacao", salvar_em: "nota", conteudo: {} },
      [{ id: "t", tipo: "texto", conteudo: { texto: "Obrigado" } }]),
    destinos: destinos()
  })
  chat.hospedeiro.porClasse("cf__estrela")[2].disparar("click")
  await assentar()
  assert.equal(chat.estado().respostas.nota, "3")
  assert.match(chat.hospedeiro.porClasse("cf__thread")[0].textContent, /Obrigado/)
})

test("a nota escolhida aparece na conversa como as estrelas cheias", async () => {
  const chat = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_avaliacao", salvar_em: "nota", conteudo: {} }),
    destinos: destinos()
  })
  chat.hospedeiro.porClasse("cf__estrela")[3].disparar("click")
  await assentar()
  assert.match(chat.hospedeiro.porClasse("cf__thread")[0].textContent, /★{4}/,
    "sem ver o que respondeu, a pessoa não sabe se o toque pegou")
})

test("o texto acima das estrelas aparece, e interpola a variavel", async () => {
  const chat = await montarChat({
    fluxo: {
      versao: 2,
      eventos: [{ tipo: "inicio", proximo: "g" }],
      grupos: [{ id: "g", blocos: [
        { id: "n", tipo: "entrada_texto", salvar_em: "nome", conteudo: {} },
        { id: "b", tipo: "entrada_avaliacao", salvar_em: "nota",
          conteudo: { rotulo: "Como fomos, {{nome}}?" } }] }]
    },
    destinos: destinos()
  })
  await chat.digitar("Gustavo")
  assert.match(chat.hospedeiro.porClasse("cf__thread")[0].textContent, /Como fomos, Gustavo\?/)
})

// --- Escolha com imagem -----------------------------------------------------

test("a escolha com imagem mostra a figura junto do texto de cada opcao", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_imagens", salvar_em: "plano", conteudo: {
      opcoes: [
        { id: "o1", label: "Carro", imagem: "https://exemplo/carro.png" },
        { id: "o2", label: "Imóvel", imagem: "https://exemplo/casa.png" }] } }),
    destinos: destinos()
  })
  const escolhas = hospedeiro.porClasse("cf__escolha")
  assert.equal(escolhas.length, 2)
  assert.equal(hospedeiro.porClasse("cf__escolha-img")[0].src, "https://exemplo/carro.png")
  assert.match(escolhas[1].textContent, /Imóvel/)
})

test("opcao sem imagem continua sendo um botao, e nao um buraco", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_imagens", salvar_em: "plano", conteudo: {
      opcoes: [{ id: "o1", label: "Sem figura" }] } }),
    destinos: destinos()
  })
  assert.equal(hospedeiro.porClasse("cf__escolha").length, 1)
  assert.equal(hospedeiro.porClasse("cf__escolha-img").length, 0,
    "img sem src pinta o ícone de imagem quebrada")
})

test("clicar na figura responde com o texto da opcao", async () => {
  const chat = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_imagens", salvar_em: "plano", conteudo: {
      opcoes: [{ id: "o1", label: "Carro", imagem: "x.png" },
        { id: "o2", label: "Imóvel", imagem: "y.png" }] } }),
    destinos: destinos()
  })
  chat.hospedeiro.porClasse("cf__escolha")[1].disparar("click")
  await assentar()
  assert.equal(chat.estado().respostas.plano, "Imóvel")
})

// --- Cartões ----------------------------------------------------------------

test("cada cartao traz figura, titulo, descricao e o botao dele", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_cartoes", salvar_em: "escolha", conteudo: {
      opcoes: [{ id: "o1", label: "Quero este", imagem: "a.png",
        titulo: "Plano Leve", descricao: "Para começar" }] } }),
    destinos: destinos()
  })
  const cartao = hospedeiro.porClasse("cf__cartao")[0]
  assert.ok(cartao, "sem cartão, o bloco não existe na tela")
  assert.equal(hospedeiro.porClasse("cf__cartao-img")[0].src, "a.png")
  assert.match(cartao.textContent, /Plano Leve/)
  assert.match(cartao.textContent, /Para começar/)
  assert.match(hospedeiro.porClasse("cf__cartao-botao")[0].textContent, /Quero este/)
})

test("cartao sem titulo ou sem descricao nao deixa linha vazia no lugar", async () => {
  const { hospedeiro } = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_cartoes", salvar_em: "escolha", conteudo: {
      opcoes: [{ id: "o1", label: "Ir" }] } }),
    destinos: destinos()
  })
  assert.equal(hospedeiro.porClasse("cf__cartao-titulo").length, 0)
  assert.equal(hospedeiro.porClasse("cf__cartao-texto").length, 0)
  assert.equal(hospedeiro.porClasse("cf__cartao-img").length, 0)
  assert.equal(hospedeiro.porClasse("cf__cartao-botao").length, 1)
})

test("o botao do cartao responde com o texto dele", async () => {
  const chat = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_cartoes", salvar_em: "escolha", conteudo: {
      opcoes: [{ id: "o1", label: "Primeiro" }, { id: "o2", label: "Segundo" }] } }),
    destinos: destinos()
  })
  chat.hospedeiro.porClasse("cf__cartao-botao")[1].disparar("click")
  await assentar()
  assert.equal(chat.estado().respostas.escolha, "Segundo")
})

test("cartao sem botao escrito ainda tem onde clicar", async () => {
  const chat = await montarChat({
    fluxo: comBloco({ id: "b", tipo: "entrada_cartoes", salvar_em: "escolha", conteudo: {
      opcoes: [{ id: "o1", titulo: "Plano Leve" }] } }),
    destinos: destinos()
  })
  const botao = chat.hospedeiro.porClasse("cf__cartao-botao")[0]
  assert.match(botao.textContent, /\S/, "botão sem letra nenhuma é um retângulo invisível")
})

test("as tres entradas novas interpolam variavel no que escrevem", async () => {
  const chat = await montarChat({
    fluxo: {
      versao: 2,
      eventos: [{ tipo: "inicio", proximo: "g" }],
      grupos: [{ id: "g", blocos: [
        { id: "n", tipo: "entrada_texto", salvar_em: "nome", conteudo: {} },
        { id: "b", tipo: "entrada_cartoes", salvar_em: "e", conteudo: {
          opcoes: [{ id: "o1", label: "Vamos, {{nome}}", titulo: "Oi {{nome}}",
            descricao: "Tudo bem, {{nome}}?" }] } }] }]
    },
    destinos: destinos()
  })
  await chat.digitar("Gustavo")
  const cartao = chat.hospedeiro.porClasse("cf__cartao")[0]
  assert.match(cartao.textContent, /Oi Gustavo/)
  assert.match(cartao.textContent, /Tudo bem, Gustavo\?/)
  assert.match(cartao.textContent, /Vamos, Gustavo/)
})
