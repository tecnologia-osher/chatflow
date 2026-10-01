# Estado do chatflow — 25/09/2026

## Sub-projeto 1: EM PRODUÇÃO

O chat da Osher está no ar desde 27/08/2026:

**https://tecnologia-osher.github.io/chatflow/?cliente=osher**

- `&novo=1` — ignora a sessão guardada e começa do zero (para testar)
- `&teste=1` — pré-visualiza sem enviar nada a lugar nenhum

Publicado com GitHub Pages a partir de `main`, repositório público em
github.com/tecnologia-osher/chatflow. **186 testes passando.**

**Armadilha que vai se repetir no próximo cliente:** o GitHub Pages roda
Jekyll por padrão, e Jekyll **ignora todo arquivo que começa com `_`**. O
`motor/blocos/_registro.js` voltava 404 e o chat abria em branco, sem erro
nenhum no console. O `.nojekyll` vazio na raiz resolve. **Não apague.**

## Para onde vai o lead

```
chat no navegador
  ├── planilha "Leads Osher Backup"
  │      aba Chatflow          — um lead por pessoa que termina
  │      aba Chatflow Eventos  — ~1 linha por pergunta exibida (funil)
  │      aba Chatflow Parciais — uma linha por PESSOA, reescrita a cada
  │                              passo. Quem deixa telefone e abandona
  │                              aparece aqui e em lugar nenhum mais
  └── webhook do Make
         └── Edge Function lead-intake (Supabase pidzzwlpsffjznbzukhj)
                └── rodízio de vendedor → tabela deals → e-mail
```

**Por que o Make existe no meio.** Ele guarda o `INTAKE_SECRET` da Edge
Function. O `destinos.json` do chatflow é público — repositório público,
site público — então a credencial não pode viver nele. O Make é quem segura
o segredo.

**O formato que a Edge Function espera** é o payload embrulhado:
`{ "value": "<o json do chatflow como string>" }`. Daí o módulo Create JSON
entre o webhook e o HTTP no cenário do Make. Payload cru também entra, mas
mutilado: perde origem, campanha, dedup e toda a qualificação.

**O cenário do Make** chama-se `Osher - Chatflow para CRM`, com três
módulos: Webhook (2) → Create JSON (5) → HTTP (8). O campo da estrutura de
dados precisa chamar-se exatamente `value`.

## O fluxo hoje

Cinco perguntas, nove falas, 1 segundo de digitação antes de cada uma.

```
1. Bem-vindo à Osher Capital, queremos te conhecer melhor.
2. Qual o seu nome?                          → nome
3. Show, prazer em te conhecer, {nome}.
4. Qual seu telefone com WhatsApp?           → whatsapp
5. Qual sua idade?                           → idade      (não pontua)
6. Por que você está buscando um consórcio?  → objetivo   (1 · 2)
7. Qual o valor do crédito do imóvel?        → valor      (1 · 2 · 3)
8. Muito obrigado pelas respostas.
9. Vou te redirecionar para falar com um de nossos especialistas.
   [ Continuar no WhatsApp ]  → (61) 99969-9829
```

**O telefone tem que ser um celular de verdade.** O campo tem máscara: a
pessoa digita só números e ele escreve `(61) 98228-6044` sozinho. Letra não
aparece, passar de onze números não entra, e colar com o `+55` na frente não
vira um número errado. O validador exige DDD de 2 números que existe na lista
oficial, o nono dígito começado em 9, e recusa número repetido. Enquanto o
número não estiver certo, o fluxo não anda — a mensagem é uma só:
"Digite o número correto." Era só uma contagem de 10 a 13 dígitos até
29/08/2026, então `1234567890`, `0000000000` e até `abc 1234567890` passavam
— e um telefone falso que parece telefone é pior que um campo vazio, porque
ninguém desconfia dele. Leads gravados antes dessa data podem ter números
assim.

