const MARCADOR = /\{\{\s*([\w.]+)\s*\}\}/g

export function interpolar(texto, contexto = {}) {
  if (typeof texto !== "string") return ""
  return texto.replace(MARCADOR, (_, chave) => {
    const valor = contexto[chave]
    if (valor === undefined || valor === null) return ""
    return String(valor)
  })
}
