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

Pontuação máxima: 5 — só motivo (1 ou 2) e valor (1, 2 ou 3) pontuam; a
idade é demográfica e não entra na conta. Quente a partir de 5, morno de 3 a
4, frio até 2. (Os números 12/9/5 que estavam aqui eram do fluxo anterior à
reescrita de 28/08/2026.)

## Receptor

`apps-script.gs` é o código que recebe os leads, publicado como app da web no
Apps Script. É um script avulso, então a planilha de destino é declarada por
ID na constante `ID_DA_PLANILHA`, no topo do arquivo.

Destino: planilha **Leads Osher Backup**, que já guarda os leads históricos de
2025. O chat escreve só em três abas próprias. As abas antigas não são
tocadas. Para renomear, mexa nas constantes no topo do arquivo — as abas são
criadas com o nome que estiver lá.

| Aba | O que tem | Para quem |
| --- | --- | --- |
| `Chatflow` | um lead por pessoa que termina | é o que também vai para o CRM |
| `Chatflow Parciais` | uma linha por pessoa, reescrita a cada passo | vendedor: quem parou no meio e deixou telefone |
| `Chatflow Eventos` | uma linha por pergunta exibida, ~16 por visitante | análise de funil |

A aba de parciais existe porque quem abandona no meio nunca chega ao envio
final: o evento de funil é o único lugar por onde as respostas já dadas saem
do navegador. A coluna `situacao` vira `concluído` quando a pessoa termina —
serve para o vendedor não ligar para quem já entrou no CRM pelo caminho
normal.

Leads parciais **não vão para o CRM**, só para a planilha: os eventos têm um
destino só (`"eventos": "planilha"` no `destinos.json`), e o CRM recebe apenas
o que está em `ao_finalizar`. Mandar parcial para o CRM hoje quebraria o lead
bom — a Edge Function `lead-intake` usa o `sessaoId` como chave de
deduplicação e descarta o segundo envio da mesma sessão.

Ao editar esse arquivo, republique: **Implantar → Gerenciar implantações →
editar → Versão: Nova versão**. Só salvar não muda o que está no ar, e a URL
`/exec` continua servindo o código antigo.
