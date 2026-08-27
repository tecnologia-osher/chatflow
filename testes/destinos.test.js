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

test("destino pausado com url valida nunca e chamado, mesmo configurado", async () => {
  const chamadas = []
  const enviador = criarEnviador({
    destinos: {
      planilha: { tipo: "apps_script", url: "https://exemplo/planilha" },
      crm: { tipo: "webhook", url: "https://exemplo/crm", ativo: false }
    },
    ao_finalizar: ["planilha", "crm"],
    buscar: async (url) => { chamadas.push(url); return { ok: true } }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.deepEqual(chamadas, ["https://exemplo/planilha"])
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
  let chamadas = 0
  const enviador = criarEnviador({
    ...config(),
    buscar: async () => { chamadas++; throw new Error("rede fora") }
  })
  await enviador.enviar({ nome: "Ana" })
  assert.equal(enviador.fila()[0].tentativas, 1)
  await enviador.processarFila()
  assert.equal(enviador.fila()[0].tentativas, 2)
  await enviador.processarFila()
  assert.equal(enviador.fila().length, 0)
  assert.equal(chamadas, 3)
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
