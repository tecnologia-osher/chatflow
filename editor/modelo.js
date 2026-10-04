// Leitura do fluxo para o canvas: cartões e setas. Lógica pura, sem DOM.
//
// O editor não conhece tipo de bloco nenhum: o rótulo e os campos saem do
// catálogo em motor/blocos. Tipo novo aparece aqui sozinho.

import { registrarTodos } from "../motor/blocos/index.js"
import { todos, obter } from "../motor/blocos/_registro.js"
import { partesDoDestino } from "../motor/destino.js"

if (todos().length === 0) registrarTodos()

const LARGURA = 380
const ALTURA = 260
const POR_LINHA = 3
const LIMITE_RESUMO = 80

// Um grupo sem posicao seria desenhado na origem, em cima dos outros. Espalha
// numa grade para que o fluxo continue legível enquanto ninguém arrastou nada.
function posicaoDe(grupo, indice) {
  const p = grupo.posicao
  if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y }
  return {
    x: 40 + (indice % POR_LINHA) * LARGURA,
    y: 40 + Math.floor(indice / POR_LINHA) * ALTURA
  }
}

function cortar(texto) {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim()
  return limpo.length > LIMITE_RESUMO ? limpo.slice(0, LIMITE_RESUMO - 1) + "…" : limpo
}

// O que o cartão mostra de cada bloco. Procura o primeiro campo que tenha
// conteúdo, na ordem em que o tipo os declara — é o que a pessoa escreveu.
function resumoDe(bloco, definicao) {
  const c = bloco.conteudo || {}
  if (Array.isArray(c.opcoes)) return cortar(c.opcoes.map((o) => o.label).join(" · "))
  if (Array.isArray(c.regras)) return cortar(`${c.regras.length} regra(s)`)

  for (const campo of definicao?.campos || []) {
    const valor = c[campo.nome]
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") return cortar(valor)
  }
  for (const valor of Object.values(c)) {
    if (typeof valor === "string" && valor.trim() !== "") return cortar(valor)
  }
  return ""
}

function definicaoDe(tipo) {
  try {
    return obter(tipo)
  } catch {
    return null
  }
}

// Qual campo a pessoa edita clicando direto no bloco do cartão. É o primeiro
// campo de texto que o tipo declara — para `texto` é a fala, para as entradas
// é o texto de exemplo. Tipo cujo conteúdo é lista (botões, condição) não tem
// principal: ali o que importa são os itens, e isso não cabe numa caixa só.
export function campoPrincipal(tipo) {
  const definicao = definicaoDe(tipo)
  if (!definicao) return null
  const campo = (definicao.campos || []).find((c) => c.tipo === "texto")
  return campo ? campo.nome : null
}

export function cartoes(fluxo) {
  return (fluxo?.grupos || []).filter(Boolean).map((grupo, indice) => ({
    id: grupo.id,
    titulo: grupo.titulo || grupo.id,
    posicao: posicaoDe(grupo, indice),
    proximo: grupo.proximo || null,
    blocos: (grupo.blocos || []).filter(Boolean).map((bloco) => {
      const definicao = definicaoDe(bloco.tipo)
      return {
        id: bloco.id,
        tipo: bloco.tipo,
        rotulo: definicao ? definicao.rotulo : bloco.tipo,
        categoria: definicao ? definicao.categoria : null,
        desconhecido: !definicao,
        resumo: resumoDe(bloco, definicao),
        campoPrincipal: campoPrincipal(bloco.tipo),
        // As opções sobem para o cartão: é lá que se escreve o que cada botão
        // vai dizer, empilhadas uma abaixo da outra.
        opcoes: Array.isArray(bloco.conteudo?.opcoes)
          ? bloco.conteudo.opcoes.filter(Boolean).map((o) => ({
            id: o.id, label: o.label ?? "", pontos: o.pontos, proximo: o.proximo || null
          }))
          : null,
        valorPrincipal: (bloco.conteudo || {})[campoPrincipal(bloco.tipo)] ?? "",
        // O conteúdo inteiro, para quem edita no cartão mais de um campo —
        // a bolha de imagem tem link, upload e abrir-ao-clicar na mesma caixa.
        conteudo: { ...(bloco.conteudo || {}) },
        salvar_em: bloco.salvar_em || null
      }
    })
  }))
}

