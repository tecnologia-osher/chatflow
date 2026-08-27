# chatflow — Motor e formato do fluxo

**Data:** 2026-08-27
**Sub-projeto:** 1 de 4
**Status:** desenho aprovado, aguardando plano de implementação

---

## 1. Contexto

A Osher usa hoje um qualificador de leads em `Osher/Typebot/index.html`: um
chat de 7 perguntas lineares, com pontuação e classificação em quente,
morno e frio, que deveria enviar o resultado para uma planilha via Google
Apps Script.

Três problemas encontrados no estado atual:

1. **Nenhum lead está sendo salvo.** `CONFIG.sheetsWebhookUrl` continua com
   o valor `"COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT"`, e a função de envio
   desiste silenciosamente quando encontra esse valor. O `apps-script.gs`
   está escrito e correto, mas nunca foi conectado.
2. **O fluxo é linear.** Todo lead responde as mesmas 7 perguntas, mesmo
   quando as primeiras respostas já mostram que não faz sentido continuar.
3. **Motor e conteúdo estão no mesmo arquivo.** Não é possível reaproveitar
   o mecanismo para outro fluxo ou outro cliente sem duplicar tudo.

Além disso, a pergunta `necessidade` atribui 3 pontos a todas as opções, o
que a torna irrelevante para a classificação.

## 2. Objetivo

Construir um motor de chat conversacional que executa um fluxo descrito em
arquivo, com ramificação, pontuação e entrega do lead a destinos
configuráveis.

O motor é uma **ferramenta independente**. A Osher é seu primeiro cliente,
não sua dona.

### Critério de aceitação do sub-projeto

- O fluxo da Osher roda no motor novo, com ramificação real
- Um lead que completa o chat **aparece na planilha**, verificado
- Apagar a pasta `clientes/osher/` não quebra o motor
- A lógica de percurso tem testes automatizados que passam

## 3. Não-objetivos

Fora de escopo deste sub-projeto, cada um com sua própria spec depois:

- **Editor visual com arrastar-e-soltar** (sub-projeto 2)
- **Contas, banco de dados e multi-cliente simultâneo** (sub-projeto 3)
- **Painel de analytics e integração com CRM** (sub-projeto 4)

Também fora: autenticação, cobrança, marca comercial do produto.

## 4. Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Motor x conteúdo | Separados | Um motor, N configurações. Correção de bug em um lugar só. É também a fronteira que o editor do sub-projeto 2 vai usar. |
| Onde roda | Navegador, sem servidor | Publica em qualquer lugar, custo zero. Migrar para servidor depois troca onde roda, não o formato. |
| Build | Nenhum | HTML + JS puro. Node só para rodar testes. |
| Idioma das chaves | Português | O arquivo será lido e editado por gente da operação. Legibilidade vale mais que convenção. |
| Onde mora o código | Repositório próprio, fora do workspace da Osher | A ferramenta é independente desde o primeiro commit. |
| Destino do lead | Configurável por cliente | O motor não conhece CRM nem planilha. A Osher aponta para o Apps Script dela. |

### Teste de acoplamento

Aplicado a cada arquivo do motor: *se a pasta `clientes/osher/` for
apagada, o motor continua funcionando?* Se não, há acoplamento e volta.

Na prática, isso proíbe dentro de `motor/`: qualquer texto sobre consórcio,
as cores da Osher, e qualquer URL de destino.

## 5. Estrutura de arquivos

```
chatflow/
├── motor/
│   ├── player.html          entrada, sem conteúdo de cliente
│   ├── motor.js             estado da conversa e renderização
│   ├── fluxo.js             percurso: qual é o próximo bloco (lógica pura)
│   ├── destinos.js          envio, fila e reenvio
│   └── tema.css             estrutura visual, cores vêm de variáveis CSS
├── clientes/
│   └── osher/
│       ├── fluxo.json
│       ├── tema.json
│       └── destinos.json
├── exemplos/
│   └── fluxo-modelo.json    ponto de partida para cliente novo
├── testes/
│   └── fluxo.test.js
└── docs/superpowers/specs/
```

Abertura: `player.html?cliente=osher` carrega os três arquivos daquela
pasta. Sem o parâmetro, carrega `exemplos/fluxo-modelo.json`.

## 6. Formato do fluxo

```json
{
  "versao": 1,
  "inicio": "boas_vindas",
  "blocos": [ ... ]
}
```

Todo bloco tem `id` (único no fluxo) e `tipo`. Cada bloco declara para onde
vai depois — é isso que vira seta no editor visual do sub-projeto 2.

