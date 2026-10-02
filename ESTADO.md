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
- **Enquadramento ao abrir** e botão `Centralizar` (era "Ajustar à tela"). O fluxo da Osher vai de
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

### O botão "Novo grupo" deu lugar ao arrasto

403 testes. Grupo vazio não serve para nada, e um botão que cria um cartão num
canto fixo obriga a arrastar depois. Agora o gesto é um só: **arrasta-se um
tipo da paleta até o quadro**. Solto no vazio, nasce um grupo naquele ponto já
com o bloco dentro, numerado `Grupo #1`, `#2`, `#3`… (a numeração pula os
números já usados, então renomear um não faz dois saírem iguais). Solto sobre
um cartão, o bloco entra nele. Clicar continua valendo para quem já tem grupo
selecionado, e a paleta diz o gesto em uma linha — gesto escondido é gesto que
não existe.

O canvas ganhou `alvoDe(ev)`: onde um ponto da janela cai no fluxo, e se havia
cartão ali. A paleta não precisa saber de zoom nem de deslocamento.

Achado no caminho: o fluxo de exemplo (`exemplos/captacao-simples.json`, que é
o que abre sem `?cliente=`) tinha o mesmo problema de sobreposição do da Osher.
O teste de cartões que se cobrem agora varre **todo fluxo versionado**, exemplo
e clientes, em vez de só o da Osher.

### Um controle, um trabalho: `+ botão` e a saída no rodapé

403 testes. O "padrão" em forma de botão dentro da lista fazia dois trabalhos:
era a saída do grupo **e** o "criar botão" (clicar nele acrescentava uma opção).
Foram separados. Agora cada bloco de botões fecha com uma linha `+ botão`, que
só acrescenta; e a saída do grupo volta a ser a bolinha no rodapé do cartão,
uma por cartão, com legenda que muda com o contexto: **"padrão"** quando há
botões (quem escolheu uma opção sem destino próprio segue por ali) e
**"seguinte"** quando não há escolha nenhuma a fazer.

Duas razões, além do controle duplo: um retângulo na lista de botões lê como
botão que o lead vai ver no chat, e não é; e chamar de "padrão" a saída de um
cartão sem botões nomeia uma decisão que não existe.

As medidas do cartão foram refeitas no navegador (linha de opção 40, linha do
`+ botão` conta igual, rodapé em todo cartão) e os dois fluxos versionados
foram espalhados de novo, porque todo cartão ficou 27px mais alto.

### O nome se edita com um clique, e o painel só vem quando chamado

410 testes. Clicar no nome do grupo abre a caixa de renomear **ali mesmo**, com
o cursor dentro e o nome inteiro selecionado — era duplo clique, e depois de
abrir ainda pedia um clique para escrever. Arrastar o cartão pelo nome continua
movendo o cartão: o clique só vale se o ponteiro não andou mais de 3px, senão
quem arrasta acaba renomeando sem querer.

E selecionar um grupo **não abre mais o painel da direita**. Ele oferecia duas
coisas, título e próximo, que o cartão já resolve (nome no lugar, destino na
bolinha). Ficou o `⋯` no cabeçalho para quem precisa escolher o destino numa
lista — ligar num grupo fora da tela arrastando seria às cegas.

**Um defeito que só o navegador pegou:** `focus()` em elemento que ainda não
está no documento não faz nada. O campo era focado logo depois do `append` no
cabeçalho, mas o cartão inteiro só entrava na página depois — a caixa abria sem
cursor, o que foi digitado não ia a lugar nenhum e clicar fora não a fechava,
porque nunca houve `blur`. O dublê de DOM não distingue elemento solto de
elemento na página, então aceitava o foco e o teste passava. Agora o foco é
dado no fim do `desenhar`, e quem prova esse pedaço é o script no Chrome.

### Seta com ponta, ímã, e ligação que entra no meio do grupo

458 testes. Três coisas, pedidas juntas:

1. **Toda seta tem ponta**, girada conforme o lado por onde entra e da cor da
   linha. Sem ponta, num fluxo com volta os dois lados parecem iguais.
2. **Ímã.** A 28px do cartão (medida de tela: a mão não fica mais firme porque
   o zoom afastou), o fio deixa o cursor e gruda na borda exata por onde a seta
   vai entrar, e o cartão acende. Longe de tudo, soltar não liga nada.
3. **Ligação para um bloco.** Em cima do cartão o ímã mira o bloco sob o
   cursor, que acende; no nome do cartão, no rodapé, ou chegando por fora, o
   alvo é o grupo inteiro. Soltar num bloco grava `"g_contato#b_telefone"`.

