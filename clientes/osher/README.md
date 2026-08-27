# Osher — fluxo de qualificação

Primeiro cliente do chatflow. Consórcio, Brasília.

- `fluxo.json` — as perguntas e os caminhos
- `tema.json` — azul #0C2340, dourado #BF9C5A, Georgia
- `destinos.json` — para onde vai o lead

Rodar: `motor/player.html?cliente=osher`
Rodar sem enviar nada: `motor/player.html?cliente=osher&teste=1`

Pontuação máxima: 12. Quente a partir de 9, morno de 5 a 8, frio até 4.

## Receptor

`apps-script.gs` é o código que recebe os leads, publicado como app da web no
Apps Script. É um script avulso, então a planilha de destino é declarada por
ID na constante `ID_DA_PLANILHA`, no topo do arquivo.

Ao editar esse arquivo, republique: **Implantar → Gerenciar implantações →
editar → Versão: Nova versão**. Só salvar não muda o que está no ar, e a URL
`/exec` continua servindo o código antigo.
