// Edições do fluxo. Puras e imutáveis: recebem fluxo, devolvem fluxo novo.
//
// Nenhuma delas conhece tipo de bloco: o que um tipo novo traz de padrão sai
// dos `campos` que ele mesmo declara.

import { obter, todos } from "./catalogo.js"

function trocarGrupo(fluxo, id, transformar) {
  const grupos = fluxo.grupos || []
  const indice = grupos.findIndex((g) => g && g.id === id)
  if (indice === -1) return fluxo
  const novo = transformar(grupos[indice])
  if (novo === grupos[indice]) return fluxo
  return { ...fluxo, grupos: grupos.map((g, i) => (i === indice ? novo : g)) }
}

function trocarBloco(fluxo, idGrupo, idBloco, transformar) {
  return trocarGrupo(fluxo, idGrupo, (grupo) => {
    const blocos = grupo.blocos || []
    const indice = blocos.findIndex((b) => b && b.id === idBloco)
    if (indice === -1) return grupo
    const novo = transformar(blocos[indice])
    if (novo === blocos[indice]) return grupo
    return { ...grupo, blocos: blocos.map((b, i) => (i === indice ? novo : b)) }
  })
}

// Um valor em branco some do JSON em vez de virar string vazia: campo vazio
// gravado é ruído que depois ninguém sabe se foi intenção ou descuido.
function comCampo(objeto, chave, valor) {
  const limpo = typeof valor === "string" ? valor.trim() : valor
  const copia = { ...objeto }
  if (limpo === "" || limpo === undefined || limpo === null) delete copia[chave]
  else copia[chave] = valor
  return copia
}

function idsEmUso(fluxo) {
  const usados = new Set()
  for (const g of fluxo.grupos || []) {
    if (!g) continue
    usados.add(g.id)
    for (const b of g.blocos || []) if (b) usados.add(b.id)
  }
  return usados
}

function idNovo(fluxo, prefixo) {
  const usados = idsEmUso(fluxo)
  for (let n = 1; ; n++) {
    const tentativa = `${prefixo}${n}`
    if (!usados.has(tentativa)) return tentativa
  }
}

// --- campos ----------------------------------------------------------------

export function definirCampo(fluxo, { grupo, bloco, campo, valor }) {
  return trocarBloco(fluxo, grupo, bloco, (b) => ({
    ...b, conteudo: comCampo(b.conteudo || {}, campo, valor)
  }))
}

export function definirSalvarEm(fluxo, { grupo, bloco, valor }) {
  return trocarBloco(fluxo, grupo, bloco, (b) => comCampo(b, "salvar_em", valor))
}

export function definirTitulo(fluxo, { grupo, valor }) {
  return trocarGrupo(fluxo, grupo, (g) => comCampo(g, "titulo", valor))
}

export function definirProximo(fluxo, { grupo, valor }) {
  return trocarGrupo(fluxo, grupo, (g) => comCampo(g, "proximo", valor))
}

export function moverGrupo(fluxo, { grupo, x, y }) {
  return trocarGrupo(fluxo, grupo, (g) => ({
    ...g, posicao: { x: Math.round(x), y: Math.round(y) }
  }))
}

// --- blocos ----------------------------------------------------------------

function blocoNovo(fluxo, tipo) {
  const definicao = obter(tipo)
  const conteudo = {}
  for (const campo of definicao?.campos || []) {
    if (campo.padrao !== undefined) conteudo[campo.nome] = campo.padrao
  }
  const bloco = { id: idNovo(fluxo, "b"), tipo, conteudo }
  // Entrada sem `salvar_em` é erro de validação na hora de rodar. Nascer já
  // com um nome evita que o fluxo fique quebrado entre um clique e outro.
  if (definicao?.salva_variavel) bloco.salvar_em = idNovo(fluxo, "resposta")
  return bloco
}

export function acrescentarBloco(fluxo, { grupo, tipo, apos = null }) {
  if (!obter(tipo)) return fluxo
  const novo = blocoNovo(fluxo, tipo)
  return trocarGrupo(fluxo, grupo, (g) => {
    const blocos = [...(g.blocos || [])]
    const onde = apos ? blocos.findIndex((b) => b && b.id === apos) : -1
    if (onde === -1) blocos.push(novo)
    else blocos.splice(onde + 1, 0, novo)
    return { ...g, blocos }
  })
}

export function removerBloco(fluxo, { grupo, bloco }) {
  return trocarGrupo(fluxo, grupo, (g) => {
    const blocos = (g.blocos || []).filter(Boolean)
    if (!blocos.some((b) => b.id === bloco)) return g
    return { ...g, blocos: blocos.filter((b) => b.id !== bloco) }
  })
}

export function moverBloco(fluxo, { grupo, bloco, direcao }) {
  return trocarGrupo(fluxo, grupo, (g) => {
    const blocos = [...(g.blocos || [])]
    const de = blocos.findIndex((b) => b && b.id === bloco)
    const para = de + direcao
    if (de === -1 || para < 0 || para >= blocos.length) return g
    ;[blocos[de], blocos[para]] = [blocos[para], blocos[de]]
    return { ...g, blocos }
  })
}

// --- grupos ----------------------------------------------------------------

export function criarGrupo(fluxo, { x = 0, y = 0, titulo } = {}) {
  const id = idNovo(fluxo, "g")
  return {
    ...fluxo,
    grupos: [...(fluxo.grupos || []), {
      id, titulo: titulo || `Grupo ${id}`, posicao: { x: Math.round(x), y: Math.round(y) }, blocos: []
    }]
  }
}

export { todos as tiposDisponiveis }

// --- opções do bloco de botões ---------------------------------------------

function trocarOpcoes(fluxo, grupo, bloco, transformar) {
  return trocarBloco(fluxo, grupo, bloco, (b) => {
    const conteudo = b.conteudo || {}
    const atuais = Array.isArray(conteudo.opcoes) ? conteudo.opcoes.filter(Boolean) : []
    const novas = transformar(atuais)
    if (novas === atuais) return b
    return { ...b, conteudo: { ...conteudo, opcoes: novas } }
  })
}

export function definirOpcao(fluxo, { grupo, bloco, opcao, campo, valor }) {
  return trocarOpcoes(fluxo, grupo, bloco, (opcoes) => {
    const indice = opcoes.findIndex((o) => o.id === opcao)
    if (indice === -1) return opcoes
    // Pontuação precisa ser número: em texto, a soma vira concatenação e a
    // classificação sai errada sem ninguém perceber.
    const tratado = campo === "pontos" && String(valor).trim() !== "" ? Number(valor) : valor
    if (campo === "pontos" && tratado !== "" && Number.isNaN(tratado)) return opcoes
    return opcoes.map((o, i) => (i === indice ? comCampo(o, campo, tratado) : o))
  })
}

export function acrescentarOpcao(fluxo, { grupo, bloco }) {
  return trocarOpcoes(fluxo, grupo, bloco, (opcoes) => {
    const usados = new Set(opcoes.map((o) => o.id))
    let n = 1
    while (usados.has(`o${n}`)) n++
    return [...opcoes, { id: `o${n}`, label: `Opção ${n}` }]
  })
}

export function removerOpcao(fluxo, { grupo, bloco, opcao }) {
  return trocarOpcoes(fluxo, grupo, bloco, (opcoes) => {
    // Botões sem opção nenhuma deixam a pessoa sem saída no chat: o bloco
    // espera resposta e não oferece nenhuma.
    if (opcoes.length <= 1) return opcoes
    const restantes = opcoes.filter((o) => o.id !== opcao)
    return restantes.length === opcoes.length ? opcoes : restantes
  })
}
