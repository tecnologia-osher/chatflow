# Onde paramos — 27/08/2026

Sub-projeto 1 do chatflow: o motor e o formato do fluxo.
Branch de trabalho: **`motor-v1`**. `main` está intocado.

## Estado

**10 de 12 tarefas concluídas. 98 testes passando.**

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
| 10 | `criarChat` e player | 🔄 **em correção** |
| 11 | Retomada de sessão | ⬜ |
| 12 | Fluxo da Osher, ponta a ponta | ⬜ |

Depois da 12 falta a **review final da branch inteira**, que olha o conjunto
em vez de tarefa por tarefa.

## Como ver funcionando agora

```
cd "/Users/gustavolacerda/Desktop/Claude Master/chatflow"
python3 -m http.server 8080
```

Navegador: `http://localhost:8080/motor/player.html`
Com avisos de configuração em tela e sem enviar nada: acrescente `?teste=1`.

Rodar os testes: `npm test`

Editar as frases do fluxo: `exemplos/captacao-simples.json`.

## O ponto exato de retomada

A Task 10 estava num ciclo de correção quando paramos. O commit
`724d0c8 wip: enviarPara para destino nomeado (INCOMPLETO)` guarda o
trabalho parcial: consistente, 95 testes passando, mas **inacabado**. Os
achados e o que falta em cada um:

1. **`motor/motor.js`, bloco `webhook` ignora seu `destino`.** O bloco
   declara o campo, `motor/validar.js` exige que ele exista em
   `destinos.json`, e o motor chamava `enviador.enviar()` — que só entrega
   para `ao_finalizar`. O campo era validado e morto.
   **Fechado.** `enviarPara(nome, dados)` existe em `motor/destinos.js:73`,
   o ramo `webhook` do motor já o usa (`motor/motor.js:200`), e os três
   testes estão em `testes/destinos.test.js`.

2. **`motor/motor.js`, a guarda de 500 iterações finge conclusão.** Ao
   estourar, o laço sai com `terminou` ainda falso e cai em `finalizar()`,
   que envia um lead carimbado como concluído. Um fluxo travado vira chat
   mudo mais um lead falso na planilha do cliente. Correção: mostrar erro
   visível em português nomeando o grupo onde travou, não enviar nada, não
   marcar como terminado.

3. A limitação da fila já foi registrada no `README.md`. **Fechado.**

**Resumo: só o item 2 continua aberto.** Feito ele, a Task 10 vai para o
re-review e seguem as Tasks 11 e 12.

## Pendências que dependem do Gustavo

1. **URL do Apps Script publicado.** A Task 12 termina com um teste de ponta
   a ponta que só fecha com ela: completar o chat e conferir a linha na
   planilha. Como publicar: planilha → Extensões → Apps Script → colar
   `Osher/Typebot/apps-script.gs` → Implantar → Nova implantação → App da
   Web → executar como você, acesso "qualquer pessoa" → copiar a URL
   terminada em `/exec`.
2. **As quatro faixas de valor** do fluxo da Osher (até 100 mil, 100–300,
   300–600, acima de 600) foram estimadas pelo mercado de Brasília.
3. **Para qual WhatsApp vai o lead quente.** Só existe o (61) 98228-6044 e
   a equipe tem seis vendedores.
4. **O bubble de texto aceita negrito, itálico e link?** Decide se o campo
   do editor é caixa simples ou editor com formatação. Não bloqueia o
   sub-projeto 1.

## Onde está o resto

- Spec: `docs/superpowers/specs/2026-08-27-chatflow-motor-design.md`
- Plano das 12 tarefas: `docs/superpowers/plans/2026-08-27-motor-chatflow.md`
- Registro de execução, com todas as decisões que tomei e por quê:
  `.superpowers/sdd/2026-08-27-motor-chatflow/progress.md` *(fora do git —
  não rode `git clean -fdx`)*

## Para retomar

Abra o Claude Code nesta pasta e diga: *"retomar o plano do chatflow a
partir da Task 10"*. O registro de execução tem o histórico completo,
inclusive as quinze decisões que tomei sozinho durante a execução.
