# Plano Arquitetural: Criptografia Transparente no Git, Gestão de Chaves Zero-API e Análise Crítica

> [!TIP]
> **Documento de Referência Arquitetural Permanente**
> Este documento serve como especificação e guia de referência para todas as etapas de implementação da criptografia transparente, descentralizada e compatível com IA no Context OS.

---

## 1. Visão Geral do Ciclo de Vida Transparente

```mermaid
flowchart TD
    subgraph "Repositório Remoto (GitHub / Servidor)"
        RemoteEnc["finance/dre.md.enc<br/>(Apenas Cifrado - Zero Plaintext)"]
        RemotePublic["docs/public/guia.md<br/>(Público - Markdown Normal)"]
        RemoteKeymap[".keymap.json<br/>(Chaves Públicas & DEKs Cifrados)"]
    end

    subgraph "Context OS / Git Hooks (Camada de Sincronização Local)"
        PullAction["git pull / checkout"]
        VaultDecrypt["Vault Engine:<br/>1. Abre Private Key no OS Keychain<br/>2. Desbloqueia DEKs autorizados<br/>3. Checa Cache SHA-256"]
        PushAction["git commit & push"]
        VaultEncrypt["Vault Engine:<br/>1. Detecta modificados por hash<br/>2. Criptografa para .enc<br/>3. Limpa working tree se necessário"]
        MergeDriver["Plaintext 3-Way Merge Driver:<br/>Ancestor + Ours + Theirs em Plaintext"]
    end

    subgraph "Área de Trabalho Local (Working Tree)"
        LocalPlain["finance/dre.md<br/>(Texto Plano no .gitignore)"]
        LocalPublic["docs/public/guia.md<br/>(Markdown Normal)"]
        LocalRestricted["legal/contrato.md.enc<br/>(Sem chave -> Não criado localmente)"]
        LocalCache[".git/context-vault-cache.json<br/>(Hashes & Timestamps)"]
    end

    subgraph "Ferramentas Locais (Transparência Total)"
        AI["IAs Locais (Copilot, Cursor, Antigravity)"]
        RAG["Indexador RAG do Context OS"]
        Editor["Notion Editor / VS Code / Obsidian"]
    end

    RemoteEnc -->|1. Pull| PullAction
    RemoteKeymap -->|1. Pull| PullAction
    PullAction --> VaultDecrypt
    VaultDecrypt -->|2. Descriptografa autorizados| LocalPlain
    VaultDecrypt -->|2. Omissão se não autorizado| LocalRestricted
    VaultDecrypt -.->|Atualiza| LocalCache

    LocalPlain <-->|3. Leitura e Edição em Texto Puro| AI
    LocalPlain <-->|3. Indexação Direta| RAG
    LocalPlain <-->|3. Edição Direta| Editor

    Editor -->|4. Salva alterações| LocalPlain
    LocalPlain -->|5. Commit & Push| PushAction
    PushAction --> VaultEncrypt
    LocalCache -.->|Compara Hashes| VaultEncrypt
    VaultEncrypt -->|6. Apenas modificados| RemoteEnc

    PullAction -.->|Se houver conflito| MergeDriver
    MergeDriver -.->|Gera merge limpo| LocalPlain
```

---

## 2. Decisões Arquiteturais Aprovadas

1. **Documentos Públicos (`security_level: 999`)**: Ficam 100% em Markdown puro (`.md`), versionados abertamente no Git sem nenhuma criptografia.
2. **Documentos Confidenciais (`security_level < 999`)**: Adotam o formato `arquivo.md.enc` no repositório Git e `arquivo.md` no disco local do usuário (ignorado via `.gitignore`).
3. **Arquivos Não Autorizados no Disco Local**: Simplesmente **não são gerados** na máquina do usuário sem permissão, mantendo a árvore de pastas limpa.
4. **Resolução de Conflitos**: Quando houver colisão de linhas no mesmo arquivo cifrado, o Context OS abre o **Modal de Conflito Visual** do Notion Editor para o usuário resolver visualmente antes do commit.
5. **Suporte a Pipelines de Deploy (CI/CD)**: Mecanismo de exportação de chaves em variáveis de ambiente (`CONTEXT_VAULT_DEPLOY_KEY`) para GitHub Actions / Vercel descriptografarem a documentação no momento do build.

---

## 3. Gestão Descentralizada de Chaves (Zero-API)

- **Chave Privada X25519 do Usuário**: Gerada uma única vez e guardada no **OS Keychain** via `VaultService`. Nunca vai para o Git.
- **Chave Pública X25519 do Usuário**: Registrada no `.keymap.json` do repositório.
- **DEKs de Compartimento (AES-256-GCM)**: Uma DEK por departamento/nível (ex: `finance`, `engineering`).
- **Slots no `.keymap.json`**: Cifrados pelo Administrador com a chave pública do membro autorizado:
  $$\text{Slot}_{u, d} = \text{Encrypt}_{PK_u}(\text{DEK}_d)$$
- **Cache Local (`.git/context-vault-cache.json`)**: Mantém hashes SHA-256 e mtimes para garantir processamento incremental sub-segundo ($< 10$ms).

---

## 4. Fases de Implementação

- **Fase 1: Motor Criptográfico Assimétrico & Reconciliação (Core Crypto)**
- **Fase 2: Script Autônomo e Motor de Cofre (`.scripts/vault-sync.cjs` e `vault-engine.service.ts`)**
- **Fase 3: Integração com Git Service & Governança (`git.service.ts` e `governance.service.ts`)**
- **Fase 4: Resolução Visual de Conflitos & Integração Frontend (`SecurityContext.tsx` e UI)**
- **Fase 5: Testes Automatizados, Validação de Ponta a Ponta & Walkthrough**
