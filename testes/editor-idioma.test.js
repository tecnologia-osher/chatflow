// O idioma do editor. Duas promessas: a tela inteira troca de língua, e
// nenhuma frase fica para trás — nem agora nem quando alguém acrescentar uma.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { instalarNavegador, Elemento, assentar, criarArmazenamento } from "./apoio/navegador.js"
instalarNavegador()

const { criarEditor } = await import("../editor/app.js")
const { criarTradutor, preencher, idiomaValido, IDIOMAS, EM_INGLES, PADRAO } =
  await import("../editor/idioma.js")

const pasta = new URL("../editor/", import.meta.url)
const fontes = readdirSync(pasta).filter((n) => n.endsWith(".js"))
const codigo = Object.fromEntries(
  fontes.map((n) => [n, readFileSync(new URL(n, pasta), "utf8")]))

// --- o tradutor ------------------------------------------------------------

test("sem tradução, a frase sai como está", () => {
  const t = criarTradutor("en")
  assert.equal(t("Frase que ninguém traduziu ainda"), "Frase que ninguém traduziu ainda",
    "chave técnica na cara do cliente é pior que a frase em português")
})

test("em português, o dicionário é a própria frase", () => {
  const t = criarTradutor(PADRAO)
  assert.equal(t("Centralizar"), "Centralizar")
})

test("os buracos da frase são preenchidos nas duas línguas", () => {
  assert.equal(criarTradutor("pt")("{n} pessoas", { n: 3 }), "3 pessoas")
  assert.equal(criarTradutor("en")("{n} pessoas", { n: 3 }), "3 people")
  assert.equal(preencher("Vai para {grupo}", { grupo: "Contato" }), "Vai para Contato")
})

test("buraco sem valor fica como está, em vez de virar undefined", () => {
  assert.equal(preencher("Vai para {grupo}", {}), "Vai para {grupo}")
  assert.equal(preencher("Vai para {grupo}"), "Vai para {grupo}")
})

test("idioma desconhecido cai no português, nao numa tela vazia", () => {
  assert.equal(criarTradutor("klingon")("Centralizar"), "Centralizar")
  assert.equal(idiomaValido("klingon"), false)
  assert.equal(idiomaValido("en"), true)
})

// --- o dicionário está completo -------------------------------------------

// Toda frase que o editor manda traduzir, achada no próprio código. É este
// teste que impede uma tela meio inglesa, meio portuguesa: frase nova sem
// tradução quebra a suíte no mesmo dia em que é escrita.
function frasesPedidas() {
  const pedidas = new Map()
  for (const [arquivo, texto] of Object.entries(codigo)) {
    for (const m of texto.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)+)"|'((?:[^'\\]|\\.)+)')/g)) {
      pedidas.set((m[1] ?? m[2]).replace(/\\"/g, '"').replace(/\\'/g, "'"), arquivo)
    }
  }
  return pedidas
}

test("toda frase que o editor traduz tem versao em ingles", () => {
  const faltando = [...frasesPedidas()]
    .filter(([frase]) => !(frase in EM_INGLES))
    .map(([frase, arquivo]) => `${arquivo}: ${frase}`)
  assert.deepEqual(faltando, [])
})

test("o editor pede traduzir uma quantidade de frases que faz sentido", () => {
  // Se este número despencar, alguém tirou o t() de meia tela sem perceber.
  // Muitas frases chegam ao t() por variável (seções do tema, nomes de bloco,
  // categorias) e não entram nesta conta — por isso o piso é bem abaixo do
  // tamanho do dicionário.
  assert.ok(frasesPedidas().size > 60, `só ${frasesPedidas().size} frases traduzidas`)
})

test("nao ha tradução sobrando, apontando para frase que nao existe mais", () => {
  const pedidas = frasesPedidas()
  // As frases dos dados (rótulos de tema, de bloco, categorias) não aparecem
  // dentro de t(): quem as traduz é o render, com a variável. Então só se
  // acusa o que não está em lugar nenhum do código do editor.
  const soltas = Object.keys(EM_INGLES).filter((frase) =>
    !pedidas.has(frase) &&
    !Object.values(codigo).some((texto) => texto.includes(`"${frase}"`)))
  assert.deepEqual(soltas, [])
})

// --- nenhuma frase ficou sem t() ------------------------------------------

