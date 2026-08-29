// Testes da camada de DOM: dirigem `criarChat` de ponta a ponta num
// navegador de mentira. Cada caso aqui existe porque um defeito real passou
// por ele — ver o registro de execução em .superpowers/sdd/.
//
// Nada neste arquivo lê `clientes/`: o motor tem que ser testável sem
// cliente nenhum.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { montarChat, criarArmazenamento, assentar } from "./apoio/chat.js"
import { relogioManual } from "./apoio/relogio.js"

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

// ---------------------------------------------------------------------------
// Indicador de digitação
// ---------------------------------------------------------------------------

const RITMO = { piso: 350, porCaractere: 10, teto: 1800 }

const fluxoDeDuasFalas = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [{ id: "g1", blocos: [
    { id: "t1", tipo: "texto", conteudo: { texto: "Oi." } },
    { id: "t2", tipo: "texto", conteudo: { texto: "Tudo bem por aí?" } }
  ] }]
}

test("mostra o indicador de digitacao antes da fala", async () => {
  const relogio = relogioManual()
  const chat = await montarChat({
    fluxo: fluxoDeDuasFalas, ritmo: RITMO, esperar: relogio.esperar
  })
  assert.equal(chat.digitando(), 1, "o indicador não apareceu")
  assert.deepEqual(chat.bolhas(), [], "a fala chegou antes da pausa")
})

