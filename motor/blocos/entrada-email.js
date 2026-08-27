export default {
  tipo: "entrada_email",
  categoria: "entrada",
  rotulo: "E-mail",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  validar: (valor) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(valor || "")),
  erro: "Digite um e-mail válido."
}
