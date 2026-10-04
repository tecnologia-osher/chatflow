export default {
  tipo: "entrada_hora",
  categoria: "entrada",
  rotulo: "Hora",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  // O campo nativo: no celular ele abre o relógio do sistema, que é muito
  // melhor do que qualquer máscara que a gente escrevesse. Ele já entrega
  // "HH:MM" em 24 horas, mesmo onde a pessoa vê AM/PM na tela.
  campo_html: { type: "time" },
  validar: (valor) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || "")),
  erro: "Use o formato hora:minuto, como 14:30."
}