### 6.1 `mensagem`

O bot fala e segue adiante sem esperar resposta.

```json
{ "id": "boas_vindas", "tipo": "mensagem",
  "texto": "Vou fazer algumas perguntas para entender seu momento.",
  "proximo": "nome" }
```

### 6.2 `pergunta`

```json
{ "id": "tipo_bem", "tipo": "pergunta", "formato": "escolha",
  "texto": "O que você quer conquistar?",
  "salvar_em": "bem",
  "opcoes": [
    { "label": "Imóvel",        "pontos": 2, "proximo": "valor_imovel" },
    { "label": "Automóvel",     "pontos": 2, "proximo": "valor_auto" },
    { "label": "Ainda não sei", "pontos": 0, "proximo": "ajuda_definir" }
  ] }
```

- `formato`: `texto` · `email` · `telefone` · `numero` · `escolha`
- `salvar_em`: nome da variável que guarda a resposta
- `placeholder`: só para os formatos de digitação
- `obrigatorio`: booleano, padrão `true`
- `opcoes`: só para `escolha`. Cada opção pode ter `pontos` e `proximo`
- `proximo`: para formatos de digitação, ou como padrão quando a opção não
  declara o seu

Quando uma opção tem `proximo`, ele vence o `proximo` do bloco.

### 6.3 `condicao`

Desvia por variável ou pontuação, sem perguntar nada.

```json
{ "id": "triagem", "tipo": "condicao",
  "regras": [
    { "se": { "pontuacao": { "menor_que": 4 } }, "entao": "fim_frio" },
    { "se": { "variavel": "bem", "igual": "Ainda não sei" }, "entao": "ajuda_definir" }
  ],
  "senao": "urgencia" }
```

Regras avaliadas em ordem; a primeira verdadeira decide. Operadores:
`igual`, `diferente`, `maior_que`, `menor_que`, `contem`, `vazio`.

### 6.4 `acao`

Entrega o que foi coletado a um destino, no meio do fluxo.

```json
{ "id": "salvar_parcial", "tipo": "acao",
  "destino": "planilha", "proximo": "urgencia" }
```

`destino` referencia uma chave de `destinos.json`. Não bloqueia a conversa:
falha vai para a fila de reenvio.

### 6.5 `fim`

Encerra. Um fluxo pode ter vários.

```json
{ "id": "fim_quente", "tipo": "fim",
  "titulo": "Perfeito, {{nome}}.",
  "texto": "Um consultor vai falar com você ainda hoje.",
  "botao": { "tipo": "whatsapp", "numero": "5561982286044",
             "mensagem": "Olá, sou {{nome}} e vim pelo chat.",
             "label": "Continuar no WhatsApp" } }
```

`botao` aceita `whatsapp`, `link`, ou `null` (só mensagem).

> **Nota de nomenclatura.** `destino` (no bloco `acao` e em
> `destinos.json`) é para onde vão os **dados**. `botao` (no bloco `fim`) é
> para onde vai a **pessoa**. São coisas diferentes e por isso têm nomes
> diferentes.

Ao chegar num `fim`, o motor envia o lead completo aos destinos listados em
`ao_finalizar` antes de renderizar a tela final.

### 6.6 Interpolação

`{{variavel}}` em qualquer texto é trocado pelo valor salvo. Variável
inexistente vira string vazia, nunca `undefined` na tela.

Além das respostas, ficam disponíveis: `pontuacao` e `classificacao`.

### 6.7 Classificação

Declarada na raiz do fluxo, ao lado de `versao` e `inicio`:

```json
{ "versao": 1,
  "inicio": "boas_vindas",
  "classificacao": { "quente": 9, "morno": 5 },
  "blocos": [ ... ] }
```

Faixas por pontuação total, comparadas com "maior ou igual". Abaixo da
menor faixa, `frio`. Disponível como `{{classificacao}}`, usável em
condições e enviada aos destinos.

### 6.8 Validação do fluxo

Verificado ao carregar, com erro claro em tela (modo teste) e no console:

- `inicio` aponta para um bloco existente
- ids únicos
- todo `proximo`, `entao` e `senao` aponta para bloco existente
- todo bloco é alcançável a partir de `inicio`
- de todo bloco existe ao menos um caminho até um bloco `fim` (evita becos
  sem saída; ciclos são permitidos, desde que haja saída)
- `destino` de `acao` existe em `destinos.json`

## 7. O motor

### Estado da conversa

