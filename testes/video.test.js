// Endereço de vídeo que o navegador saiba tocar.

import { test } from "node:test"
import assert from "node:assert/strict"
import { fonteDeVideo } from "../motor/video.js"

test("YouTube vira o endereco de incorporacao, em todas as formas do link", () => {
  for (const endereco of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ"
  ]) {
    assert.deepEqual(fonteDeVideo(endereco),
      { tipo: "incorporado", src: "https://www.youtube.com/embed/dQw4w9WgXcQ" }, endereco)
  }
})

test("Vimeo tambem", () => {
  assert.deepEqual(fonteDeVideo("https://vimeo.com/347119375"),
    { tipo: "incorporado", src: "https://player.vimeo.com/video/347119375" })
})

test("autoplay entra no endereco, e sempre mudo", () => {
  const { src } = fonteDeVideo("https://youtu.be/dQw4w9WgXcQ", { autoplay: true })
  assert.match(src, /autoplay=1/)
  assert.match(src, /mute=1/, "navegador nenhum deixa começar com som: sem mudo, não começa")

  const vimeo = fonteDeVideo("https://vimeo.com/347119375", { autoplay: true }).src
  assert.match(vimeo, /autoplay=1/)
  assert.match(vimeo, /muted=1/)
})

test("arquivo de video toca direto", () => {
  assert.deepEqual(fonteDeVideo("https://exemplo.com/a.mp4"),
    { tipo: "arquivo", src: "https://exemplo.com/a.mp4" })
})

test("endereco vazio ou estranho nao vira video", () => {
  for (const nada of ["", "   ", null, undefined, "só um texto", "javascript:alert(1)"]) {
    assert.equal(fonteDeVideo(nada), null, String(nada))
  }
})

test("o id do video nao vaza para o endereco de incorporacao", () => {
  // Link com coisa colada depois do id: o que vale é o id, não o resto.
  const { src } = fonteDeVideo("https://youtu.be/dQw4w9WgXcQ?t=42")
  assert.equal(src, "https://www.youtube.com/embed/dQw4w9WgXcQ")
})
