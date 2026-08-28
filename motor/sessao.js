const PREFIXO = "chatflow:"

export function criarSessao({
  chave,
  armazenamento,
  agora = () => Date.now(),
  // Trinta minutos cobre o caso real — recarreguei sem querer, saí para o
  // WhatsApp e voltei — sem ressuscitar uma conversa de ontem, que devolveria
  // a pessoa ao meio de um diálogo que ela não lembra.
  validadePorMinutos = 30
} = {}) {
  const endereco = `${PREFIXO}${chave || "padrao"}`
  const validadeEmMs = validadePorMinutos * 60 * 1000

  function apagar() {
    try {
      armazenamento.removeItem(endereco)
    } catch {
      /* armazenamento indisponível: seguir sem retomada */
    }
  }

  return {
    salvar(estado) {
      try {
        armazenamento.setItem(endereco, JSON.stringify({ em: agora(), estado }))
      } catch {
        /* armazenamento indisponível: seguir sem retomada */
      }
    },

    carregar() {
      let bruto = null
      try {
        bruto = armazenamento.getItem(endereco)
      } catch {
        return null
      }
      if (!bruto) return null

      let pacote
      try {
        pacote = JSON.parse(bruto)
      } catch {
        apagar()
        return null
      }

      if (!pacote || typeof pacote.em !== "number" || !pacote.estado) {
        apagar()
        return null
      }
      if (agora() - pacote.em > validadeEmMs) {
        apagar()
        return null
      }
      return pacote.estado
    },

    limpar: apagar
  }
}
