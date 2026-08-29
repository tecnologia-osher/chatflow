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

  // O campo recusa letra na hora da digitação, não só na hora de enviar:
  // quem digita "asdf" no telefone não vê o texto aparecer. O motor aplica
  // isto a cada tecla; o `validar` abaixo continua sendo a palavra final,
  // porque um valor colado ou um filtro que não rodou não podem passar.
  filtrar_digitacao: (texto) => String(texto ?? "").replace(/\D/g, ""),

  // Celular, não telefone qualquer: quem responde isto está dando o número
  // pelo qual vai ser procurado, e desde 2016 todo celular brasileiro tem
  // nove dígitos começados em 9. Aceitar um fixo aqui seria aceitar um
  // número em que ninguém consegue mandar mensagem.
  //
  // Devolve o motivo em vez de só `false`: "faltam dois números" e "esse DDD
  // não existe" mandam corrigir coisas diferentes.
  validar: (valor) => {
    const bruto = String(valor ?? "").trim()
    if (bruto === "") return "Digite o seu celular com DDD."
    if (/[^\d\s()+.-]/.test(bruto)) return "Digite apenas números, sem letras."

    let digitos = bruto.replace(/\D/g, "")
    // O DDI do Brasil é opcional: "+55 61 ..." e "61 ..." são o mesmo número.
    if (digitos.length === 13 && digitos.startsWith("55")) digitos = digitos.slice(2)

    const FORMATO = "São 11 números: os 2 do DDD, o 9, e mais 8."
    if (digitos.length < 11) {
      return `Faltam números. ${FORMATO} Você digitou ${digitos.length}.`
    }
    if (digitos.length > 11) {
      return `Números demais. ${FORMATO} Você digitou ${digitos.length}.`
    }

    const ddd = digitos.slice(0, 2)
    if (!DDDS.has(Number(ddd))) {
      return `Não existe o DDD ${ddd}. Use os 2 números do DDD, como 61.`
    }

    const numero = digitos.slice(2)
    if (numero[0] !== "9") return "Depois do DDD, o celular começa com 9."
    // 999999999 e 888888888 não são de ninguém — são o que se digita para
    // se livrar do campo.
    if (/^(\d)\1+$/.test(numero)) return "Esse número não parece ser de verdade."
    return true
  },
  erro: "Digite um celular com DDD, como 61982286044."
}