**Nome e telefone são obrigatórios.** O chat insiste até o dado ser válido:
não há caminho que leve ao fim sem contato. Era o contrário até 29/08/2026 —
um evento `invalido` dizia "seguir sem esse dado" depois de duas tentativas e
saltava para a idade, então quem errava o telefone virava um lead sem
telefone, e quem errava o **nome** perdia o nome e o telefone junto, porque o
salto caía depois do grupo de contato. Nos dois casos o lead era enviado,
pontuado e distribuído a um vendedor sem ninguém para ligar. Três testes em
`testes/fluxo-osher.test.js` guardam isso agora.

**Faixas:** quente ≥ 5 · morno ≥ 3 · frio abaixo. Das seis combinações
possíveis, uma é frio, quatro são morno e uma é quente.

**O ritmo da digitação é do cliente**, declarado em `ritmo` dentro do
`fluxo.json`. Sem ele, o motor usa o padrão proporcional ao tamanho do texto.

## Auditoria de 28/08/2026

**Corrigido: a classificação "frio" era inalcançável.** Depois da reescrita
do fluxo, a menor pontuação possível passou a ser 2 e "morno" começava em 2 —
todo lead virava morno ou quente, metade e metade. O rótulo deixava de ser
sinal para o vendedor. Faixas ajustadas, e criado um teste que enumera todas
as combinações de resposta e exige que as três classificações aconteçam.

Verificado e limpo: `motor/` e `exemplos/` sem nenhum vestígio de cliente;
zero dependências; nenhuma sobra de depuração; os 28 arquivos publicados
idênticos ao repositório; a cópia de `preferencias.md` idêntica ao original
do MazyOS.

## Decisões em aberto, todas suas

1. **As exclamações.** Você escreveu "Show!" e "Muito obrigado pelas
   respostas!". O `preferencias.md` da marca bane exclamação e um teste
   barra. Estão publicados sem o ponto. Ou mantém a regra, ou a gente
   relaxa ela para o chat e ajusta o teste.
2. ~~**Lead sem WhatsApp.**~~ Resolvido em 29/08/2026 — ver a seção da
   conversa acima. O campo virou obrigatório e o validador passou a exigir
   um celular de verdade.
3. **Formato do payload instável.** Campos só existem se a pergunta foi
   alcançada, então todo destino precisa tolerar ausência. Está em standby
   por decisão sua: o motor poderia sempre enviar todas as variáveis
   declaradas no fluxo, com vazio nas não respondidas.
4. **Barra de progresso** ("pergunta 3 de 8"), que o Typebot antigo tinha.

## O que mudou em 29/08/2026

**A cara do chat.** Fundo claro; a fala do chat em azul `#0C2340` com texto
branco e retrato redondo da marca ao lado; a resposta de quem conversa em
dourado `#BF9C5A` com texto branco e borda fina azul. Open Sans, pedida pelo
`fonte_url` do tema. A conversa vive numa coluna de 48rem centrada no
computador e ocupa a tela toda no celular, onde as falas ficam ancoradas no
rodapé e sobem, como num aplicativo de mensagens.

**O rodapé deixou de existir.** Botões de escolha, link de saída, campo de
texto e botão de enviar vivem todos dentro da conversa, do lado de quem
responde, logo abaixo da pergunta. Nada disso entra na transcrição: retomar
a sessão não redesenha controle morto. Cada opção leva um selo laranja
`#D97757` a cavalo na quina, e o enviar troca o rótulo por um avião de papel
(máscara CSS, então o ícone toma a cor do tema sozinho; o rótulo continua no
`aria-label`).

**O telefone.** Era o buraco sério, e tinha duas metades:

- O fluxo tinha um evento `invalido` que, depois de duas tentativas, dizia
  "seguir sem esse dado" e saltava para a idade. Errar o telefone dava um
  lead sem telefone; errar o **nome** dava um lead sem nome e sem telefone,
  porque o salto caía depois do grupo de contato e a pergunta nem chegava a
  ser feita. Nos dois casos o lead era enviado, pontuado e distribuído.
- O validador só contava dígitos: qualquer coisa entre 10 e 13 passava.
  `1234567890`, `0000000000` e `abc 1234567890` viravam leads. **Telefone
  falso que parece telefone é pior que campo vazio** — ninguém no CRM
  desconfia, e o vendedor descobre na ligação.

**Leads gravados antes de 29/08/2026 podem ter números assim.** Vale revisar
os que ainda não foram contatados.

