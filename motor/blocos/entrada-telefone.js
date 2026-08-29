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
  campo_html: { type: "tel", inputmode: "numeric" },

  // Máscara: a pessoa digita só números e o campo escreve os parênteses e o
  // traço sozinho. Letra nenhuma chega a aparecer, e passar de onze números
  // não adianta — o que sobra não entra. Assim o campo só chega ao validador
  // já no formato certo, e a única coisa que pode dar errado é faltar número.
  filtrar_digitacao: (texto) => {
    let d = String(texto ?? "").replace(/\D/g, "")
    // Coladocom o DDI do Brasil na frente: "+55 61 98228-6044" é o mesmo
    // número que "(61) 98228-6044", e cortar em onze deixaria "(55) 61982…",
    // um número errado com cara de certo.
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2)
    d = d.slice(0, 11)

    if (d.length === 0) return ""
    if (d.length <= 2) return `(${d}`
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  },

  // Celular, não telefone qualquer: quem responde isto está dando o número
  // pelo qual vai ser procurado, e desde 2016 todo celular brasileiro tem
  // nove dígitos começados em 9. Aceitar um fixo aqui seria aceitar um
  // número em que ninguém consegue mandar mensagem.
  validar: (valor) => {
    let digitos = String(valor ?? "").replace(/\D/g, "")
    if (/[^\d\s()+.-]/.test(String(valor ?? ""))) return false
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
  erro: "Digite o número correto."
}
