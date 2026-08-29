// Navegador de mentira, escrito à mão, para poder dirigir `motor/motor.js`
// dentro do `node --test`.
//
// Por que isto existe: o motor é a única camada do projeto que fala com o
// DOM, e por isso ficou sem teste automatizado até 27/08/2026. O preço
// apareceu — cinco defeitos sérios nasceram aqui e nenhum foi pego pela
// suíte, incluindo o lead mais quente do fluxo nunca ser enviado. Este
// arquivo é o mínimo de DOM que o motor toca, nada além disso.
//
// Continua valendo a regra de zero dependências: nada aqui vem de fora.

class Elemento {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.filhos = []
    this.className = ""
    this.atributos = {}
    this.ouvintes = {}
    this.scrollTop = 0
    this.scrollHeight = 0
    // Um <input> de verdade nasce com value "", não undefined. Sem isto o
    // falso mente: `campo.value += "a"` daria "undefineda" aqui e "a" no
    // navegador.
    if (this.tagName === "INPUT") this.value = ""
    this._texto = ""
    this.style = {
      propriedades: {},
      setProperty(nome, valor) { this.propriedades[nome] = valor }
    }
  }

  set textContent(valor) { this._texto = String(valor); this.filhos = [] }
  get textContent() {
    if (this.filhos.length === 0) return this._texto
    return this.filhos.map((f) => f.textContent).join("")
  }

  append(...nos) { this.#adotar(nos); this.filhos.push(...nos) }
  prepend(...nos) { this.#adotar(nos); this.filhos.unshift(...nos) }
  replaceChildren(...nos) { this.#adotar(nos); this.filhos = [...nos]; this._texto = "" }

  #adotar(nos) { for (const no of nos) if (no) no.pai = this }

  remove() {
    if (!this.pai) return
    const onde = this.pai.filhos.indexOf(this)
    if (onde !== -1) this.pai.filhos.splice(onde, 1)
    this.pai = null
  }

  setAttribute(nome, valor) {
    this.atributos[nome] = String(valor)
    if (nome === "type") this.type = String(valor)
  }

  addEventListener(evento, fn) { (this.ouvintes[evento] ||= []).push(fn) }
  click() { for (const fn of this.ouvintes.click || []) fn({ preventDefault() {} }) }
  focus() {}

  // Percorre a árvore inteira coletando quem tem a classe pedida.
  porClasse(classe, achados = []) {
    if (this.className.split(/\s+/).includes(classe)) achados.push(this)
    for (const filho of this.filhos) filho.porClasse?.(classe, achados)
    return achados
  }
}

// Os avisos do motor só saem por console. Guardamos para poder afirmar
// sobre eles — e de quebra a saída do `node --test` fica limpa.
const avisosCapturados = []

export function instalarNavegador() {
  globalThis.document = { createElement: (tag) => new Elemento(tag) }
  globalThis.crypto ??= {}
  globalThis.crypto.randomUUID ??= () => "sessao-de-teste"

  if (!console.warn.capturado) {
    const registrar = (...partes) => avisosCapturados.push(partes.join(" "))
    registrar.capturado = true
    console.warn = registrar
    console.error = registrar
  }
}

export function limparAvisos() { avisosCapturados.length = 0 }
export function avisos() { return [...avisosCapturados] }

// localStorage de mentira. Sobrevive entre "recargas" se você reaproveitar
// a mesma instância em duas montagens.
export function criarArmazenamento() {
  const dados = new Map()
  return {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
    removeItem: (chave) => dados.delete(chave),
    tamanho: () => dados.size,
    bytes: () => [...dados.values()].reduce((t, v) => t + Buffer.byteLength(v, "utf8"), 0)
  }
}

// O motor dispara envios sem esperar por eles. Dois turnos de event loop
// bastam para as promessas do `buscar` de teste assentarem.
export async function assentar() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

export { Elemento }
