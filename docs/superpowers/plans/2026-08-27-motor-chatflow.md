# Motor do chatflow — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o motor que executa um fluxo de chat descrito em JSON, com ramificação, pontuação opcional, validação de entrada e envio a destinos configuráveis.

**Architecture:** Núcleo de lógica pura, sem DOM, testado com o runner nativo do Node. Camada de renderização por cima, montável em qualquer elemento da página. Tipos de bloco vivem em arquivos separados, registrados num catálogo extensível — adicionar um tipo não exige editar o motor.

**Tech Stack:** JavaScript ESM puro, sem framework e sem build. `node --test` e `node:assert` para testes. Nenhuma dependência de terceiros.

**Spec:** [docs/superpowers/specs/2026-08-27-chatflow-motor-design.md](../specs/2026-08-27-chatflow-motor-design.md)

## Global Constraints

- **Zero dependências de terceiros.** Nem em produção, nem em teste. `package.json` sem `dependencies` nem `devDependencies`.
- **Sem etapa de build.** O que está no repositório é o que roda no navegador.
- **Node 24.20.0** (instalado em `~/.local/node`). Testes com `node --test`.
- **ESM em tudo:** `"type": "module"` no `package.json`, `import`/`export`.
- **Teste de acoplamento:** nenhum arquivo em `motor/` pode conter texto de nicho, cor da Osher ou URL de destino. Se apagar `clientes/osher/`, o motor continua funcionando.
- **Estado imutável na lógica pura:** funções de `percurso.js` recebem estado e devolvem estado novo, nunca modificam o recebido.
- **Chaves do formato em português:** `grupos`, `blocos`, `proximo`, `opcoes`, `salvar_em`, `conteudo`.
- **Nenhuma credencial em arquivo de cliente.** Só URL pública de webhook.
- **Idioma:** identificadores de código em português quando descrevem o domínio do formato; mensagens de erro sempre em português.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Declara ESM e o script de teste |
| `motor/blocos/_registro.js` | Catálogo de tipos: registrar, obter, listar |
| `motor/blocos/*.js` | Um arquivo por tipo de bloco |
| `motor/validar.js` | Valida a integridade de um fluxo antes de rodar |
| `motor/interpolar.js` | Troca `{{variavel}}` pelo valor |
| `motor/pontuacao.js` | Soma pontos e classifica em faixas |
| `motor/percurso.js` | Qual é o próximo bloco/grupo. Lógica pura |
| `motor/destinos.js` | Envio, fila e reenvio |
| `motor/motor.js` | `criarChat` — renderização e ligação das peças |
| `motor/tema.css` | Estrutura visual; cores só por variável CSS |
| `motor/player.html` | Página que monta o chat em tela cheia |
| `exemplos/captacao-simples.json` | Fluxo genérico de demonstração |
| `clientes/osher/` | Fluxo, tema e destinos da Osher |
| `testes/*.test.js` | Um arquivo de teste por módulo |

---

### Task 1: Fundação e registro de tipos

**Files:**
- Create: `package.json`
- Create: `motor/blocos/_registro.js`
- Test: `testes/registro.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `registrar(definicao) -> void` — lança `Error` se a definição for inválida ou o tipo já existir
  - `obter(tipo) -> definicao` — lança `Error` se não existir
  - `todos() -> definicao[]`
  - `limpar() -> void` — só para testes
  - Formato da definição: `{ tipo: string, categoria: "fala"|"entrada"|"logica"|"conexao", rotulo: string, ramifica: boolean, salva_variavel: boolean, campos: Campo[], validar?: (valor) => boolean, erro?: string }`
  - `Campo`: `{ nome: string, rotulo: string, tipo: "texto"|"numero"|"lista"|"booleano", aceita_variavel?: boolean, padrao?: any }`

- [ ] **Step 1: Criar o `package.json`**

```json
{
  "name": "chatflow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test testes/"
  }
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `testes/registro.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { registrar, obter, todos, limpar } from "../motor/blocos/_registro.js"

const definicaoValida = {
  tipo: "texto",
  categoria: "fala",
  rotulo: "Texto",
  ramifica: false,
  salva_variavel: false,
  campos: [{ nome: "texto", rotulo: "Mensagem", tipo: "texto", aceita_variavel: true }]
}

test("registra e recupera uma definicao", () => {
  limpar()
  registrar(definicaoValida)
  assert.equal(obter("texto").rotulo, "Texto")
})

test("obter tipo desconhecido lanca erro com o nome do tipo", () => {
  limpar()
  assert.throws(() => obter("inexistente"), /inexistente/)
})

test("registrar o mesmo tipo duas vezes lanca erro", () => {
  limpar()
  registrar(definicaoValida)
  assert.throws(() => registrar(definicaoValida), /já registrado/)
})

test("recusa definicao sem campos obrigatorios", () => {
  limpar()
  assert.throws(() => registrar({ tipo: "x" }), /categoria/)
})

test("recusa categoria invalida", () => {
  limpar()
  assert.throws(
    () => registrar({ ...definicaoValida, categoria: "outra" }),
    /categoria/
  )
})

test("todos devolve as definicoes registradas", () => {
  limpar()
  registrar(definicaoValida)
  registrar({ ...definicaoValida, tipo: "imagem", rotulo: "Imagem" })
  assert.deepEqual(todos().map((d) => d.tipo).sort(), ["imagem", "texto"])
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
cd chatflow && node --test testes/registro.test.js
```

Esperado: FAIL — `Cannot find module '../motor/blocos/_registro.js'`

- [ ] **Step 4: Implementar o registro**

Criar `motor/blocos/_registro.js`:

```js
const CATEGORIAS = ["fala", "entrada", "logica", "conexao"]

const catalogo = new Map()

function conferir(definicao) {
  if (!definicao || typeof definicao.tipo !== "string" || !definicao.tipo) {
    throw new Error("Definição de bloco precisa de um tipo.")
  }
  if (!CATEGORIAS.includes(definicao.categoria)) {
    throw new Error(
      `Bloco "${definicao.tipo}": categoria inválida. Use uma de: ${CATEGORIAS.join(", ")}.`
    )
  }
  if (typeof definicao.rotulo !== "string" || !definicao.rotulo) {
    throw new Error(`Bloco "${definicao.tipo}": rotulo é obrigatório.`)
  }
  if (typeof definicao.ramifica !== "boolean") {
    throw new Error(`Bloco "${definicao.tipo}": ramifica precisa ser booleano.`)
  }
  if (typeof definicao.salva_variavel !== "boolean") {
    throw new Error(`Bloco "${definicao.tipo}": salva_variavel precisa ser booleano.`)
  }
  if (!Array.isArray(definicao.campos)) {
    throw new Error(`Bloco "${definicao.tipo}": campos precisa ser uma lista.`)
  }
}

export function registrar(definicao) {
  conferir(definicao)
  if (catalogo.has(definicao.tipo)) {
    throw new Error(`Bloco "${definicao.tipo}" já registrado.`)
  }
  catalogo.set(definicao.tipo, Object.freeze({ ...definicao }))
}

export function obter(tipo) {
  const definicao = catalogo.get(tipo)
  if (!definicao) throw new Error(`Bloco de tipo "${tipo}" não existe no catálogo.`)
  return definicao
}

export function todos() {
  return [...catalogo.values()]
}

export function limpar() {
  catalogo.clear()
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
node --test testes/registro.test.js
```

Esperado: PASS, 6 testes.

- [ ] **Step 6: Commit**

```bash
git add package.json motor/blocos/_registro.js testes/registro.test.js
git commit -m "feat: registro extensivel de tipos de bloco"
```

---

### Task 2: Interpolação de variáveis

**Files:**
- Create: `motor/interpolar.js`
- Test: `testes/interpolar.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `interpolar(texto, contexto) -> string`. `contexto` é um objeto simples de variáveis. Entrada que não é string volta como string vazia.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/interpolar.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { interpolar } from "../motor/interpolar.js"

test("troca uma variavel", () => {
  assert.equal(interpolar("Olá {{nome}}", { nome: "Ana" }), "Olá Ana")
})

test("troca varias ocorrencias da mesma variavel", () => {
  assert.equal(
    interpolar("{{nome}}, confirma? {{nome}}", { nome: "Ana" }),
    "Ana, confirma? Ana"
  )
})

test("variavel ausente vira string vazia, nunca undefined", () => {
  const saida = interpolar("Olá {{nome}}!", {})
  assert.equal(saida, "Olá !")
  assert.ok(!saida.includes("undefined"))
})

test("aceita espacos dentro das chaves", () => {
  assert.equal(interpolar("Olá {{ nome }}", { nome: "Ana" }), "Olá Ana")
})

test("converte numero para texto", () => {
  assert.equal(interpolar("Total: {{pontuacao}}", { pontuacao: 7 }), "Total: 7")
})

test("valor zero aparece, nao vira vazio", () => {
  assert.equal(interpolar("Pontos: {{p}}", { p: 0 }), "Pontos: 0")
})

test("texto sem variavel volta igual", () => {
  assert.equal(interpolar("Sem nada", { nome: "Ana" }), "Sem nada")
})

test("entrada nao textual devolve string vazia", () => {
  assert.equal(interpolar(undefined, {}), "")
  assert.equal(interpolar(null, {}), "")
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/interpolar.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/interpolar.js`:

```js
const MARCADOR = /\{\{\s*([\w.]+)\s*\}\}/g

export function interpolar(texto, contexto = {}) {
  if (typeof texto !== "string") return ""
  return texto.replace(MARCADOR, (_, chave) => {
    const valor = contexto[chave]
    if (valor === undefined || valor === null) return ""
    return String(valor)
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/interpolar.test.js
```

Esperado: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add motor/interpolar.js testes/interpolar.test.js
git commit -m "feat: interpolacao de variaveis em textos"
```

---

### Task 3: Pontuação e classificação

**Files:**
- Create: `motor/pontuacao.js`
- Test: `testes/pontuacao.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `pontuacaoAtiva(fluxo) -> boolean`
  - `classificar(pontos, faixas) -> string | null` — compara com "maior ou igual", da faixa mais alta para a mais baixa; devolve `"frio"` abaixo de todas; devolve `null` se `faixas` for inválido

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/pontuacao.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { classificar, pontuacaoAtiva } from "../motor/pontuacao.js"

const faixas = { quente: 9, morno: 5 }

test("classifica nos limites exatos", () => {
  assert.equal(classificar(9, faixas), "quente")
  assert.equal(classificar(8, faixas), "morno")
  assert.equal(classificar(5, faixas), "morno")
  assert.equal(classificar(4, faixas), "frio")
})

test("acima da maior faixa continua quente", () => {
  assert.equal(classificar(50, faixas), "quente")
})

test("zero e frio", () => {
  assert.equal(classificar(0, faixas), "frio")
})

test("faixas fora de ordem no objeto nao afetam o resultado", () => {
  assert.equal(classificar(9, { morno: 5, quente: 9 }), "quente")
})

test("faixas ausentes devolve null", () => {
  assert.equal(classificar(9, undefined), null)
  assert.equal(classificar(9, {}), null)
})