O terceiro item mexeu no **formato**, não só no editor: `motor/destino.js`
define as duas metades de um destino, `percurso.js` entra no grupo pelo bloco
pedido (bloco apagado entra pelo começo — perder o bloco não pode perder o
lead), o validador acusa bloco que não existe no grupo citado, a seta chega na
faixa daquele bloco e fica vermelha se o bloco sumiu, e a lista de destinos do
painel passou a oferecer "Contato → Qual seu WhatsApp?" para quem não quer
arrastar até um cartão fora da tela.

Provado de ponta a ponta no Chrome: liguei a saída da Abertura no bloco do
telefone, respondi o nome no preview e a conversa pulou direto para "Qual seu
telefone com WhatsApp?", sem passar pelo "Show, prazer em te conhecer".

### O que o Typebot faz, lido no código dele

463 testes. Fui ao repositório (`baptisteArno/typebot.io`,
`apps/builder/src/features/graph/`) em vez de adivinhar. Quatro achados, três
copiados:

1. **O ímã é por hover, não por distância.** `BlockNode.tsx` acende o alvo no
   `onMouseEnter` do bloco e, no `onMouseLeave`, limpa só o `blockId` — ficar
   no grupo mantém o grupo como destino. Aqui a folga caiu de 28px para 10px:
   o suficiente para não exigir pontaria de um pixel, pouco para não parecer
   que o fio decidiu antes da pessoa.
2. **O fio arrastado usa a mesma matemática da aresta pronta**
   (`computeEdgePathToMouth` chama os mesmos segmentos). Aqui ele era uma reta
   e virava curva ao soltar: agora é a mesma curva, e um teste exige que o
   caminho do fio seja idêntico ao da seta que fica.
3. **A aresta sai da altura do conector** (`sourceTop` em
   `computeSourceCoordinates`), e o lado (esquerda/direita) troca conforme o
   cursor passa do meio do cartão. Aqui todas as setas saíam do meio da borda:
   agora cada uma sai da sua linha — a opção, ou o rodapé do grupo. Efeito
   colateral desejado: duas saídas para o mesmo grupo deixaram de ser
   desenhadas como uma seta só, porque são dois caminhos de alturas diferentes.
4. **Não copiado:** no Typebot as arestas são ortogonais com cantos
   arredondados (`segments.ts` + `svg-round-corners`), não curvas de Bézier.
   É escolha de linguagem visual, não de comportamento, e mudá-la mexeria em
   todo o desenho — fica para quando for decisão de design, não de física.

### Clicar na linha: esquerdo seleciona, direito exclui

477 testes. Cada seta ganhou uma faixa invisível de 16px por cima dela — 2px de
traço não se acerta com o mouse, e era por isso que a camada de setas ignorava
clique. Clique esquerdo seleciona (a linha engrossa e fica laranja); clique
direito abre um menu no ponto clicado com **Excluir**. Clicar no fundo larga a
seleção e fecha o menu; o zoom também fecha.

Excluir apaga o destino de quem criou a ligação, e qual campo é depende de onde
a seta nasceu — a própria seta diz: `proximo` do grupo, `proximo` da opção,
`proximo` do evento, `destino` do `ir_para`. O campo sai do JSON em vez de ficar
como texto vazio.

**Linha de condição não ganha Excluir**, e o menu explica por quê: as `regras`
ainda não se editam no editor, então apagar seria tirar um caminho que não há
como recriar. É a única exceção, e está escrita na tela.

De passagem: apagar a ligação do Start fazia o aviso dizer `aponta para o grupo
"", que não existe` — mandava procurar um grupo que nunca existiu. Agora diz
"O início não aponta para nenhum grupo: ligue o Start ao primeiro grupo".

### Excluir grupo, e a numeração que não via os grupos existentes

491 testes.

**O gesto do grupo é o mesmo da linha:** esquerdo seleciona, direito abre o
menu no ponto clicado — agora com "Excluir grupo (3 blocos)". O número de
blocos está no botão de propósito: sem desfazer no editor, a pessoa merece ver
o tamanho do estrago antes de clicar.

Apagar um grupo apaga também **quem apontava para ele** — saída de grupo,
`proximo` de opção, `destino` de `ir_para`, `entao` de regra e `proximo` de
evento, nas duas formas do destino (`g2` e `g2#bloco`). Destino para grupo que
não existe não é caminho, é erro espalhado pelo fluxo. E a seleção é largada
junto: presa num grupo fantasma, clicar num tipo da paleta não acrescentava
nada e também não avisava.

