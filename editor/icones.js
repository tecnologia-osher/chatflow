// Um ícone por tipo, desenhado em traço simples de 16px. Ler a paleta e o
// cartão vira reconhecer a forma, não soletrar a palavra.
export const ICONE_DO_TIPO = {
  texto: "M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z",
  imagem: "M2.5 3.5h11v9h-11zM2.5 10l3-3 2.5 2.5 2-2 3.5 3.5M10.5 6.2h.01",
  video: "M2.5 3.5h11v9h-11zM6.8 6.3l3.7 2.2-3.7 2.2z",
  entrada_texto: "M2.5 4.5h11v7h-11zM5 8h4",
  entrada_numero: "M2.5 4.5h11v7h-11zM5.5 10.2V6.5l-1.3 1",
  entrada_email: "M2.5 4h11v8h-11zM2.5 4.6l5.5 4 5.5-4",
  entrada_telefone: "M5.6 2.8h4.8v10.4H5.6zM7.4 11.6h1.2",
  entrada_data: "M2.8 4.3h10.4v9H2.8zM2.8 7h10.4M5.6 2.6v2.4M10.4 2.6v2.4",
  entrada_botoes: "M2.8 3.6h10.4v3.2H2.8zM2.8 9.2h10.4v3.2H2.8z",
  condicao: "M8 2.6l3.4 3.4L8 9.4 4.6 6zM8 9.4v4",
  definir_variavel: "M4.4 3.2C3 5 3 11 4.4 12.8M11.6 3.2C13 5 13 11 11.6 12.8M6.4 6.4l3.2 3.2M9.6 6.4l-3.2 3.2",
  ir_para: "M3 8h9M8.6 4.6L12 8l-3.4 3.4",
  redirecionar: "M9 3.2h3.8V7M12.8 3.2L7.6 8.4M11.4 9.2v3.6H3.2V4.6h3.6",
  webhook: "M5.2 6.6a2.8 2.8 0 1 1 4.3 2.4M10.8 9.4a2.8 2.8 0 1 1-4.3-2.4M8 13.2a2.8 2.8 0 1 1 0-5.6"
}

export function iconeDoTipo(tipo, classe = "ed__tipo-icone") {
  const caminho = ICONE_DO_TIPO[tipo]
  if (!caminho) return null
  const SVG = "http://www.w3.org/2000/svg"
  const desenho = document.createElementNS(SVG, "svg")
  desenho.setAttribute("class", classe)
  desenho.setAttribute("viewBox", "0 0 16 16")
  const traco = document.createElementNS(SVG, "path")
  traco.setAttribute("d", caminho)
  desenho.append(traco)
  return desenho
}
