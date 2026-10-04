export default {
  tipo: "entrada_url",
  categoria: "entrada",
  rotulo: "Site",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  campo_html: { type: "url", inputmode: "url" },
  // Sem exigir o protocolo: ninguém digita "https://" ao dizer onde fica o
  // site da empresa, e um campo que recusa "osher.com.br" vira pegadinha.
  // O que se exige é o desenho de um domínio — nome, ponto e sufixo de pelo
  // menos duas letras — e nada de espaço no meio. `javascript:` e outros
  // esquemas não passam porque não são domínio nenhum.
  validar: (valor) => {
    const texto = String(valor || "").trim()
    if (!texto || /\s/.test(texto)) return false
    const semEsquema = texto.replace(/^https?:\/\//i, "")
    if (semEsquema !== texto && !semEsquema) return false
    const dominio = semEsquema.split(/[/?#]/)[0]
    return /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}$/i.test(dominio)
  },
  erro: "Digite um endereço de site, como osher.com.br."
}
