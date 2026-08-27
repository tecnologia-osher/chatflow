# chatflow

Motor de chat conversacional para qualificação de leads.

Um motor, N configurações: o fluxo, o tema e os destinos de cada cliente
ficam em `clientes/<nome>/`. O motor não conhece nenhum cliente.

- **Estado:** em desenho. Nada implementado ainda.
- **Spec do sub-projeto 1:** [docs/superpowers/specs/2026-08-27-chatflow-motor-design.md](docs/superpowers/specs/2026-08-27-chatflow-motor-design.md)
- **Primeiro cliente:** Osher (Brasília) — consórcio

## Limitações conhecidas

A fila de reenvio (`motor/destinos.js`) vive só na memória da instância: se um
envio falha, ele é reentregue enquanto a aba do navegador continuar aberta,
mas a fila se perde se a aba for fechada antes disso. Persistir a fila junto
com o estado da sessão fecharia essa brecha; garantir a entrega sob qualquer
falha (aba fechada, dispositivo desligado etc.) exige um servidor, que é o
sub-projeto 3.