test("pontuacaoAtiva le a configuracao do fluxo", () => {
  assert.equal(pontuacaoAtiva({ pontuacao: { ativa: true, faixas } }), true)
  assert.equal(pontuacaoAtiva({ pontuacao: { ativa: false, faixas } }), false)
  assert.equal(pontuacaoAtiva({}), false)
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/pontuacao.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/pontuacao.js`:

```js
export function pontuacaoAtiva(fluxo) {
  return Boolean(fluxo && fluxo.pontuacao && fluxo.pontuacao.ativa)
}

export function classificar(pontos, faixas) {
  if (!faixas || typeof faixas !== "object") return null
  const ordenadas = Object.entries(faixas)
    .filter(([, corte]) => typeof corte === "number")
    .sort((a, b) => b[1] - a[1])
  if (ordenadas.length === 0) return null
  for (const [nome, corte] of ordenadas) {
    if (pontos >= corte) return nome
  }
  return "frio"
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/pontuacao.test.js
```

Esperado: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add motor/pontuacao.js testes/pontuacao.test.js
git commit -m "feat: pontuacao opcional e classificacao por faixas"
```

---

### Task 4: Percurso — sequência dentro do grupo e entre grupos

**Files:**
- Create: `motor/percurso.js`
- Test: `testes/percurso-sequencia.test.js`

**Interfaces:**
- Consumes: `pontuacaoAtiva`, `classificar` de `motor/pontuacao.js`
- Produces:
  - `criarEstado(fluxo) -> Estado` — `Estado` é `{ respostas: {}, pontuacao: 0, grupoAtual: string|null, indiceBloco: number, historico: string[], terminou: boolean }`
  - `blocoAtual(fluxo, estado) -> bloco | null`
  - `avancar(fluxo, estado, { destino } = {}) -> Estado` — move para o próximo bloco; se `destino` vier preenchido, salta para aquele grupo; ao esgotar os blocos do grupo, segue o `proximo` do grupo; sem `proximo`, marca `terminou`
  - `aplicarResposta(fluxo, estado, valor) -> Estado` — grava em `salvar_em`, soma `pontos` quando houver, e não avança
  - `contexto(fluxo, estado) -> objeto` — respostas mais `pontuacao` e `classificacao`, para a interpolação
  - Todas devolvem estado novo. Nenhuma modifica o estado recebido.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/percurso-sequencia.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { criarEstado, blocoAtual, avancar, aplicarResposta, contexto } from "../motor/percurso.js"

const fluxo = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  grupos: [
    {
      id: "g1",
      titulo: "Abertura",
      blocos: [
        { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
        { id: "b2", tipo: "entrada_texto", conteudo: {}, salvar_em: "nome" }
      ],
      proximo: "g2"
    },
    {
      id: "g2",
      titulo: "Fim",
      blocos: [{ id: "b3", tipo: "texto", conteudo: { texto: "Obrigado" } }]
    }
  ]
}

test("estado inicial aponta para o grupo do evento de inicio", () => {
  const e = criarEstado(fluxo)
  assert.equal(e.grupoAtual, "g1")
  assert.equal(e.indiceBloco, 0)
  assert.equal(e.terminou, false)
  assert.deepEqual(e.respostas, {})
})

test("blocoAtual devolve o primeiro bloco do grupo", () => {
  assert.equal(blocoAtual(fluxo, criarEstado(fluxo)).id, "b1")
})

test("avancar caminha pelos blocos do grupo em ordem", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  assert.equal(blocoAtual(fluxo, e).id, "b2")
})

test("ao esgotar os blocos, segue o proximo do grupo", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.equal(e.grupoAtual, "g2")
  assert.equal(blocoAtual(fluxo, e).id, "b3")
})

test("grupo sem proximo encerra o fluxo", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.equal(e.terminou, true)
  assert.equal(blocoAtual(fluxo, e), null)
})

test("historico registra os grupos visitados sem repetir em sequencia", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = avancar(fluxo, e)
  assert.deepEqual(e.historico, ["g1", "g2"])
})

test("aplicarResposta grava na variavel e nao avanca", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  const depois = aplicarResposta(fluxo, e, "Ana")
  assert.equal(depois.respostas.nome, "Ana")
  assert.equal(blocoAtual(fluxo, depois).id, "b2")
})

test("nao modifica o estado recebido", () => {
  const e = criarEstado(fluxo)
  const copia = JSON.parse(JSON.stringify(e))
  avancar(fluxo, e)
  aplicarResposta(fluxo, e, "Ana")
  assert.deepEqual(e, copia)
})

test("avancar com destino salta para o grupo indicado", () => {
  const e = criarEstado(fluxo)
  const depois = avancar(fluxo, e, { destino: "g2" })
  assert.equal(depois.grupoAtual, "g2")
  assert.equal(depois.indiceBloco, 0)
})

test("contexto expoe as respostas", () => {
  let e = criarEstado(fluxo)
  e = avancar(fluxo, e)
  e = aplicarResposta(fluxo, e, "Ana")
  assert.equal(contexto(fluxo, e).nome, "Ana")
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/percurso-sequencia.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/percurso.js`:

```js
import { pontuacaoAtiva, classificar } from "./pontuacao.js"

function acharGrupo(fluxo, id) {
  return (fluxo.grupos || []).find((g) => g.id === id) || null
}

function eventoInicio(fluxo) {
  return (fluxo.eventos || []).find((e) => e.tipo === "inicio") || null
}

function entrarNoGrupo(estado, idGrupo) {
  const historico =
    estado.historico[estado.historico.length - 1] === idGrupo
      ? estado.historico
      : [...estado.historico, idGrupo]
  return { ...estado, grupoAtual: idGrupo, indiceBloco: 0, historico }
}

export function criarEstado(fluxo) {
  const inicio = eventoInicio(fluxo)
  const base = {
    respostas: {},
    pontuacao: 0,
    grupoAtual: null,
    indiceBloco: 0,
    historico: [],
    terminou: false
  }
  if (!inicio || !inicio.proximo) return { ...base, terminou: true }
  return entrarNoGrupo(base, inicio.proximo)
}

export function blocoAtual(fluxo, estado) {
  if (estado.terminou || !estado.grupoAtual) return null
  const grupo = acharGrupo(fluxo, estado.grupoAtual)
  if (!grupo) return null
  return grupo.blocos[estado.indiceBloco] || null
}

export function avancar(fluxo, estado, { destino } = {}) {
  if (estado.terminou) return estado

  if (destino) {
    const alvo = acharGrupo(fluxo, destino)
    if (!alvo) return { ...estado, terminou: true }
    return entrarNoGrupo(estado, destino)
  }

  const grupo = acharGrupo(fluxo, estado.grupoAtual)
  if (!grupo) return { ...estado, terminou: true }

  const proximoIndice = estado.indiceBloco + 1
  if (proximoIndice < grupo.blocos.length) {
    return { ...estado, indiceBloco: proximoIndice }
  }

  if (!grupo.proximo) return { ...estado, terminou: true }
  const seguinte = acharGrupo(fluxo, grupo.proximo)
  if (!seguinte) return { ...estado, terminou: true }
  return entrarNoGrupo(estado, grupo.proximo)
}

export function aplicarResposta(fluxo, estado, valor) {
  const bloco = blocoAtual(fluxo, estado)
  if (!bloco) return estado

  const respostas = { ...estado.respostas }
  if (bloco.salvar_em) respostas[bloco.salvar_em] = valor

  let pontuacao = estado.pontuacao
  if (pontuacaoAtiva(fluxo)) {
    const opcoes = (bloco.conteudo && bloco.conteudo.opcoes) || []
    const escolhida = opcoes.find((o) => o.label === valor)
    if (escolhida && typeof escolhida.pontos === "number") {
      pontuacao += escolhida.pontos
    }
  }

  return { ...estado, respostas, pontuacao }
}

export function contexto(fluxo, estado) {
  const base = { ...estado.respostas, pontuacao: estado.pontuacao }
  if (pontuacaoAtiva(fluxo)) {
    base.classificacao = classificar(estado.pontuacao, fluxo.pontuacao.faixas)
  }
  return base
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/percurso-sequencia.test.js
```

Esperado: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add motor/percurso.js testes/percurso-sequencia.test.js
git commit -m "feat: percurso sequencial entre blocos e grupos"
```

---

### Task 5: Percurso — ramificação por botões, condição e ir_para

**Files:**
- Modify: `motor/percurso.js`
- Test: `testes/percurso-ramificacao.test.js`

**Interfaces:**
- Consumes: tudo da Task 4
- Produces:
  - `destinoDaResposta(bloco, valor) -> string | null` — para `entrada_botoes`, o `proximo` da opção escolhida
  - `avaliarRegra(regra, ctx) -> boolean` — operadores `igual`, `diferente`, `maior_que`, `menor_que`, `contem`, `vazio`
  - `destinoDaLogica(fluxo, estado, bloco) -> string | null` — para `condicao` e `ir_para`

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/percurso-ramificacao.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  criarEstado, avancar, aplicarResposta, contexto,
  destinoDaResposta, avaliarRegra, destinoDaLogica
} from "../motor/percurso.js"

const blocoBotoes = {
  id: "b1",
  tipo: "entrada_botoes",
  salvar_em: "bem",
  conteudo: {
    opcoes: [
      { id: "o1", label: "Imóvel", pontos: 2, proximo: "g_imovel" },
      { id: "o2", label: "Automóvel", pontos: 2, proximo: "g_auto" },
      { id: "o3", label: "Ainda não sei", pontos: 0 }
    ]
  }
}

test("opcao com proximo devolve o destino dela", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Imóvel"), "g_imovel")
})

test("opcao sem proximo devolve null, para cair no proximo do grupo", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Ainda não sei"), null)
})

test("valor que nao corresponde a nenhuma opcao devolve null", () => {
  assert.equal(destinoDaResposta(blocoBotoes, "Outro"), null)
})

test("bloco que nao ramifica devolve null", () => {
  assert.equal(destinoDaResposta({ tipo: "entrada_texto", conteudo: {} }, "x"), null)
})

test("operadores de regra", () => {
  const ctx = { bem: "Imóvel", pontuacao: 7, obs: "" }
  assert.equal(avaliarRegra({ variavel: "bem", igual: "Imóvel" }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "bem", diferente: "Imóvel" }, ctx), false)
  assert.equal(avaliarRegra({ pontuacao: { maior_que: 5 } }, ctx), true)
  assert.equal(avaliarRegra({ pontuacao: { menor_que: 5 } }, ctx), false)
  assert.equal(avaliarRegra({ variavel: "bem", contem: "mó" }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "obs", vazio: true }, ctx), true)
  assert.equal(avaliarRegra({ variavel: "bem", vazio: true }, ctx), false)
})

test("variavel inexistente conta como vazia", () => {
  assert.equal(avaliarRegra({ variavel: "nao_existe", vazio: true }, {}), true)
})

const fluxoCondicao = {
  versao: 2,
  eventos: [{ tipo: "inicio", proximo: "g1" }],
  pontuacao: { ativa: true, faixas: { quente: 9, morno: 5 } },
  grupos: [
    {
      id: "g1",
      blocos: [
        {
          id: "c1",
          tipo: "condicao",
          conteudo: {
            regras: [
              { se: { pontuacao: { menor_que: 4 } }, entao: "g_frio" },
              { se: { variavel: "bem", igual: "Ainda não sei" }, entao: "g_ajuda" }
            ]
          }
        }
      ],
      proximo: "g_segue"
    },
    { id: "g_frio", blocos: [] },
    { id: "g_ajuda", blocos: [] },
    { id: "g_segue", blocos: [] }
  ]
}

test("condicao por pontuacao desvia", () => {
  const e = criarEstado(fluxoCondicao)
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_frio")
})

test("condicao por variavel desvia quando a primeira regra nao vale", () => {
  let e = criarEstado(fluxoCondicao)
  e = { ...e, pontuacao: 10, respostas: { bem: "Ainda não sei" } }
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_ajuda")
})

test("nenhuma regra verdadeira devolve null, para seguir o proximo do grupo", () => {
  let e = criarEstado(fluxoCondicao)
  e = { ...e, pontuacao: 10, respostas: { bem: "Imóvel" } }
  const bloco = fluxoCondicao.grupos[0].blocos[0]
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), null)
})

test("ir_para devolve o destino declarado", () => {
  const e = criarEstado(fluxoCondicao)
  const bloco = { id: "j1", tipo: "ir_para", conteudo: { destino: "g_segue" } }
  assert.equal(destinoDaLogica(fluxoCondicao, e, bloco), "g_segue")
})

