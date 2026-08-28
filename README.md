# chatflow

Motor de chat conversacional para captação e qualificação de leads. A pessoa
conversa; o motor faz as perguntas descritas num JSON, ramifica conforme as
respostas, pontua, valida o que foi digitado e entrega o resultado onde você
mandar.

**Um motor, N clientes.** O fluxo, o tema e os destinos de cada cliente vivem
em `clientes/<nome>/`, e o motor não conhece nenhum deles. Apagar
`clientes/osher/` não quebra o motor — só remove aquele cliente.

- **JavaScript ESM puro**, sem framework
- **Zero dependências**, em produção e em teste
- **Sem etapa de build** — o que está no repositório é o que roda no navegador

## Rodar

```bash
python3 -m http.server 8080
```

| | Endereço |
|---|---|
| Fluxo de exemplo | `localhost:8080/motor/player.html` |
| Um cliente | `localhost:8080/motor/player.html?cliente=osher` |
| Pré-visualizar sem enviar nada | acrescente `&teste=1` |

Testes: `npm test` — usa o runner nativo do Node, nada a instalar.

## Como um fluxo é descrito

Um fluxo é uma lista de **grupos**, cada um com uma lista de **blocos**. Um
bloco fala, pergunta ou decide. O caminho entre grupos é explícito.

```json
{
  "versao": 2,
  "eventos": [{ "tipo": "inicio", "proximo": "g_abertura" }],
  "pontuacao": { "ativa": true, "faixas": { "quente": 4, "morno": 2 } },
  "grupos": [
    {
      "id": "g_abertura",
      "blocos": [
        { "id": "b1", "tipo": "texto",
          "conteudo": { "texto": "Olá. Duas perguntas rápidas." } },
        { "id": "b2", "tipo": "entrada_texto", "salvar_em": "nome",
          "conteudo": { "placeholder": "Seu nome" } },
        { "id": "b3", "tipo": "entrada_botoes", "salvar_em": "interesse",
          "conteudo": { "opcoes": [
            { "id": "o1", "label": "Quero contratar", "pontos": 3,
              "proximo": "g_contato" },
            { "id": "o2", "label": "Só tirando dúvidas", "pontos": 1 }
          ] } }
      ],
      "proximo": "g_duvidas"
    }
  ]
}
```

Antes de cada fala o chat mostra três pontinhos, por um tempo proporcional
ao tamanho do texto. O compasso é configurável em
`criarChat({ ritmo: { piso, porCaractere, teto } })`; zerar os três desliga.

`{{nome}}` em qualquer texto é trocado pela resposta. São treze tipos de
bloco: fala (`texto`, `imagem`), entrada (texto, número, e-mail, telefone,
data, botões), lógica (`condicao`, `definir_variavel`, `ir_para`) e conexão
(`webhook`, `redirecionar`).

**Adicionar um tipo novo não exige editar o motor.** Cada tipo é um arquivo
em `motor/blocos/` que declara o que é e quais campos tem; o catálogo é lido
em tempo de execução.

## Estrutura

| Pasta | O que é |
|---|---|
| `motor/` | O motor. Não contém nada de nenhum cliente |
| `motor/blocos/` | Um arquivo por tipo de bloco, mais o catálogo |
| `clientes/<nome>/` | Fluxo, tema, destinos e receptor de um cliente |
| `exemplos/` | Fluxo genérico de demonstração |
| `testes/` | Um arquivo por módulo, mais os testes de DOM |
| `docs/` | Spec de desenho e plano de implementação |

O núcleo de percurso (`motor/percurso.js`) é lógica pura, sem DOM: recebe
estado e devolve estado novo, nunca modifica o que recebeu.

## Estado

**Sub-projeto 1 de 4 concluído** — o formato e o motor. 152 testes passando.

Os próximos: 2 = editor visual do fluxo, que é a cara do produto;
3 = contas, banco e multi-cliente simultâneo; 4 = analytics e CRM.

Onde a obra está e o que está em aberto: [ESTADO.md](ESTADO.md).
Por que cada decisão foi tomada: [docs/superpowers/specs/](docs/superpowers/specs/).

## Limitações conhecidas

**A entrega do lead depende da aba ficar aberta.** A fila de reenvio de
`motor/destinos.js` vive na memória da instância: um envio que falha é
retentado enquanto a aba continuar aberta, mas a fila se perde se ela fechar
antes disso. Entrega garantida sob qualquer falha exige servidor — é o
sub-projeto 3.

**O destino é público.** Sem servidor, a URL de destino fica visível no
navegador de quem usa o chat. Quem a descobrir pode enviar dados falsos. O
sub-projeto 3 também resolve isso.