**O defeito da numeração:** `proximoNomeDeGrupo` contava só os cartões que já
se chamavam "Grupo #N". Num fluxo com seis grupos de nome próprio, o sétimo
nascia como "Grupo #1" — parecia que o editor não tinha visto os outros. Agora
o número é a posição no fluxo (seis grupos → #7), pulando números já usados.

### As linhas passaram a correr pelo corredor

503 testes. A reclamação era concreta: a linha de "Idade" para "Objetivo"
cortava em diagonal por dentro dos outros cartões. Duas causas, e a segunda era
a grande:

1. **Bézier cortava reto.** As setas agora são **ortogonais com cantos
   arredondados**, como no Typebot: saem perpendicular à borda, viram no meio
   do vão entre as duas caixas e entram perpendicular na outra. Era o único
   ponto do Typebot que eu tinha deixado de fora de propósito — o problema que
   ele resolve só aparece quando os cartões estão em coluna.
2. **O lado de saída estava errado.** Quando a distância vertical era maior que
   a horizontal, a seta saía pelo **topo** do cartão — e mandava a linha para
   dentro do cartão de cima. Agora a saída é sempre lateral, porque é lá que
   estão as bolinhas: direita se o destino está à direita, esquerda se está à
   esquerda. A entrada é a lateral que olha para a origem, com uma exceção:
   destino na mesma coluna e abaixo entra por cima, e aí a linha desce pelo
   corredor ao lado antes de atravessar.

O guarda disso é um teste que percorre as setas dos fluxos versionados de 6 em 6
unidades e falha se qualquer amostra cair dentro de um cartão que não seja a
ponta daquela seta. Foi ele que achou a segunda causa — eu tinha trocado a
curva pela ortogonal e o desenho continuava invadindo.

### O nome ocupa o que as letras pedem, e o resto do cabeçalho é alça

512 testes. O nome esticava até o fim do cabeçalho, então qualquer ponto para
pegar o cartão era também um ponto para renomeá-lo sem querer. Agora ele ocupa
só a largura do texto (medido no Chrome: 45px de letras em 51px de caixa) e o
que sobra é uma alça de arrasto — de 41px no nome mais comprido do fluxo da
Osher a 103px no mais curto. Nome muito longo é cortado com reticência, e a
alça tem largura mínima garantida: num nome de 51 caracteres sobraram 29px.

**Dois defeitos achados ao medir isso, e o segundo é o grave:**

1. Clicar no fundo ou no cabeçalho **não fechava a caixa de renomear**. O
   arrasto chama `preventDefault` no mousedown, que segura o foco onde está —
   e sem perder o foco não há `blur`. Agora começar um arrasto fecha a caixa.
2. **O canvas repintava texto velho.** Ele guarda o fluxo do último desenho, e
   digitar de propósito não redesenha os cartões (recriar a caixa jogaria o
   cursor para o fim). Qualquer redesenho interno depois — clicar numa linha,
   começar um arrasto, abrir um menu — pintava o fluxo guardado e desfazia na
   tela o que tinha sido digitado. O dado nunca se perdia, a tela mentia.
   Agora `canvas.sincronizar(fluxo)` mantém o fluxo e as caixas em dia sem
   tocar no DOM. Era defeito antigo: só apareceu porque o arrasto passou a
   redesenhar.

### O ⋯ do grupo virou uma caixa de ações, com duplicar

524 testes. O `⋯` do cabeçalho abria o painel da direita com o nome do grupo —
formulário que já não tinha razão de existir, porque o nome se edita no cartão
e o destino se arrasta pela bolinha. Agora ele abre uma **caixa flutuante acima
do próprio botão**, que cresce para a esquerda, para dentro do cartão: a borda
direita encosta no `⋯`, então ela não vaza para fora do canvas nem no cartão
mais à direita (medido: caixa 1108→1181 num cartão que vai até 1197).

Dentro dela, dois ícones desenhados em SVG — **duplicar** e **lixeira** — com
dica própria ao passar o mouse ("Duplicar", "Excluir"). A dica é nossa e não a
do navegador: a nativa demora um segundo e não dá para alinhar.

**Duplicar** copia o grupo com id novo, nome `(cópia)` e lugar livre (nunca em
cima de outro cartão). Os destinos de fora são preservados; o que apontava para
o próprio grupo passa a apontar para a cópia, senão o laço do original mandaria
o lead de volta para o original. A cópia nasce selecionada.

**O que se perdeu com o painel do grupo:** escolher o destino numa lista, útil
para ligar num cartão fora da tela. Se fizer falta, cabe como um terceiro ícone
nessa mesma caixa.

### A linha nasce na bolinha, e um botão que ninguém via

529 testes. A seta saía da **borda do cartão**, e a bolinha fica para fora
dela: sobrava um vão, e a linha parecia sair do grupo. Agora a caixa de saída
se estica até o centro da bolinha (`CARTAO_CONECTOR`), e a saída é sempre pela
direita, que é onde a bolinha está — indo para trás, a linha sai, contorna pela
altura do meio e volta a entrar pela direita do destino.

As bolinhas não estavam todas à mesma distância da borda: cada uma mora num
container com recuo próprio (a linha da opção fica dentro do bloco, que tem
0.85rem de preenchimento; o rodapé encosta na borda). O `right` de cada uma
agora desconta o recuo do próprio container a partir de uma medida só, e a
conta inclui os 2px de borda da bolinha — foi esse 2px que deixou tudo 2
unidades fora na primeira tentativa. Medido no Chrome: as seis setas nascem a
1–2px do centro da bolinha mais próxima, e todas as bolinhas do cartão têm o
mesmo recuo.

**E um achado que só a captura de tela deu:** o botão "Baixar fluxo.json"
estava **invisível** — `.ed__baixar` pintava a letra de branco e o fundo de
azul, mas `.ed__barra button` tem especificidade maior e devolvia o fundo para
branco. Texto branco em fundo branco, o botão existindo e ninguém vendo, e
nenhuma medição geométrica pegaria isso. Virou `testes/editor-estilo.test.js`,
que lê o CSS e reprova letra branca sem fundo na mesma regra, e variante de
botão da barra que perca para a regra geral.

**O padrão novo:** medir pega geometria; olhar pega cor. Uma captura por
mudança visual.

### O editor salva no arquivo

536 testes. O botão "Baixar fluxo.json" virou **"Salvar"**. O `servir.py`
passou a aceitar `PUT` e grava o que o editor manda em
`clientes/<nome>/fluxo.json` — formatado como está no git, para o diff mostrar
o que mudou no fluxo e não a linha inteira reescrita.

O `PUT` só aceita `clientes/<nome>/fluxo.json` e `exemplos/<nome>.json`, com o
nome sem barra nem ponto-ponto, e só se o corpo for JSON válido. Conferido na
mão: caminho fora da lista → 403, corpo que não é JSON → 400, subir de pasta →
403, cliente que não existe → 404, gravação de verdade → 200 e o arquivo muda.

O botão conta três estados — **Salvar** (destacado, há o que gravar),
**Salvando…**, **Salvo** (apagado e sem clique). Dois cliques seguidos mandam
um envio só. Se a gravação falhar — servidor fora, editor aberto do GitHub
Pages — ele **baixa o arquivo** e diz o motivo: perder uma tarde de trabalho
porque o servidor caiu seria o pior resultado possível. E fechar a aba com
coisa não salva pede confirmação do navegador.

Saber se há o que salvar é comparar o JSON de agora com o retrato do último
gravado, em vez de marcar "sujo" em cada edição — são dezesseis lugares que
mexem no fluxo, e esquecer de marcar num deles perde trabalho em silêncio.

**O que isto não é:** salvar de qualquer lugar. Grava no arquivo desta
máquina; publicar segue sendo commit e push, e o cliente editando sozinho da
casa dele continua sendo o sub-projeto 3.

### As bolinhas voltaram para a borda do cartão

537 testes. Ao unificar a distância das bolinhas eu as empurrei para 29px da
borda — flutuando ao lado do cartão. Agora ficam **em cima da borda**: metade
dentro do cartão, metade no quadro, que é de onde a linha sai. Todas à mesma
distância, que é o que faz a linha nascer dentro delas.

A distância vive em dois lugares: `--ed-conector-fora` no CSS põe a bolinha,
`CARTAO_CONECTOR` no modelo faz a linha nascer nela. Mudar um e esquecer o
outro reabre o vão — então um teste lê o CSS e compara os dois números.

### O header novo, com desfazer de verdade

561 testes. O header passou a ter três zonas, no espírito do Typebot:

- **Esquerda:** `‹` para a lista de projetos (a página ainda não existe — o
  botão avisa, em vez de não fazer nada em silêncio), o **nome do projeto**
  editável no lugar, e **desfazer/refazer**.
- **Meio:** as abas **Fluxo · Tema · Resultados** (as três existem hoje; na
  época desta nota, Tema e Resultados ainda diziam na tela que não existiam).
- **Direita:** **▶ Testar**, **Centralizar**, **Salvar** e a **engrenagem**,
  que abre as configurações — por ora o compasso da digitação, que é do fluxo.

O nome vive no próprio fluxo (`nome`), com `My Chatflow` como padrão: é o
arquivo que viaja, e um nome guardado em outro lugar se perderia na primeira
cópia.

**Desfazer e refazer** guardam o fluxo inteiro a cada mudança — alguns kB, e
muito mais confiável que uma lista de operações inversas, que erra justamente
nas que mexem em várias coisas (apagar um grupo mexe em todos os que apontavam
para ele). Todas as dezesseis edições passam por um funil, `trocarFluxo`, com
uma **assinatura**: edições seguidas no mesmo campo viram um passo só, porque
desfazer letra por letra o que se digitou seria um castigo. Arrastar um tipo
para o quadro são duas edições — criar o grupo e pôr o bloco — e uma assinatura
só, senão o primeiro desfazer deixaria um grupo vazio. Ctrl+Z e Ctrl+Shift+Z
funcionam, menos dentro de uma caixa de texto, onde o desfazer do próprio campo
é o que a mão espera.

**O dublê aprendeu duas coisas, as duas por defeito real:** eventos sobem até o
documento, e existe fase de **captura**. Foi assim que o "clicar fora fecha a
caixa do nome" passou a ser testável — na borbulha ele nunca chegaria, porque
o canvas para a propagação de tudo o que acontece dentro dele.

### O teste volta a digitar, e o Start se seleciona

567 testes. O preview zerava o compasso (`ritmo: {piso:0, porCaractere:0,
teto:0}`) — então a conversa inteira aparecia pronta de uma vez, e testar não
mostrava o que o lead vê. Agora ele usa o compasso do próprio fluxo, como o
chat de verdade; quem precisa de pressa é a suíte, que injeta a espera.
Conferido no Chrome: ao abrir, só os três pontinhos; 1,5s depois, a primeira
fala e os pontinhos de novo; 2,8s depois, as duas falas.

E o **Start** passou a se selecionar como um cartão — clicar nele e nada
acontecer parecia defeito — e ganhou o seu **▶**, que testa do começo.
Selecionar o Start larga o cartão selecionado e vice-versa: são dois lugares
diferentes do fluxo.

### Três bolhas, com ícone: Texto, Imagem e Vídeo

583 testes. A categoria **Bolhas** (era "Fala") agora tem três tipos, e toda a
paleta ganhou ícone antes do rótulo — ler a paleta virou reconhecer a forma em
vez de soletrar o nome.

- **Texto**: o que já existia.
- **Imagem**: ganhou **abrir link ao clicar**. A imagem vira um link que abre
  em outra aba (`noopener`), para a conversa não ser abandonada no meio.
- **Vídeo** (novo): toca por link. `motor/video.js` traduz o endereço —
  YouTube (watch, youtu.be, embed, shorts), Vimeo, ou arquivo `.mp4` direto —
  e o autoplay entra no endereço **sempre mudo**, porque navegador nenhum
  deixa começar com som e sem o mudo o autoplay simplesmente não acontece.
  Endereço que ninguém sabe tocar não vira caixa preta: o bloco é pulado e a
  conversa segue.

**Não entrou, e por quê:** subir imagem, Giphy, Unsplash e ícones. Upload
precisa de lugar para guardar o arquivo (hoje só existe o `PUT` do fluxo, e no
editor publicado não há servidor); Giphy e Unsplash precisam de chave de API.
São duas conversas separadas, não uma linha de código.

O dublê aprendeu que, no DOM, `img.src = x` e `setAttribute("src", x)` são a
mesma coisa — sem isso, o código podia pôr o endereço pela propriedade e o
teste jurar, olhando o atributo, que ele não estava lá. `value` ficou de fora
de propósito: nele propriedade e atributo são coisas diferentes de verdade.

### O cursor diz o que dá para fazer

586 testes. O quadro mostrava a mão aberta em toda a sua extensão, como se
tudo ali fosse arrastável. Agora o quadro usa a seta de sempre e a **mão é do
cartão** — e, para a mão não mentir, **o cartão inteiro virou alça**: arrastar
de qualquer parte dele move o grupo, não só pelo cabeçalho. Quem precisa do
clique parado para do mousedown antes: as caixas de texto (cursor de escrita),
os botões (mãozinha) e as bolinhas (mira).

Arrastando o fundo, a mão fechada aparece enquanto dura o arrasto: isso é
retorno do que está acontecendo, não promessa do que dá para fazer.

E o que se clica mostra o dedo apontando: a linha do bloco, a caixa de cada
botão, o `+ botão`, o play. A caixa do botão volta a ser barra de texto quando
recebe o cursor — aí o que a pessoa faz é digitar, e a barra diz onde a letra
cai.

Medido no Chrome: quadro `default`, cartão `grab`, bloco e caixa de botão
`pointer`, nome `text`, bolinha `crosshair` — e arrastar pelo corpo do cartão
move o grupo exatamente o que o mouse andou.

### Os blocos ficaram livres

608 testes. Clicar e segurar um bloco agora leva **o bloco**, não o cartão:
solto sobre outro grupo ele entra lá, na altura em que foi largado (acima do
bloco que estiver sob o cursor, ou no fim); solto no quadro, vira um grupo
novo naquele ponto. Enquanto se arrasta, o bloco de origem apaga, um fantasma
com o nome do tipo acompanha o cursor, o cartão de destino acende e a linha
onde ele vai entrar ganha um traço em cima.

O cartão continua se arrastando — pelo cabeçalho, pelo rodapé e pelas bordas,
que é o que sobra depois dos blocos. E andar menos de 3px continua sendo
clique, não arrasto: é o mesmo critério do nome do grupo.

Dois cuidados que os testes fixaram: **grupo que fica sem nenhum bloco
continua existindo**, porque ele ainda é um ponto do fluxo com as ligações
dele, e apagá-lo levaria junto caminhos que ninguém pediu para apagar; e
**soltar fora do quadro não faz nada**, nem leva nem cria.

Conferido no Chrome com mouse real: o bloco saiu de "Contato" (3 → 2) e entrou
em "Fim" (3 → 4), com o fantasma "Texto" no meio do caminho e o cartão de
destino aceso; e soltar um bloco no vazio criou o "Grupo #7" com ele dentro,
que um desfazer desfez.

### O que se arrasta da paleta é a própria caixa

611 testes. Arrastar um tipo mostrava um adesivo escuro com o nome. Agora o
que acompanha o cursor é a **própria caixa da paleta** — mesmo tamanho, mesmo
ícone, mesma borda colorida, inclinada e com sombra para ficar claro que está
no ar. E ela fica **presa onde a mão pegou**: quem agarrou pela beirada
continua segurando pela beirada, em vez de a caixa saltar para o centro do
cursor.

Medido no Chrome: caixa da paleta 116×36, fantasma 117×40 (a diferença é a
inclinação), e o cursor a 21,12 da borda dele depois de ter pego a 20,10 da
borda dela.

### E a mesma coisa para os blocos dentro do grupo

614 testes. O bloco arrastado era um adesivo com o nome do tipo. Agora é uma
**cópia do próprio bloco**, com o texto que está nele, do tamanho em que está
na tela (inclusive a escala do zoom), inclinada e com sombra — e presa onde a
mão pegou, como a caixa da paleta.

Medido no Chrome: bloco 158×43 na tela, fantasma 160×45 (a diferença é a
inclinação), com o conteúdo "Texto⋯Show, prazer em te conhecer," dentro, e o
cursor a 26,18 da borda dele depois de ter pego a 25,12 da borda do bloco.

O dublê de DOM ganhou `cloneNode(true)`: cópia funda com marcação, atributos,
estilo e texto, e **sem** os ouvintes — que o DOM de verdade também não copia.
Sem isso, a cópia arrastada começaria um segundo arrasto ao ser tocada.

### O cartão ficou do jeito da referência

614 testes. Três mudanças no desenho do grupo, pedidas olhando o Typebot:

1. **Cada bloco mostra o ícone do seu tipo**, o mesmo da paleta — e o nome do
   tipo saiu da linha: a forma conta o que a palavra contava, e o texto do
   bloco subiu para a primeira linha. O nome continua no `title`.
2. **Sem as faixas coloridas** por categoria: a cor repetida em todo bloco
   virava listra. Ficaram caixas cinzas arredondadas, com respiro entre elas.
   O bloco de tipo desconhecido continua marcado — ali a cor é aviso.
3. **"seguinte" saiu; "padrão" ficou só onde significa algo.** Num cartão de
   botões, é por ali que segue quem escolheu uma opção sem destino próprio —
   e quem não quer mandar botão nenhum para outro lugar usa só ele. Sem
   botões não há padrão a nomear: fica a bolinha, e o rodapé encolhe.

As medidas do modelo foram refeitas no navegador, de novo: bloco 28 + 16 por
linha de texto (com a margem dentro), 27 letras por linha (o ícone e a margem
tiraram largura do texto), bloco de botões 43 + 40 por opção, rodapé 27 com a
palavra e 17 sem ela.

### O quadro falando uma cor só

614 testes. O azul do Salvar virou a **cor de ação do editor**. As bolinhas,
as setas de opção, o fio que se arrasta, a linha selecionada e todos os
realces de alvo deixaram de ser laranja. Conferido varrendo o DOM: **nenhum
elemento dentro do quadro usa mais o laranja**.

O laranja ficou onde ele distingue uma coisa de outra: a categoria "Entrada"
na paleta e a faixa de recado.

No header, passar o mouse e estar escolhido falam a mesma língua do Salvar —
fundo azul, letra branca — nas abas e nos botões Testar e Centralizar. Antes a
aba escolhida era um cinza que mal se via.

### A aba Resultados

636 testes. Uma linha por pessoa que entrou no chat, com o que ela respondeu
até onde chegou — inclusive quem parou no meio, que é o lead que some de vista
em todo lugar menos ali.

**As colunas saem do fluxo, não dos dados:** cada bloco com `salvar_em` vira
uma coluna, na ordem em que o chat pergunta, com o nome da pergunta e não o da
variável. Pergunta nova aparece como coluna antes de alguém responder. O que
vier na planilha e não estiver no fluxo entra no fim, marcado — esconder dado
que existe é pior que uma coluna a mais. O maquinário (`sessaoId`,
`ultimoGrupo`, `ultimoBloco`) fica de fora.

**De onde vem:** da aba `Chatflow Parciais`, por um `GET` novo no Apps Script.
A leitura exige chave, e **a chave não está no repositório**: mora nas
propriedades do script (`CHAVE_LEITURA`), e no editor fica guardada no
navegador de quem abriu — em memória durante a sessão, e no armazenamento
local para não pedir de novo amanhã. Sem a propriedade definida, a leitura
fica fechada: é melhor a aba dizer "não configurado" do que publicar telefone
de cliente para quem achar o endereço, num repositório público.

**Para ligar, uma vez:** colar `clientes/osher/apps-script.gs` no editor do
Apps Script, definir a propriedade `CHAVE_LEITURA` (engrenagem → Propriedades
do script), publicar, e colar a mesma frase na aba Resultados.

Enquanto isso não acontece, a aba diz exatamente isso em vez de mentir: o
Apps Script antigo responde sem `linhas`, e devolver lista vazia ali diria
"ninguém entrou no chat" para uma planilha possivelmente cheia.

### A tabela de resultados existe antes do primeiro lead

638 testes. Com a planilha vazia, a aba mostrava uma frase e nenhuma tabela.
Agora a tabela aparece de qualquer jeito, com as colunas do fluxo e uma linha
dizendo que ninguém entrou ainda — quando o primeiro lead cair, ele entra
embaixo do cabeçalho e nada muda de lugar.

Erro de leitura continua sem tabela: ali não há dado nenhum para mostrar, e
cabeçalho sozinho ao lado de "chave inválida" pareceria planilha vazia.

### A aba Tema

693 testes. As cores da conversa, editadas ao lado da conversa: à esquerda as
seções, no meio o chat deste projeto rodando de verdade, com o tema do cliente.

**A cascata do CSS virou dado.** `--cf-botao: var(--cf-acento)` quer dizer que
o botão sem cor própria é da cor do acento; sem isso declarado em algum lugar,
a aba mostraria campo vazio no botão de um chat cujo botão é claramente azul.
Agora `editor/tema.js` guarda tanto os padrões (`COR_PADRAO`) quanto quem segue
quem (`SEGUE`), e **três testes leem `motor/tema.css`** para garantir que os
dois não se separem: padrão diferente, herança trocada, ou cor nova no motor
sem controle na aba — qualquer um dos três quebra a suíte.

**Botões e campo de entrada ganharam cor própria.** Antes não dava para mudar a
cor do botão sem mudar o acento da conversa inteira. Entraram `--cf-botao`,
`--cf-sobre-botao`, `--cf-botao-opcao`, `--cf-sobre-botao-opcao`, `--cf-campo`,
`--cf-sobre-campo`, `--cf-placeholder` e `--cf-sobre-erro`, todos herdando o que
já valia: quem não mexer não vê diferença. E a largura da conversa
(`--cf-coluna`, 48rem) passou a vir do tema, em `largura`.

**Mexer numa cor não reinicia a conversa.** `aplicarTema(raiz, tema)` saiu de
dentro do `criarChat` e escreve as variáveis no elemento do chat já montado —
remontar a cada tom do seletor jogaria a pessoa de volta para a primeira
pergunta. Ele lembra o que escreveu em cada elemento para poder **apagar**: cor
devolvida à herança tem de voltar a herdar, e propriedade escrita no elemento
ganha de qualquer folha. Retrato e marca, que o chat lê ao nascer, remontam —
mas só no `change`, não a cada tecla.

**Desfazer vale para o tema também.** A pilha passou a guardar `{fluxo, tema}`:
são duas abas do mesmo projeto, e desfazer que só valesse numa delas seria uma
armadilha. Arrastar o seletor de cor é um passo só, pela mesma assinatura que
junta as teclas de um campo.

**O interruptor do retrato não tem beco sem saída.** Desligar esvazia `avatar`
(chave vazia não entra no arquivo do cliente), e o caminho fica guardado para
religar sem digitar de novo. Ligado sem imagem nenhuma, o campo aparece e
recebe o cursor — antes o interruptor voltava sozinho para "desligado", porque
não havia caminho para pôr, e parecia quebrado.

**Salvar grava os dois arquivos, cada um só se mudou.** O `servir.py` passou a
aceitar `PUT` em `clientes/<nome>/tema.json`. Sem gravador de tema (o editor
aberto sem `?cliente=`), o Salvar baixa o `tema.json` em vez de perder a cor.

Conferido no Chrome: trocar a fala de azul para vinho muda a bolha e o botão de
enviar na hora, sem a conversa recomeçar; o seletor do botão, que segue o
acento, acompanha — senão o painel diria azul enquanto a conversa já está
vinho. O Testar também passou a abrir com o tema do cliente: testar com as
cores do motor mostraria um chat que não existe em lugar nenhum.

### A fonte sai de uma lista

710 testes. Os dois campos de texto — família e endereço da folha — viraram uma
lista com quinze fontes do Google, cada nome **escrito na própria letra**: é
pela cara que se escolhe fonte, não pelo nome. Escolher escreve as duas coisas
juntas; antes dava para escrever "Poppins" e esquecer a folha, e o chat
mostrava a fonte do sistema sem dizer por quê.

A fonte é reconhecida pelo **primeiro nome da pilha**, não pelo texto todo: a
pilha de reserva de quem escreveu o tema à mão quase nunca é igual à nossa, e
comparar tudo diria "personalizada" para uma fonte que está na lista. Fonte
mesmo fora da lista continua valendo — aparece como "Personalizada: …",
escolhida, e só sai se a pessoa trocar.

"Padrão do sistema" é a primeira da lista e **não baixa nada**: a conversa abre
sem esperar a rede. Trocar para ela tira a `fonte_url` do arquivo, senão o
navegador baixaria uma fonte que ninguém mais usa.

Conferido no Chrome: a folha das quinze famílias entra uma vez quando a aba
abre, a seta é a mesma do resto do editor (a do navegador muda de cara em cada
sistema), e escolher Poppins troca a letra da conversa sem reiniciá-la.

### A última leitura fica no navegador

718 testes. Abrir a aba Resultados para conferir um telefone custava uma viagem
à planilha de alguns segundos, toda vez. Agora a última leitura fica guardada
neste navegador (`chatflow:leads:<cliente>`) e a tabela aparece **no instante
em que a aba abre** — conferido no Chrome: 15 ms. A planilha é consultada por
baixo, uma vez por sessão, e corrige a tabela quando responde.

**A hora da leitura entrou no rodapé** ("2 pessoas · lido em 02/10 14:05"), e é
ela que mantém a coisa honesta: sem a hora, dado de antes passa por dado de
agora. Enquanto a busca corre, o rodapé diz "buscando na planilha…".

**Erro deixou de apagar a tabela.** A regra anterior era não mostrar dado velho
ao lado de um aviso; com a cópia guardada, essa regra deixaria quem perdeu a
rede sem nada. A tabela fica, datada, com o erro em cima.

**A cópia some junto com a chave:** "Trocar chave" apaga as duas. A chave sair
e o telefone de todo mundo continuar guardado seria o pior dos dois mundos.
Cópia estragada ou armazenamento bloqueado (janela anônima) não impedem nada —
a aba funciona, só sem atalho. Planilha grande demais para caber guarda as 200
mais recentes.

**Dois defeitos achados no caminho**, os dois por medição: a busca era disparada
no meio do desenho e se redesenhava por dentro, saindo **duas tabelas**; e
esconder a paleta na aba Resultados não bastava, porque a grade continuava com
duas colunas e **o centro ia parar dentro das 17rem da paleta** — a tabela
larga ficava espremida em 272px.

### O editor fala inglês

736 testes. A engrenagem ganhou **Idioma do editor**, com português e inglês.
Troca a tela inteira na hora: barra, abas, paleta, nomes dos tipos de bloco,
cartões do quadro, painel, aba Tema, aba Resultados e as próprias
configurações. A escolha é **da pessoa, não do projeto** — fica neste
navegador (`chatflow:idioma`), vale para qualquer cliente que ela abrir, e não
conta como mudança a salvar.

**O que não muda é a conversa do lead.** O que ele lê está escrito no fluxo,
pelo cliente; traduzir isso sozinho seria inventar texto no lugar de quem
vende. Os nomes dos grupos ("Abertura", "Contato") são conteúdo e continuam
como estão, em qualquer idioma do editor.

**A chave do dicionário é a própria frase em português** (`editor/idioma.js`).
O código continua legível para quem o escreve, e frase sem tradução cai no
original em vez de mostrar uma chave técnica na cara do cliente. Frase com
buraco é uma frase só — `"Excluir grupo ({n} blocos)"` —, nunca três pedaços
costurados: em outra língua a ordem das partes muda.

**Dois testes seguram o resto:** um varre o código atrás de todo `t("…")` e
exige a versão em inglês; o outro varre as posições onde texto aparece na tela
(`el(…, "frase")`, `title`, `aria-label`, `placeholder`, `textContent =`) e
acusa qualquer frase que tenha escapado do tradutor. Tela meio inglesa, meio
portuguesa quebra a suíte no mesmo dia em que nasce.

O editor **começa em português**, sem olhar o idioma do navegador: quem tem o
sistema em inglês mas trabalha em português abriria numa língua que não pediu.
