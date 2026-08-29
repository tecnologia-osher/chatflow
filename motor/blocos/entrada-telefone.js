// Os DDDs que existem no Brasil. É esta lista que separa um telefone de uma
// sequência de dígitos: sem ela, "1234567890" passa como um fixo de São José
// dos Campos e o lead chega com um número que não é de ninguém.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99
])

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
  campo_html: { type: "tel" },
  // Celular, não telefone qualquer: quem responde isto está dando o número
  // pelo qual vai ser procurado, e desde 2016 todo celular brasileiro tem
  // nove dígitos começados em 9. Aceitar um fixo aqui seria aceitar um
  // número em que ninguém consegue mandar mensagem.
  validar: (valor) => {
    let digitos = String(valor || "").replace(/\D/g, "")
    // O DDI do Brasil é opcional: "+55 61 ..." e "61 ..." são o mesmo número.
    if (digitos.length === 13 && digitos.startsWith("55")) digitos = digitos.slice(2)
    if (digitos.length !== 11) return false
    if (!DDDS.has(Number(digitos.slice(0, 2)))) return false

    const numero = digitos.slice(2)
    if (numero[0] !== "9") return false
    // 999999999 e 888888888 não são de ninguém — são o que se digita para
    // se livrar do campo.
    if (/^(\d)\1+$/.test(numero)) return false
    return true
  },
  erro: "Digite um celular com DDD, como (61) 98228-6044."
}