test("percurso completo: escolha desvia o fluxo", () => {
  const fluxo = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    pontuacao: { ativa: true, faixas: { quente: 2 } },
    grupos: [
      { id: "g1", blocos: [blocoBotoes], proximo: "g_padrao" },
      { id: "g_imovel", blocos: [] },
      { id: "g_padrao", blocos: [] }
    ]
  }
  let e = criarEstado(fluxo)
  e = aplicarResposta(fluxo, e, "Imóvel")
  assert.equal(e.pontuacao, 2)
  e = avancar(fluxo, e, { destino: destinoDaResposta(blocoBotoes, "Imóvel") })
  assert.equal(e.grupoAtual, "g_imovel")
  assert.equal(contexto(fluxo, e).classificacao, "quente")
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/percurso-ramificacao.test.js
```

Esperado: FAIL — `destinoDaResposta is not a function`

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `motor/percurso.js`:

```js
export function destinoDaResposta(bloco, valor) {
  const opcoes = (bloco && bloco.conteudo && bloco.conteudo.opcoes) || []
  const escolhida = opcoes.find((o) => o.label === valor)
  return (escolhida && escolhida.proximo) || null
}

function estaVazio(valor) {
  return valor === undefined || valor === null || valor === ""
}

export function avaliarRegra(regra, ctx) {
  if (!regra || typeof regra !== "object") return false

  if (regra.pontuacao && typeof regra.pontuacao === "object") {
    const pontos = ctx.pontuacao ?? 0
    if ("maior_que" in regra.pontuacao) return pontos > regra.pontuacao.maior_que
    if ("menor_que" in regra.pontuacao) return pontos < regra.pontuacao.menor_que
    if ("igual" in regra.pontuacao) return pontos === regra.pontuacao.igual
    return false
  }

  if (typeof regra.variavel === "string") {
    const valor = ctx[regra.variavel]
    if ("vazio" in regra) return regra.vazio === estaVazio(valor)
    if ("igual" in regra) return valor === regra.igual
    if ("diferente" in regra) return valor !== regra.diferente
    if ("contem" in regra) return String(valor ?? "").includes(String(regra.contem))
    if ("maior_que" in regra) return Number(valor) > Number(regra.maior_que)
    if ("menor_que" in regra) return Number(valor) < Number(regra.menor_que)
  }

  return false
}

export function destinoDaLogica(fluxo, estado, bloco) {
  if (!bloco) return null

  if (bloco.tipo === "ir_para") {
    return (bloco.conteudo && bloco.conteudo.destino) || null
  }

  if (bloco.tipo === "condicao") {
    const ctx = contexto(fluxo, estado)
    const regras = (bloco.conteudo && bloco.conteudo.regras) || []
    for (const item of regras) {
      if (avaliarRegra(item.se, ctx)) return item.entao || null
    }
    return null
  }

  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add motor/percurso.js testes/percurso-ramificacao.test.js
git commit -m "feat: ramificacao por botoes, condicao e ir_para"
```

---

### Task 6: Validação do fluxo

**Files:**
- Create: `motor/validar.js`
- Test: `testes/validar.test.js`

**Interfaces:**
- Consumes: `obter` de `motor/blocos/_registro.js`
- Produces: `validarFluxo(fluxo, { destinos = {} } = {}) -> { valido: boolean, erros: string[] }`. Nunca lança; devolve todos os erros encontrados, cada um numa frase em português citando o id envolvido.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/validar.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { validarFluxo } from "../motor/validar.js"
import { registrar, limpar } from "../motor/blocos/_registro.js"

function prepararCatalogo() {
  limpar()
  registrar({
    tipo: "texto", categoria: "fala", rotulo: "Texto",
    ramifica: false, salva_variavel: false, campos: []
  })
  registrar({
    tipo: "entrada_texto", categoria: "entrada", rotulo: "Entrada de texto",
    ramifica: false, salva_variavel: true, campos: []
  })
}

function fluxoValido() {
  return {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      {
        id: "g1",
        blocos: [
          { id: "b1", tipo: "texto", conteudo: { texto: "Olá" } },
          { id: "b2", tipo: "entrada_texto", conteudo: {}, salvar_em: "nome" }
        ],
        proximo: "g2"
      },
      { id: "g2", blocos: [{ id: "b3", tipo: "texto", conteudo: { texto: "Fim" } }] }
    ]
  }
}

test("fluxo correto passa sem erros", () => {
  prepararCatalogo()
  assert.deepEqual(validarFluxo(fluxoValido()), { valido: true, erros: [] })
})

test("sem evento de inicio e invalido", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos = []
  const r = validarFluxo(f)
  assert.equal(r.valido, false)
  assert.match(r.erros.join(" "), /início/i)
})

test("inicio apontando para grupo inexistente", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos[0].proximo = "g_fantasma"
  assert.match(validarFluxo(f).erros.join(" "), /g_fantasma/)
})

test("ids de grupo duplicados", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[1].id = "g1"
  assert.match(validarFluxo(f).erros.join(" "), /duplicad/i)
})

test("ids de bloco duplicados dentro do mesmo grupo", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].blocos[1].id = "b1"
  assert.match(validarFluxo(f).erros.join(" "), /b1/)
})

test("proximo orfao", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].proximo = "g_nao_existe"
  assert.match(validarFluxo(f).erros.join(" "), /g_nao_existe/)
})

test("grupo inalcancavel", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos.push({ id: "g_orfao", blocos: [] })
  assert.match(validarFluxo(f).erros.join(" "), /g_orfao/)
})

test("grupo alcancado apenas por um evento nao e orfao", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push({ tipo: "invalido", apos_tentativas: 2, proximo: "g_ajuda" })
  f.grupos.push({
    id: "g_ajuda",
    blocos: [{ id: "b_aj", tipo: "texto", conteudo: { texto: "Vamos seguir." } }],
    proximo: "g2"
  })
  assert.deepEqual(validarFluxo(f).erros, [])
})

test("evento apontando para grupo inexistente e erro", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.eventos.push({ tipo: "invalido", proximo: "g_nao_existe" })
  assert.match(validarFluxo(f).erros.join(" "), /g_nao_existe/)
})

test("ciclo com saida e aceito", () => {
  prepararCatalogo()
  const f = {
    versao: 2,
    eventos: [{ tipo: "inicio", proximo: "g1" }],
    grupos: [
      {
        id: "g1",
        blocos: [{
          id: "b1", tipo: "entrada_texto", conteudo: {}, salvar_em: "x"
        }],
        proximo: "g2"
      },
      {
        id: "g2",
        blocos: [{
          id: "b2", tipo: "condicao",
          conteudo: { regras: [{ se: { variavel: "x", vazio: true }, entao: "g1" }] }
        }],
        proximo: "g3"
      },
      { id: "g3", blocos: [] }
    ]
  }
  registrar({
    tipo: "condicao", categoria: "logica", rotulo: "Condição",
    ramifica: true, salva_variavel: false, campos: []
  })
  assert.equal(validarFluxo(f).valido, true)
})

test("tipo de bloco fora do catalogo", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].blocos[0].tipo = "inventado"
  assert.match(validarFluxo(f).erros.join(" "), /inventado/)
})

test("input sem salvar_em", () => {
  prepararCatalogo()
  const f = fluxoValido()
  delete f.grupos[0].blocos[1].salvar_em
  assert.match(validarFluxo(f).erros.join(" "), /salvar_em|variável/i)
})

test("webhook apontando para destino inexistente", () => {
  prepararCatalogo()
  registrar({
    tipo: "webhook", categoria: "conexao", rotulo: "Webhook",
    ramifica: false, salva_variavel: false, campos: []
  })
  const f = fluxoValido()
  f.grupos[1].blocos.push({
    id: "b4", tipo: "webhook", conteudo: { destino: "crm" }
  })
  const r = validarFluxo(f, { destinos: { planilha: {} } })
  assert.match(r.erros.join(" "), /crm/)
})

test("acumula varios erros de uma vez", () => {
  prepararCatalogo()
  const f = fluxoValido()
  f.grupos[0].proximo = "g_x"
  f.grupos[0].blocos[0].tipo = "inventado"
  assert.ok(validarFluxo(f).erros.length >= 2)
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/validar.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/validar.js`:

```js
import { obter } from "./blocos/_registro.js"

function destinosDoBloco(bloco) {
  const saidas = []
  if (bloco.tipo === "ir_para" && bloco.conteudo?.destino) {
    saidas.push(bloco.conteudo.destino)
  }
  if (bloco.tipo === "condicao") {
    for (const regra of bloco.conteudo?.regras || []) {
      if (regra.entao) saidas.push(regra.entao)
    }
  }
  for (const opcao of bloco.conteudo?.opcoes || []) {
    if (opcao.proximo) saidas.push(opcao.proximo)
  }
  return saidas
}

function saidasDoGrupo(grupo) {
  const saidas = grupo.proximo ? [grupo.proximo] : []
  for (const bloco of grupo.blocos || []) saidas.push(...destinosDoBloco(bloco))
  return saidas
}

export function validarFluxo(fluxo, { destinos = {} } = {}) {
  const erros = []
  const grupos = fluxo?.grupos || []
  const porId = new Map()

  for (const grupo of grupos) {
    if (porId.has(grupo.id)) erros.push(`Grupo com id duplicado: "${grupo.id}".`)
    porId.set(grupo.id, grupo)
  }

  const eventos = fluxo?.eventos || []
  const inicio = eventos.find((e) => e.tipo === "inicio")
  if (!inicio) {
    erros.push("O fluxo precisa de um evento de início.")
  } else if (!porId.has(inicio.proximo)) {
    erros.push(`O início aponta para o grupo "${inicio.proximo}", que não existe.`)
  }

  for (const evento of eventos) {
    if (evento === inicio) continue
    if (evento.proximo && !porId.has(evento.proximo)) {
      erros.push(`O evento "${evento.tipo}" aponta para o grupo "${evento.proximo}", que não existe.`)
    }
  }

  for (const grupo of grupos) {
    const idsBloco = new Set()
    for (const bloco of grupo.blocos || []) {
      if (idsBloco.has(bloco.id)) {
        erros.push(`Grupo "${grupo.id}": id de bloco duplicado "${bloco.id}".`)
      }
      idsBloco.add(bloco.id)

      let definicao = null
      try {
        definicao = obter(bloco.tipo)
      } catch {
        erros.push(`Grupo "${grupo.id}": bloco "${bloco.id}" usa o tipo "${bloco.tipo}", que não existe no catálogo.`)
      }

      if (definicao?.salva_variavel && !bloco.salvar_em) {
        erros.push(`Bloco "${bloco.id}" precisa de salvar_em: toda entrada guarda a resposta numa variável.`)
      }

      if (bloco.tipo === "webhook") {
        const chave = bloco.conteudo?.destino
        if (chave && !(chave in destinos)) {
          erros.push(`Bloco "${bloco.id}" usa o destino "${chave}", que não existe em destinos.json.`)
        }
      }
    }

    for (const saida of saidasDoGrupo(grupo)) {
      if (!porId.has(saida)) {
        erros.push(`Grupo "${grupo.id}" aponta para "${saida}", que não existe.`)
      }
    }
  }

  if (inicio && porId.has(inicio.proximo)) {
    // Todo evento é uma raiz: um grupo alcançado só pelo evento "invalido"
    // não é órfão.
    const alcancados = new Set()
    const fila = eventos.map((e) => e.proximo).filter((id) => porId.has(id))
    while (fila.length) {
      const id = fila.shift()
      if (alcancados.has(id)) continue
      alcancados.add(id)
      const grupo = porId.get(id)
      if (!grupo) continue
      for (const saida of saidasDoGrupo(grupo)) {
        if (porId.has(saida)) fila.push(saida)
      }
    }
    for (const grupo of grupos) {
      if (!alcancados.has(grupo.id)) {
        erros.push(`Grupo "${grupo.id}" não é alcançável a partir do início.`)
      }
    }

    const terminais = new Set(
      grupos.filter((g) => saidasDoGrupo(g).length === 0).map((g) => g.id)
    )
    const chegaAoFim = new Set(terminais)
    let mudou = true
    while (mudou) {
      mudou = false
      for (const grupo of grupos) {
        if (chegaAoFim.has(grupo.id)) continue
        if (saidasDoGrupo(grupo).some((s) => chegaAoFim.has(s))) {
          chegaAoFim.add(grupo.id)
          mudou = true
        }
      }
    }
    for (const grupo of grupos) {
      if (alcancados.has(grupo.id) && !chegaAoFim.has(grupo.id)) {
        erros.push(`Grupo "${grupo.id}" é um beco sem saída: nenhum caminho a partir dele termina o fluxo.`)
      }
    }
  }

  return { valido: erros.length === 0, erros }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add motor/validar.js testes/validar.test.js
git commit -m "feat: validacao de integridade do fluxo"
```

---

### Task 7: Catálogo de blocos do v1

**Files:**
- Create: `motor/blocos/texto.js`, `imagem.js`, `entrada-texto.js`, `entrada-numero.js`, `entrada-email.js`, `entrada-telefone.js`, `entrada-data.js`, `entrada-botoes.js`, `condicao.js`, `definir-variavel.js`, `ir-para.js`, `redirecionar.js`, `webhook.js`
- Create: `motor/blocos/index.js`
- Test: `testes/blocos.test.js`

**Interfaces:**
- Consumes: `registrar` de `_registro.js`
- Produces: `motor/blocos/index.js` exporta `registrarTodos()`, que registra os treze tipos. Cada arquivo exporta sua definição como `default`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/blocos.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { limpar, obter, todos } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"

function preparar() {
  limpar()
  registrarTodos()
}

test("registra os treze tipos do v1", () => {
  preparar()
  assert.equal(todos().length, 13)
})

test("so tres tipos ramificam", () => {
  preparar()
  const ramificam = todos().filter((d) => d.ramifica).map((d) => d.tipo).sort()
  assert.deepEqual(ramificam, ["condicao", "entrada_botoes", "ir_para"])
})

test("todo bloco de categoria entrada salva variavel", () => {
  preparar()
  for (const d of todos().filter((x) => x.categoria === "entrada")) {
    assert.equal(d.salva_variavel, true, `${d.tipo} deveria salvar variável`)
  }
})

test("validacao de email", () => {
  preparar()
  const email = obter("entrada_email")
  assert.equal(email.validar("ana@osher.com.br"), true)
  assert.equal(email.validar("ana@"), false)
  assert.equal(email.validar("sem arroba"), false)
  assert.equal(email.validar(""), false)
})

test("validacao de telefone aceita formatos brasileiros comuns", () => {
  preparar()
  const tel = obter("entrada_telefone")
  assert.equal(tel.validar("(61) 98228-6044"), true)
  assert.equal(tel.validar("61982286044"), true)
  assert.equal(tel.validar("+55 61 98228-6044"), true)
  assert.equal(tel.validar("123"), false)
  assert.equal(tel.validar("abcdefghijk"), false)
})

test("validacao de numero", () => {
  preparar()
  const num = obter("entrada_numero")
  assert.equal(num.validar("42"), true)
  assert.equal(num.validar("3,5"), true)
  assert.equal(num.validar("abc"), false)
  assert.equal(num.validar(""), false)
})

test("validacao de data no formato dd/mm/aaaa", () => {
  preparar()
  const data = obter("entrada_data")
  assert.equal(data.validar("27/08/2026"), true)
  assert.equal(data.validar("32/08/2026"), false)
  assert.equal(data.validar("27-08-2026"), false)
})

test("entrada de texto aceita qualquer conteudo nao vazio", () => {
  preparar()
  const texto = obter("entrada_texto")
  assert.equal(texto.validar("Ana"), true)
  assert.equal(texto.validar("   "), false)
})

test("todo tipo declara campos com nome e rotulo", () => {
  preparar()
  for (const d of todos()) {
    for (const campo of d.campos) {
      assert.equal(typeof campo.nome, "string", `${d.tipo}: campo sem nome`)
      assert.equal(typeof campo.rotulo, "string", `${d.tipo}: campo sem rotulo`)
    }
  }
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/blocos.test.js
```

Esperado: FAIL — `motor/blocos/index.js` não existe.

- [ ] **Step 3: Criar os arquivos de definição**

`motor/blocos/texto.js`:

```js
export default {
  tipo: "texto",
  categoria: "fala",
  rotulo: "Texto",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "texto", rotulo: "Mensagem", tipo: "texto", aceita_variavel: true }
  ]
}
```

`motor/blocos/imagem.js`:

```js
export default {
  tipo: "imagem",
  categoria: "fala",
  rotulo: "Imagem",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço da imagem", tipo: "texto", aceita_variavel: true },
    { nome: "alternativo", rotulo: "Texto alternativo", tipo: "texto" }
  ]
}
```

`motor/blocos/entrada-texto.js`:

```js
const CAMPOS_ENTRADA = [
  { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
  { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
]

export default {
  tipo: "entrada_texto",
  categoria: "entrada",
  rotulo: "Texto",
  ramifica: false,
  salva_variavel: true,
  campos: CAMPOS_ENTRADA,
  validar: (valor) => typeof valor === "string" && valor.trim().length > 0,
  erro: "Escreva uma resposta."
}
```

`motor/blocos/entrada-numero.js`:

```js
export default {
  tipo: "entrada_numero",
  categoria: "entrada",
  rotulo: "Número",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" },
    { nome: "minimo", rotulo: "Mínimo", tipo: "numero" },
    { nome: "maximo", rotulo: "Máximo", tipo: "numero" }
  ],
  validar: (valor) => {
    if (typeof valor !== "string" || valor.trim() === "") return false
    return !Number.isNaN(Number(valor.replace(",", ".")))
  },
  erro: "Digite um número."
}
```

`motor/blocos/entrada-email.js`:

```js
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
```

`motor/blocos/entrada-telefone.js`:

```js
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
  validar: (valor) => {
    const digitos = String(valor || "").replace(/\D/g, "")
    return digitos.length >= 10 && digitos.length <= 13
  },
  erro: "Digite um telefone com DDD."
}
```

`motor/blocos/entrada-data.js`:

```js
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
```

`motor/blocos/entrada-botoes.js`:

```js
export default {
  tipo: "entrada_botoes",
  categoria: "entrada",
  rotulo: "Botões",
  ramifica: true,
  salva_variavel: true,
  campos: [
    { nome: "opcoes", rotulo: "Opções", tipo: "lista" },
    { nome: "multipla", rotulo: "Permite mais de uma escolha", tipo: "booleano", padrao: false }
  ],
  validar: (valor) => typeof valor === "string" && valor.length > 0,
  erro: "Escolha uma das opções."
}
```

`motor/blocos/condicao.js`:

```js
export default {
  tipo: "condicao",
  categoria: "logica",
  rotulo: "Condição",
  ramifica: true,
  salva_variavel: false,
  campos: [{ nome: "regras", rotulo: "Regras", tipo: "lista" }]
}
```

`motor/blocos/definir-variavel.js`:

```js
export default {
  tipo: "definir_variavel",
  categoria: "logica",
  rotulo: "Definir variável",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "operacao", rotulo: "Operação", tipo: "texto", padrao: "atribuir" },
    { nome: "valor", rotulo: "Valor", tipo: "texto", aceita_variavel: true }
  ]
}
```

`motor/blocos/ir-para.js`:

```js
export default {
  tipo: "ir_para",
  categoria: "logica",
  rotulo: "Ir para",
  ramifica: true,
  salva_variavel: false,
  campos: [{ nome: "destino", rotulo: "Grupo de destino", tipo: "texto" }]
}
```

`motor/blocos/redirecionar.js`:

```js
export default {
  tipo: "redirecionar",
  categoria: "conexao",
  rotulo: "Redirecionar",
  ramifica: false,
  salva_variavel: false,
  campos: [
    { nome: "url", rotulo: "Endereço", tipo: "texto", aceita_variavel: true },
    { nome: "nova_aba", rotulo: "Abrir em nova aba", tipo: "booleano", padrao: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Continuar" }
  ]
}
```

`motor/blocos/webhook.js`:

```js
export default {
  tipo: "webhook",
  categoria: "conexao",
  rotulo: "Webhook",
  ramifica: false,
  salva_variavel: false,
  campos: [{ nome: "destino", rotulo: "Destino", tipo: "texto" }]
}
```

- [ ] **Step 4: Criar o `index.js`**

`motor/blocos/index.js`:

```js
import { registrar } from "./_registro.js"

import texto from "./texto.js"
import imagem from "./imagem.js"
import entradaTexto from "./entrada-texto.js"
import entradaNumero from "./entrada-numero.js"
import entradaEmail from "./entrada-email.js"
import entradaTelefone from "./entrada-telefone.js"
import entradaData from "./entrada-data.js"
import entradaBotoes from "./entrada-botoes.js"
import condicao from "./condicao.js"
import definirVariavel from "./definir-variavel.js"
import irPara from "./ir-para.js"
import redirecionar from "./redirecionar.js"
import webhook from "./webhook.js"

export const CATALOGO_V1 = [
  texto, imagem,
  entradaTexto, entradaNumero, entradaEmail, entradaTelefone, entradaData, entradaBotoes,
  condicao, definirVariavel, irPara,
  redirecionar, webhook
]

export function registrarTodos() {
  for (const definicao of CATALOGO_V1) registrar(definicao)
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 6: Commit**

```bash
git add motor/blocos/ testes/blocos.test.js
git commit -m "feat: catalogo de treze tipos de bloco do v1"
```

---

### Task 8: Evento `invalido` e tentativas

**Files:**
- Modify: `motor/percurso.js`
- Test: `testes/invalido.test.js`

**Interfaces:**
- Consumes: `obter` de `_registro.js`
- Produces:
  - `validarEntrada(bloco, valor) -> { ok: boolean, erro: string | null }`
  - `registrarFalha(estado) -> Estado` — incrementa `tentativas`
  - `limparFalhas(estado) -> Estado` — zera `tentativas`
  - `destinoDeInvalido(fluxo, estado) -> string | null` — devolve o grupo do evento `invalido` quando `tentativas` atinge `apos_tentativas`
  - `Estado` ganha o campo `tentativas: number`, começando em 0

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/invalido.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { limpar } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"
import {
  criarEstado, validarEntrada, registrarFalha, limparFalhas, destinoDeInvalido
} from "../motor/percurso.js"

function preparar() {
  limpar()
  registrarTodos()
}

const fluxo = {
  versao: 2,
  eventos: [
    { tipo: "inicio", proximo: "g1" },
    { tipo: "invalido", apos_tentativas: 2, proximo: "g_ajuda" }
  ],
  grupos: [
    { id: "g1", blocos: [{ id: "b1", tipo: "entrada_email", conteudo: {}, salvar_em: "email" }] },
    { id: "g_ajuda", blocos: [] }
  ]
}

test("entrada valida passa", () => {
  preparar()
  const bloco = fluxo.grupos[0].blocos[0]
  assert.deepEqual(validarEntrada(bloco, "ana@osher.com.br"), { ok: true, erro: null })
})

test("entrada invalida devolve a mensagem do tipo", () => {
  preparar()
  const bloco = fluxo.grupos[0].blocos[0]
  const r = validarEntrada(bloco, "ana@")
  assert.equal(r.ok, false)
  assert.match(r.erro, /e-mail/i)
})

test("bloco sem validador aceita qualquer coisa", () => {
  preparar()
  assert.equal(validarEntrada({ tipo: "texto", conteudo: {} }, "").ok, true)
})

test("estado comeca com zero tentativas", () => {
  preparar()
  assert.equal(criarEstado(fluxo).tentativas, 0)
})

test("registrarFalha incrementa e limparFalhas zera", () => {
  preparar()
  let e = criarEstado(fluxo)
  e = registrarFalha(e)
  assert.equal(e.tentativas, 1)
  e = registrarFalha(e)
  assert.equal(e.tentativas, 2)
  e = limparFalhas(e)
  assert.equal(e.tentativas, 0)
})

test("desvia so ao atingir apos_tentativas", () => {
  preparar()
  let e = criarEstado(fluxo)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(fluxo, e), null)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(fluxo, e), "g_ajuda")
})

