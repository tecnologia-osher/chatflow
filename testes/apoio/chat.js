// Monta um chat de verdade num hospedeiro de mentira e devolve as alavancas
// que um teste precisa: o que está escrito na tela, o que dá para acionar
// agora, o que foi para a rede, e como responder.

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
  retomar = true,
  // Testes não esperam de verdade: sem ritmo não há pausa e a suíte
  // continua em milissegundos. Quem quiser exercitar a digitação passa
  // um ritmo e um relógio manual.
  ritmo = { piso: 0, porCaractere: 0, teto: 0 },
  esperar
} = {}) {
  limparAvisos()

  const enviados = []
  const hospedeiro = new Elemento("div")

  const chat = criarChat({
    elemento: hospedeiro, fluxo, tema, destinos, modo, chaveSessao, armazenamento,
    ritmo, esperar,
    buscar: async (url, opcoes) => {
      enviados.push({ url, corpo: JSON.parse(opcoes.body) })
      return redeResponde(url, opcoes)
    }
  })

  // Tudo o que a pessoa aciona mora na conversa, do lado dela: o campo de
  // texto com o enviar numa caixa, os botões de escolha e o link de saída
  // noutra. Um teste não deveria ter que saber de qual das duas cada coisa
  // veio.
  const entrada = () => hospedeiro.porClasse("cf__entrada")[0]
  const opcoes = () => hospedeiro.porClasse("cf__opcoes")[0]

  const painel = {
    hospedeiro,
    chat,
    armazenamento,
    estado: () => chat.estado(),

    // O que a pessoa vê
    bolhas: () => hospedeiro.porClasse("cf__bolha")
      .filter((b) => !b.className.includes("cf__digitando"))
      .map((b) => b.textContent),
    digitando: () => hospedeiro.porClasse("cf__digitando").length,
    erro: () => hospedeiro.porClasse("cf__erro")[0]?.textContent ?? "",
    aviso: () => hospedeiro.porClasse("cf__aviso")[0]?.textContent ?? "",
    campo: () => hospedeiro.porClasse("cf__campo")[0] ?? null,
    controles: () => [...(entrada()?.filhos ?? []), ...(opcoes()?.filhos ?? [])],
    rotulos: () => painel.controles().map((c) => c.textContent),

    // O que foi para a rede
    enviados: () => enviados.map((e) => ({ ...e })),
    leads: () => enviados.filter((e) => e.corpo.finalizadoEm).map((e) => e.corpo),
    eventos: () => enviados.filter((e) => e.corpo.event).map((e) => e.corpo),
    avisos,

    // O que a pessoa faz
    async digitar(valor) {
      const [campo, botao] = entrada().filhos
      campo.value = valor
      botao.click()
      await assentar()
    },
    async escolher(rotulo) {
      const botao = painel.controles().find((c) => c.textContent === rotulo)
      if (!botao) {
        throw new Error(
          `Não há opção "${rotulo}" na tela. Tem: ${JSON.stringify(painel.rotulos())}`
        )
      }
      botao.click()
      await assentar()
    }
  }

  painel.pronto = chat.reiniciar({ retomar })
  await assentar()
  return painel
}
