# Osher — fluxo de qualificação

Primeiro cliente do chatflow. Consórcio, Brasília.

- `fluxo.json` — as perguntas e os caminhos
- `tema.json` — fala do chat em azul #0C2340, resposta em dourado #BF9C5A, Open Sans
- `logo.svg` — o retrato redondo que aparece ao lado de cada fala do chat
- `destinos.json` — para onde vai o lead

A fonte vem do Google Fonts, pedida pelo `fonte_url` do tema. É o único
recurso de fora que este cliente carrega — se a rede não responder, o chat
cai na fonte do sistema e continua funcionando.

`logo.svg` é o wordmark desenhado em SVG, dentro de um círculo azul. Para
trocar pelo arquivo oficial, ponha o PNG na pasta e mude `avatar` no
`tema.json`; nada além dessa linha precisa mudar.

Rodar: `motor/player.html?cliente=osher`
Rodar sem enviar nada: `motor/player.html?cliente=osher&teste=1`

Pontuação máxima: 12. Quente a partir de 9, morno de 5 a 8, frio até 4.

## Receptor

`apps-script.gs` é o código que recebe os leads, publicado como app da web no
Apps Script. É um script avulso, então a planilha de destino é declarada por
ID na constante `ID_DA_PLANILHA`, no topo do arquivo.

Destino: planilha **Leads Osher Backup**, que já guarda os leads históricos de
2025. O chat escreve só em duas abas próprias, `Chatflow` (um lead por pessoa
que termina) e `Chatflow Eventos` (o funil, ~16 linhas por visitante). As abas
antigas não são tocadas. Para renomear, mexa nas constantes `ABA_LEADS` e
`ABA_EVENTOS` — as abas são criadas com o nome que estiver lá.

Ao editar esse arquivo, republique: **Implantar → Gerenciar implantações →
editar → Versão: Nova versão**. Só salvar não muda o que está no ar, e a URL
`/exec` continua servindo o código antigo.
