import { registrar } from "./_registro.js"

import texto from "./texto.js"
import imagem from "./imagem.js"
import video from "./video.js"
import incorporar from "./incorporar.js"
import audio from "./audio.js"
import entradaTexto from "./entrada-texto.js"
import entradaNumero from "./entrada-numero.js"
import entradaEmail from "./entrada-email.js"
import entradaTelefone from "./entrada-telefone.js"
import entradaData from "./entrada-data.js"
import entradaHora from "./entrada-hora.js"
import entradaUrl from "./entrada-url.js"
import entradaBotoes from "./entrada-botoes.js"
import entradaAvaliacao from "./entrada-avaliacao.js"
import entradaImagens from "./entrada-imagens.js"
import entradaCartoes from "./entrada-cartoes.js"
import condicao from "./condicao.js"
import definirVariavel from "./definir-variavel.js"
import irPara from "./ir-para.js"
import redirecionar from "./redirecionar.js"
import webhook from "./webhook.js"

export const CATALOGO_V1 = [
  texto, imagem, video, audio, incorporar,
  entradaTexto, entradaNumero, entradaEmail, entradaUrl,
  entradaData, entradaHora, entradaTelefone,
  entradaBotoes, entradaImagens, entradaCartoes, entradaAvaliacao,
  condicao, definirVariavel, irPara,
  redirecionar, webhook
]

export function registrarTodos() {
  for (const definicao of CATALOGO_V1) registrar(definicao)
}
