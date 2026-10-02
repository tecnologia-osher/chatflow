// A aba Resultados: uma linha por pessoa que entrou no chat, com o que ela
// respondeu até onde chegou.
//
// As colunas saem do fluxo, não dos dados: pergunta nova no editor já aparece
// como coluna, mesmo antes de alguém responder. O que vier na planilha e não
// estiver no fluxo entra no fim — esconder dado que existe seria pior do que
// uma coluna a mais.

const CONTROLE = ["sessaoId", "situacao", "atualizadoEm", "ultimoGrupo", "ultimoBloco"]

export const COLUNAS_FIXAS = [
  { chave: "atualizadoEm", rotulo: "Quando" },
  { chave: "situacao", rotulo: "Situação" }
]

// As variáveis que o fluxo guarda, na ordem em que o chat as pergunta — cada
// uma com o nome do **grupo** onde a pergunta mora.
//
// A coluna é o grupo porque é assim que a pessoa pensa o fluxo: "o que o lead
// respondeu na Idade". Quando um grupo pergunta duas coisas, a segunda vira
// "Contato (1)", a terceira "Contato (2)" — o nome do grupo continua à vista
// e a ordem diz qual pergunta é.
//
// Grupo que não pergunta nada não vira coluna: não há o que mostrar ali.
export function variaveisDoFluxo(fluxo) {
  const vistas = new Set()
  const lista = []
  for (const grupo of fluxo?.grupos || []) {
    if (!grupo) continue
    const titulo = grupo.titulo || grupo.id
    let quantas = 0
    for (const bloco of grupo.blocos || []) {
      if (!bloco?.salvar_em || vistas.has(bloco.salvar_em)) continue
      vistas.add(bloco.salvar_em)
      const rotulo = quantas === 0 ? titulo : `${titulo} (${quantas})`
      quantas += 1
      lista.push({ chave: bloco.salvar_em, rotulo })
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
