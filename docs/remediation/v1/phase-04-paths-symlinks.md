# Fase 4 — Caminhos e symlinks (N4)

**Objetivo:** nenhuma leitura/escrita de arquivo do projeto sai do diretório do repositório, mesmo via symlink.
**Resolve:** N4.
**Esforço:** pequeno. **Pré-requisitos:** Fase 0 (pode rodar em paralelo às fases 5 e 6).

## Passos

### 4.1 RED — `repo-ref.symlink.test.ts`
Criar `tmp/projects/repo` e `tmp/secret.txt`, e:
- Symlink `repo/docs -> ../..` e `repo/leak.md -> ../secret.txt`.
- `isPathInside(repo, repo/leak.md)` deve retornar **false** (hoje retorna true).
- Escrita em `repo/docs/novo.md` (via symlink de diretório) deve ser recusada.
- Repo irmão `repo-evil` (regressão do bug de prefixo).
- Arquivo ainda inexistente dentro de pasta normal continua permitido.
**Verifica:** falha hoje.

### 4.2 Implementação
Em `utils/repo-ref.ts`:
- `resolveReal(p)`: `fs.realpathSync` do caminho ou, se não existir, do ancestral existente mais próximo + o resto.
- `isPathInside` e `assertPathInside` comparam **caminhos reais** com `path.sep`.
- Versão assíncrona opcional para rotas quentes.

### 4.3 Uso consistente
Trocar as verificações ad hoc por `assertPathInside` em: `workspace.service.ts` (save, import, move, delete, open), `native-tools.ts`, `custom-tools.service.ts`/runner, rotas de arquivos/`rag`/`wiki`. Procurar com `grep -rn "path.resolve(" server/src` onde há entrada externa.
Guard (Fase 0): número de usos diretos de `fs.readFileSync/writeFileSync` com caminho vindo de requisição sem `assertPathInside` não pode subir.

### 4.4 Defesa na clonagem
Ao clonar/puxar, listar symlinks cujo alvo real sai do repo e registrar aviso na UI/log (não bloqueia o clone, mas as operações ficam bloqueadas pelo guard).

## Gate de saída
- [ ] `repo-ref.symlink.test.ts` verde.
- [ ] `npm run verify` verde.
- [ ] Manual: criar symlink `docs/x -> ~` num repo local e tentar abrir/salvar via a app → erro claro, nada fora do repo é tocado.