// Toda saída que o grupo tem, com a origem de cada uma. A origem importa para
// o canvas desenhar diferente o que veio de uma opção e o que veio do grupo.
function saidasDoGrupo(grupo) {
  const saidas = []
  if (grupo.proximo) saidas.push({ para: grupo.proximo, origem: "grupo" })

  for (const bloco of grupo.blocos || []) {
    if (!bloco) continue
    const c = bloco.conteudo || {}
    if (bloco.tipo === "ir_para" && c.destino) {
      saidas.push({ para: c.destino, origem: "ir_para", saida: { bloco: bloco.id } })
    }
    for (const regra of c.regras || []) {
      if (regra && regra.entao) {
        saidas.push({ para: regra.entao, origem: "condicao", saida: { bloco: bloco.id } })
      }
    }
    for (const opcao of c.opcoes || []) {
      if (opcao && opcao.proximo) {
        saidas.push({ para: opcao.proximo, origem: "opcao", saida: { bloco: bloco.id, opcao: opcao.id } })
      }
    }
  }
  return saidas
}

export function setas(fluxo) {
  const grupos = (fluxo?.grupos || []).filter(Boolean)
  const existe = new Set(grupos.map((g) => g.id))
  const porPar = new Map()

  // Um destino pode nomear um bloco ("g#b"). A seta é órfã quando o grupo não
  // existe ou quando o bloco citado não existe mais naquele grupo: as duas
  // coisas levam o lead para o lugar errado, então as duas aparecem em
  // vermelho em vez de sumirem do desenho.
  const blocosPorGrupo = new Map(grupos.map((g) =>
    [g.id, new Set((g.blocos || []).filter(Boolean).map((b) => b.id))]))

  function destinoQuebrado(destino) {
    const { grupo, bloco } = partesDoDestino(destino)
    if (!existe.has(grupo)) return true
    return !!bloco && !blocosPorGrupo.get(grupo)?.has(bloco)
  }

  function juntar(de, para, origem, evento, saida = null) {
    // A chave inclui a saída: duas opções que vão para o mesmo grupo são duas
    // setas, porque saem de alturas diferentes. Juntá-las escondia uma delas.
    const chave = `${evento || ""}|${de || ""}|${saida?.bloco || ""}|${saida?.opcao || ""}|${para}`
    const atual = porPar.get(chave)
    if (atual) {
      if (!atual.origens.includes(origem)) atual.origens.push(origem)
      return
    }
    // Seta órfã continua sendo desenhada de propósito: sumir com ela
    // esconderia justamente o erro que a pessoa precisa ver.
    porPar.set(chave, {
      // A chave identifica a seta entre um desenho e o seguinte: é por ela
      // que o canvas sabe qual linha continua selecionada depois de
      // redesenhar, sem guardar o objeto antigo.
      chave,
      de: de ?? null, para, origens: [origem], saida,
      orfa: destinoQuebrado(para), evento: evento || null
    })
  }

  for (const evento of (fluxo?.eventos || []).filter(Boolean)) {
    if (evento.proximo) juntar(null, evento.proximo, "evento", evento.tipo)
  }
  for (const grupo of grupos) {
    for (const { para, origem, saida } of saidasDoGrupo(grupo)) juntar(grupo.id, para, origem, null, saida)
  }
  return [...porPar.values()]
}

// --- tamanho do cartão -----------------------------------------------------

