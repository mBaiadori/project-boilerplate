## Descrição das Alterações

<!-- Descreva de forma concisa e objetiva o que este PR altera e por quê. -->

## Checklist de Qualidade e Segurança (Remediação v3)

- [ ] **RED Test escrito**: O PR adicionou testes que comprovam o problema antes da correção.
- [ ] **GREEN Implementation**: A implementação resolveu os testes sem efeitos colaterais.
- [ ] **Static Guards**: `node scripts/guards.mjs` executou e passou sem aumentar o baseline.
- [ ] **Sem regressões de tipo**: `tsc` do servidor e do frontend passaram com 0 erros.
- [ ] **Sem quebras de testes**: `npm test` do servidor passou 100%.
- [ ] **Gate da Fase cumprido**: Todos os itens do gate da fase correspondente em `docs/remediation-v3/` foram atendidos.