`respostas` (objeto), `pontuacao` (número), `blocoAtual` (id),
`sessaoId` (uuid), `historico` (ids visitados, para o funil).

### Retomada

O estado é gravado no navegador a cada bloco. Quem fecha a aba e volta em
até 24 horas retoma de onde parou. Depois disso, recomeça. O botão de
recomeçar fica sempre disponível.

Motivação: hoje quem sai perde tudo, e o abandono é o maior vazamento.

### Eventos

A cada bloco exibido, um evento é enviado ao destino de eventos com
`sessaoId`, `blocoId` e horário. É o que permite ver em que pergunta as
pessoas desistem. Envio sem bloquear a conversa.

### Tema

`tema.json` alimenta variáveis CSS. `motor/tema.css` só usa variáveis,
nunca cor literal.

```json
{ "marca": "Osher",
  "logo": "logo.png",
  "cores": { "fundo": "#0C2340", "superficie": "#1F3140",
             "acento": "#BF9C5A", "texto": "#EEF1F5" },
  "fonte": "Georgia, 'Gelasio', serif" }
```

## 8. Destinos

```json
{ "destinos": {
    "planilha": { "tipo": "apps_script", "url": "https://script.google.com/..." },
    "crm":      { "tipo": "webhook", "url": "", "ativo": false } },
  "ao_finalizar": ["planilha"],
  "eventos": "planilha" }
```

Tipos: `apps_script` e `webhook` (ambos POST com JSON). Destino com
`"ativo": false` ou `url` vazia é ignorado sem erro.

### Fila e reenvio

Envio que falha entra numa fila no navegador e é retentado com espera
crescente (2s, 8s, 30s). A fila é reprocessada quando a pessoa volta.
Máximo de 3 tentativas por item.

### Quando não há destino configurado

Diferente de hoje, isso **não** passa em silêncio: aviso no console em
qualquer caso, e faixa visível de aviso quando aberto com `?teste=1`.

### Segurança

Nenhuma chave, token ou credencial em arquivo de cliente — tudo é URL
pública de webhook. Integração que exija credencial (CRM) fica atrás do
Apps Script ou do Make, nunca no navegador.

## 9. Testes

`fluxo.js` é lógica pura, sem DOM: recebe um fluxo e as respostas, devolve
o percurso e a pontuação. Testado com o runner nativo do Node
(`node --test`), sem dependência externa. Escritos antes do código.

Casos obrigatórios:

1. Fluxo linear percorre todos os blocos na ordem
2. Opção com `proximo` próprio desvia corretamente
3. `condicao` por pontuação manda para o fim antecipado
4. `condicao` por variável desvia corretamente
5. Pontuação soma apenas o que a opção declara
6. Interpolação troca variável e não vaza `undefined`
7. Classificação bate as faixas nos limites (8, 9, 4, 5)
8. Fluxo com `proximo` órfão é rejeitado com mensagem clara
9. Fluxo com bloco inalcançável é rejeitado
10. Caminho sem `fim` é rejeitado

Teste de ponta a ponta, manual e verificado: completar o fluxo no navegador
e **confirmar a linha na planilha**. Não é dado por concluído sem isso.

## 10. Fluxo da Osher

Reescrito, não portado. Correções em relação ao atual:

- `necessidade` (3 pontos para tudo) removida; `tipo_bem` passa a ramificar
- "Qual faixa de **investimento**" reescrita — palavra proibida em
  `_memoria/preferencias.md`, e consórcio não é aplicação financeira
- Typo "iteresse" corrigido
- Placeholder "Ex.: e-commerce" removido
- Emoji removido das boas-vindas, conforme tom registrado
- Faixa por valor do bem, não por parcela: o cliente sabe quanto custa o
  que quer, raramente sabe qual parcela cabe
- E-mail deixa de ser perguntado: contato segue por WhatsApp
- Fim antecipado para quem está só pesquisando

## 11. Dependências e pendências

| Item | Responsável | Bloqueia |
|---|---|---|
| Publicar o Apps Script e obter a URL | Gustavo | Teste de ponta a ponta |
| Confirmar faixas de valor do bem | Gustavo | Conteúdo do fluxo |
| Nome do CRM e como a planilha se liga a ele | Gustavo | Sub-projeto 4 |
| Onde o player será hospedado | Gustavo | Publicação |

Nenhuma dessas impede começar a implementação.

## 12. Registro

- **2026-08-27** — Desenho aprovado por Gustavo. Abordagem escolhida:
  motor separado do fluxo. Ferramenta interna da Osher agora, com
  estrutura preparada para uso independente depois.