// O canvas não mede nada: o tamanho é calculado. Medir exigiria o elemento já
// desenhado, e aí as setas só saberiam onde ancorar depois de um quadro — o
// desenho apareceria torto e se corrigiria sozinho, que é pior que estar fixo.
// Estas medidas não são palpite: foram medidas no Chrome, em unidades de
// fluxo (o que o CSS desenha dividido pela escala). Enquanto diziam "todo
// bloco tem 52", um cartão de 333 era anunciado como 226 — e um cartão que
// o editor acha mais baixo do que é deixa a seta mirar errado, o "ajustar à
// tela" cortar o pé do fluxo e os cartões se cobrirem sem ninguém notar.
const CARTAO_LARGURA = 260
const CARTAO_CABECALHO = 44
// O bloco sem o texto: rótulo, respiros e borda. Cada linha de resumo
// acrescenta uma linha de altura, e o resumo quebra perto dos 36 caracteres.
// A medida inclui a margem entre blocos: o cartão desenha cada bloco como uma
// caixinha com respiro, e quem soma a altura precisa somar o respiro junto.
// Medidos no Chrome depois que a linha do tipo entrou: a faixa fixa do bloco
// (nome do tipo, margens e o respiro até o bloco seguinte) e cada linha de
// texto embaixo dela.
const CARTAO_BLOCO = 45.6
// Recalibrado em 03/10/2026, quando a letra do bloco foi de 0,84 para 0,9rem:
// a faixa fixa continuou a mesma, e cada linha ficou 1,2px mais alta.
const CARTAO_LINHA = 18.7
// Medido letra a letra no Chrome: 28 ainda cabem numa linha, 29 já quebram.
// A largura do cartão não mudou — quem tirou letras da linha foi a letra
// maior. Alargar o cartão junto faria grupos já arranjados se cobrirem: a
// posição que o cliente salvou foi escolhida com o cartão deste tamanho.
const CARTAO_CARACTERES_POR_LINHA = 28
// Bloco de botões: o topo com o rótulo, e cada opção empilhada — mais a
// linha do "+ botão", que fecha a lista e ocupa altura como as outras.
const CARTAO_OPCOES_TOPO = 43.2
const CARTAO_OPCAO = 39.6
// O rodapé é a faixa onde mora a saída do grupo, em todo cartão: é a única
// saída que existe, com botões ou sem.
const CARTAO_RODAPE = 32
// Sem botões o rodapé não tem palavra nenhuma, só a bolinha: é mais baixo.
const CARTAO_RODAPE_SO_BOLINHA = 22.4
// Onde fica o centro da bolinha, medido da borda direita do cartão. A linha
// nasce nela, não na borda — nascendo na borda, ficava um vão entre a bolinha
// e o começo do traço, e a linha parecia sair do cartão.
//
// Tem de ser o mesmo valor de `--ed-conector-fora` no editor.css: lá ele põe
// a bolinha, aqui ele faz a linha nascer nela. Dois números diferentes
// voltariam a abrir o vão.
const CARTAO_CONECTOR = 0

function alturaDoBloco(bloco) {
  if (bloco.opcoes) {
    return CARTAO_OPCOES_TOPO + (bloco.opcoes.length + 1) * CARTAO_OPCAO
  }
  const letras = (bloco.resumo || "").length
  const linhas = Math.max(1, Math.ceil(letras / CARTAO_CARACTERES_POR_LINHA))
  return CARTAO_BLOCO + linhas * CARTAO_LINHA
}

export function alturaDoCartao(cartao) {
  const temBotoes = cartao.blocos.some((b) => b.opcoes)
  const blocos = cartao.blocos.reduce((total, b) => total + alturaDoBloco(b), 0)
  return CARTAO_CABECALHO + blocos + (temBotoes ? CARTAO_RODAPE : CARTAO_RODAPE_SO_BOLINHA)
}

export function caixas(listaDeCartoes) {
  const mapa = new Map()
  for (const cartao of listaDeCartoes) {
    // A faixa de cada bloco dentro do cartão: é nela que a seta de um destino
    // com bloco precisa chegar, e é ela que o ímã procura.
    const linhas = []
    let topo = CARTAO_CABECALHO
    for (const bloco of cartao.blocos) {
      const altura = alturaDoBloco(bloco)
      // Cada opção tem a sua linha dentro do bloco: é dela que a seta daquela
      // resposta sai, como a bolinha que se puxa. Duas setas saindo da mesma
      // altura seriam duas respostas indistinguíveis no desenho.
      const opcoes = (bloco.opcoes || []).map((opcao, i) => ({
        id: opcao.id,
        y: topo + CARTAO_OPCOES_TOPO + i * CARTAO_OPCAO,
        altura: CARTAO_OPCAO
      }))
      linhas.push({ id: bloco.id, y: topo, altura, opcoes })
      topo += altura
    }
    mapa.set(cartao.id, {
      x: cartao.posicao.x,
      y: cartao.posicao.y,
      largura: CARTAO_LARGURA,
      altura: alturaDoCartao(cartao),
      // A seta que chega pela lateral encosta na altura do nome do grupo, não
      // no meio do cartão: é o nome que diz em qual grupo ela entra.
      ancoraY: cartao.posicao.y + CARTAO_CABECALHO / 2,
      blocos: linhas,
      rodape: {
        y: topo,
        altura: cartao.blocos.some((b) => b.opcoes) ? CARTAO_RODAPE : CARTAO_RODAPE_SO_BOLINHA
      }
    })
  }
  return mapa
}