test("sem evento invalido nunca desvia", () => {
  preparar()
  const semEvento = { ...fluxo, eventos: [{ tipo: "inicio", proximo: "g1" }] }
  let e = criarEstado(semEvento)
  e = registrarFalha(e)
  e = registrarFalha(e)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(semEvento, e), null)
})

test("apos_tentativas ausente desvia na primeira falha", () => {
  preparar()
  const f = {
    ...fluxo,
    eventos: [
      { tipo: "inicio", proximo: "g1" },
      { tipo: "invalido", proximo: "g_ajuda" }
    ]
  }
  let e = criarEstado(f)
  e = registrarFalha(e)
  assert.equal(destinoDeInvalido(f, e), "g_ajuda")
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/invalido.test.js
```

Esperado: FAIL — `validarEntrada is not a function`

- [ ] **Step 3: Implementar**

Em `motor/percurso.js`, acrescentar o import no topo:

```js
import { obter } from "./blocos/_registro.js"
```

Em `criarEstado`, incluir `tentativas: 0` no objeto `base`.

Acrescentar ao fim do arquivo:

```js
export function validarEntrada(bloco, valor) {
  if (!bloco || !bloco.tipo) return { ok: true, erro: null }
  let definicao
  try {
    definicao = obter(bloco.tipo)
  } catch {
    return { ok: true, erro: null }
  }
  if (typeof definicao.validar !== "function") return { ok: true, erro: null }
  if (definicao.validar(valor)) return { ok: true, erro: null }
  return { ok: false, erro: definicao.erro || "Resposta inválida." }
}

export function registrarFalha(estado) {
  return { ...estado, tentativas: (estado.tentativas || 0) + 1 }
}

export function limparFalhas(estado) {
  return { ...estado, tentativas: 0 }
}

export function destinoDeInvalido(fluxo, estado) {
  const evento = (fluxo.eventos || []).find((e) => e.tipo === "invalido")
  if (!evento || !evento.proximo) return null
  const limite = typeof evento.apos_tentativas === "number" ? evento.apos_tentativas : 1
  return (estado.tentativas || 0) >= limite ? evento.proximo : null
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos. O teste `"nao modifica o estado recebido"` da Task 4 continua passando porque `tentativas` entra no estado inicial.

- [ ] **Step 5: Commit**

```bash
git add motor/percurso.js testes/invalido.test.js
git commit -m "feat: validacao de entrada e evento invalido"
```

---

### Task 9: Destinos com fila e reenvio

**Files:**
- Create: `motor/destinos.js`
- Test: `testes/destinos.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `criarEnviador({ destinos, ao_finalizar, eventos, buscar, avisar }) -> { enviar, enviarEvento, processarFila, fila }`
  - `buscar` é a função de rede injetada (o `fetch` do navegador em produção, um dublê nos testes)
  - `avisar` recebe mensagens de aviso; padrão `console.warn`
  - `enviar(dados) -> Promise<void>` — envia a todos os destinos de `ao_finalizar`
  - `fila() -> item[]` — itens pendentes, cada um `{ destino, dados, tentativas }`
  - `processarFila() -> Promise<void>` — reprocessa, descartando quem passou de 3 tentativas

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/destinos.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { criarEnviador } from "../motor/destinos.js"

function config(extra = {}) {
  return {
    destinos: {
      planilha: { tipo: "apps_script", url: "https://exemplo/planilha" },
      crm: { tipo: "webhook", url: "", ativo: false }
    },
    ao_finalizar: ["planilha"],
    eventos: "planilha",
    ...extra
  }
}

test("envia para o destino configurado", async () => {
  const chamadas = []
  const enviador = criarEnviador({
    ...config(),
    buscar: async (url, opcoes) => {
      chamadas.push({ url, corpo: JSON.parse(opcoes.body) })
      return { ok: true }
    }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].url, "https://exemplo/planilha")
  assert.equal(chamadas[0].corpo.nome, "Ana")
  assert.equal(enviador.fila().length, 0)
})

test("destino inativo e ignorado sem erro", async () => {
  let chamou = false
  const enviador = criarEnviador({
    ...config({ ao_finalizar: ["planilha", "crm"] }),
    buscar: async () => { chamou = true; return { ok: true } }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(chamou, true)
  assert.equal(enviador.fila().length, 0)
})

test("falha de rede coloca na fila", async () => {
  const enviador = criarEnviador({
    ...config(),
    buscar: async () => { throw new Error("rede fora") }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(enviador.fila().length, 1)
  assert.equal(enviador.fila()[0].tentativas, 1)
})

test("resposta nao-ok tambem vai para a fila", async () => {
  const enviador = criarEnviador({
    ...config(),
    buscar: async () => ({ ok: false, status: 500 })
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(enviador.fila().length, 1)
})

test("processarFila reenvia e limpa quando da certo", async () => {
  let falhar = true
  const enviador = criarEnviador({
    ...config(),
    buscar: async () => {
      if (falhar) throw new Error("rede fora")
      return { ok: true }
    }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(enviador.fila().length, 1)
  falhar = false
  await enviador.processarFila()
  assert.equal(enviador.fila().length, 0)
})

test("descarta o item depois de tres tentativas", async () => {
  const enviador = criarEnviador({
    ...config(),
    buscar: async () => { throw new Error("rede fora") }
  })
  await enviador.enviar({ nome: "Ana" })
  await enviador.processarFila()
  await enviador.processarFila()
  assert.equal(enviador.fila().length, 0)
})

test("destino sem url avisa e nao tenta enviar", async () => {
  const avisos = []
  let chamou = false
  const enviador = criarEnviador({
    destinos: { planilha: { tipo: "apps_script", url: "" } },
    ao_finalizar: ["planilha"],
    buscar: async () => { chamou = true; return { ok: true } },
    avisar: (m) => avisos.push(m)
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(chamou, false)
  assert.equal(enviador.fila().length, 0)
  assert.match(avisos.join(" "), /planilha/)
})

test("url com o texto de exemplo do apps script tambem avisa", async () => {
  const avisos = []
  let chamou = false
  const enviador = criarEnviador({
    destinos: { planilha: { tipo: "apps_script", url: "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT" } },
    ao_finalizar: ["planilha"],
    buscar: async () => { chamou = true; return { ok: true } },
    avisar: (m) => avisos.push(m)
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(chamou, false)
  assert.match(avisos.join(" "), /não configurad/i)
})

test("enviarEvento usa o destino de eventos", async () => {
  const chamadas = []
  const enviador = criarEnviador({
    ...config(),
    buscar: async (url, opcoes) => {
      chamadas.push(JSON.parse(opcoes.body))
      return { ok: true }
    }
  })
  await enviador.enviarEvento({ sessaoId: "s1", grupoId: "g1" })
  assert.equal(chamadas[0].grupoId, "g1")
})

test("sem nenhum destino configurado, avisa uma vez e nao quebra", async () => {
  const avisos = []
  const enviador = criarEnviador({
    destinos: {},
    ao_finalizar: [],
    buscar: async () => ({ ok: true }),
    avisar: (m) => avisos.push(m)
  })
  await enviador.enviar({ nome: "Ana" })
  assert.ok(avisos.length >= 1)
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/destinos.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/destinos.js`:

```js
const MAX_TENTATIVAS = 3
const URL_DE_EXEMPLO = /^COLE_AQUI/i

function utilizavel(destino) {
  if (!destino) return { ok: false, motivo: "não existe em destinos.json" }
  if (destino.ativo === false) return { ok: false, motivo: null }
  if (!destino.url) return { ok: false, motivo: "está sem URL" }
  if (URL_DE_EXEMPLO.test(destino.url)) {
    return { ok: false, motivo: "não configurado: a URL ainda é o texto de exemplo" }
  }
  return { ok: true, motivo: null }
}

export function criarEnviador({
  destinos = {},
  ao_finalizar = [],
  eventos = null,
  buscar,
  avisar = (m) => console.warn(m)
} = {}) {
  const pendentes = []
  const jaAvisados = new Set()

  function avisarUmaVez(chave, mensagem) {
    if (jaAvisados.has(chave)) return
    jaAvisados.add(chave)
    avisar(mensagem)
  }

  async function entregar(nomeDestino, dados) {
    const destino = destinos[nomeDestino]
    const estado = utilizavel(destino)

    if (!estado.ok) {
      if (estado.motivo) {
        avisarUmaVez(nomeDestino, `chatflow: destino "${nomeDestino}" ${estado.motivo}. Nada será enviado.`)
      }
      return { entregue: true }
    }

    try {
      const resposta = await buscar(destino.url, {
        method: "POST",
        body: JSON.stringify(dados)
      })
      if (resposta && resposta.ok === false) return { entregue: false }
      return { entregue: true }
    } catch {
      return { entregue: false }
    }
  }

  async function tentar(nomeDestino, dados, tentativasAnteriores = 0) {
    const { entregue } = await entregar(nomeDestino, dados)
    if (entregue) return
    const tentativas = tentativasAnteriores + 1
    if (tentativas >= MAX_TENTATIVAS) {
      avisar(`chatflow: desisti de enviar para "${nomeDestino}" após ${tentativas} tentativas.`)
      return
    }
    pendentes.push({ destino: nomeDestino, dados, tentativas })
  }

  return {
    async enviar(dados) {
      if (ao_finalizar.length === 0) {
        avisarUmaVez("__nenhum__", "chatflow: nenhum destino em ao_finalizar. As respostas não serão salvas.")
        return
      }
      for (const nome of ao_finalizar) await tentar(nome, dados)
    },

    async enviarEvento(dados) {
      if (!eventos) return
      await entregar(eventos, dados)
    },

    async processarFila() {
      const itens = pendentes.splice(0, pendentes.length)
      for (const item of itens) {
        await tentar(item.destino, item.dados, item.tentativas)
      }
    },

    fila() {
      return pendentes.map((item) => ({ ...item }))
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add motor/destinos.js testes/destinos.test.js
git commit -m "feat: envio a destinos com fila, reenvio e aviso de nao configurado"
```

---

### Task 10: `criarChat` e o player

**Files:**
- Create: `motor/motor.js`
- Create: `motor/tema.css`
- Create: `motor/player.html`
- Create: `exemplos/captacao-simples.json`

**Interfaces:**
- Consumes: `percurso.js`, `validar.js`, `destinos.js`, `interpolar.js`, `blocos/index.js`
- Produces: `criarChat({ elemento, fluxo, tema, destinos, modo = "producao", buscar = fetch }) -> { reiniciar, estado }`
  - Monta dentro de `elemento`; nunca toca em `document.body`
  - `modo: "teste"` não envia nada e exibe os erros de validação em tela

- [ ] **Step 1: Escrever o fluxo de exemplo**

Criar `exemplos/captacao-simples.json` — genérico, sem nenhuma referência a consórcio:

```json
{
  "versao": 2,
  "eventos": [
    { "tipo": "inicio", "posicao": { "x": 40, "y": 40 }, "proximo": "g_abertura" },
    { "tipo": "invalido", "posicao": { "x": 40, "y": 200 }, "apos_tentativas": 2, "proximo": "g_ajuda" }
  ],
  "pontuacao": { "ativa": true, "faixas": { "quente": 4, "morno": 2 } },
  "grupos": [
    {
      "id": "g_abertura",
      "titulo": "Abertura",
      "posicao": { "x": 320, "y": 40 },
      "blocos": [
        { "id": "b_ola", "tipo": "texto", "conteudo": { "texto": "Olá. Vou fazer duas perguntas rápidas." } },
        { "id": "b_nome", "tipo": "entrada_texto", "conteudo": { "placeholder": "Seu nome", "rotulo_botao": "Enviar" }, "salvar_em": "nome" }
      ],
      "proximo": "g_interesse"
    },
    {
      "id": "g_interesse",
      "titulo": "Interesse",
      "posicao": { "x": 320, "y": 260 },
      "blocos": [
        { "id": "b_p", "tipo": "texto", "conteudo": { "texto": "Prazer, {{nome}}. Com o que podemos ajudar?" } },
        {
          "id": "b_opcoes", "tipo": "entrada_botoes", "salvar_em": "interesse",
          "conteudo": { "opcoes": [
            { "id": "o1", "label": "Quero contratar", "pontos": 3, "proximo": "g_contato" },
            { "id": "o2", "label": "Só tirando dúvidas", "pontos": 1, "proximo": "g_duvidas" }
          ] }
        }
      ],
      "proximo": "g_duvidas"
    },
    {
      "id": "g_contato",
      "titulo": "Contato",
      "posicao": { "x": 660, "y": 180 },
      "blocos": [
        { "id": "b_tel_txt", "tipo": "texto", "conteudo": { "texto": "Qual o melhor telefone para falar com você?" } },
        { "id": "b_tel", "tipo": "entrada_telefone", "conteudo": { "placeholder": "(00) 00000-0000", "rotulo_botao": "Enviar" }, "salvar_em": "telefone" },
        { "id": "b_fim", "tipo": "texto", "conteudo": { "texto": "Obrigado, {{nome}}. Entraremos em contato." } }
      ]
    },
    {
      "id": "g_duvidas",
      "titulo": "Dúvidas",
      "posicao": { "x": 660, "y": 400 },
      "blocos": [
        { "id": "b_duv", "tipo": "texto", "conteudo": { "texto": "Sem problema, {{nome}}. Estamos por aqui quando precisar." } }
      ]
    },
    {
      "id": "g_ajuda",
      "titulo": "Ajuda",
      "posicao": { "x": 40, "y": 400 },
      "blocos": [
        { "id": "b_aj", "tipo": "texto", "conteudo": { "texto": "Vamos seguir sem esse dado por enquanto." } }
      ],
      "proximo": "g_duvidas"
    }
  ]
}
```

- [ ] **Step 2: Escrever o CSS**

Criar `motor/tema.css` — sem nenhuma cor literal fora do bloco de variáveis padrão:

```css
.cf {
  --cf-fundo: #101418;
  --cf-superficie: #1b2128;
  --cf-acento: #7a8b99;
  --cf-texto: #eef1f5;
  --cf-erro: #e68a7c;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 20rem;
  background: var(--cf-fundo);
  color: var(--cf-texto);
  font-family: system-ui, sans-serif;
  font-size: 1rem;
  line-height: 1.55;
}

.cf__thread {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.cf__bolha {
  max-width: 80%;
  padding: 0.7rem 0.95rem;
  border-radius: 10px;
  background: var(--cf-superficie);
  white-space: pre-wrap;
}
.cf__bolha--pessoa {
  align-self: flex-end;
  background: var(--cf-acento);
  color: var(--cf-fundo);
}
.cf__bolha img { max-width: 100%; height: auto; border-radius: 6px; display: block; }

.cf__composer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.cf__campo {
  flex: 1;
  min-width: 12rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: var(--cf-fundo);
  color: var(--cf-texto);
  font: inherit;
}
.cf__botao {
  padding: 0.7rem 1.15rem;
  border-radius: 8px;
  border: 1px solid var(--cf-acento);
  background: var(--cf-acento);
  color: var(--cf-fundo);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.cf__botao--opcao { background: transparent; color: var(--cf-texto); }
.cf__botao:hover { filter: brightness(1.1); }
.cf__campo:focus-visible, .cf__botao:focus-visible {
  outline: 2px solid var(--cf-acento);
  outline-offset: 2px;
}

.cf__erro { color: var(--cf-erro); padding: 0 1.25rem 0.5rem; font-size: 0.9rem; }
.cf__aviso {
  background: var(--cf-erro);
  color: var(--cf-fundo);
  padding: 0.65rem 1.25rem;
  font-size: 0.88rem;
}
```

- [ ] **Step 3: Implementar `criarChat`**

Criar `motor/motor.js`:

```js
import { registrarTodos } from "./blocos/index.js"
import { todos } from "./blocos/_registro.js"
import { validarFluxo } from "./validar.js"
import { interpolar } from "./interpolar.js"
import { criarEnviador } from "./destinos.js"
import {
  criarEstado, blocoAtual, avancar, aplicarResposta, contexto,
  destinoDaResposta, destinoDaLogica, validarEntrada,
  registrarFalha, limparFalhas, destinoDeInvalido
} from "./percurso.js"

if (todos().length === 0) registrarTodos()

function elementoCom(tag, classe, texto) {
  const el = document.createElement(tag)
  if (classe) el.className = classe
  if (texto !== undefined) el.textContent = texto
  return el
}

function novaSessao() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Math.random().toString(16).slice(2)}`
}

export function criarChat({
  elemento,
  fluxo,
  tema = {},
  destinos = {},
  modo = "producao",
  buscar = (...args) => fetch(...args)
}) {
  if (!elemento) throw new Error("criarChat precisa de um elemento onde montar.")

  const raiz = elementoCom("div", "cf")
  const thread = elementoCom("div", "cf__thread")
  const composer = elementoCom("div", "cf__composer")
  const erro = elementoCom("div", "cf__erro")
  raiz.append(thread, erro, composer)
  elemento.replaceChildren(raiz)

  for (const [nome, valor] of Object.entries(tema.cores || {})) {
    raiz.style.setProperty(`--cf-${nome}`, valor)
  }
  if (tema.fonte) raiz.style.fontFamily = tema.fonte

  const relatorio = validarFluxo(fluxo, { destinos: destinos.destinos || {} })
  if (!relatorio.valido) {
    const aviso = elementoCom("div", "cf__aviso", relatorio.erros.join(" · "))
    raiz.prepend(aviso)
    console.error("chatflow: fluxo inválido.", relatorio.erros)
    if (modo === "producao") return { reiniciar() {}, estado: () => null }
  }

  const enviador = criarEnviador({
    destinos: destinos.destinos || {},
    ao_finalizar: modo === "teste" ? [] : destinos.ao_finalizar || [],
    eventos: modo === "teste" ? null : destinos.eventos || null,
    buscar
  })

  let estado = criarEstado(fluxo)
  let sessaoId = novaSessao()

  function falar(texto) {
    const bolha = elementoCom("div", "cf__bolha", interpolar(texto, contexto(fluxo, estado)))
    thread.append(bolha)
    thread.scrollTop = thread.scrollHeight
  }

  function ecoar(texto) {
    const bolha = elementoCom("div", "cf__bolha cf__bolha--pessoa", texto)
    thread.append(bolha)
    thread.scrollTop = thread.scrollHeight
  }

  function limparComposer() {
    composer.replaceChildren()
    erro.textContent = ""
  }

  async function finalizar() {
    limparComposer()
    await enviador.enviar({
      sessaoId,
      finalizadoEm: new Date().toISOString(),
      ...contexto(fluxo, estado),
      historico: estado.historico.join(" > ")
    })
  }

  function responder(valor, rotuloVisivel = valor) {
    const bloco = blocoAtual(fluxo, estado)
    const veredito = validarEntrada(bloco, valor)
    if (!veredito.ok) {
      erro.textContent = veredito.erro
      estado = registrarFalha(estado)
      const desvio = destinoDeInvalido(fluxo, estado)
      if (desvio) {
        estado = limparFalhas(estado)
        estado = avancar(fluxo, estado, { destino: desvio })
        seguir()
      }
      return
    }
    erro.textContent = ""
    estado = limparFalhas(estado)
    ecoar(rotuloVisivel)
    estado = aplicarResposta(fluxo, estado, valor)
    const destino = destinoDaResposta(bloco, valor)
    estado = avancar(fluxo, estado, destino ? { destino } : {})
    seguir()
  }

  function pedirTexto(bloco, definicaoTipo) {
    const campo = elementoCom("input", "cf__campo")
    campo.type = definicaoTipo === "entrada_numero" ? "text" : "text"
    campo.placeholder = interpolar(bloco.conteudo?.placeholder || "", contexto(fluxo, estado))
    const botao = elementoCom("button", "cf__botao", bloco.conteudo?.rotulo_botao || "Enviar")
    botao.type = "button"
    botao.addEventListener("click", () => responder(campo.value.trim()))
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); botao.click() }
    })
    composer.replaceChildren(campo, botao)
    campo.focus()
  }

  function pedirOpcao(bloco) {
    const botoes = (bloco.conteudo?.opcoes || []).map((opcao) => {
      const botao = elementoCom("button", "cf__botao cf__botao--opcao", opcao.label)
      botao.type = "button"
      botao.addEventListener("click", () => responder(opcao.label))
      return botao
    })
    composer.replaceChildren(...botoes)
  }

  function mostrarLink(bloco) {
    const url = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado))
    const link = elementoCom("a", "cf__botao", bloco.conteudo?.rotulo_botao || "Continuar")
    link.href = url
    if (bloco.conteudo?.nova_aba !== false) {
      link.target = "_blank"
      link.rel = "noopener noreferrer"
    }
    composer.replaceChildren(link)
  }

  function seguir() {
    limparComposer()

    let guarda = 0
    while (!estado.terminou && guarda++ < 500) {
      const bloco = blocoAtual(fluxo, estado)
      if (!bloco) { estado = avancar(fluxo, estado); continue }

      enviador.enviarEvento({
        sessaoId,
        grupoId: estado.grupoAtual,
        blocoId: bloco.id,
        em: new Date().toISOString()
      })

      if (bloco.tipo === "texto") { falar(bloco.conteudo?.texto || ""); estado = avancar(fluxo, estado); continue }

      if (bloco.tipo === "imagem") {
        const bolha = elementoCom("div", "cf__bolha")
        const img = document.createElement("img")
        img.src = interpolar(bloco.conteudo?.url || "", contexto(fluxo, estado))
        img.alt = bloco.conteudo?.alternativo || ""
        bolha.append(img)
        thread.append(bolha)
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "condicao" || bloco.tipo === "ir_para") {
        const destino = destinoDaLogica(fluxo, estado, bloco)
        estado = avancar(fluxo, estado, destino ? { destino } : {})
        continue
      }

      if (bloco.tipo === "definir_variavel") {
        const ctx = contexto(fluxo, estado)
        const bruto = interpolar(String(bloco.conteudo?.valor ?? ""), ctx)
        const atual = estado.respostas[bloco.salvar_em]
        const operacao = bloco.conteudo?.operacao || "atribuir"
        let novo = bruto
        if (operacao === "somar") novo = Number(atual || 0) + Number(bruto || 0)
        if (operacao === "concatenar") novo = `${atual ?? ""}${bruto}`
        estado = { ...estado, respostas: { ...estado.respostas, [bloco.salvar_em]: novo } }
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "webhook") {
        enviador.enviar({ sessaoId, ...contexto(fluxo, estado) })
        estado = avancar(fluxo, estado)
        continue
      }

      if (bloco.tipo === "redirecionar") { mostrarLink(bloco); return }
      if (bloco.tipo === "entrada_botoes") { pedirOpcao(bloco); return }
      pedirTexto(bloco, bloco.tipo)
      return
    }

    finalizar()
  }

  return {
    reiniciar() {
      estado = criarEstado(fluxo)
      sessaoId = novaSessao()
      thread.replaceChildren()
      seguir()
    },
    estado: () => estado
  }
}
```

- [ ] **Step 4: Criar o `player.html`**

Criar `motor/player.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>chatflow</title>
<link rel="stylesheet" href="tema.css">
<style>
  html, body { height: 100%; margin: 0; }
  #chat { height: 100%; }
