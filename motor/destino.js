// Para onde uma ligação aponta.
//
// "g_contato" entra no grupo pelo começo, como sempre foi. "g_contato#b_fone"
// entra naquele bloco, pulando os de cima — é o que permite reaproveitar o
// miolo de um grupo em vez de copiar os blocos num grupo novo.
//
// O formato é texto, e não objeto, de propósito: `proximo` é comparado,
// guardado em JSON e escolhido em lista solta por todo o motor e o editor.
export const SEPARADOR = "#"

export function partesDoDestino(valor) {
  const texto = typeof valor === "string" ? valor : ""
  const corte = texto.indexOf(SEPARADOR)
  if (corte === -1) return { grupo: texto, bloco: null }
  return { grupo: texto.slice(0, corte), bloco: texto.slice(corte + 1) || null }
}

export function grupoDoDestino(valor) {
  return partesDoDestino(valor).grupo
}

export function montarDestino(grupo, bloco) {
  return bloco ? `${grupo}${SEPARADOR}${bloco}` : grupo
}
