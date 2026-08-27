# chatflow — Motor e formato do fluxo

**Data:** 2026-08-27 (revisão 2)
**Sub-projeto:** 1 de 4
**Status:** desenho revisado, aguardando aprovação

> **Revisão 2** — Reescrita depois que o Gustavo definiu que o chatflow é um
> produto genérico, para qualquer área, com editor visual como interface
> principal. Mudanças estruturais: grupos, fala separada de captura, fim do
> bloco `fim`, catálogo extensível de tipos. A revisão 1 tratava o formato
> como algo escrito à mão para um fluxo de consórcio.

---

## 1. O que é o chatflow

Uma ferramenta para montar chats de captação e atendimento sem escrever
código. Quem usa arrasta blocos num canvas, escreve o que o cliente vai
ler, liga um grupo no outro, e publica.

O produto não pertence a nenhum ramo. O primeiro fluxo real será da Osher
(consórcio), mas ele é um exemplo dentro do repositório, não o produto.

**Sub-projeto 1 entrega o alicerce:** o formato que descreve um fluxo e o
motor que executa esse fluxo para o cliente final. O editor visual, que é a
cara do produto, é o sub-projeto 2 — e todas as decisões aqui existem para
que ele seja possível.

## 2. Contexto

A Osher usa hoje `Osher/Typebot/index.html`: sete perguntas lineares,
pontuação, classificação em quente, morno e frio. Três problemas:

1. **Nenhum lead é salvo.** `sheetsWebhookUrl` continua com o valor de
   exemplo e a função de envio desiste em silêncio.
2. **Fluxo linear**, sem ramificação nem encerramento antecipado.
3. **Motor e conteúdo no mesmo arquivo**, impossível de reaproveitar.

Serve como caso de teste real, não como escopo.

## 3. Critério de aceitação

- Um fluxo genérico de exemplo roda no motor, com ramificação
- O fluxo da Osher roda no mesmo motor, sem nenhuma linha específica dele
- Um lead que completa o chat **aparece na planilha**, verificado
- Apagar `clientes/osher/` não quebra nada
- Adicionar um tipo de bloco novo não exige editar o motor
- A lógica de percurso tem testes automatizados que passam

## 4. Não-objetivos

- **Editor visual** (sub-projeto 2) — mas o formato é desenhado para ele
- **Contas, banco, multi-cliente simultâneo** (sub-projeto 3)
- **Analytics e CRM** (sub-projeto 4)
- Cobrança, planos, marca comercial

## 5. Decisões estruturais

| Decisão | Escolha | Motivo |
|---|---|---|
| Fala x captura | Blocos separados | Liberdade de montar: três mensagens, uma imagem, depois o campo. É o que dá autonomia a quem monta. |
| Agrupamento | Grupos contêm blocos; setas ligam grupos | Sem isso, um chat de seis perguntas vira doze setas no canvas. Confirmado no Typebot. |
| Bloco de encerramento | Não existe | O fluxo acaba quando um grupo não aponta para ninguém. Menos conceito especial, mais liberdade. |
| Catálogo de tipos | Registro extensível | Adicionar "Rating" é escrever um arquivo, sem tocar em motor nem editor. |
| Pontuação | Opcional | Uma clínica marcando consulta não pontua. Recurso que se liga, não obrigação. |
| Motor x conteúdo | Separados | Um motor, N fluxos. Correção de bug num lugar só. |
| Montagem | Em qualquer elemento da página | O editor precisa rodar o fluxo num painel lateral, ao vivo. Motor que assume ser dono da página inviabiliza o preview. |
| Onde roda | Navegador, sem servidor | Publica em qualquer lugar. Migrar para servidor troca onde roda, não o formato. |
| Build | Nenhum | HTML + JS puro. Node só para testes. |
| Idioma das chaves | Português | Mercado brasileiro. Quem edita pelo editor nunca vê o arquivo. |

### Teste de acoplamento

Aplicado a cada arquivo do motor: *se `clientes/osher/` for apagada, o
motor continua funcionando?* Proíbe, dentro de `motor/`: qualquer texto de
nicho, as cores da Osher, e qualquer URL de destino.

## 6. Estrutura de arquivos