test("nenhuma frase visivel escapou do tradutor", () => {
  const posicoes = [
    // el("tag", "classe", "texto")
    /\bel\(\s*"[^"]+"\s*,\s*(?:"[^"]*"|null|`[^`]*`)\s*,\s*"([^"]+)"/g,
    /setAttribute\(\s*"(?:title|aria-label|placeholder|alt)"\s*,\s*"([^"]+)"/g,
    /\.textContent\s*=\s*"([^"]+)"/g
  ]
  const escaparam = []
  for (const [arquivo, texto] of Object.entries(codigo)) {
    if (arquivo === "idioma.js") continue
    for (const padrao of posicoes) {
      for (const m of texto.matchAll(padrao)) {
        // Símbolo não é frase: ✕, ‹, ▶ e companhia não se traduzem.
        if (!/\p{L}{2}/u.test(m[1])) continue
        escaparam.push(`${arquivo}: ${m[1]}`)
      }
    }
  }
  assert.deepEqual(escaparam, [])
})

// --- a tela troca de língua ------------------------------------------------

const fluxoBase = () => ({
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    { id: "g1", titulo: "Abertura", posicao: { x: 0, y: 0 }, blocos: [
      { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }] }
  ]
})

function porClasse(no, classe) { return no.porClasse(classe) }

function montar(armazenamento = criarArmazenamento()) {
  const hospedeiro = new Elemento("div")
  const editor = criarEditor({
    elemento: hospedeiro, fluxo: fluxoBase(), armazenamento, esperarNoTeste: async () => {}
  })
  return { hospedeiro, editor, armazenamento }
}

const engrenagem = (h) => porClasse(h, "ed__engrenagem")[0]
const listaDeIdioma = (h) => porClasse(h, "ed__config-linha--idioma")[0].porClasse("ed__tema-lista")[0]

function escolherIdioma(h, chave) {
  // A engrenagem alterna: clicar de novo fecharia o painel aberto.
  if (!porClasse(h, "ed__config").length) engrenagem(h).disparar("click")
  const lista = listaDeIdioma(h)
  lista.value = chave
  lista.disparar("change")
  return lista
}

test("a engrenagem traz a lista de idiomas, no que esta valendo", () => {
  const { hospedeiro } = montar()
  engrenagem(hospedeiro).disparar("click")
  const lista = listaDeIdioma(hospedeiro)
  assert.deepEqual(lista.porClasse("ed__tema-opcao").map((o) => o.textContent),
    IDIOMAS.map((i) => i.nome))
  assert.equal(lista.value, PADRAO, "o editor é escrito em português: é por aí que ele começa")
})

test("escolher English troca a barra inteira", () => {
  const { hospedeiro } = montar()
  escolherIdioma(hospedeiro, "en")
  assert.deepEqual(porClasse(hospedeiro, "ed__aba").map((b) => b.textContent),
    ["Flow", "Theme", "Results"])
  assert.equal(porClasse(hospedeiro, "ed__testar")[0].textContent, "▶ Test")
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Saved")
  assert.equal(porClasse(hospedeiro, "ed__ajustar")[0].textContent, "Center")
  assert.equal(porClasse(hospedeiro, "ed__voltar")[0].atributos.title, "Back to projects")
})

test("escolher English troca a paleta e o que esta no quadro", () => {
  const { hospedeiro } = montar()
  escolherIdioma(hospedeiro, "en")
  assert.deepEqual(porClasse(hospedeiro, "ed__categoria").map((h) => h.textContent),
    ["Bubbles", "Input", "Logic", "Connection"])
  assert.ok(porClasse(hospedeiro, "ed__tipo").some((b) => b.textContent.includes("Video")),
    "o nome do tipo de bloco também é do editor")
  assert.match(porClasse(hospedeiro, "ed__dica")[0].textContent, /Drag a type/)
  assert.equal(porClasse(hospedeiro, "ed__cabecalho-titulo")[0].atributos.title, "Click to rename")
})

test("voltar para Português desfaz a troca", () => {
  const { hospedeiro } = montar()
  escolherIdioma(hospedeiro, "en")
  escolherIdioma(hospedeiro, "pt")
  assert.deepEqual(porClasse(hospedeiro, "ed__aba").map((b) => b.textContent),
    ["Fluxo", "Tema", "Resultados"])
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
})

test("o idioma escolhido fica guardado e vale na proxima vez", () => {
  const guardado = criarArmazenamento()
  escolherIdioma(montar(guardado).hospedeiro, "en")
  assert.equal(guardado.getItem("chatflow:idioma"), "en")

  const outro = montar(guardado)
  assert.equal(porClasse(outro.hospedeiro, "ed__salvar")[0].textContent, "Saved",
    "escolher o idioma toda vez que abre seria pior que não ter a escolha")
})

test("o idioma e da pessoa, nao do projeto: nao conta como mudanca a salvar", () => {
  const { hospedeiro, editor } = montar()
  escolherIdioma(hospedeiro, "en")
  assert.equal(editor.temMudancas(), false, "trocar de idioma não mexe no fluxo nem no tema")
})

test("navegador sem armazenamento: troca de idioma na mesma, so nao lembra", () => {
  const semNada = {
    getItem() { throw new Error("bloqueado") },
    setItem() { throw new Error("bloqueado") },
    removeItem() { throw new Error("bloqueado") }
  }
  const hospedeiro = new Elemento("div")
  criarEditor({ elemento: hospedeiro, fluxo: fluxoBase(), armazenamento: semNada, esperarNoTeste: async () => {} })
  escolherIdioma(hospedeiro, "en")
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Saved")
})

test("idioma guardado invalido nao deixa o editor em branco", () => {
  const guardado = criarArmazenamento()
  guardado.setItem("chatflow:idioma", "klingon")
  const { hospedeiro } = montar(guardado)
  assert.equal(porClasse(hospedeiro, "ed__salvar")[0].textContent, "Salvo")
})

test("em English, a aba Tema e a de Resultados tambem falam ingles", async () => {
  const { hospedeiro } = montar()
  escolherIdioma(hospedeiro, "en")
  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Theme").disparar("click")
  await assentar()
  assert.ok(porClasse(hospedeiro, "ed__categoria").map((h) => h.textContent).includes("Conversation"))
  assert.equal(porClasse(hospedeiro, "ed__tema-titulo")[0].textContent, "Your conversation, your way")

  porClasse(hospedeiro, "ed__aba").find((b) => b.textContent === "Results").disparar("click")
  await assentar()
  assert.equal(porClasse(hospedeiro, "ed__resultados-titulo")[0].textContent, "Results")
  assert.match(porClasse(hospedeiro, "ed__chave-texto")[0].textContent, /paste the spreadsheet's read key/i)
})
