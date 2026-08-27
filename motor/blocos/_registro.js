const CATEGORIAS = ["fala", "entrada", "logica", "conexao"]

const catalogo = new Map()

function congelarProfundo(objeto) {
  Object.freeze(objeto)
  if (Array.isArray(objeto.campos)) {
    Object.freeze(objeto.campos)
    objeto.campos.forEach((campo) => Object.freeze(campo))
  }
  return objeto
}

function conferir(definicao) {
  if (!definicao || typeof definicao.tipo !== "string" || !definicao.tipo) {
    throw new Error("Definição de bloco precisa de um tipo.")
  }
  if (!CATEGORIAS.includes(definicao.categoria)) {
    throw new Error(
      `Bloco "${definicao.tipo}": categoria inválida. Use uma de: ${CATEGORIAS.join(", ")}.`
    )
  }
  if (typeof definicao.rotulo !== "string" || !definicao.rotulo) {
    throw new Error(`Bloco "${definicao.tipo}": rotulo é obrigatório.`)
  }
  if (typeof definicao.ramifica !== "boolean") {
    throw new Error(`Bloco "${definicao.tipo}": ramifica precisa ser booleano.`)
  }
  if (typeof definicao.salva_variavel !== "boolean") {
    throw new Error(`Bloco "${definicao.tipo}": salva_variavel precisa ser booleano.`)
  }
  if (!Array.isArray(definicao.campos)) {
    throw new Error(`Bloco "${definicao.tipo}": campos precisa ser uma lista.`)
  }
}

export function registrar(definicao) {
  conferir(definicao)
  if (catalogo.has(definicao.tipo)) {
    throw new Error(`Bloco "${definicao.tipo}" já registrado.`)
  }
  const copia = { ...definicao }
  if (definicao.campos) {
    copia.campos = [...definicao.campos].map((campo) => ({ ...campo }))
  }
  catalogo.set(definicao.tipo, congelarProfundo(copia))
}

export function obter(tipo) {
  const definicao = catalogo.get(tipo)
  if (!definicao) throw new Error(`Bloco de tipo "${tipo}" não existe no catálogo.`)
  return definicao
}

export function todos() {
  return [...catalogo.values()]
}

export function limpar() {
  catalogo.clear()
}
