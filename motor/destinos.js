const MAX_TENTATIVAS = 3
const URL_DE_EXEMPLO = /^COLE_AQUI/i

function utilizavel(destino) {
  if (!destino) return { ok: false, motivo: "não existe em destinos.json" }
  if (destino.ativo === false) return { ok: false, motivo: null }
  if (!destino.url) return { ok: false, motivo: "está sem URL" }
  if (URL_DE_EXEMPLO.test(destino.url)) {
    return { ok: false, motivo: "não configurado: a URL ainda é o texto de exemplo" }
  }
  return { ok: true, motivo: null }
}

export function criarEnviador({
  destinos = {},
  ao_finalizar = [],
  eventos = null,
  buscar,
  avisar = (m) => console.warn(m)
} = {}) {
  const pendentes = []
  const jaAvisados = new Set()

  function avisarUmaVez(chave, mensagem) {
    if (jaAvisados.has(chave)) return
    jaAvisados.add(chave)
    avisar(mensagem)
  }

  async function entregar(nomeDestino, dados) {
    const destino = destinos[nomeDestino]
    const estado = utilizavel(destino)

    if (!estado.ok) {
      if (estado.motivo) {
        avisarUmaVez(nomeDestino, `chatflow: destino "${nomeDestino}" ${estado.motivo}. Nada será enviado.`)
      }
      return { entregue: true }
    }

    try {
      const resposta = await buscar(destino.url, {
        method: "POST",
        body: JSON.stringify(dados)
      })
      if (resposta && resposta.ok === false) return { entregue: false }
      return { entregue: true }
    } catch {
      return { entregue: false }
    }
  }

  async function tentar(nomeDestino, dados, tentativasAnteriores = 0) {
    const { entregue } = await entregar(nomeDestino, dados)
    if (entregue) return
    const tentativas = tentativasAnteriores + 1
    if (tentativas >= MAX_TENTATIVAS) {
      avisar(`chatflow: desisti de enviar para "${nomeDestino}" após ${tentativas} tentativas.`)
      return
    }
    pendentes.push({ destino: nomeDestino, dados, tentativas })
  }

  return {
    async enviar(dados) {
      if (ao_finalizar.length === 0) {
        avisarUmaVez("__nenhum__", "chatflow: nenhum destino em ao_finalizar. As respostas não serão salvas.")
        return
      }
      for (const nome of ao_finalizar) await tentar(nome, dados)
    },

    async enviarEvento(dados) {
      if (!eventos) return
      await entregar(eventos, dados)
    },

    async processarFila() {
      const itens = pendentes.splice(0, pendentes.length)
      for (const item of itens) {
        await tentar(item.destino, item.dados, item.tentativas)
      }
    },

    fila() {
      return pendentes.map((item) => ({ ...item }))
    }
  }
}
