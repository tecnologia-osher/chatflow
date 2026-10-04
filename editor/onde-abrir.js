// Onde uma caixa flutuante abre, em coordenadas do quadro.
//
// Mora aqui porque é conta, e conta se prova sem navegador: no dublê de DOM a
// caixa não tem tamanho até alguém medi-la, e forçar um tamanho nela provaria
// o dublê, não a regra.

export const FOLGA = 12

export function ondeAbrirACaixa({ alvo, area, caixa, folga = FOLGA }) {
  // Abre à direita do bloco; se não couber, à esquerda. Nunca com o começo
  // fora do quadro: caixa cortada pela beira é caixa que não dá para
  // preencher.
  const cabeNaDireita = alvo.right + folga + caixa.largura <= area.right
  const x = cabeNaDireita
    ? alvo.right - area.left + folga
    : alvo.left - area.left - folga - caixa.largura

  // Alinhada pelo topo do bloco. Se o pé dela passar do quadro, sobe o
  // tanto que falta — e para de subir na beira de cima, porque uma caixa mais
  // alta que o quadro tem de mostrar pelo menos o começo.
  const alturaUtil = area.bottom - area.top
  const topo = alvo.top - area.top
  const maximo = alturaUtil - caixa.altura - folga
  const y = Math.max(folga, Math.min(topo, maximo))

  return { x: Math.max(folga, x), y }
}
