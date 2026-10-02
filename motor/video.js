// De um endereço de vídeo para o que o navegador sabe tocar.
//
// YouTube e Vimeo não tocam por <video>: precisam do endereço de incorporação
// deles. O resto — um .mp4 no servidor do cliente, por exemplo — toca direto.
// Quem não for reconhecido vira link, porque uma caixa preta e muda é pior
// que uma frase azul que funciona.

const YOUTUBE = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
  /youtu\.be\/([\w-]{6,})/i,
  /youtube\.com\/(?:embed|shorts|live)\/([\w-]{6,})/i
]
const VIMEO = [/vimeo\.com\/(?:video\/)?(\d{6,})/i]

function primeiro(regras, texto) {
  for (const regra of regras) {
    const achado = regra.exec(texto)
    if (achado) return achado[1]
  }
  return null
}

export function fonteDeVideo(url, { autoplay = false } = {}) {
  const endereco = String(url || "").trim()
  if (!endereco) return null

  const doYoutube = primeiro(YOUTUBE, endereco)
  if (doYoutube) {
    // `mute=1` junto com o autoplay porque navegador nenhum deixa começar com
    // som sem a pessoa pedir — sem ele, o autoplay simplesmente não acontece.
    const extras = autoplay ? "?autoplay=1&mute=1" : ""
    return { tipo: "incorporado", src: `https://www.youtube.com/embed/${doYoutube}${extras}` }
  }

  const doVimeo = primeiro(VIMEO, endereco)
  if (doVimeo) {
    const extras = autoplay ? "?autoplay=1&muted=1" : ""
    return { tipo: "incorporado", src: `https://player.vimeo.com/video/${doVimeo}${extras}` }
  }

  if (/^https?:\/\//i.test(endereco)) return { tipo: "arquivo", src: endereco }
  return null
}