```
chatflow/
├── motor/
│   ├── player.html          entrada, sem conteúdo de cliente
│   ├── motor.js             estado da conversa e renderização
│   ├── percurso.js          qual é o próximo grupo (lógica pura, testada)
│   ├── destinos.js          envio, fila e reenvio
│   ├── tema.css             estrutura visual; cores via variáveis CSS
│   └── blocos/              um arquivo por tipo de bloco
│       ├── _registro.js
│       ├── texto.js
│       ├── imagem.js
│       ├── entrada-texto.js
│       ├── entrada-numero.js
│       ├── entrada-email.js
│       ├── entrada-telefone.js
│       ├── entrada-data.js
│       ├── entrada-botoes.js
│       ├── condicao.js
│       ├── definir-variavel.js
│       └── ir-para.js
├── clientes/
│   └── osher/               fluxo, tema e destinos da Osher
├── exemplos/
│   └── captacao-simples.json
├── testes/
└── docs/superpowers/specs/
```

`player.html?cliente=osher` carrega os três arquivos daquela pasta. Sem
parâmetro, carrega o exemplo.

## 7. O formato do fluxo

### 7.1 Forma geral

```json
{
  "versao": 2,
  "eventos": [
    { "tipo": "inicio", "posicao": { "x": 40, "y": 40 }, "proximo": "g_boas_vindas" }
  ],
  "pontuacao": { "ativa": true, "faixas": { "quente": 9, "morno": 5 } },
  "grupos": [ ... ]
}
```

`pontuacao` é opcional. Ausente ou `"ativa": false`, o motor ignora
qualquer campo `pontos` e não calcula classificação.

### 7.1.1 Eventos

Eventos **não são blocos**. Não vivem dentro de grupos e não são
executados em sequência: eles dizem *quando* um fluxo começa ou é
interrompido. No canvas, são nós próprios com conector de saída.

| Evento | Dispara quando | Quando |
|---|---|---|
| `inicio` | A conversa abre | v1, obrigatório, exatamente um |
| `invalido` | A resposta não passa na validação do input | **v1** |
| `comando` | A página hospedeira chama o chat por código | depois |
| `resposta` | Chega resposta por canal assíncrono (WhatsApp) | depois |

**`invalido` substitui a mensagem de erro fixa.** Sem ele, o motor repete
a pergunta com o texto padrão do tipo de bloco. Com ele, quem monta decide
o que acontece — explicar melhor na segunda tentativa, oferecer outro
caminho, ou seguir sem o campo depois de duas falhas.

```json
{ "tipo": "invalido", "posicao": { "x": 40, "y": 200 },
  "apos_tentativas": 2, "proximo": "g_ajuda_contato" }
```

`apos_tentativas` define quantas falhas antes de desviar. Ausente, desvia
na primeira.

**Nota de escopo:** `resposta` implica canais fora do navegador, o que
muda a arquitetura inteira — a conversa deixa de viver numa aba aberta e
passa a precisar de servidor e de estado persistente. Fora do sub-projeto
1 e provavelmente fora do 2. Registrado aqui porque o formato não deve
impedir.

### 7.2 Grupo

A unidade que o editor desenha e conecta.

```json
{
  "id": "g_nome",
  "titulo": "Nome",
  "posicao": { "x": 320, "y": 140 },
  "blocos": [ ... ],
  "proximo": "g_contato"
}
```

- `titulo` é rótulo do editor, nunca aparece para o cliente
- `posicao` é onde a caixa fica no canvas
- `proximo` é a saída única do grupo. Ausente, o fluxo encerra ali.

Os blocos rodam em ordem. Quando o último termina, o motor segue o
`proximo` — a menos que algum bloco tenha desviado antes.

### 7.3 Bloco

Todo bloco, de qualquer tipo, tem a mesma forma:

```json
{ "id": "b_1", "tipo": "texto", "conteudo": { ... } }
```

Inputs acrescentam `salvar_em`. Nada mais varia entre tipos — é o que
permite ao editor montar a interface a partir do registro, sem conhecer
cada tipo.

### 7.4 Categorias

Espelham o vocabulário que quem monta já reconhece:

| Categoria | O que faz | Espera resposta |
|---|---|---|
| `fala` | O bot mostra algo | Não |
| `entrada` | O cliente responde | Sim |
| `logica` | Decide ou altera estado | Não |
| `conexao` | Fala com sistema externo | Não |

### 7.5 Catálogo — primeira versão

