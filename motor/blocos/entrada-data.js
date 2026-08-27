export default {
  tipo: "entrada_data",
  categoria: "entrada",
  rotulo: "Data",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  validar: (valor) => {
    const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(valor || ""))
    if (!partes) return false
    const [, d, m, a] = partes.map(Number)
    const data = new Date(a, m - 1, d)
    return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d
  },
  erro: "Use o formato dia/mês/ano, como 27/08/2026."
}
