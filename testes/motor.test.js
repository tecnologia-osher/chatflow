// Testes da camada de DOM: dirigem `criarChat` de ponta a ponta num
// navegador de mentira. Cada caso aqui existe porque um defeito real passou
// por ele — ver o registro de execução em .superpowers/sdd/.
//
// Nada neste arquivo lê `clientes/`: o motor tem que ser testável sem
// cliente nenhum.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { montarChat, criarArmazenamento } from "./apoio/chat.js"

const exemplo = () =>
  JSON.parse(readFileSync(new URL("../exemplos/captacao-simples.json", import.meta.url)))

const destinosDeTeste = () => ({
  destinos: {
    planilha: { url: "https://exemplo.invalido/planilha" },
    meio: { url: "https://exemplo.invalido/meio" }
  },
  ao_finalizar: ["planilha"],
  eventos: "planilha"
})

// ---------------------------------------------------------------------------
// Quem termina num redirecionamento também é um lead
// ---------------------------------------------------------------------------

const fluxoQueDespede = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g_fim" }],
  grupos: [{
    id: "g_fim",
    blocos: [
      { id: "b_txt", tipo: "texto", conteudo: { texto: "Falamos por lá." } },
      { id: "b_ir", tipo: "redirecionar", conteudo: {
        url: "https://exemplo.invalido/whatsapp", rotulo_botao: "Continuar" } }
    ]
  }]
}

test("fluxo que termina em redirecionamento envia o lead", async () => {
  const chat = await montarChat({ fluxo: fluxoQueDespede, destinos: destinosDeTeste() })
  assert.equal(chat.leads().length, 1, "o lead do caminho mais quente não foi enviado")
  assert.equal(chat.estado().terminou, true)
})

test("o botão do redirecionamento continua na tela depois do envio", async () => {
  const chat = await montarChat({ fluxo: fluxoQueDespede, destinos: destinosDeTeste() })
  const link = chat.controles().find((c) => c.tagName === "A")
  assert.ok(link, "o link sumiu da tela")
  assert.equal(link.href, "https://exemplo.invalido/whatsapp")
  assert.equal(link.rel, "noopener noreferrer")
})

test("redirecionamento no meio do fluxo nao encerra nem envia", async () => {
  const fluxo = structuredClone(fluxoQueDespede)
  fluxo.grupos[0].blocos.push({ id: "b_depois", tipo: "texto", conteudo: { texto: "Ainda aqui." } })
  const chat = await montarChat({ fluxo, destinos: destinosDeTeste() })
  assert.equal(chat.leads().length, 0)
  assert.equal(chat.estado().terminou, false)
})

// ---------------------------------------------------------------------------
// Guarda de laço
// ---------------------------------------------------------------------------

const fluxoEmLaco = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", proximo: "g3", blocos: [{ id: "c1", tipo: "condicao", conteudo: {
      regras: [{ se: { variavel: "x", vazio: true }, entao: "g2" }] } }] },
    { id: "g2", blocos: [{ id: "j1", tipo: "ir_para", conteudo: { destino: "g1" } }] },
    { id: "g3", blocos: [{ id: "t", tipo: "texto", conteudo: { texto: "Fim" } }] }
  ]
}

test("fluxo em laco falha alto: erro na tela nomeando o grupo", async () => {
  const chat = await montarChat({ fluxo: fluxoEmLaco, destinos: destinosDeTeste() })
  assert.match(chat.erro(), /em loop/)
  assert.match(chat.erro(), /"g1"|"g2"/)
})

test("fluxo em laco nao envia lead nem se diz terminado", async () => {
  const chat = await montarChat({ fluxo: fluxoEmLaco, destinos: destinosDeTeste() })
  assert.equal(chat.leads().length, 0, "mandou um lead falso de um fluxo travado")
  assert.equal(chat.estado().terminou, false)
})

// ---------------------------------------------------------------------------
// Pré-visualização não fala com a rede
// ---------------------------------------------------------------------------

