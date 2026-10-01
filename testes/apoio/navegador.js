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

// Eventos de foco não sobem a árvore no navegador de verdade.
const NAO_SOBEM = new Set(["focus", "blur"])

class Elemento {
  constructor(tag, svg = false) {
    this.tagName = String(tag).toUpperCase()
    this.filhos = []
    this.className = ""
    this.atributos = {}
    this.ouvintes = {}
    this.scrollTop = 0
    this.scrollHeight = 0
    // Um elemento de verdade tem tamanho. Sem isto o enquadramento dividiria
    // por zero e o teste passaria com uma vista que o navegador não produz.
    this.clientWidth = 900
    this.clientHeight = 700
    // Onde o elemento está na janela. Por padrão na origem; um teste que
    // queira provar deslocamento (paleta à esquerda, barra em cima) troca
    // isto. Sem o método, o código tem de chutar que canvas e janela
    // coincidem — e foi esse chute que levou a ligação para o lugar errado.
    this.deslocamento = { left: 0, top: 0 }
    // Um <input> de verdade nasce com value "", não undefined. Sem isto o
    // falso mente: `campo.value += "a"` daria "undefineda" aqui e "a" no
    // navegador.
    if (this.tagName === "INPUT") {
      this.value = ""
      // Onde está o cursor. O motor lê isto para recolocá-lo depois de a
      // máscara reescrever o campo; sem o par selectionStart/setSelectionRange
      // aqui, um cursor que salta para o lugar errado não teria como falhar
      // num teste.
      this.selectionStart = 0
      this.selectionEnd = 0
    }
    this._texto = ""
    this.style = {
      propriedades: {},
      setProperty(nome, valor) { this.propriedades[nome] = valor }
    }

    // Por último, depois de toda a inicialização: em SVG de verdade
    // `className` é um SVGAnimatedString somente leitura, e atribuir lança
    // TypeError que derruba o render inteiro. O dublê recusa igual — senão o
    // teste passa e a página abre em branco.
    if (svg) {
      let classe = this.className || ""
      Object.defineProperty(this, "className", {
        get: () => classe,
        set: () => {
          throw new TypeError('className de elemento SVG é somente leitura — use setAttribute("class", …)')
        }
      })
      this.definirClasse = (v) => { classe = String(v) }
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
    if (nome === "class") {
      if (this.definirClasse) this.definirClasse(valor)
      else this.className = String(valor)
    }
  }

  setSelectionRange(inicio, fim) {
    this.selectionStart = inicio
    this.selectionEnd = fim ?? inicio
  }

  addEventListener(evento, fn) { (this.ouvintes[evento] ||= []).push(fn) }
  removeEventListener(evento, fn) {
    this.ouvintes[evento] = (this.ouvintes[evento] || []).filter((x) => x !== fn)
  }
  disparar(evento, detalhe = {}) {
    // O evento sobe pela árvore, como no navegador: sem isso, um
    // stopPropagation que falta nunca quebraria teste nenhum — e é
    // exatamente ele que impede um clique na opção de abrir o painel.
    let parado = false
    const e = {
      type: evento, preventDefault() {}, stopPropagation() { parado = true },
      target: this, ...detalhe
    }
    let no = this
    while (no) {
      for (const fn of [...(no.ouvintes?.[evento] || [])]) {
        e.currentTarget = no
        fn(e)
      }
      if (parado || NAO_SOBEM.has(evento)) break
      no = no.pai
    }
    return e
  }
  click() { for (const fn of this.ouvintes.click || []) fn({ preventDefault() {} }) }
  getBoundingClientRect() {
    return {
      left: this.deslocamento.left, top: this.deslocamento.top,
      right: this.deslocamento.left + this.clientWidth,
      bottom: this.deslocamento.top + this.clientHeight,
      width: this.clientWidth, height: this.clientHeight
    }
  }

  // Selecionar o conteúdo todo, como o select() de um <input> de verdade.
  select() {
    this.selectionStart = 0
    this.selectionEnd = String(this.value ?? "").length
  }

  focus() {
    // Quem está com o cursor. Sem isto, "a caixa nova recebe o foco" não teria
    // como falhar num teste.
    if (globalThis.document) globalThis.document.focado = this
  }

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
  const ouvintesDoDocumento = {}
  globalThis.document = {
    createElement: (tag) => new Elemento(tag),
    createElementNS: (_ns, tag) => new Elemento(tag, true),
    addEventListener(evento, fn) { (ouvintesDoDocumento[evento] ||= []).push(fn) },
    removeEventListener(evento, fn) {
      ouvintesDoDocumento[evento] = (ouvintesDoDocumento[evento] || []).filter((x) => x !== fn)
    },
    // Só para os testes: dispara no documento o que o navegador dispararia.
    disparar(evento, detalhe = {}) {
      const e = { type: evento, preventDefault() {}, stopPropagation() {}, ...detalhe }
      for (const fn of [...(ouvintesDoDocumento[evento] || [])]) fn(e)
      return e
    }
  }
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
