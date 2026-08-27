export default {
  tipo: "entrada_numero",
  categoria: "entrada",
  rotulo: "Número",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" },
    { nome: "minimo", rotulo: "Mínimo", tipo: "numero" },
    { nome: "maximo", rotulo: "Máximo", tipo: "numero" }
  ],
  campo_html: { type: "text", inputmode: "decimal" },
  validar: (valor) => {
    if (typeof valor !== "string" || valor.trim() === "") return false
    return !Number.isNaN(Number(valor.replace(",", ".")))
  },
  erro: "Digite um número."
}
