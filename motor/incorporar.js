// A bolha que mostra uma página dentro da conversa: um PDF, um formulário, um
// site. O que se cola pode ser o endereço ou o código de incorporar inteiro,
// que é o que a maioria dos serviços dá de copiar.

export const ALTURA_PADRAO = 400
// Mais alto que isto não cabe na tela de ninguém, e a conversa some embaixo.
export const ALTURA_MAXIMA = 1200
export const ALTURA_MINIMA = 80

// Um `<iframe src="...">` colado inteiro: tira-se o endereço de dentro dele.
// Quem copia de um serviço de PDF ou de formulário recebe o código, não o
// link — exigir que a pessoa extraia o src na mão é trabalho de editor.
const SRC_DE_IFRAME = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i

export function enderecoIncorporado(texto) {
  const bruto = String(texto || "").trim()
  if (!bruto) return ""
  const doCodigo = SRC_DE_IFRAME.exec(bruto)
  if (doCodigo) return doCodigo[1].trim()
  // Só entra o que é endereço: `javascript:` e companhia não viram iframe.
  if (/^(https?:)?\/\//i.test(bruto)) return bruto
  return ""
}

export function alturaIncorporada(valor) {
  const numero = Number.parseInt(valor, 10)
  if (!Number.isFinite(numero)) return ALTURA_PADRAO
  return Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, numero))
}