**Novidades do formato do tema**, todas opcionais: `avatar` (retrato, caminho
relativo à pasta do cliente, resolvido pelo player), `fonte_url` (folha de
fonte externa), e as cores `destaque`, `sobre-acento`, `sobre-destaque`,
`borda` e `aviso`. Sem elas o motor desenha como antes.

**Sobre os testes.** A suíte foi de 161 para 183, e cada trecho novo passou
por mutação — defeito reintroduzido de propósito, para confirmar que algum
teste falha. Três lições que valem para o próximo:

- Um mutante que "escapa" às vezes acusa **código redundante**, não teste
  fraco. Dois `limparOpcoes()` cobriam um ao outro; a correção foi apagar um.
- O navegador de mentira precisou aprender `value = ""` e
  `selectionStart`/`setSelectionRange`. Sem eles, um cursor saltando para o
  lugar errado não tinha como falhar num teste — e de fato não tinha.
- Screenshot não prova layout. O transbordo horizontal só apareceu medindo
  `scrollWidth` contra a viewport, e o Chrome headless tem viewport mínimo
  de 500px, o que faz uma captura de 390px parecer cortada sem estar.

## O que vem depois

- **Sub-projeto 2** — editor visual, a cara do produto. As imagens do Typebot
  já foram analisadas e o formato do chatflow bate quase campo a campo:
  grupos, blocos, eventos, `salvar_em`, `proximo`, e as `posicao {x,y}` que
  já estão gravadas em todos os JSONs esperando o canvas.
- **Sub-projeto 3** — contas, banco, multi-cliente. **Ficou mais barato do
  que a spec previa:** o projeto Supabase `Chatflow`
  (`tsaqxbqthnnqtspojwxk`) já existe, vazio. Banco, auth e Edge Functions
  prontos.

**Atenção ao encadeamento:** o sub-projeto 2 sozinho **não** dá autonomia ao
cliente. Ele dá a edição visual, mas não o salvar — sem servidor, o editor só
consegue baixar um arquivo que alguém ainda precisa publicar. Autonomia real
é editar + salvar + publicar, e isso exige o 3 junto.

Antes de atacar o 2, vale deixar o chat rodando alguns dias: a aba
`Chatflow Eventos` vai dizer onde as pessoas desistem, e isso deveria guiar o
desenho do editor em vez de a gente adivinhar.

## Onde está o resto

- Spec do motor: `docs/superpowers/specs/2026-08-27-chatflow-motor-design.md`
- Desenho da publicação: `docs/superpowers/specs/2026-08-27-publicacao-design.md`
- Plano das 12 tarefas: `docs/superpowers/plans/2026-08-27-motor-chatflow.md`
- Registro de execução, com as decisões e o porquê de cada uma:
  `.superpowers/sdd/2026-08-27-motor-chatflow/progress.md` *(fora do git —
  não rode `git clean -fdx`)*


## 25/09/2026 — o que esta sessão fechou

**Quem abandona no meio deixa rastro.** O evento de funil passou a carregar
as respostas dadas até ali, e o receptor mantém a aba `Chatflow Parciais`,
uma linha por pessoa. Antes, quem digitava o telefone e parava na pergunta
seguinte sumia. Provado no ar: a aba nasceu sozinha no primeiro envio.

**O receptor agora diz qual versão está publicada.** Um `GET` na URL do
Apps Script devolve `{ versao, abas }`. Serve para conferir de fora se o que
está no ar é o que está no repositório, sem abrir a planilha e procurar aba.
Trocar a constante `VERSAO` quando o arquivo mudar de verdade.

**Três enganos que custaram tempo, anotados para não se repetirem:**

1. `curl -L` num Apps Script devolve **405** e parece destino morto. Não é:
   o `302` é normal, o `doPost` já rodou e gravou; o 405 é o curl virando
   POST em GET ao seguir. **Confira pelo efeito** (a planilha foi escrita?),
   nunca pelo código de status.
2. `git push origin main` **estando em outra branch** empurra a `main` local,
   que não mudou — e sai com sucesso. O trabalho ficou três semanas parado
   na `leads-parciais` sem ninguém notar. Conferir `git status -sb` antes.
