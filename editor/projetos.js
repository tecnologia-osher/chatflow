// A página de projetos: o que é um projeto, como se chama o próximo e quais
// modelos existem. Dado puro — quem desenha é a página, quem grava é o
// servidor.
//
// Hoje um projeto é uma pasta em `clientes/<id>/`, e `clientes/index.json` diz
// quais existem. No sub-projeto 3 isso vira uma tabela com dono; o formato
// desta lista foi escolhido para essa troca ser de um módulo só.

import { NOME_PADRAO } from "./edicoes.js"

// Um emoji no começo do nome vira o ícone do cartão. É o único jeito de ter
// ícone: quem quiser um, digita um no nome do projeto. Campo separado de
// ícone dava um desenho que ninguém escolheu e que aparecia duas vezes quando
// a pessoa também digitava o emoji.
const EMOJI_NO_COMECO =
  /^(\p{Extended_Pictographic}(\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}(\uFE0F)?)*)\s*/u

export function separarIcone(nome) {
  const texto = String(nome || "").trim()
  const achado = EMOJI_NO_COMECO.exec(texto)
  if (!achado) return { icone: "", nome: texto }
  const resto = texto.slice(achado[0].length).trim()
  // Nome que é só o emoji continua sendo o nome: sem isso o cartão ficaria
  // com um desenho e nenhuma palavra.
  if (!resto) return { icone: "", nome: texto }
  return { icone: achado[1], nome: resto }
}

// O id vira nome de pasta e entra na URL: só minúsculas, números e hífen.
// Nome vazio ou que vire nada depois da limpeza cai num id genérico, em vez
// de criar uma pasta chamada "".
export function idDeProjeto(nome, existentes = []) {
  const limpo = String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const base = limpo || "projeto"
  const tomados = new Set(existentes)
  if (!tomados.has(base)) return base
  // Dois projetos com o mesmo nome são comuns ("Quiz", "Quiz"): o segundo
  // ganha sufixo em vez de sobrescrever a pasta do primeiro.
  for (let n = 2; ; n++) {
    const tentativa = `${base}-${n}`
    if (!tomados.has(tentativa)) return tentativa
  }
}

// O retrato de um projeto na lista. O que o cartão mostra vem do próprio
// fluxo — ele é quem sabe como se chama —, e o id vem da pasta.
export function projetoDoFluxo(id, fluxo) {
  const { icone, nome } = separarIcone(fluxo?.nome)
  return { id, nome: nome || NOME_PADRAO, icone, publicado: Boolean(fluxo?.publicado) }
}

// Fluxo de um projeto que nasce do zero: o mínimo que o editor sabe abrir e o
// validador aceita — um começo ligado a um grupo com uma fala vazia.
export function fluxoDoZero({ nome = NOME_PADRAO } = {}) {
  return {
    versao: 2,
    nome,
    eventos: [{ tipo: "inicio", posicao: { x: 40, y: 160 }, proximo: "g1" }],
    grupos: [{
      id: "g1",
      titulo: "Grupo #1",
      posicao: { x: 360, y: 120 },
      blocos: [{ id: "b1", tipo: "texto", conteudo: { texto: "Olá" } }]
    }]
  }
}

// Os modelos. Cada um é um fluxo pronto em `modelos/<arquivo>`, e esta lista
// é o que a galeria mostra: categoria, nome, ícone e a frase que explica para
// que ele serve. Modelo novo é uma entrada aqui mais um arquivo lá.
export const MODELOS = [
  {
    id: "captacao-simples",
    categoria: "Marketing",
    nome: "Captação simples",
    icone: "🧲",
    descricao: "Pergunta o essencial, pontua o interesse e entrega o lead.",
    arquivo: "captacao-simples.json"
  }
]

export function categoriasDeModelos(modelos = MODELOS) {
  const ordem = []
  const por = new Map()
  for (const modelo of modelos) {
    if (!por.has(modelo.categoria)) { por.set(modelo.categoria, []); ordem.push(modelo.categoria) }
    por.get(modelo.categoria).push(modelo)
  }
  return ordem.map((nome) => ({ nome, modelos: por.get(nome) }))
}

export function modeloPorId(id, modelos = MODELOS) {
  return modelos.find((m) => m.id === id) || null
}

// O fluxo que o modelo gera: o arquivo dele, com o nome do modelo, menos o
// que é do projeto que o originou (quem publicou foi outro, e o ícone da
// galeria é da galeria — no cartão, o ícone é o que a pessoa digitar).
export function fluxoDoModelo(modelo, conteudo) {
  const { publicado, icone, ...resto } = conteudo || {}
  return { ...resto, nome: modelo.nome }
}
