const PREFIXO = "chatflow:"

export function criarSessao({
  chave,
  armazenamento,
  agora = () => Date.now(),
  validadePorHoras = 24
} = {}) {
  const endereco = `${PREFIXO}${chave || "padrao"}`
  const validadeEmMs = validadePorHoras * 60 * 60 * 1000

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
