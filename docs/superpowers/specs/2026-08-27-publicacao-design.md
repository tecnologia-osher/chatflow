# Publicação do chatflow — desenho

**Data:** 2026-08-27
**Escopo:** colocar o chat no ar. Não é sub-projeto; é uma tarefa de operação.

## Por que

O sub-projeto 1 entregou um chat que funciona e não é alcançável: roda em
`localhost:8080`. Nenhum cliente da Osher consegue chegar nele, e a aba de
funil não tem dado nenhum além do teste do Gustavo. Publicar transforma o
sub-projeto 1 de artefato em ferramenta, e produz o dado que vai informar o
desenho do sub-projeto 2.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Alcance | Página própria, independente do site | Escolha do Gustavo. O site da Osher não existe ainda; quando existir terá o próprio formulário de contato. Dois funis, decisão consciente. |
| Código-fonte | Público | Escolha do Gustavo. Libera GitHub Pages gratuito. Trade-off aceito: qualquer um pode ler e copiar o produto. |
| Host | GitHub Pages, servindo a raiz de `main` | Serve arquivo estático como está. Sem build, coerente com a restrição do projeto. |
| Endereço | `<usuario>.github.io/chatflow/?cliente=osher` | Domínio próprio adiado de propósito, ver abaixo. |
| Raiz | `index.html` que redireciona preservando a query | Encurta o link e evita 404 na raiz. Dez linhas, sem lógica. |

## O domínio próprio, e por que foi adiado

Um repositório é um site do Pages, e um site tem uma raiz. Um domínio
apontado (`chat.oshersolucoes.com.br`) cai na raiz — que é do produto
genérico, não da Osher. Fazer a raiz ser da Osher quebraria a separação
produto/cliente que o sub-projeto 1 inteiro existiu para estabelecer.

A saída, quando o domínio entrar, é um repositório separado só do deploy da
Osher, consumindo o motor. É um passo pequeno e futuro. Inventar essa
estrutura hoje seria resolver um problema que ainda não existe.

## O que muda de natureza ao publicar

**O destino fica exposto.** A URL do Apps Script vive em `destinos.json`, que
o navegador de qualquer visitante baixa. Quem a descobrir pode enviar linhas
falsas para a aba `Chatflow`.

Pior caso é lixo na planilha, não vazamento: o script só escreve, nunca lê, e
a planilha continua privada. Aceitável para um cliente de volume baixo, e é
exatamente o que o sub-projeto 3 resolve. Registrado no `README.md` como
limitação conhecida, para não virar surpresa.

**O histórico fica exposto.** Os 45 commits carregam o e-mail pessoal do
Gustavo. Reescrever mudaria todos os SHAs, vários citados no `CLAUDE.md` e no
registro de decisões — custo maior que o problema. Decisão: aceitar o
histórico como está e ajustar a identidade dos commits futuros.

## Critério de aceitação

- A URL pública abre o chat da Osher, com o tema dela
- Completar o fluxo quente produz uma linha nova na aba `Chatflow` da planilha
- `&teste=1` continua não enviando nada
- O `npm test` não muda: nada aqui altera lógica

## Fora de escopo

- Domínio próprio (ver acima)
- Widget embutido em site (não há site)
- Analytics de página, robots.txt, SEO — o chat é destino de link, não
  conteúdo a ser encontrado por busca
