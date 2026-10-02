// A aba Resultados: uma linha por pessoa que entrou no chat, com o que ela
// respondeu até onde chegou.
//
// As colunas saem do fluxo, não dos dados: pergunta nova no editor já aparece
// como coluna, mesmo antes de alguém responder. O que vier na planilha e não
// estiver no fluxo entra no fim — esconder dado que existe seria pior do que
// uma coluna a mais.

import { obter } from "./catalogo.js"

const CONTROLE = ["sessaoId", "situacao", "atualizadoEm", "ultimoGrupo", "ultimoBloco"]

export const COLUNAS_FIXAS = [
  { chave: "atualizadoEm", rotulo: "Quando" },
  { chave: "situacao", rotulo: "Situação" }
]

// As variáveis que o fluxo guarda, na ordem em que o chat as pergunta.
export function variaveisDoFluxo(fluxo) {
  const vistas = new Set()
  const lista = []
  for (const grupo of fluxo?.grupos || []) {
    for (const bloco of grupo?.blocos || []) {
      if (!bloco?.salvar_em || vistas.has(bloco.salvar_em)) continue
      vistas.add(bloco.salvar_em)
      let rotulo = bloco.salvar_em
      try {
        rotulo = bloco.conteudo?.rotulo || bloco.conteudo?.texto || obter(bloco.tipo).rotulo
      } catch { /* tipo fora do catálogo: fica o nome da variável */ }
      lista.push({ chave: bloco.salvar_em, rotulo: String(rotulo).slice(0, 40) })
    }
  }
  return lista
}

export function colunasDosResultados(fluxo, linhas = []) {
  const colunas = [...COLUNAS_FIXAS, ...variaveisDoFluxo(fluxo)]
  const conhecidas = new Set([...colunas.map((c) => c.chave), ...CONTROLE])
  for (const linha of linhas) {
    for (const chave of Object.keys(linha || {})) {
      if (conhecidas.has(chave)) continue
      conhecidas.add(chave)
      colunas.push({ chave, rotulo: chave, extra: true })
    }
  }
  return colunas
}

// Data em formato de gente. Entrada que não é data volta como veio: é melhor
// mostrar o texto estranho do que esconder a linha.
export function quando(valor) {
  const data = new Date(valor)
  if (!valor || Number.isNaN(data.getTime())) return String(valor || "")
  const dois = (n) => String(n).padStart(2, "0")
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)} ${dois(data.getHours())}:${dois(data.getMinutes())}`
}

export function valorNaColuna(linha, coluna) {
  const valor = linha?.[coluna.chave]
  if (valor === undefined || valor === null || valor === "") return ""
  return coluna.chave === "atualizadoEm" ? quando(valor) : String(valor)
}
