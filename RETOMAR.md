# Estado do chatflow — 27/08/2026

## Sub-projeto 1: concluído e integrado

O motor e o formato do fluxo. As 12 tarefas do plano, a review final da
branch e o merge em `main`. **114 testes passando.** A branch `motor-v1`
foi removida; o histórico está preservado no commit de merge `8dc10b9`,
que isola o sub-projeto inteiro caso algum dia precise ser revertido.

O primeiro cliente está no ar de ponta a ponta: o chat da Osher grava na
planilha **Leads Osher Backup**, nas abas `Chatflow` e `Chatflow Eventos`.

## Como rodar

```
cd "/Users/gustavolacerda/Desktop/Claude Master/chatflow"
python3 -m http.server 8080
```

- Fluxo genérico: `http://localhost:8080/motor/player.html`
- Fluxo da Osher: `http://localhost:8080/motor/player.html?cliente=osher`
- Sem enviar nada, para pré-visualizar: acrescente `&teste=1`

Testes: `npm test` · Frases do chat: `clientes/osher/fluxo.json`

## O que vem depois

- **Sub-projeto 2** — editor visual do fluxo. O catálogo de blocos
  (`motor/blocos/`) já foi desenhado para isso: cada tipo declara seus
  `campos`, que é o que o painel de propriedades vai ler.
- **Sub-projeto 3** — servidor. Hoje a entrega do lead depende da aba do
  navegador ficar aberta; a fila de reenvio vive em memória.

## Decisões em aberto, todas suas

1. **Para qual WhatsApp vai o lead quente.** Está no fluxo o
   (61) 98228-6044, o único que existe, mas a equipe tem seis vendedores.
2. **O bubble de texto aceita negrito, itálico e link?** Decide se o editor
   do sub-projeto 2 usa caixa simples ou editor com formatação.
3. **`motor/motor.js` continua sem teste automatizado**, por ser camada de
   DOM — decisão deliberada do plano. Vale saber o preço: cinco defeitos
   sérios apareceram nele ou na fronteira dele, e **nenhum** foi pego pela
   suíte. Entre eles, o lead mais quente nunca ser enviado. O que os pegou
   foi um shim de DOM escrito à mão (~60 linhas, sem dependência nova) que
   vive fora do repositório e some com a sessão. Promovê-lo a `testes/` é a
   melhoria de qualidade mais barata disponível aqui.
4. **Barra de progresso** ("pergunta 3 de 8"), que existia no Typebot antigo
   e não foi reimplementada. Vira um tipo de bloco novo.

## Onde está o resto

- Spec: `docs/superpowers/specs/2026-08-27-chatflow-motor-design.md`
- Plano das 12 tarefas: `docs/superpowers/plans/2026-08-27-motor-chatflow.md`
- Registro de execução, com as 18 decisões tomadas durante a implementação e
  o porquê de cada uma, mais o relatório da review final:
  `.superpowers/sdd/2026-08-27-motor-chatflow/progress.md`
  *(fora do git — não rode `git clean -fdx`)*
