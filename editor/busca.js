// Procurar um tipo na coluna da esquerda. São catorze tipos em quatro grupos:
// quem sabe o nome não devia precisar caçar com os olhos.

// Sem acento, sem caixa alta, sem espaço sobrando. "video" acha "Vídeo" e
// "botao" acha "Botões" — ninguém digita acento quando está com pressa.
export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export function palavrasDe(termo) {
  return normalizar(termo).split(/\s+/).filter(Boolean)
}

// Combina quando TODAS as palavras do que se digitou aparecem em algum dos
// textos do item. Exigir todas é o que faz "entrada texto" achar um item só,
// em vez dos sete que têm "texto" em algum lugar.
export function combina(termo, ...textos) {
  const palavras = palavrasDe(termo)
  if (!palavras.length) return true
  const alvo = textos.map(normalizar).join(" ")
  return palavras.every((palavra) => alvo.includes(palavra))
}

// Filtra uma lista de itens. `textosDe` diz onde procurar em cada um — o
// rótulo que está na tela e o nome do grupo, porque os dois são nomes que a
// pessoa conhece.
export function filtrar(lista, termo, textosDe) {
  if (!palavrasDe(termo).length) return lista
  return lista.filter((item) => combina(termo, ...textosDe(item)))
}
