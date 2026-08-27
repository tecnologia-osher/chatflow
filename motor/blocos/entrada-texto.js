const CAMPOS_ENTRADA = [
  { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
  { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
]

export default {
  tipo: "entrada_texto",
  categoria: "entrada",
  rotulo: "Texto",
  ramifica: false,
  salva_variavel: true,
  campos: CAMPOS_ENTRADA,
  campo_html: { type: "text" },
  validar: (valor) => typeof valor === "string" && valor.trim().length > 0,
  erro: "Escreva uma resposta."
}