| Tipo | Categoria | Ramifica | Salva variável |
|---|---|---|---|
| `texto` | fala | não | não |
| `imagem` | fala | não | não |
| `entrada_texto` | entrada | não | sim |
| `entrada_numero` | entrada | não | sim |
| `entrada_email` | entrada | não | sim |
| `entrada_telefone` | entrada | não | sim |
| `entrada_data` | entrada | não | sim |
| `entrada_botoes` | entrada | **sim** | sim |
| `condicao` | logica | **sim** | não |
| `definir_variavel` | logica | não | sim |
| `ir_para` | logica | **sim** | não |
| `redirecionar` | conexao | não | não |
| `webhook` | conexao | não | opcional |

Depois: vídeo, áudio, embed, website, hora, nota, escolha com foto, cards,
arquivo, pagamento, esperar, teste A/B, sub-fluxo, retornar, script.

### Dois pontos do catálogo futuro que afetam decisões de agora

**Sub-fluxo e retornar são o mecanismo de templates.** Um fluxo chamando
outro e voltando permite montar um trecho padrão uma vez e reusar em todo
cliente novo, corrigindo num lugar só. É a maior alavanca comercial do
catálogo. Não entra no v1, mas o formato precisa comportar — e comporta,
porque grupo já é endereçável por id.

**`script` é o único bloco com risco de segurança.** Ele executa
JavaScript escrito por quem monta o fluxo. Enquanto cada fluxo roda no
domínio do próprio dono, tudo bem. No momento em que o chatflow hospedar
fluxos de clientes no mesmo domínio, um cliente escrevendo JavaScript
alcança sessão e dados de outros contextos. Implementar por último, e
então ou isolar em moldura separada, ou restringir a expressões em vez de
código livre.

**Invariante:** só ramificam `entrada_botoes`, `condicao` e `ir_para`.
Todo o resto segue em frente. Isso mantém o canvas previsível — quem olha
um grupo sabe, pelos blocos que ele tem, se dali sai uma seta ou várias.

### 7.6 Registro de tipos

Cada tipo é um arquivo em `motor/blocos/` que exporta sua definição:

```js
export default {
  tipo: "entrada_email",
  categoria: "entrada",
  rotulo: "E-mail",
  ramifica: false,
  salva_variavel: true,
  campos: [
    { nome: "placeholder", rotulo: "Texto de exemplo", tipo: "texto", aceita_variavel: true },
    { nome: "rotulo_botao", rotulo: "Texto do botão", tipo: "texto", padrao: "Enviar" }
  ],
  validar: (valor) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor),
  erro: "Digite um e-mail válido.",
  render: (bloco, ctx) => { /* devolve o elemento */ }
}
```

`campos` é o que permite ao editor do sub-projeto 2 **desenhar o painel de
propriedades sozinho**, sem código específico por tipo. Adicionar um tipo
novo é criar um arquivo e registrá-lo.

### 7.7 Exemplos por tipo

**Fala:**
```json
{ "id": "b_1", "tipo": "texto",
  "conteudo": { "texto": "Olá {{nome}}, vamos começar." } }
```

**Entrada simples:**
```json
{ "id": "b_2", "tipo": "entrada_texto",
  "conteudo": { "placeholder": "Seu nome", "rotulo_botao": "Enviar" },
  "salvar_em": "nome" }
```

**Entrada que ramifica** — cada opção leva a um grupo:
```json
{ "id": "b_3", "tipo": "entrada_botoes",
  "conteudo": { "opcoes": [
      { "id": "o1", "label": "Imóvel",        "pontos": 2, "proximo": "g_valor" },
      { "id": "o2", "label": "Automóvel",     "pontos": 2, "proximo": "g_valor" },
      { "id": "o3", "label": "Ainda não sei", "pontos": 0, "proximo": "g_ajuda" }
  ] },
  "salvar_em": "interesse" }
```

Opção sem `proximo` cai no `proximo` do grupo. `pontos` só tem efeito com
pontuação ativa.

**Condição:**
```json
{ "id": "b_4", "tipo": "condicao",
  "conteudo": { "regras": [
      { "se": { "pontuacao": { "menor_que": 4 } }, "entao": "g_encerra" },
      { "se": { "variavel": "interesse", "igual": "Ainda não sei" }, "entao": "g_ajuda" }
  ] } }
```

