# Estado do chatflow — 27/08/2026

## Sub-projeto 1: concluído e integrado

O motor e o formato do fluxo. As 12 tarefas do plano, a review final da
branch e o merge em `main`. **139 testes passando.** A branch `motor-v1`
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
- **Sub-projeto 3** — contas, banco, multi-cliente simultâneo. Hoje a entrega
  do lead depende da aba do navegador ficar aberta; a fila de reenvio vive em
  memória.
- **Sub-projeto 4** — analytics e CRM.

São quatro ao todo, conforme a spec ("Sub-projeto: 1 de 4"). O 2 é a cara do
produto: sem ele o chatflow é uma biblioteca, não uma ferramenta.

## Camada de DOM agora tem teste

`motor/motor.js` era a única parte sem teste automatizado, por ser a camada
que fala com o DOM. Cinco defeitos sérios nasceram ali e nenhum foi pego pela
suíte — o pior deles fazia o lead mais quente nunca ser enviado.

Fechado em 27/08/2026: `testes/apoio/navegador.js` é um navegador de mentira
escrito à mão (81 linhas, zero dependência) e `testes/motor.test.js` dirige o
chat de ponta a ponta em 25 casos. Os testes foram validados por mutação:
oito defeitos foram reintroduzidos um a um no código de produção e os oito
foram detectados.

Não cobertos ainda, por nenhum fluxo em uso os exercitar: o bloco `imagem`, o
bloco `definir_variavel` e vários destinos em `ao_finalizar`.

## Decisões em aberto, todas suas

1. **Para qual WhatsApp vai o lead quente.** Está no fluxo o
   (61) 98228-6044, o único que existe, mas a equipe tem seis vendedores.
2. **O bubble de texto aceita negrito, itálico e link?** Decide se o editor
   do sub-projeto 2 usa caixa simples ou editor com formatação.
3. **Barra de progresso** ("pergunta 3 de 8"), que existia no Typebot antigo
   e não foi reimplementada. Vira um tipo de bloco novo.

## Onde está o resto

- Spec: `docs/superpowers/specs/2026-08-27-chatflow-motor-design.md`
- Plano das 12 tarefas: `docs/superpowers/plans/2026-08-27-motor-chatflow.md`
- Registro de execução, com as 18 decisões tomadas durante a implementação e
  o porquê de cada uma, mais o relatório da review final:
  `.superpowers/sdd/2026-08-27-motor-chatflow/progress.md`
  *(fora do git — não rode `git clean -fdx`)*