const fluxoComWebhook = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", proximo: "g2", blocos: [
      { id: "b_h", tipo: "webhook", conteudo: { destino: "meio" } }
    ] },
    { id: "g2", blocos: [{ id: "b_f", tipo: "texto", conteudo: { texto: "Fim." } }] }
  ]
}

test("modo teste nao faz chamada de rede nenhuma", async () => {
  const chat = await montarChat({
    fluxo: fluxoComWebhook, destinos: destinosDeTeste(), modo: "teste"
  })
  assert.deepEqual(chat.enviados(), [], "a pré-visualização falou com a rede")
})

test("modo teste avisa que nao enviou, em vez de mentir sobre a configuracao", async () => {
  const chat = await montarChat({
    fluxo: fluxoComWebhook, destinos: destinosDeTeste(), modo: "teste"
  })
  const texto = chat.avisos().join(" ")
  assert.match(texto, /pré-visualização/)
  assert.doesNotMatch(texto, /não existe em destinos\.json/)
})

test("o bloco webhook entrega ao destino nomeado, nao ao de ao_finalizar", async () => {
  const chat = await montarChat({ fluxo: fluxoComWebhook, destinos: destinosDeTeste() })
  const urls = chat.enviados().map((e) => e.url)
  assert.ok(urls.includes("https://exemplo.invalido/meio"), JSON.stringify(urls))
})

// ---------------------------------------------------------------------------
// Evento de funil se identifica
// ---------------------------------------------------------------------------

test("evento de funil vai marcado e o lead nao", async () => {
  const chat = await montarChat({ fluxo: fluxoQueDespede, destinos: destinosDeTeste() })
  assert.ok(chat.eventos().length > 0, "nenhum evento de funil foi emitido")
  for (const evento of chat.eventos()) assert.equal(evento.event, true)
  assert.equal(chat.leads()[0].event, undefined, "o lead foi marcado como evento")
})

test("o lead leva as respostas, a pontuacao e a classificacao", async () => {
  const chat = await montarChat({ fluxo: exemplo(), destinos: destinosDeTeste() })
  await chat.digitar("Ana")
  await chat.escolher("Só tirando dúvidas")
  const lead = chat.leads()[0]
  assert.equal(lead.nome, "Ana")
  assert.equal(lead.interesse, "Só tirando dúvidas")
  assert.equal(lead.pontuacao, 1)
  assert.equal(lead.classificacao, "frio")
  assert.ok(lead.historico.includes("g_abertura"))
})

// ---------------------------------------------------------------------------
// Teclado certo no celular
// ---------------------------------------------------------------------------

const atributosEsperados = {
  entrada_texto: { type: "text" },
  entrada_numero: { type: "text", inputmode: "decimal" },
  entrada_email: { type: "email", inputmode: "email" },
  entrada_telefone: { type: "tel" },
  entrada_data: { type: "text", inputmode: "numeric" }
}

for (const [tipo, esperado] of Object.entries(atributosEsperados)) {
  test(`${tipo} abre o teclado certo`, async () => {
    const chat = await montarChat({
      fluxo: {
        versao: 2,
        eventos: [{ tipo: "inicio", proximo: "g1" }],
        grupos: [{ id: "g1", blocos: [
          { id: "b", tipo, conteudo: {}, salvar_em: "x" }] }]
      },
      destinos: destinosDeTeste()
    })
    assert.deepEqual(chat.campo().atributos, esperado)
  })
}

// ---------------------------------------------------------------------------
// Retomada de sessão
// ---------------------------------------------------------------------------

test("recarregar retoma no mesmo ponto, com a conversa inteira na tela", async () => {
  const armazenamento = criarArmazenamento()
  const primeira = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  await primeira.digitar("Ana")
  const antes = primeira.bolhas()

  const segunda = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  assert.deepEqual(segunda.bolhas(), antes, "a conversa não foi redesenhada")
  assert.equal(segunda.estado().respostas.nome, "Ana")
  assert.ok(
    segunda.rotulos().includes("Quero contratar"),
    "não voltou na pergunta pendente"
  )
})