Regras em ordem; a primeira verdadeira decide. Nenhuma verdadeira, segue o
`proximo` do grupo. Operadores: `igual`, `diferente`, `maior_que`,
`menor_que`, `contem`, `vazio`.

**Definir variável:**
```json
{ "id": "b_5", "tipo": "definir_variavel",
  "conteudo": { "operacao": "somar", "valor": 3 },
  "salvar_em": "score_extra" }
```
Operações: `atribuir`, `somar`, `concatenar`.

**Webhook:**
```json
{ "id": "b_6", "tipo": "webhook",
  "conteudo": { "destino": "planilha" } }
```
Referencia uma chave de `destinos.json`. Não bloqueia a conversa: falha vai
para a fila de reenvio.

### 7.8 Variáveis e interpolação

`{{variavel}}` em qualquer campo marcado `aceita_variavel: true` é trocado
pelo valor. Variável inexistente vira string vazia, nunca `undefined` na
tela.

Sempre disponíveis: `pontuacao` e `classificacao` (com pontuação ativa).

### 7.9 Encerramento

Não há bloco de fim. O fluxo termina quando um grupo sem `proximo` acaba de
rodar seus blocos. Ao encerrar, o motor envia o resultado aos destinos de
`ao_finalizar`.

Um "fim com botão de WhatsApp" é montado como qualquer outra coisa: um
`texto` seguido de um `entrada_botoes` com uma opção que aponta para link
externo.

### 7.10 Validação do fluxo

Verificada ao carregar; erro claro no console e em tela no modo `?teste=1`:

- `inicio` aponta para grupo existente
- ids de grupo únicos; ids de bloco únicos dentro do grupo
- todo `proximo` e `entao` aponta para grupo existente
- todo grupo é alcançável a partir de `inicio`
- de todo grupo existe ao menos um caminho até um grupo terminal (ciclos
  permitidos, becos sem saída não)
- todo `tipo` existe no registro
- todo `salvar_em` de input está preenchido
- `destino` de webhook existe em `destinos.json`

## 8. O motor

### Como é montado

```js
const chat = criarChat({
  elemento: document.querySelector("#chat"),
  fluxo, tema, destinos,
  modo: "producao"   // ou "teste": não envia nada, mostra avisos
})
chat.reiniciar()
```

O motor **não é dono da página**. Ele desenha dentro do elemento que
recebe, e várias instâncias podem coexistir. Isso é o que permite:

- `player.html` montar em tela cheia para o cliente final
- o editor do sub-projeto 2 montar num painel lateral, com preview ao vivo
  e botão de reiniciar, enquanto quem monta edita o fluxo
- incorporar o chat dentro do site de um cliente, como widget

O modo `teste` roda o fluxo sem enviar nada aos destinos e exibe os avisos
de configuração em tela.

### Estado

`respostas`, `pontuacao`, `grupoAtual`, `blocoAtual`, `sessaoId`,
`historico`.

**Retomada:** estado gravado no navegador a cada grupo. Quem fecha a aba e
volta em até 24 horas retoma de onde parou. Botão de recomeçar sempre
disponível.

**Eventos:** a cada grupo exibido, envio de `sessaoId`, `grupoId` e horário
ao destino de eventos. É o que mostra onde as pessoas desistem. Sem
bloquear a conversa.

**Tema:** `tema.json` alimenta variáveis CSS; `tema.css` nunca usa cor
literal.

```json
{ "marca": "Osher",
  "logo": "logo.png",
  "cores": { "fundo": "#0C2340", "superficie": "#1F3140",
             "acento": "#BF9C5A", "texto": "#EEF1F5" },
  "fonte": "Georgia, 'Gelasio', serif" }
```

## 9. Destinos

```json
{ "destinos": {
    "planilha": { "tipo": "apps_script", "url": "https://script.google.com/..." },
    "crm":      { "tipo": "webhook", "url": "", "ativo": false } },
  "ao_finalizar": ["planilha"],
  "eventos": "planilha" }
```

Tipos: `apps_script` e `webhook`, ambos POST com JSON. Destino inativo ou
sem URL é ignorado sem erro.

**Fila e reenvio:** envio que falha entra numa fila no navegador, com
espera crescente (2s, 8s, 30s), máximo 3 tentativas. Reprocessada quando a
pessoa volta.

