export default {
  tipo: "entrada_telefone",
  categoria: "entrada",
  rotulo: "Telefone",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  validar: (valor) => {
    const digitos = String(valor || "").replace(/\D/g, "")
    return digitos.length >= 10 && digitos.length <= 13
  },
  erro: "Digite um telefone com DDD."
}
