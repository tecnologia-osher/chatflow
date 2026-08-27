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
