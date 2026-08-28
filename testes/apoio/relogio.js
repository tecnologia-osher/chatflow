// Relógio de mentira: em vez de dormir, guarda a espera pendente e deixa o
// teste decidir quando ela termina. Testes de tempo que dormem de verdade
// são lentos e instáveis; estes são instantâneos e determinísticos.

import { assentar } from "./navegador.js"

export function relogioManual() {
  const pedidas = []
  let pendente = null

  return {
    // Passe como `esperar` para o criarChat
    esperar(ms) {
      pedidas.push(ms)
      return new Promise((resolve) => { pendente = resolve })
    },

    // Quanto o motor pediu para esperar, em ordem
    duracoes: () => [...pedidas],
    esperando: () => pendente !== null,

    // Deixa a pausa atual terminar
    async correr() {
      if (!pendente) throw new Error("nada esperando: o motor não pediu pausa")
      const soltar = pendente
      pendente = null
      soltar()
      await assentar()
    }
  }
}