test("o indicador some quando a fala chega", async () => {
  const relogio = relogioManual()
  const chat = await montarChat({
    fluxo: fluxoDeDuasFalas, ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()
  assert.equal(chat.digitando(), 1, "deveria estar digitando a segunda fala")
  assert.deepEqual(chat.bolhas(), ["Oi."])
})

test("cada fala tem a sua propria pausa", async () => {
  const relogio = relogioManual()
  const chat = await montarChat({
    fluxo: fluxoDeDuasFalas, ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()
  await relogio.correr()
  assert.deepEqual(chat.bolhas(), ["Oi.", "Tudo bem por aí?"])
  assert.equal(chat.digitando(), 0, "sobrou indicador na tela")
  assert.equal(relogio.duracoes().length, 2)
})

test("a pausa cresce com o tamanho do texto", async () => {
  const relogio = relogioManual()
  await montarChat({
    fluxo: fluxoDeDuasFalas, ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()
  await relogio.correr()
  const [curta, longa] = relogio.duracoes()
  assert.equal(curta, 350 + 3 * 10, "Oi. tem 3 caracteres")
  assert.equal(longa, 350 + 16 * 10, "a segunda fala tem 16 caracteres")
})

test("a pausa respeita o teto", async () => {
  const relogio = relogioManual()
  await montarChat({
    fluxo: {
      versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }],
      grupos: [{ id: "g1", blocos: [
        { id: "t", tipo: "texto", conteudo: { texto: "x".repeat(500) } }] }]
    },
    ritmo: RITMO, esperar: relogio.esperar
  })
  assert.equal(relogio.duracoes()[0], 1800)
})

test("bloco de logica nao pausa: so o que vira balao espera", async () => {
  const relogio = relogioManual()
  await montarChat({
    fluxo: {
      versao: 2, eventos: [{ tipo: "inicio", proximo: "g1" }],
      grupos: [
        { id: "g1", blocos: [
          { id: "j", tipo: "ir_para", conteudo: { destino: "g2" } }] },
        { id: "g2", blocos: [
          { id: "t", tipo: "texto", conteudo: { texto: "Cheguei." } }] }
      ]
    },
    ritmo: RITMO, esperar: relogio.esperar
  })
  assert.equal(relogio.duracoes().length, 1, "o ir_para não deveria pausar")
})

test("o indicador nao entra na transcricao da sessao", async () => {
  const armazenamento = criarArmazenamento()
  const relogio = relogioManual()
  // Precisa parar numa pergunta: fluxo que termina tem a sessão apagada,
  // e aí não há transcrição gravada para inspecionar.
  const fluxo = structuredClone(fluxoDeDuasFalas)
  fluxo.grupos[0].blocos.push(
    { id: "e", tipo: "entrada_texto", conteudo: {}, salvar_em: "x" }
  )
  const primeira = await montarChat({
    fluxo, armazenamento, chaveSessao: "d",
    ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()
  await relogio.correr()
  assert.deepEqual(primeira.bolhas(), ["Oi.", "Tudo bem por aí?"])

  // Afirma sobre o que foi GRAVADO, não sobre a tela: se o indicador
  // entrasse na transcrição, apareceria aqui como um item a mais.
  const guardado = JSON.parse(armazenamento.getItem("chatflow:d"))
  const transcricao = guardado.estado.transcricao
  assert.deepEqual(
    transcricao.map((i) => i.texto),
    ["Oi.", "Tudo bem por aí?"],
    "o indicador foi parar na transcrição"
  )

  const segunda = await montarChat({ fluxo, armazenamento, chaveSessao: "d" })
  assert.equal(segunda.digitando(), 0)
})

test("a retomada redesenha a conversa de uma vez, sem pausar", async () => {
  const armazenamento = criarArmazenamento()
  const relogio = relogioManual()
  const primeira = await montarChat({
    fluxo: exemplo(), armazenamento, chaveSessao: "d2",
    ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()          // a abertura
  await primeira.digitar("Ana")
  await relogio.correr()          // "Prazer, Ana." — depois disso o motor
                                  // para nos botões, sem pausa pendente

  const relogio2 = relogioManual()
  const segunda = await montarChat({
    fluxo: exemplo(), armazenamento, chaveSessao: "d2",
    ritmo: RITMO, esperar: relogio2.esperar
  })
  assert.deepEqual(segunda.bolhas(), primeira.bolhas(), "a conversa não voltou inteira")
  assert.equal(relogio2.duracoes().length, 0, "a retomada pausou para redesenhar")
})

test("clicar duas vezes durante a digitacao nao responde duas vezes", async () => {
  const relogio = relogioManual()
  const chat = await montarChat({
    fluxo: exemplo(), ritmo: RITMO, esperar: relogio.esperar
  })
  await relogio.correr()
  const campo = chat.controles()[0]
  const botao = chat.controles()[1]
  campo.value = "Ana"
  botao.click()
  botao.click()
  await assentar()
  const ecos = chat.hospedeiro.porClasse("cf__bolha--pessoa").map((b) => b.textContent)
  assert.deepEqual(ecos, ["Ana"], "a resposta foi ecoada duas vezes")
})

// ---------------------------------------------------------------------------
// Auditoria: defeitos encontrados na revisão do refactor assíncrono
// ---------------------------------------------------------------------------

test("ritmo parcial mantem os outros valores padrao", async () => {
  const relogio = relogioManual()
  await montarChat({
    fluxo: fluxoDeDuasFalas,
    ritmo: { piso: 500 },        // só o piso; o resto deve continuar valendo
    esperar: relogio.esperar
  })
  assert.equal(relogio.duracoes().length, 1,
    "sem os padrões, um ritmo parcial desliga a pausa em silêncio")
  assert.equal(relogio.duracoes()[0], 500 + 3 * 10)
})

test("o fluxo so termina depois do lead ter sido entregue", async () => {
  let entregar
  const chat = await montarChat({
    fluxo: fluxoDeDuasFalas,
    destinos: destinosDeTeste(),
    redeResponde: () => new Promise((resolve) => { entregar = () => resolve({ ok: true }) })
  })
  let terminou = false
  chat.pronto.then(() => { terminou = true })
  await assentar()
  assert.equal(terminou, false, "deu o fluxo por encerrado antes de o lead sair")
  entregar()
  await assentar()
  assert.equal(terminou, true)
})

test("erro dentro do laco vira mensagem na tela, nao rejeicao silenciosa", async () => {
  const chat = await montarChat({
    fluxo: fluxoDeDuasFalas,
    ritmo: { piso: 10, porCaractere: 0, teto: 10 },
    esperar: () => Promise.reject(new Error("relógio quebrou"))
  })
  await assentar()
  assert.match(chat.erro(), /problema/i,
    "a falha sumiu sem avisar ninguém")
})

test("laco em fuga para de pausar em vez de arrastar por minutos", async () => {
  const relogio = { chamadas: 0, esperar() { relogio.chamadas++; return Promise.resolve() } }
  const chat = await montarChat({
    fluxo: {
      versao: 2,
      eventos: [{ tipo: "inicio", proximo: "g1" }],
      grupos: [
        { id: "g1", proximo: "g3", blocos: [
          { id: "t", tipo: "texto", conteudo: { texto: "de novo" } },
          { id: "c", tipo: "condicao", conteudo: {
            regras: [{ se: { variavel: "x", vazio: true }, entao: "g2" }] } }] },
        { id: "g2", blocos: [{ id: "j", tipo: "ir_para", conteudo: { destino: "g1" } }] },
        { id: "g3", blocos: [] }
      ]
    },
    ritmo: RITMO,
    esperar: relogio.esperar
  })
  assert.match(chat.erro(), /em loop/, "a guarda de laço não disparou")
  assert.ok(relogio.chamadas <= 25,
    `pausou ${relogio.chamadas} vezes: um fluxo quebrado ficaria minutos na tela`)
})

// ---------------------------------------------------------------------------
// Como a conversa é montada na tela: retrato, lado e onde ficam os botões
// ---------------------------------------------------------------------------

const fluxoComOpcoes = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g_1" }],
  grupos: [{
    id: "g_1",
    blocos: [
      { id: "b_txt", tipo: "texto", conteudo: { texto: "Qual o seu nome?" } },
      { id: "b_op", tipo: "entrada_botoes", salvar_em: "quem", conteudo: {
        opcoes: [{ id: "a", label: "Ana" }, { id: "b", label: "Bia" }] } }
    ]
  }]
}

const temaComAvatar = { marca: "Osher", avatar: "logo.svg" }

const linhas = (chat) => chat.hospedeiro.porClasse("cf__linha")
const avatares = (chat) => chat.hospedeiro.porClasse("cf__avatar")

test("cada fala do chat leva o retrato de quem fala", async () => {
  const chat = await montarChat({ fluxo: fluxoDeDuasFalas, tema: temaComAvatar })
  assert.equal(chat.bolhas().length, 2)
  assert.equal(avatares(chat).length, 2, "faltou retrato em alguma fala")
  assert.equal(avatares(chat)[0].src, "logo.svg")
  assert.equal(avatares(chat)[0].alt, "Logo Osher")
})

test("a resposta da pessoa vai para o outro lado e sem retrato", async () => {
  const chat = await montarChat({ fluxo: fluxoComOpcoes, tema: temaComAvatar })
  await chat.escolher("Ana")
  const daPessoa = linhas(chat).filter((l) => l.className.includes("cf__linha--pessoa"))
  assert.equal(daPessoa.length, 1, "o eco da pessoa não ficou do lado dela")
  assert.equal(daPessoa[0].porClasse("cf__avatar").length, 0,
    "o retrato do chat apareceu na fala da pessoa")
  assert.equal(avatares(chat).length, 1, "a pergunta perdeu o retrato")
})

test("tema sem avatar nao desenha retrato nenhum", async () => {
  const chat = await montarChat({ fluxo: fluxoDeDuasFalas, tema: { marca: "Osher" } })
  assert.equal(avatares(chat).length, 0)
  assert.equal(chat.bolhas().length, 2, "a conversa parou de aparecer")
})

test("os botoes de opcao ficam na conversa, do lado de quem responde", async () => {
  const chat = await montarChat({ fluxo: fluxoComOpcoes, tema: temaComAvatar })
  const rodape = chat.hospedeiro.porClasse("cf__composer")[0]
  assert.deepEqual(rodape.filhos, [], "os botões voltaram para o rodapé")

  const caixa = chat.hospedeiro.porClasse("cf__opcoes")[0]
  assert.ok(caixa, "as opções não foram parar na conversa")
  assert.deepEqual(caixa.filhos.map((b) => b.textContent), ["Ana", "Bia"])
  assert.ok(caixa.pai.className.includes("cf__linha--pessoa"),
    "as opções não ficaram do lado de quem responde")
  assert.ok(caixa.filhos.every((b) => b.className.includes("cf__botao--opcao")),
    "sem a classe da opção o botão perde a bolinha de aviso")
})

test("responder tira os botoes da conversa antes do eco", async () => {
  const chat = await montarChat({ fluxo: fluxoComOpcoes, tema: temaComAvatar })
  await chat.escolher("Ana")
  assert.equal(chat.hospedeiro.porClasse("cf__opcoes").length, 0,
    "os botões ficaram na tela depois de respondidos")
  assert.deepEqual(chat.bolhas(), ["Qual o seu nome?", "Ana"],
    "o eco não entrou no lugar dos botões")
})

test("retomar a sessao nao redesenha botoes ja respondidos", async () => {
  const armazenamento = criarArmazenamento()
  const fluxo = structuredClone(fluxoComOpcoes)
  fluxo.grupos[0].blocos.push({ id: "b_op2", tipo: "entrada_botoes", salvar_em: "outro",
    conteudo: { opcoes: [{ id: "c", label: "Sim" }] } })

  const primeira = await montarChat({ fluxo, tema: temaComAvatar, armazenamento })
  await primeira.escolher("Ana")

  const segunda = await montarChat({ fluxo, tema: temaComAvatar, armazenamento })
  assert.deepEqual(segunda.bolhas(), primeira.bolhas(), "a conversa não voltou inteira")
  assert.deepEqual(segunda.rotulos(), ["Sim"],
    "voltaram botões mortos junto com a conversa retomada")
})

test("o link de saida tambem fica na conversa, do lado da pessoa", async () => {
  const chat = await montarChat({ fluxo: fluxoQueDespede, destinos: destinosDeTeste() })
  const caixa = chat.hospedeiro.porClasse("cf__opcoes")[0]
  assert.ok(caixa, "o link de saída não foi para a conversa")
  assert.equal(caixa.filhos[0].tagName, "A")
  assert.ok(caixa.filhos[0].className.includes("cf__botao--opcao"),
    "sem a classe da opção o link de saída perde a bolinha de aviso")
  assert.ok(caixa.pai.className.includes("cf__linha--pessoa"))
})
