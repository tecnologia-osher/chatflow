// Imagem e vídeo que vivem na pasta do cliente.
//
// O fluxo guarda o caminho como ele é dentro da pasta — "imagens/foto.png" —
// porque é isso que viaja junto com o projeto. Quem sabe onde essa pasta está
// é quem carrega o fluxo, não o motor: o mesmo arquivo abre em
// `motor/player.html`, no preview do editor e, um dia, num endereço próprio.

const ABSOLUTO = /^(https?:)?\/\/|^data:|^blob:|^\//i
// Os tipos cujo conteúdo é um arquivo que pode morar na pasta do cliente.
const MIDIA = new Set(["imagem", "video", "audio"])

export function ehRelativo(caminho) {
  const texto = String(caminho || "").trim()
  return Boolean(texto) && !ABSOLUTO.test(texto)
}

export function resolverCaminho(caminho, base) {
  if (!base || !ehRelativo(caminho)) return caminho
  return `${String(base).replace(/\/+$/, "")}/${String(caminho).trim()}`
}

// Devolve o fluxo com as mídias prontas para o navegador buscar. Não mexe no
// original: o editor grava o que leu, e gravar um caminho já resolvido
// quebraria o projeto assim que ele mudasse de endereço.
export function resolverMidia(fluxo, base) {
  if (!base || !fluxo?.grupos) return fluxo
  let mudou = false
  const grupos = fluxo.grupos.map((grupo) => {
    if (!grupo?.blocos) return grupo
    const blocos = grupo.blocos.map((bloco) => {
      if (!bloco || !MIDIA.has(bloco.tipo)) return bloco
      const url = bloco.conteudo?.url
      if (!ehRelativo(url)) return bloco
      mudou = true
      return { ...bloco, conteudo: { ...bloco.conteudo, url: resolverCaminho(url, base) } }
    })
    return blocos === grupo.blocos ? grupo : { ...grupo, blocos }
  })
  return mudou ? { ...fluxo, grupos } : fluxo
}