3. O layout mudou em 29/08 e `cf__composer` deixou de existir. Scripts de
   verificação no scratchpad envelhecem junto com o produto.

## O problema que sobrou, e não é de código

**Ninguém usa o chat.** Desde o fim de agosto não há tráfego: 1 lead no CRM
em 45 dias, e é teste do próprio Gustavo. A planilha sem escrita desde 02/09
não era destino quebrado — era ausência de visita.

O chat funciona, captura, classifica e entrega em dois destinos. Está vazio
porque o link não está na frente de ninguém. Enquanto isso não mudar,
nenhuma linha de código altera o resultado — e o sub-projeto 2 (editor
visual) resolveria uma pergunta que ninguém está fazendo.

**A próxima tarefa do chatflow é de distribuição, não de engenharia.**


## Sub-projeto 2 em andamento — branch `editor-visual`

⚠️ **O trabalho do editor vive na branch `editor-visual`, não na `main`.**
O Pages serve a `main`: enquanto não houver merge, nada do editor está no ar.
Em setembro esse mesmo esquecimento deixou três semanas de trabalho parado —
conferir `git status -sb` antes de dar push.

Primeira fatia combinada em 25/09/2026:

- `editor/index.html`, estático, zero dependência, aberto com `?cliente=osher`
- Paleta à esquerda, canvas no meio, preview à direita — como no Typebot
- Cartões nas `posicao` já gravadas; setas de `proximo`, das opções e do
  `entao` das condições; pan, zoom e arrastar grupo
- Painel de propriedades montado a partir dos `campos` do tipo, sem código
  específico por tipo
- Acrescentar, apagar e reordenar bloco; criar grupo
- Ligar grupos por seletor `próximo: ▾`, **não** arrastando seta — liga tudo
  que o arrastar ligaria, por uma fração do trabalho
- Preview com o motor de verdade em `modo: teste`
- Salvar = baixar o `fluxo.json`. Salvar de verdade é o sub-projeto 3

Fora da fatia: arrastar seta, desfazer/refazer, abas Theme e Settings, publicar.

**A primeira fatia está pronta.** 268 testes no total, ~80 deles do editor,
todos validados por mutação. Arquivos:

| Arquivo | O que é |
|---|---|
| `editor/modelo.js` | fluxo → cartões e setas, e o tamanho do cartão |
| `editor/vista.js` | pan, zoom ancorado no cursor, geometria das setas |
| `editor/edicoes.js` | todas as edições, puras e imutáveis |
| `editor/catalogo.js` | acesso ao catálogo do motor, tolerante a tipo desconhecido |
| `editor/canvas.js` | cartões, setas, arrastar |
| `editor/painel.js` | formulário montado a partir dos `campos` do tipo |
| `editor/app.js` | paleta, barra, validação ao vivo, preview |
| `editor/index.html` + `editor.css` | a página |

Abre em `editor/index.html?cliente=osher`.

**Decisões que os testes fixaram:**

- Grupo sem `posicao` ganha uma em grade, senão todos nascem na origem e o
  fluxo parece vazio.
- **Seta para grupo inexistente continua sendo desenhada**, marcada como
  órfã. Sumir com ela esconderia o erro que a pessoa precisa ver. O canvas
  chegou a contradizer isso com um `continue` bem comentado — o teste pegou.
- Arrastar cartão divide o deslocamento pela escala; sem isso o cartão foge
  do cursor assim que há zoom.
- Campo em branco **some** do JSON em vez de virar `""`.
- Bloco de entrada nasce com `salvar_em`, senão o fluxo fica inválido entre
  um clique e outro.
- Pontuação de opção vira número: em texto, a soma concatena.
- A última opção de um bloco de botões não pode ser removida.
- O preview roda em `modo: teste` com um `buscar` que recusa — nenhuma tecla
  digitada no editor vira linha na planilha do cliente.

**Ainda não editável:** as `regras` de condição. O painel avisa em vez de
fingir que não existem.

### Segunda fatia — 01/10/2026

O editor deixou de ser um visualizador com painel ao lado e virou um canvas
onde se escreve direto:

- **Teste sob demanda.** `▶ Testar` na barra abre a conversa numa gaveta; um
  `▶` em cada cartão começa o teste daquela etapa, pulando o que vem antes.
  O botão some enquanto a gaveta está aberta.
- **Enquadramento ao abrir** e botão `Ajustar à tela`. O fluxo da Osher vai de
  y=40 a y=1020 numa área de 843px — abrindo sem enquadrar, o último grupo
  ficava invisível e parecia que o editor tinha cortado o trabalho.
- **Edição dentro do cartão.** Clicar num bloco de fala abre a caixa ali
  mesmo; duplo clique renomeia o grupo. O painel sumiu da coluna fixa e só
  aparece pelo `⋯` ou ao selecionar um grupo.
- **Opções dos botões empilhadas no bloco**, cada uma com sua caixa. Enter
  abre a próxima e põe o cursor nela; Backspace numa vazia remove.
- **Ligações arrastáveis.** Bolinha por opção, uma por grupo (a saída, numa
  faixa de rodapé própria) e uma no Start. Soltar no vazio não faz nada —
  apagar ligação por acidente é pior que exigir um clique no painel.
- **Start como cartão**, com bandeira, na `posicao` que já estava no JSON
  desde agosto sem nunca ter sido desenhada. Fluxo do zero já nasce com ele, e
  ligá-lo cria o evento `inicio` que faltava.

**Três defeitos que só o Chrome de verdade pegou**, e o que cada um ensinou
sobre o dublê de DOM:

1. `className` em SVG é somente leitura — atribuir lança e derruba o render.
   O dublê tratava como propriedade comum. Agora recusa igual.
2. `clientX/clientY` são da **janela**, não do palco. O canvas começa depois
   da paleta (272px) e da barra (57px), então o zoom ancorava deslocado e a
   ligação era solta no grupo errado. O dublê não tinha posição; agora
   responde `getBoundingClientRect()` e um teste desloca o palco.
3. Posicionamento com margem negativa que não vencia o preenchimento: a
   bolinha ficava dentro do cartão, e a saída do grupo colidia com a da
   opção. Medido no navegador, não olhado.

**O padrão:** um dublê só protege até onde é honesto. Quando simplifica demais,
para de testar e passa a concordar.

### Terceira fatia: o padrão como botão, e dois defeitos de layout

389 testes. O "padrão" virou a última linha da lista de botões, no formato das
outras mas tracejado e sem caixa de digitar: a bolinha dele continua sendo a
saída do grupo. Clicar nele cria um botão vazio acima e o padrão desce. **Opção
sem texto só existe enquanto o cursor está nela** — sair por qualquer caminho
a desfaz, e o bloco nunca fica sem nenhum botão.

Dois defeitos sérios, nenhum deles visível em teste, os dois achados medindo:

1. **Os cartões se cobriam.** O modelo dizia que todo bloco tem 52px de altura;
   o cartão de idade tinha 333 e era anunciado como 226. Com as posições
   escritas em agosto, cada cartão cobria o seguinte — e o padrão do grupo de
   idade ficava embaixo do cartão de cima, sem receber clique. As medidas agora
   saem do navegador (bloco = 38 + 16 por linha de resumo; botões = 31 + 41 por
   opção, contando o padrão; rodapé só sem botões), o fluxo da Osher foi
   espalhado em duas colunas e **um teste no fluxo do cliente falha se dois
   cartões voltarem a se cruzar**. Grupo novo também nasce em lugar livre.
2. **Abrir o painel encolhia o canvas de 900 para 671px.** Painel e preview
   flutuam, mas os invólucros deles eram itens da grade: bastava um ter filho
   para a grade criar uma segunda linha. O canvas tem `overflow: hidden`, então
   os cartões de baixo continuavam desenhados e paravam de receber clique.
   Fora da grade, com tamanho zero, nada do que nasce ali rouba altura.

**O padrão, de novo:** clique que não chega não deixa rastro. Antes de dizer
que um controle funciona, vale perguntar ao navegador quem recebe o clique
naquele ponto (`elementFromPoint`) — foi o que achou os dois.
