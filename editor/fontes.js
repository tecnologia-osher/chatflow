// As fontes que a lista da aba Tema oferece.
//
// Escolher uma fonte é escolher duas coisas: a família que o chat usa e o
// endereço da folha que o navegador baixa. Deixar isso em dois campos de texto
// era pedir para alguém escrever "Poppins" e esquecer a folha — e aí o chat
// mostra a fonte de sistema sem dizer por quê.
//
// A lista é de fontes do Google, de graça e com acento, porque é o que o chat
// precisa em português. Fonte fora da lista continua valendo: quem escreveu
// uma à mão no tema.json aparece como "Personalizada" e não é sobrescrita.

const PESOS = "wght@400;600;700"
const FIM = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const FIM_SERIFA = "Georgia, 'Times New Roman', serif"

function google(nome) {
  return `https://fonts.googleapis.com/css2?family=${nome.replace(/ /g, "+")}:${PESOS}&display=swap`
}

function daGoogle(nome, serifa = false) {
  return {
    nome,
    familia: `'${nome}', ${serifa ? FIM_SERIFA : FIM}`,
    url: google(nome)
  }
}

export const PADRAO_DO_SISTEMA = {
  nome: "Padrão do sistema",
  // Sem folha para baixar: é a fonte que o aparelho já tem, e a conversa abre
  // sem esperar nada da rede.
  familia: FIM,
  url: ""
}

export const FONTES = [
  PADRAO_DO_SISTEMA,
  daGoogle("Open Sans"),
  daGoogle("Inter"),
  daGoogle("Roboto"),
  daGoogle("Lato"),
  daGoogle("Montserrat"),
  daGoogle("Poppins"),
  daGoogle("Nunito"),
  daGoogle("Raleway"),
  daGoogle("Work Sans"),
  daGoogle("DM Sans"),
  daGoogle("Source Sans 3"),
  daGoogle("Merriweather", true),
  daGoogle("Playfair Display", true),
  daGoogle("Lora", true)
]

// O primeiro nome da pilha, sem aspas. É por ele que se reconhece a fonte: o
// tema do cliente traz a pilha inteira ("'Open Sans', system-ui, …") e
// comparar o texto todo diria "personalizada" para a fonte que está na lista.
export function familiaPrincipal(pilha) {
  if (typeof pilha !== "string") return ""
  const primeira = pilha.split(",")[0] || ""
  return primeira.trim().replace(/^["']|["']$/g, "").toLowerCase()
}

// Qual item da lista é o tema de agora. Devolve nulo quando a fonte veio de
// fora da lista — a aba mostra isso como "Personalizada" em vez de apagar.
export function fonteDoTema(tema) {
  const alvo = familiaPrincipal(tema?.fonte)
  if (!alvo) return PADRAO_DO_SISTEMA
  return FONTES.find((f) => familiaPrincipal(f.familia) === alvo) || null
}

export function definirFonte(tema, nome) {
  const escolhida = FONTES.find((f) => f.nome === nome)
  if (!escolhida) return tema
  const novo = { ...tema, fonte: escolhida.familia }
  // Fonte do sistema não tem folha: deixar a URL antiga faria o navegador
  // baixar uma fonte que ninguém mais usa.
  if (escolhida.url) novo.fonte_url = escolhida.url
  else delete novo.fonte_url
  return novo
}

// Um endereço só, com todas as famílias da lista, para a própria lista
// aparecer cada nome na sua letra. São folhas de estilo; o navegador só baixa
// a fonte de verdade do que ele desenha na tela.
export function urlDaAmostra() {
  const familias = FONTES.filter((f) => f.url)
    .map((f) => `family=${f.nome.replace(/ /g, "+")}:wght@400`)
  return `https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`
}
