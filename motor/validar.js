import { obter } from "./blocos/_registro.js"
import { partesDoDestino } from "./destino.js"

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
  for (const bloco of grupo.blocos || []) {
    if (!bloco) continue
    saidas.push(...destinosDoBloco(bloco))
  }
  return saidas
}

export function validarFluxo(fluxo, { destinos = {} } = {}) {
  const erros = []
  const grupos = fluxo?.grupos || []
  const porId = new Map()

  grupos.forEach((grupo, indice) => {
    if (!grupo) {
      erros.push(`Grupo nulo encontrado na posição ${indice} da lista de grupos.`)
      return
    }
    if (porId.has(grupo.id)) erros.push(`Grupo com id duplicado: "${grupo.id}".`)
    porId.set(grupo.id, grupo)
  })

  const gruposValidos = grupos.filter(Boolean)

  // Mesmo tratamento dado a grupos e blocos: um editor que apaga por índice
  // deixa null solto no array, e o contrato deste módulo é nunca lançar.
  const eventosDeclarados = fluxo?.eventos || []
  eventosDeclarados.forEach((evento, indice) => {
    if (!evento) {
      erros.push(`Evento nulo encontrado na posição ${indice} da lista de eventos.`)
    }
  })
  const eventos = eventosDeclarados.filter(Boolean)

  // Um destino pode nomear um bloco dentro do grupo ("g#b"). Quem confere
  // precisa olhar as duas metades: grupo que não existe e bloco que não existe
  // quebram o fluxo de maneiras diferentes, e calar uma esconde a outra.
  function problemaNoDestino(destino) {
    const { grupo: idGrupo, bloco } = partesDoDestino(destino)
    const grupo = porId.get(idGrupo)
    if (!grupo) return `o grupo "${idGrupo}", que não existe`
    if (bloco && !(grupo.blocos || []).some((b) => b && b.id === bloco)) {
      return `o bloco "${bloco}", que não existe no grupo "${idGrupo}"`
    }
    return null
  }

  const inicio = eventos.find((e) => e.tipo === "inicio")
  if (!inicio) {
    erros.push("O fluxo precisa de um evento de início.")
  } else if (!inicio.proximo) {
    // Apagar a ligação do início é um clique. Dizer que ele aponta para o
    // grupo "" manda a pessoa procurar um grupo que nunca existiu.
    erros.push("O início não aponta para nenhum grupo: ligue o Start ao primeiro grupo.")
  } else {
    const problema = problemaNoDestino(inicio.proximo)
    if (problema) erros.push(`O início aponta para ${problema}.`)
  }

  for (const evento of eventos) {
    if (evento === inicio) continue
    if (!evento.proximo) continue
    const problema = problemaNoDestino(evento.proximo)
    if (problema) erros.push(`O evento "${evento.tipo}" aponta para ${problema}.`)
  }

  for (const grupo of gruposValidos) {
    const idsBloco = new Set()
    const blocos = grupo.blocos || []
    blocos.forEach((bloco, indiceBloco) => {
      if (!bloco) {
        erros.push(`Grupo "${grupo.id}": bloco nulo encontrado na posição ${indiceBloco}.`)
        return
      }
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
    })

    for (const saida of saidasDoGrupo(grupo)) {
      const problema = problemaNoDestino(saida)
      if (problema) erros.push(`Grupo "${grupo.id}" aponta para ${problema}.`)
    }
  }

  // Todo evento é uma raiz: um grupo alcançado só pelo evento "invalido"
  // não é órfão. A busca roda sempre; só reportamos "inalcançável" quando
  // ao menos uma raiz de fato resolve para um grupo real — senão o
  // problema já está coberto pelo erro de início/evento quebrado.
  const alcancados = new Set()
  const fila = eventos.map((e) => partesDoDestino(e.proximo).grupo).filter((id) => porId.has(id))
  const haviaRaizValida = fila.length > 0
  while (fila.length) {
    const id = fila.shift()
    if (alcancados.has(id)) continue
    alcancados.add(id)
    const grupo = porId.get(id)
    if (!grupo) continue
    for (const saida of saidasDoGrupo(grupo)) {
      const alvo = partesDoDestino(saida).grupo
      if (porId.has(alvo)) fila.push(alvo)
    }
  }
  if (haviaRaizValida) {
    for (const grupo of gruposValidos) {
      if (!alcancados.has(grupo.id)) {
        erros.push(`Grupo "${grupo.id}" não é alcançável a partir do início.`)
      }
    }
  }

  // Becos sem saída: propriedade pura do grafo de grupos. Independe de
  // alcançabilidade ou do evento de início, então roda sempre — mas só
  // reportamos para grupos alcançáveis, para não duplicar o erro de um
  // grupo já apontado como órfão acima.
  const terminais = new Set(
    gruposValidos.filter((g) => saidasDoGrupo(g).length === 0).map((g) => g.id)
  )
  const chegaAoFim = new Set(terminais)
  let mudou = true
  while (mudou) {
    mudou = false
    for (const grupo of gruposValidos) {
      if (chegaAoFim.has(grupo.id)) continue
      if (saidasDoGrupo(grupo).some((s) => chegaAoFim.has(partesDoDestino(s).grupo))) {
        chegaAoFim.add(grupo.id)
        mudou = true
      }
    }
  }
  for (const grupo of gruposValidos) {
    if (alcancados.has(grupo.id) && !chegaAoFim.has(grupo.id)) {
      erros.push(`Grupo "${grupo.id}" é um beco sem saída: nenhum caminho a partir dele termina o fluxo.`)
    }
  }

  return { valido: erros.length === 0, erros }
}