</style>
</head>
<body>
<div id="chat"></div>
<script type="module">
  import { criarChat } from "./motor.js"

  const parametros = new URLSearchParams(location.search)
  const cliente = parametros.get("cliente")
  const modo = parametros.get("teste") === "1" ? "teste" : "producao"

  const base = cliente ? `../clientes/${cliente}` : "../exemplos"
  const arquivoFluxo = cliente ? `${base}/fluxo.json` : `${base}/captacao-simples.json`

  async function carregar(url, padrao) {
    try {
      const resposta = await fetch(url)
      if (!resposta.ok) return padrao
      return await resposta.json()
    } catch {
      return padrao
    }
  }

  const [fluxo, tema, destinos] = await Promise.all([
    carregar(arquivoFluxo, null),
    carregar(`${base}/tema.json`, {}),
    carregar(`${base}/destinos.json`, {})
  ])

  if (!fluxo) {
    document.getElementById("chat").textContent = `Não consegui carregar ${arquivoFluxo}.`
  } else {
    const chat = criarChat({
      elemento: document.getElementById("chat"),
      fluxo, tema, destinos, modo
    })
    chat.reiniciar()
  }
</script>
</body>
</html>
```

- [ ] **Step 5: Verificar no navegador**

```bash
cd chatflow && node --run test 2>/dev/null || node --test testes/
python3 -m http.server 8080
```

Abrir `http://localhost:8080/motor/player.html?teste=1`. Conferir, um a um:

1. A abertura fala "Olá. Vou fazer duas perguntas rápidas."
2. O campo de nome aparece; digitar "Ana" e enviar; a resposta aparece à direita
3. A pergunta seguinte diz "Prazer, Ana." — a interpolação funcionou
4. Aparecem dois botões; clicar em "Quero contratar"
5. Pede o telefone; digitar "123" e enviar → mensagem de erro em vermelho, sem avançar
6. Digitar "123" de novo → desvia para "Vamos seguir sem esse dado por enquanto." (evento `invalido` com `apos_tentativas: 2`)
7. O console mostra o aviso de que nenhum destino está configurado, e nada é enviado

- [ ] **Step 6: Commit**

```bash
git add motor/motor.js motor/tema.css motor/player.html exemplos/captacao-simples.json
git commit -m "feat: criarChat montavel em qualquer elemento, player e fluxo de exemplo"
```

---

### Task 11: Retomada de sessão

**Files:**
- Create: `motor/sessao.js`
- Modify: `motor/motor.js`
- Test: `testes/sessao.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `criarSessao({ chave, armazenamento, agora, validadePorHoras = 24 }) -> { salvar(estado), carregar(), limpar() }`
  - `armazenamento` é o objeto injetado com `getItem`/`setItem`/`removeItem` (o `localStorage` em produção, um dublê nos testes)
  - `agora` é uma função que devolve milissegundos; padrão `Date.now`
  - `carregar()` devolve o estado ou `null` — nunca lança, mesmo com armazenamento indisponível ou conteúdo corrompido

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/sessao.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { criarSessao } from "../motor/sessao.js"

function armazenamentoFalso() {
  const dados = new Map()
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    _dados: dados
  }
}

const estadoExemplo = {
  respostas: { nome: "Ana" }, pontuacao: 3, grupoAtual: "g2",
  indiceBloco: 1, historico: ["g1", "g2"], terminou: false, tentativas: 0
}

test("salva e carrega o estado", () => {
  const arm = armazenamentoFalso()
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => 1000 })
  sessao.salvar(estadoExemplo)
  assert.deepEqual(sessao.carregar(), estadoExemplo)
})

test("sem nada salvo devolve null", () => {
  const sessao = criarSessao({ chave: "osher", armazenamento: armazenamentoFalso() })
  assert.equal(sessao.carregar(), null)
})

test("expira depois de 24 horas", () => {
  const arm = armazenamentoFalso()
  let momento = 0
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => momento })
  sessao.salvar(estadoExemplo)

  momento = 23 * 60 * 60 * 1000
  assert.notEqual(sessao.carregar(), null)

  momento = 25 * 60 * 60 * 1000
  assert.equal(sessao.carregar(), null)
})

test("carregar depois de expirado tambem apaga o registro", () => {
  const arm = armazenamentoFalso()
  let momento = 0
  const sessao = criarSessao({ chave: "osher", armazenamento: arm, agora: () => momento })
  sessao.salvar(estadoExemplo)
  momento = 25 * 60 * 60 * 1000
  sessao.carregar()
  assert.equal(arm._dados.size, 0)
})

test("limpar remove o registro", () => {
  const arm = armazenamentoFalso()
  const sessao = criarSessao({ chave: "osher", armazenamento: arm })
  sessao.salvar(estadoExemplo)
  sessao.limpar()
  assert.equal(sessao.carregar(), null)
})

test("conteudo corrompido devolve null sem lancar", () => {
  const arm = armazenamentoFalso()
  arm.setItem("chatflow:osher", "{ isso não é json")
  const sessao = criarSessao({ chave: "osher", armazenamento: arm })
  assert.equal(sessao.carregar(), null)
})

test("armazenamento indisponivel nao quebra", () => {
  const quebrado = {
    getItem: () => { throw new Error("bloqueado") },
    setItem: () => { throw new Error("bloqueado") },
    removeItem: () => { throw new Error("bloqueado") }
  }
  const sessao = criarSessao({ chave: "osher", armazenamento: quebrado })
  assert.doesNotThrow(() => sessao.salvar(estadoExemplo))
  assert.equal(sessao.carregar(), null)
  assert.doesNotThrow(() => sessao.limpar())
})

test("clientes diferentes nao se misturam", () => {
  const arm = armazenamentoFalso()
  const a = criarSessao({ chave: "osher", armazenamento: arm })
  const b = criarSessao({ chave: "outro", armazenamento: arm })
  a.salvar(estadoExemplo)
  assert.equal(b.carregar(), null)
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/sessao.test.js
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `motor/sessao.js`:

```js
const PREFIXO = "chatflow:"

