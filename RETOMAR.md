# Onde paramos — 27/08/2026

Sub-projeto 1 do chatflow: o motor e o formato do fluxo.
Branch de trabalho: **`motor-v1`**. `main` está intocado.

## Estado

**12 de 12 tarefas concluídas. 112 testes passando.**

| | Tarefa | Estado |
|---|---|---|
| 1 | Registro de tipos de bloco | ✅ |
| 2 | Interpolação `{{variavel}}` | ✅ |
| 3 | Pontuação e faixas | ✅ |
| 4 | Percurso sequencial | ✅ |
| 5 | Ramificação | ✅ |
| 6 | Validação de fluxo | ✅ |
| 7 | Os treze tipos de bloco | ✅ |
| 8 | Entrada inválida e tentativas | ✅ |
| 9 | Envio, fila e reenvio | ✅ |
| 10 | `criarChat` e player | ✅ |
| 11 | Retomada de sessão | ✅ |
| 12 | Fluxo da Osher, ponta a ponta | ✅ código / ⛔ falta a planilha |

Falta a **review final da branch inteira**, que olha o conjunto em vez de
tarefa por tarefa, e o merge em `main`.

## O que trava a entrega: a URL do Apps Script

É o único item bloqueado. `clientes/osher/destinos.json` está com
`"url": ""`, então **o lead não é enviado para lugar nenhum**. Todo o resto
do caminho já foi verificado: o fluxo quente monta o lead completo (nome,
whatsapp, bem, valor, prazo, decisor, pontuacao 12, classificacao "quente")
e o entrega ao destino `planilha`.

Como publicar: planilha → Extensões → Apps Script → colar
`Osher/Typebot/apps-script.gs` → Implantar → Nova implantação → App da Web →
executar como você, acesso "qualquer pessoa" → copiar a URL terminada em
`/exec` e colar em `clientes/osher/destinos.json`.

Depois disso: completar o chat em
`http://localhost:8080/motor/player.html?cliente=osher` e conferir a linha
nova na planilha, com os próprios olhos.

## Como ver funcionando agora

```
cd "/Users/gustavolacerda/Desktop/Claude Master/chatflow"
python3 -m http.server 8080
```

- Fluxo genérico: `http://localhost:8080/motor/player.html`
- Fluxo da Osher: `http://localhost:8080/motor/player.html?cliente=osher`
- Sem enviar nada, com avisos em tela: acrescente `?teste=1`
  (com `&teste=1` se já houver `?cliente=`)

Rodar os testes: `npm test`
Editar as frases: `clientes/osher/fluxo.json` ou `exemplos/captacao-simples.json`

## O que mudou nesta sessão

Três defeitos reais, todos encontrados dirigindo o motor de verdade, nenhum
deles pego pela suíte:

1. **O lead mais quente nunca era enviado.** `g_fim_quente` termina num
   bloco `redirecionar`, e o motor parava ali sem fechar o fluxo: 16 pings
   de evento e zero leads. Corrigido — se não há nada depois do
   redirecionamento, o lead sai e o botão do WhatsApp continua na tela.
2. **A retomada devolvia a conversa vazia.** Recarregar a página trazia de
   volta o ponto certo do fluxo, mas com a tela em branco: dois botões
   soltos sem a pergunta. Agora a conversa já dita é gravada junto e
   redesenhada.
3. **A pré-visualização mentia sobre os destinos.** Dizia "destino não
   existe em destinos.json" para destinos que existiam. O cadeado do modo
   teste mudou de lugar: bloqueia o transporte, não a configuração.

## Pendências que dependem do Gustavo

1. **URL do Apps Script publicado** — bloqueia a entrega, ver acima.
2. ~~As quatro faixas de valor~~ **Decidido em 27/08/2026:** ficam como
   estão, medindo o valor do bem (até 100 mil, 100–300, 300–600, acima de
   600). O Typebot antigo perguntava parcela mensal; o Gustavo optou por
   manter o eixo de valor do bem. As faixas de classificação (quente 9,
   morno 5) vieram do Typebot, não foram inventadas.
3. **Para qual WhatsApp vai o lead quente.** Está no fluxo o
   (61) 98228-6044, o único que existe, mas a equipe tem seis vendedores.
4. **O bubble de texto aceita negrito, itálico e link?** Decide se o campo
   do editor é caixa simples ou editor com formatação. Não bloqueia o
   sub-projeto 1.
5. **`motor/motor.js` continua sem teste automatizado**, por ser camada de
   DOM — decisão da Task 10. O defeito nº 1 acima mostra o preço: passou por
   três reviews. Um shim de DOM escrito à mão (~60 linhas, sem dependência
   nova) cobriria caminho quente, retomada e guarda de laço. Decisão sua,
   porque muda a arquitetura de teste que o plano fixou de propósito.

## O Typebot antigo está encerrado

`Osher/Typebot/` foi inventariado em 27/08/2026 contra o chatflow. Nada mais
precisa sair de lá:

- As faixas `quente 9 / morno 5` já tinham vindo dele.
- O copy dele **viola o `preferencias.md`** em quase toda linha (emoji,
  exclamação, e a palavra banida "investimento" na pergunta de faixa) e uma
  das perguntas dava a mesma pontuação para todas as opções. Nada disso deve
  voltar — o teste da Task 12 hoje barra os três casos.
- O `apps-script.gs` dele foi substituído por `clientes/osher/apps-script.gs`,
  que aponta a planilha por ID e trava a rajada de eventos.
- `clientes/osher/preferencias.md` é cópia de `Osher Teste/_memoria/` (o
  original continua lá). Existe porque o teste do fluxo verifica as palavras
  banidas e não pode depender de arquivo de outro repositório.

**Decidido em 27/08/2026:** o fundo do chat fica `#0C2340`, mesmo o
`design-guide.md` dizendo que o fundo padrão da marca é `#1F3140`. Foi
escolha consciente, não descuido — se algum dia o chat precisar bater com as
outras peças, é uma linha em `clientes/osher/tema.json`.

**Ideia que ficou para o v2:** o Typebot tinha barra de progresso
("pergunta 3 de 8"). O chatflow não tem. Num fluxo de 6 perguntas isso
reduz abandono; vira um tipo de bloco novo.

## Onde está o resto

- Spec: `docs/superpowers/specs/2026-08-27-chatflow-motor-design.md`
- Plano das 12 tarefas: `docs/superpowers/plans/2026-08-27-motor-chatflow.md`
- Registro de execução, com todas as decisões e por quê:
  `.superpowers/sdd/2026-08-27-motor-chatflow/progress.md` *(fora do git —
  não rode `git clean -fdx`)*

## Para retomar

Abra o Claude Code nesta pasta e diga: *"fazer a review final da branch
motor-v1 do chatflow"* — ou, com a URL do Apps Script em mãos,
*"concluir o Step 5 da Task 12"*.
