// Monta um chat de verdade num hospedeiro de mentira e devolve as alavancas
// que um teste precisa: o que está escrito na tela, o que está no composer,
// o que foi para a rede, e como responder.

import {
  instalarNavegador, Elemento, criarArmazenamento, assentar,
  limparAvisos, avisos
} from "./navegador.js"

instalarNavegador()

const { criarChat } = await import("../../motor/motor.js")

export { criarArmazenamento, assentar, avisos }

export async function montarChat({
  fluxo,
  destinos,
  tema,
  modo = "producao",
  chaveSessao = "teste",
  armazenamento = criarArmazenamento(),
  redeResponde = async () => ({ ok: true }),
  retomar = true
} = {}) {
  limparAvisos()

  const enviados = []
  const hospedeiro = new Elemento("div")

  const chat = criarChat({
    elemento: hospedeiro, fluxo, tema, destinos, modo, chaveSessao, armazenamento,
    buscar: async (url, opcoes) => {
      enviados.push({ url, corpo: JSON.parse(opcoes.body) })
      return redeResponde(url, opcoes)
    }
  })

  const composer = () => hospedeiro.porClasse("cf__composer")[0]

  const painel = {
    hospedeiro,
    chat,
    armazenamento,
    estado: () => chat.estado(),

    // O que a pessoa vê
    bolhas: () => hospedeiro.porClasse("cf__bolha").map((b) => b.textContent),
    erro: () => hospedeiro.porClasse("cf__erro")[0]?.textContent ?? "",
    aviso: () => hospedeiro.porClasse("cf__aviso")[0]?.textContent ?? "",
    campo: () => hospedeiro.porClasse("cf__campo")[0] ?? null,
    controles: () => composer().filhos,
    rotulos: () => composer().filhos.map((c) => c.textContent),

    // O que foi para a rede
    enviados: () => enviados.map((e) => ({ ...e })),
    leads: () => enviados.filter((e) => e.corpo.finalizadoEm).map((e) => e.corpo),
    eventos: () => enviados.filter((e) => e.corpo.event).map((e) => e.corpo),
    avisos,

    // O que a pessoa faz
    async digitar(valor) {
      const [campo, botao] = composer().filhos
      campo.value = valor
      botao.click()
      await assentar()
    },
    async escolher(rotulo) {
      const botao = composer().filhos.find((c) => c.textContent === rotulo)
      if (!botao) {
        throw new Error(
          `Não há opção "${rotulo}" na tela. Tem: ${JSON.stringify(painel.rotulos())}`
        )
      }
      botao.click()
      await assentar()
    }
  }

  chat.reiniciar({ retomar })
  await assentar()
  return painel
}