test("a pergunta pendente fica visivel ao retomar", async () => {
  const armazenamento = criarArmazenamento()
  const primeira = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  await primeira.digitar("Ana")

  const segunda = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  assert.ok(
    segunda.bolhas().some((b) => b.includes("Com o que podemos ajudar")),
    `botões sem pergunta na tela: ${JSON.stringify(segunda.bolhas())}`
  )
})

test("terminar o fluxo apaga a sessao guardada", async () => {
  const armazenamento = criarArmazenamento()
  const chat = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  await chat.digitar("Ana")
  assert.equal(armazenamento.tamanho(), 1)
  await chat.escolher("Só tirando dúvidas")
  assert.equal(armazenamento.tamanho(), 0, "a sessão terminada continuou guardada")
})

test("retomar: false recomeca do zero mesmo com sessao guardada", async () => {
  const armazenamento = criarArmazenamento()
  const primeira = await montarChat({ fluxo: exemplo(), armazenamento, chaveSessao: "ex" })
  await primeira.digitar("Ana")

  const segunda = await montarChat({
    fluxo: exemplo(), armazenamento, chaveSessao: "ex", retomar: false
  })
  assert.equal(segunda.estado().respostas.nome, undefined)
  assert.ok(segunda.bolhas()[0].startsWith("Olá."))
})

test("armazenamento indisponivel nao impede o chat de rodar", async () => {
  const chat = await montarChat({ fluxo: exemplo(), armazenamento: undefined })
  assert.ok(chat.bolhas()[0].startsWith("Olá."))
  await chat.digitar("Ana")
  assert.equal(chat.estado().respostas.nome, "Ana")
})

// ---------------------------------------------------------------------------
// Entrada inválida e desvio por evento
// ---------------------------------------------------------------------------

test("entrada invalida mostra o erro do tipo e nao avanca", async () => {
  const chat = await montarChat({ fluxo: exemplo(), destinos: destinosDeTeste() })
  await chat.digitar("Ana")
  await chat.escolher("Quero contratar")
  const grupoAntes = chat.estado().grupoAtual

  await chat.digitar("123")
  assert.match(chat.erro(), /telefone/)
  assert.equal(chat.estado().grupoAtual, grupoAntes)
  assert.equal(chat.estado().tentativas, 1)
})

test("segunda falha desvia pelo evento invalido e limpa o erro", async () => {
  const chat = await montarChat({ fluxo: exemplo(), destinos: destinosDeTeste() })
  await chat.digitar("Ana")
  await chat.escolher("Quero contratar")
  await chat.digitar("123")
  await chat.digitar("456")

  assert.ok(
    chat.bolhas().some((b) => b.includes("sem esse dado")),
    JSON.stringify(chat.bolhas())
  )
  assert.equal(chat.erro(), "")
  assert.equal(chat.estado().tentativas, 0)
})

// ---------------------------------------------------------------------------
// O motor não é dono da página
// ---------------------------------------------------------------------------

test("duas instancias coexistem sem misturar estado", async () => {
  const a = await montarChat({ fluxo: exemplo(), chaveSessao: "a" })
  const b = await montarChat({ fluxo: exemplo(), chaveSessao: "b" })
  await a.digitar("Ana")

  assert.equal(a.estado().respostas.nome, "Ana")
  assert.equal(b.estado().respostas.nome, undefined)
  assert.ok(b.bolhas().every((texto) => !texto.includes("Ana")))
})

test("a interpolacao usa a resposta dada e o eco aparece como fala da pessoa", async () => {
  const chat = await montarChat({ fluxo: exemplo() })
  await chat.digitar("Ana")
  assert.ok(chat.bolhas().some((b) => b.includes("Prazer, Ana")))
  const daPessoa = chat.hospedeiro
    .porClasse("cf__bolha--pessoa")
    .map((b) => b.textContent)
  assert.deepEqual(daPessoa, ["Ana"])
})

test("fluxo invalido nao monta em producao e avisa no console", async () => {
  const chat = await montarChat({
    fluxo: { versao: 2, eventos: [], grupos: [] }, destinos: destinosDeTeste()
  })
  assert.equal(chat.estado(), null)
  assert.match(chat.avisos().join(" "), /inválido/)
})
