// Quantas estrelas uma avaliação tem. Mora fora do motor e fora do editor
// porque os dois precisam do mesmo número: o motor para desenhar a fileira, o
// editor para não deixar ninguém pedir uma fileira que não existe.
//
// Entre 3 e 10: menos de três não é escala, e mais de dez não cabe na largura
// de um celular sem virar uma fileira de pontinhos.
export const ESTRELAS_PADRAO = 5
export const ESTRELAS_MIN = 3
export const ESTRELAS_MAX = 10

export function quantasEstrelas(valor) {
  const n = Math.floor(Number(valor))
  if (!Number.isFinite(n) || n <= 0) return ESTRELAS_PADRAO
  return Math.min(ESTRELAS_MAX, Math.max(ESTRELAS_MIN, n))
}
