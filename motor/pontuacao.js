export function pontuacaoAtiva(fluxo) {
  return Boolean(fluxo && fluxo.pontuacao && fluxo.pontuacao.ativa)
}

export function classificar(pontos, faixas) {
  if (!faixas || typeof faixas !== "object" || Array.isArray(faixas)) return null
  const ordenadas = Object.entries(faixas)
    .filter(([, corte]) => typeof corte === "number")
    .sort((a, b) => b[1] - a[1])
  if (ordenadas.length === 0) return null
  for (const [nome, corte] of ordenadas) {
    if (pontos >= corte) return nome
  }
  return "frio"
}
