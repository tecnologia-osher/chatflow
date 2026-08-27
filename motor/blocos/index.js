import { registrar } from "./_registro.js"

import texto from "./texto.js"
import imagem from "./imagem.js"
import entradaTexto from "./entrada-texto.js"
import entradaNumero from "./entrada-numero.js"
import entradaEmail from "./entrada-email.js"
import entradaTelefone from "./entrada-telefone.js"
import entradaData from "./entrada-data.js"
import entradaBotoes from "./entrada-botoes.js"
import condicao from "./condicao.js"
import definirVariavel from "./definir-variavel.js"
import irPara from "./ir-para.js"
import redirecionar from "./redirecionar.js"
import webhook from "./webhook.js"

export const CATALOGO_V1 = [
  texto, imagem,
  entradaTexto, entradaNumero, entradaEmail, entradaTelefone, entradaData, entradaBotoes,
  condicao, definirVariavel, irPara,
  redirecionar, webhook
]

export function registrarTodos() {
  for (const definicao of CATALOGO_V1) registrar(definicao)
}