export function criarSessao({
  chave,
  armazenamento,
  agora = () => Date.now(),
  validadePorHoras = 24
} = {}) {
  const endereco = `${PREFIXO}${chave || "padrao"}`
  const validadeEmMs = validadePorHoras * 60 * 60 * 1000

  function apagar() {
    try {
      armazenamento.removeItem(endereco)
    } catch {
      /* armazenamento indisponível: seguir sem retomada */
    }
  }

  return {
    salvar(estado) {
      try {
        armazenamento.setItem(endereco, JSON.stringify({ em: agora(), estado }))
      } catch {
        /* armazenamento indisponível: seguir sem retomada */
      }
    },

    carregar() {
      let bruto = null
      try {
        bruto = armazenamento.getItem(endereco)
      } catch {
        return null
      }
      if (!bruto) return null

      let pacote
      try {
        pacote = JSON.parse(bruto)
      } catch {
        apagar()
        return null
      }

      if (!pacote || typeof pacote.em !== "number" || !pacote.estado) {
        apagar()
        return null
      }
      if (agora() - pacote.em > validadeEmMs) {
        apagar()
        return null
      }
      return pacote.estado
    },

    limpar: apagar
  }
}
```

- [ ] **Step 4: Ligar no motor**

Em `motor/motor.js`, acrescentar o import:

```js
import { criarSessao } from "./sessao.js"
```

Na assinatura de `criarChat`, acrescentar os parâmetros `chaveSessao = "padrao"` e `armazenamento = globalThis.localStorage`.

Depois da criação do `enviador`, acrescentar:

```js
const sessao = criarSessao({ chave: chaveSessao, armazenamento })
```

No fim de `seguir()`, antes da chamada a `finalizar()`, e também antes de cada `return` que espera resposta, o estado precisa ser gravado. A forma mais simples é envolver: renomear a função existente para `seguirInterno` e criar:

```js
function seguir() {
  seguirInterno()
  if (estado.terminou) sessao.limpar()
  else sessao.salvar(estado)
}
```

Trocar, dentro de `seguirInterno`, as chamadas recursivas a `seguir()` por `seguirInterno()` — elas estão em `responder`, que já chama `seguir()` de fora.

Substituir o método `reiniciar` do objeto devolvido por:

```js
  reiniciar({ retomar = true } = {}) {
    const guardado = retomar ? sessao.carregar() : null
    estado = guardado || criarEstado(fluxo)
    if (!guardado) {
      sessaoId = novaSessao()
      thread.replaceChildren()
    }
    seguir()
  },
```

E no `player.html`, passar a chave do cliente:

```js
      fluxo, tema, destinos, modo,
      chaveSessao: cliente || "exemplo"
```

- [ ] **Step 5: Rodar e verificar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos.

No navegador, em `http://localhost:8080/motor/player.html`: responder o nome, recarregar a página com F5, e conferir que o chat volta na pergunta seguinte em vez de recomeçar. Depois completar o fluxo até o fim e recarregar: agora deve recomeçar, porque a sessão terminada é apagada.

- [ ] **Step 6: Commit**

```bash
git add motor/sessao.js motor/motor.js motor/player.html testes/sessao.test.js
git commit -m "feat: retomada de sessao com validade de 24 horas"
```

---

### Task 12: Fluxo da Osher e verificação de ponta a ponta

**Files:**
- Create: `clientes/osher/fluxo.json`
- Create: `clientes/osher/tema.json`
- Create: `clientes/osher/destinos.json`
- Create: `clientes/osher/README.md`
- Test: `testes/fluxo-osher.test.js`

**Interfaces:**
- Consumes: `validarFluxo`, `registrarTodos`, `criarEstado`, `aplicarResposta`, `avancar`, `destinoDaResposta`, `contexto`
- Produces: nada que outra tarefa consuma. É o primeiro cliente real.

**Dependência externa:** a URL do Apps Script publicado. O Step 5 não pode ser concluído sem ela — se ainda não existir, parar antes dele e relatar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `testes/fluxo-osher.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { limpar } from "../motor/blocos/_registro.js"
import { registrarTodos } from "../motor/blocos/index.js"
import { validarFluxo } from "../motor/validar.js"
import {
  criarEstado, aplicarResposta, avancar, destinoDaResposta, destinoDaLogica,
  contexto, blocoAtual
} from "../motor/percurso.js"

const fluxo = JSON.parse(readFileSync(new URL("../clientes/osher/fluxo.json", import.meta.url)))
const destinos = JSON.parse(readFileSync(new URL("../clientes/osher/destinos.json", import.meta.url)))

function preparar() {
  limpar()
  registrarTodos()
}

test("o fluxo da Osher e valido", () => {
  preparar()
  const r = validarFluxo(fluxo, { destinos: destinos.destinos })
  assert.deepEqual(r.erros, [])
})

test("nao usa nenhuma palavra proibida em preferencias.md", () => {
  const texto = JSON.stringify(fluxo).toLowerCase()
  for (const proibida of ["contemplo fácil", "sinergia", "investimento", "resultado rápido", "juros altos"]) {
    assert.ok(!texto.includes(proibida), `o fluxo contém a palavra proibida "${proibida}"`)
  }
})

test("nao usa emoji nem exclamacao", () => {
  const texto = JSON.stringify(fluxo)
  assert.ok(!texto.includes("!"), "o fluxo contém exclamação")
  assert.ok(!/\p{Extended_Pictographic}/u.test(texto), "o fluxo contém emoji")
})

test("nenhuma pergunta de escolha da a mesma pontuacao para todas as opcoes", () => {
  for (const grupo of fluxo.grupos) {
    for (const bloco of grupo.blocos) {
      const opcoes = bloco.conteudo?.opcoes
      if (!opcoes || opcoes.length < 2) continue
      const pontos = new Set(opcoes.map((o) => o.pontos))
      assert.ok(pontos.size > 1, `bloco "${bloco.id}" não discrimina: todas as opções valem o mesmo`)
    }
  }
})

test("nao pergunta e-mail", () => {
  const tipos = fluxo.grupos.flatMap((g) => g.blocos.map((b) => b.tipo))
  assert.ok(!tipos.includes("entrada_email"))
})

test("caminho de quem so pesquisa encerra sem chegar ao fim quente", () => {
  preparar()
  let estado = criarEstado(fluxo)
  const respostas = { nome: "Ana", whatsapp: "(61) 98228-6044" }
  let guarda = 0

  while (!estado.terminou && guarda++ < 200) {
    const bloco = blocoAtual(fluxo, estado)
    if (!bloco) { estado = avancar(fluxo, estado); continue }

    if (bloco.tipo === "entrada_botoes") {
      const opcoes = bloco.conteudo.opcoes
      const escolhida = opcoes.find((o) => o.pontos === 0) || opcoes[opcoes.length - 1]
      estado = aplicarResposta(fluxo, estado, escolhida.label)
      const destino = destinoDaResposta(bloco, escolhida.label)
      estado = avancar(fluxo, estado, destino ? { destino } : {})
      continue
    }

    if (bloco.tipo.startsWith("entrada_")) {
      estado = aplicarResposta(fluxo, estado, respostas[bloco.salvar_em] || "x")
      estado = avancar(fluxo, estado)
      continue
    }

    if (bloco.tipo === "condicao" || bloco.tipo === "ir_para") {
      const destino = destinoDaLogica(fluxo, estado, bloco)
      estado = avancar(fluxo, estado, destino ? { destino } : {})
      continue
    }

    estado = avancar(fluxo, estado)
  }

  assert.equal(estado.terminou, true)
  assert.notEqual(contexto(fluxo, estado).classificacao, "quente")
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test testes/fluxo-osher.test.js
```

