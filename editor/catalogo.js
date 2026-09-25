// Acesso ao catálogo do motor, tolerante a tipo desconhecido.
//
// O editor mostra o que existe e não pode cair por causa de um fluxo que cita
// um tipo que ninguém registrou — é exatamente o arquivo que precisa ser
// aberto para ser consertado.

import { registrarTodos } from "../motor/blocos/index.js"
import { todos as todosDoRegistro, obter as obterDoRegistro } from "../motor/blocos/_registro.js"

if (todosDoRegistro().length === 0) registrarTodos()

export function obter(tipo) {
  try {
    return obterDoRegistro(tipo)
  } catch {
    return null
  }
}

export function todos() {
  return todosDoRegistro()
}