// A faixa de um bloco, em coordenadas do fluxo. Sem o bloco (ou com um que não
// existe mais) devolve o cartão inteiro: a seta chega na borda, como sempre.
export function caixaDoBloco(caixa, blocoId) {
  if (!caixa) return null
  const linha = (caixa.blocos || []).find((b) => b.id === blocoId)
  if (!linha) return caixa
  return { x: caixa.x, y: caixa.y + linha.y, largura: caixa.largura, altura: linha.altura }
}

// De onde uma seta sai, no cartão: a linha da opção, se a saída é de uma
// opção; a faixa do bloco, se é de um bloco; o rodapé, se é a saída do grupo.
// É a mesma conta para a seta pronta e para o fio que se arrasta — se cada um
// fizesse a sua, a linha pularia no instante em que a ligação é feita.
export function caixaDaSaida(caixa, saida) {
  if (!caixa) return null
  const faixa = (caixa.blocos || []).find((b) => b.id === saida?.bloco)
  const linha = (faixa?.opcoes || []).find((o) => o.id === saida?.opcao)
  const alvo = linha || faixa || caixa.rodape
  if (!alvo) return comConector(caixa)
  return {
    x: caixa.x, y: caixa.y + alvo.y,
    largura: caixa.largura + CARTAO_CONECTOR, altura: alvo.altura
  }
}

// A caixa esticada até o centro da bolinha. Serve para a saída da seta cair
// exatamente nela.
export function comConector(caixa) {
  return caixa && { ...caixa, largura: caixa.largura + CARTAO_CONECTOR }
}

// Qual bloco está sob um ponto, dentro de um cartão. Cabeçalho e rodapé
// devolvem null: ali o alvo é o grupo inteiro, que é o que a pessoa espera ao
// apontar para o nome do cartão.
export function blocoEmCaixa(caixa, ponto) {
  if (!caixa) return null
  const relativo = ponto.y - caixa.y
  const linha = (caixa.blocos || []).find((b) => relativo >= b.y && relativo < b.y + b.altura)
  return linha ? linha.id : null
}

export const MEDIDAS = {
  CARTAO_LARGURA, CARTAO_CABECALHO, CARTAO_BLOCO, CARTAO_LINHA, CARTAO_CARACTERES_POR_LINHA,
  CARTAO_OPCOES_TOPO, CARTAO_OPCAO, CARTAO_RODAPE, CARTAO_RODAPE_SO_BOLINHA, CARTAO_CONECTOR
}


// --- eventos como cartões --------------------------------------------------

const ROTULO_DO_EVENTO = {
  inicio: "Start",
  invalido: "Resposta inválida",
  comando: "Comando",
  resposta: "Resposta"
}
const ICONE_DO_EVENTO = { inicio: "\u2691" }

const EVENTO_LARGURA = 190
const EVENTO_ALTURA = 48

// O início deixa de ser uma seta que nasce do nada e vira um cartão. Um fluxo
// começado do zero já aparece com ele, sem destino, esperando a ligação —
// senão não há de onde puxar a primeira seta.
export function eventosDoCanvas(fluxo) {
  const declarados = (fluxo?.eventos || []).filter(Boolean)
  const temInicio = declarados.some((e) => e.tipo === "inicio")
  const lista = temInicio ? declarados : [{ tipo: "inicio" }, ...declarados]

  return lista.map((evento, indice) => ({
    tipo: evento.tipo,
    rotulo: ROTULO_DO_EVENTO[evento.tipo] || evento.tipo,
    icone: ICONE_DO_EVENTO[evento.tipo] || "",
    posicao: evento.posicao && typeof evento.posicao.x === "number"
      ? { x: evento.posicao.x, y: evento.posicao.y }
      : { x: 40, y: 40 + indice * 120 },
    proximo: evento.proximo || null
  }))
}

export function caixasDeEventos(listaDeEventos) {
  const mapa = new Map()
  for (const evento of listaDeEventos) {
    mapa.set(evento.tipo, {
      x: evento.posicao.x, y: evento.posicao.y,
      largura: EVENTO_LARGURA, altura: EVENTO_ALTURA
    })
  }
  return mapa
}