Esperado: FAIL — `clientes/osher/fluxo.json` não existe.

- [ ] **Step 3: Criar os arquivos da Osher**

`clientes/osher/tema.json`:

```json
{
  "marca": "Osher",
  "cores": {
    "fundo": "#0C2340",
    "superficie": "#1F3140",
    "acento": "#BF9C5A",
    "texto": "#EEF1F5"
  },
  "fonte": "Georgia, 'Times New Roman', serif"
}
```

`clientes/osher/destinos.json` — a URL entra no Step 5:

```json
{
  "destinos": {
    "planilha": { "tipo": "apps_script", "url": "" },
    "crm": { "tipo": "webhook", "url": "", "ativo": false }
  },
  "ao_finalizar": ["planilha"],
  "eventos": "planilha"
}
```

`clientes/osher/fluxo.json`:

```json
{
  "versao": 2,
  "eventos": [
    { "tipo": "inicio", "posicao": { "x": 40, "y": 40 }, "proximo": "g_abertura" },
    { "tipo": "invalido", "posicao": { "x": 40, "y": 220 }, "apos_tentativas": 2, "proximo": "g_sem_dado" }
  ],
  "pontuacao": { "ativa": true, "faixas": { "quente": 9, "morno": 5 } },
  "grupos": [
    {
      "id": "g_abertura",
      "titulo": "Abertura",
      "posicao": { "x": 320, "y": 40 },
      "blocos": [
        { "id": "b_ola", "tipo": "texto", "conteudo": { "texto": "Olá. Vou fazer algumas perguntas rápidas para entender o que faz sentido para você." } },
        { "id": "b_nome", "tipo": "entrada_texto", "conteudo": { "placeholder": "Seu nome", "rotulo_botao": "Enviar" }, "salvar_em": "nome" }
      ],
      "proximo": "g_whatsapp"
    },
    {
      "id": "g_whatsapp",
      "titulo": "WhatsApp",
      "posicao": { "x": 320, "y": 220 },
      "blocos": [
        { "id": "b_zap_txt", "tipo": "texto", "conteudo": { "texto": "Obrigado, {{nome}}. Qual o melhor WhatsApp para falar com você?" } },
        { "id": "b_zap", "tipo": "entrada_telefone", "conteudo": { "placeholder": "(61) 90000-0000", "rotulo_botao": "Enviar" }, "salvar_em": "whatsapp" }
      ],
      "proximo": "g_bem"
    },
    {
      "id": "g_bem",
      "titulo": "O que quer conquistar",
      "posicao": { "x": 320, "y": 400 },
      "blocos": [
        { "id": "b_bem_txt", "tipo": "texto", "conteudo": { "texto": "O que você quer conquistar?" } },
        {
          "id": "b_bem", "tipo": "entrada_botoes", "salvar_em": "bem",
          "conteudo": { "opcoes": [
            { "id": "o_imovel", "label": "Um imóvel", "pontos": 2, "proximo": "g_valor" },
            { "id": "o_auto", "label": "Um automóvel", "pontos": 2, "proximo": "g_valor" },
            { "id": "o_nsei", "label": "Ainda não sei", "pontos": 0, "proximo": "g_ajuda_definir" }
          ] }
        }
      ],
      "proximo": "g_valor"
    },
    {
      "id": "g_ajuda_definir",
      "titulo": "Ajuda a definir",
      "posicao": { "x": 40, "y": 400 },
      "blocos": [
        { "id": "b_aj", "tipo": "texto", "conteudo": { "texto": "Sem problema. Essa é justamente a conversa em que a gente mais ajuda: entender o objetivo antes de falar de plano." } }
      ],
      "proximo": "g_valor"
    },
    {
      "id": "g_valor",
      "titulo": "Valor do bem",
      "posicao": { "x": 320, "y": 600 },
      "blocos": [
        { "id": "b_val_txt", "tipo": "texto", "conteudo": { "texto": "Qual o valor aproximado do bem que você tem em mente?" } },
        {
          "id": "b_valor", "tipo": "entrada_botoes", "salvar_em": "valor",
          "conteudo": { "opcoes": [
            { "id": "v1", "label": "Até R$ 100 mil", "pontos": 1 },
            { "id": "v2", "label": "De R$ 100 a 300 mil", "pontos": 2 },
            { "id": "v3", "label": "De R$ 300 a 600 mil", "pontos": 3 },
            { "id": "v4", "label": "Acima de R$ 600 mil", "pontos": 4 },
            { "id": "v5", "label": "Ainda não sei", "pontos": 0 }
          ] }
        }
      ],
      "proximo": "g_prazo"
    },
    {
      "id": "g_prazo",
      "titulo": "Prazo",
      "posicao": { "x": 320, "y": 800 },
      "blocos": [
        { "id": "b_pz_txt", "tipo": "texto", "conteudo": { "texto": "Quando você pretende começar?" } },
        {
          "id": "b_prazo", "tipo": "entrada_botoes", "salvar_em": "prazo",
          "conteudo": { "opcoes": [
            { "id": "p1", "label": "Agora", "pontos": 3 },
            { "id": "p2", "label": "Nas próximas semanas", "pontos": 2 },
            { "id": "p3", "label": "Nos próximos meses", "pontos": 1 },
            { "id": "p4", "label": "Só pesquisando por enquanto", "pontos": 0 }
          ] }
        },
        {
          "id": "b_triagem", "tipo": "condicao",
          "conteudo": { "regras": [
            { "se": { "variavel": "prazo", "igual": "Só pesquisando por enquanto" }, "entao": "g_fim_frio" }
          ] }
        }
      ],
      "proximo": "g_decisor"
    },
    {
      "id": "g_decisor",
      "titulo": "Decisor",
      "posicao": { "x": 320, "y": 1000 },
      "blocos": [
        { "id": "b_dec_txt", "tipo": "texto", "conteudo": { "texto": "Quem decide sobre essa contratação?" } },
        {
          "id": "b_decisor", "tipo": "entrada_botoes", "salvar_em": "decisor",
          "conteudo": { "opcoes": [
            { "id": "d1", "label": "Eu decido", "pontos": 3 },
            { "id": "d2", "label": "Decido junto com outra pessoa", "pontos": 2 },
            { "id": "d3", "label": "Preciso consultar alguém", "pontos": 0 }
          ] }
        },
        {
          "id": "b_classificar", "tipo": "condicao",
          "conteudo": { "regras": [
            { "se": { "pontuacao": { "maior_que": 8 } }, "entao": "g_fim_quente" },
            { "se": { "pontuacao": { "maior_que": 4 } }, "entao": "g_fim_morno" }
          ] }
        }
      ],
      "proximo": "g_fim_frio"
    },
    {
      "id": "g_fim_quente",
      "titulo": "Fim quente",
      "posicao": { "x": 40, "y": 1200 },
      "blocos": [
        { "id": "b_fq", "tipo": "texto", "conteudo": { "texto": "Perfeito, {{nome}}. Um consultor vai falar com você para montar o plano a partir do que você contou." } },
        { "id": "b_fq_link", "tipo": "redirecionar", "conteudo": { "url": "https://wa.me/5561982286044?text=Ol%C3%A1%2C%20sou%20{{nome}}%20e%20vim%20pelo%20chat.", "rotulo_botao": "Continuar no WhatsApp", "nova_aba": true } }
      ]
    },
    {
      "id": "g_fim_morno",
      "titulo": "Fim morno",
      "posicao": { "x": 320, "y": 1200 },
      "blocos": [
        { "id": "b_fm", "tipo": "texto", "conteudo": { "texto": "Obrigado pelas respostas, {{nome}}. Vamos analisar o seu caso com calma e retornar pelo WhatsApp que você deixou." } }
      ]
    },
    {
      "id": "g_fim_frio",
      "titulo": "Fim frio",
      "posicao": { "x": 640, "y": 1200 },
      "blocos": [
        { "id": "b_ff", "tipo": "texto", "conteudo": { "texto": "Obrigado por responder, {{nome}}. Guardamos o seu contato para quando fizer sentido para você." } }
      ]
    },
    {
      "id": "g_sem_dado",
      "titulo": "Seguir sem o dado",
      "posicao": { "x": 40, "y": 220 },
      "blocos": [
        { "id": "b_sd", "tipo": "texto", "conteudo": { "texto": "Sem problema, vamos seguir sem esse dado por enquanto." } }
      ],
      "proximo": "g_bem"
    }
  ]
}
```

`clientes/osher/README.md`:

```markdown
# Osher — fluxo de qualificação

Primeiro cliente do chatflow. Consórcio, Brasília.

- `fluxo.json` — as perguntas e os caminhos
- `tema.json` — azul #0C2340, dourado #BF9C5A, Georgia
- `destinos.json` — para onde vai o lead

Rodar: `motor/player.html?cliente=osher`
Rodar sem enviar nada: `motor/player.html?cliente=osher&teste=1`

Pontuação máxima: 12. Quente a partir de 9, morno de 5 a 8, frio até 4.
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test testes/
```

Esperado: PASS em todos os arquivos, incluindo os seis testes do fluxo da Osher.

- [ ] **Step 5: Verificação de ponta a ponta (depende da URL do Apps Script)**

Pré-requisito: o Apps Script publicado como aplicativo web, com acesso "qualquer pessoa". **Se a URL ainda não existir, parar aqui e relatar** — os passos anteriores estão completos e commitados.

Com a URL em mãos, preencher `clientes/osher/destinos.json`:

```json
"planilha": { "tipo": "apps_script", "url": "https://script.google.com/macros/s/XXXX/exec" }
```

Depois:

```bash
cd chatflow && python3 -m http.server 8080
```

Abrir `http://localhost:8080/motor/player.html?cliente=osher`, completar o fluxo até o fim quente, e **conferir na planilha** que apareceu uma linha nova com `nome`, `whatsapp`, `bem`, `valor`, `prazo`, `decisor`, `pontuacao` e `classificacao`. Conferir também que a aba de eventos ganhou uma linha por grupo exibido.

Não dar a tarefa por concluída sem ver a linha na planilha.

- [ ] **Step 6: Commit**

```bash
git add clientes/osher/ testes/fluxo-osher.test.js
git commit -m "feat: fluxo de qualificacao da Osher como primeiro cliente"
```

---

## Verificação final

- [ ] `node --test testes/` passa inteiro
- [ ] `grep -rniE "consórcio|osher|#0C2340|#BF9C5A|script.google" motor/` não devolve nada — o motor está limpo
- [ ] `rm -rf clientes/osher && python3 -m http.server 8080` e abrir `motor/player.html` — o exemplo genérico ainda roda
- [ ] `git checkout clientes/osher` para restaurar
- [ ] Uma linha nova na planilha, conferida com os próprios olhos