**Sem destino configurado:** diferente do estado atual, isso **não** passa
em silêncio — aviso no console sempre, e faixa visível com `?teste=1`.

**Segurança:** nenhuma credencial em arquivo de cliente. Só URL pública de
webhook. Integração que exija chave fica atrás do Apps Script ou do Make,
nunca no navegador.

### Integrações são presets sobre webhook

O Typebot lista 28 integrações. A maioria — Sheets, Zapier, Make, Pabbly,
Segment, Posthog, Zendesk, HTTP request — é um POST para uma URL. O que
muda entre elas é a interface: campos pré-preenchidos, nome e ícone.

Portanto o chatflow **não implementa integrações uma a uma**. Implementa um
bloco `webhook` sólido, e cada integração nomeada é um arquivo de preset
no registro de tipos, declarando os campos que aquele serviço espera. É o
mesmo mecanismo que gera o painel de propriedades no editor.

**Exceção: os modelos de IA** (OpenAI, Anthropic, Mistral, Groq, DeepSeek,
Perplexity, Together, OpenRouter). Todos exigem chave de API, que não pode
existir no navegador — qualquer visitante lê o código-fonte. Só são
viáveis com servidor intermediando, junto com os canais assíncronos. Fora
dos sub-projetos 1 e 2.

## 10. Testes

`percurso.js` é lógica pura, sem DOM: recebe fluxo e respostas, devolve o
caminho percorrido e a pontuação. Testado com `node --test`, sem
dependência externa. Escritos antes do código.

1. Grupo com vários blocos executa todos na ordem
2. Grupo sem `proximo` encerra o fluxo
3. Opção de botões com `proximo` desvia; sem `proximo` cai no do grupo
4. Condição por pontuação desvia
5. Condição por variável desvia
6. Nenhuma regra verdadeira segue o `proximo` do grupo
7. Pontuação soma só o que a opção declara
8. Pontuação desativada ignora `pontos` e não gera classificação
9. Interpolação troca variável e não vaza `undefined`
10. Classificação bate nos limites (4, 5, 8, 9)
11. `proximo` órfão é rejeitado com mensagem clara
12. Grupo inalcançável é rejeitado
13. Beco sem saída é rejeitado; ciclo com saída é aceito
14. Tipo desconhecido é rejeitado
15. Validação de e-mail e telefone rejeita entrada inválida

Ponta a ponta, manual e verificado: completar o fluxo no navegador e
**confirmar a linha na planilha**. Não é dado como concluído sem isso.

## 11. O fluxo da Osher

Vive em `clientes/osher/`, montado só com blocos do catálogo. Correções
sobre o atual:

- Pergunta que dava 3 pontos para toda resposta: removida
- "Faixa de **investimento**": reescrita — palavra proibida em
  `_memoria/preferencias.md`, e consórcio não é aplicação financeira
- Typo "iteresse" e placeholder "Ex.: e-commerce": corrigidos
- Emoji removido da abertura, conforme tom registrado
- Faixa por valor do bem, não por parcela
- E-mail deixa de ser perguntado
- Encerramento antecipado para quem está só pesquisando

## 12. Dependências e pendências

| Item | Responsável | Bloqueia |
|---|---|---|
| Publicar o Apps Script e obter a URL | Gustavo | Teste de ponta a ponta |
| Confirmar faixas de valor do bem | Gustavo | Fluxo da Osher |
| Bubble de texto aceita negrito, itálico e link? | Gustavo | Campo simples ou editor com formatação |
| Blocos de Logic e Integrations do Typebot | Gustavo | Completar o catálogo (não bloqueia o v1) |
| Para qual WhatsApp vai o lead quente | Gustavo | Fluxo da Osher |
| Nome do CRM e ligação com a planilha | Gustavo | Sub-projeto 4 |
| Onde o player será hospedado | Gustavo | Publicação |

Nenhuma impede começar a implementação.

## 13. Registro

- **2026-08-27** — Revisão 1: motor separado do fluxo, formato para edição
  manual, fluxo de consórcio.
- **2026-08-27** — Revisão 2: reposicionado como produto genérico com
  editor visual. Grupos, fala separada de captura, bloco `fim` eliminado,
  catálogo extensível, pontuação opcional. Baseado nas telas do Typebot
  enviadas pelo Gustavo.
