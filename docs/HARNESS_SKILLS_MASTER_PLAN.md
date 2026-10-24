# 🚀 Plano Mestre: AI Agent Harness, Skills Hub (Padrão ECC) & Living Specs

> **Documento de Governança e Rastreamento Contínuo**  
> *Este arquivo serve como a fonte única de verdade (Single Source of Truth) para a evolução arquitetural do projeto. Cada fase é executada, testada, documentada e marcada com status atualizado aqui antes de avançar para a próxima etapa.*

---

## 📌 Status Geral de Execução

| Fase | Título | Status | Dependências |
| :--- | :--- | :---: | :--- |
| **Fase 1** | Curadoria & Mapeamento do ECC-main e Formato de Skills | 🟢 **Concluído** | Nenhuma |
| **Fase 2** | Backend Core: Tool Registry & Motor Híbrido (`AIService`) | 🟢 **Concluído** | Fase 1 |
| **Fase 3** | Package Manager de Skills (`SkillsService` & Hub ECC) | 🟢 **Concluído** | Fase 2 |
| **Fase 4** | Indexador Híbrido de Grafo & Conexões (`docs-metadata`) | 🟢 **Concluído** | Fase 2, 3 |
| **Fase 5** | Frontend: Hub de Skills, Seletor RAW/Skill & Timeline | 🟢 **Concluído** | Fase 3, 4 |
| **Fase 6** | Testes de Regressão, Validação E2E & Conexão de Engenharia | 🟢 **Concluído** | Fase 5 |

*Legenda: ⚪ Não Iniciado | 🟡 Em Andamento / Planejamento | 🟢 Concluído / Validado | 🔴 Bloqueado*

---

## 🛡️ Princípios Invariantes (Não-Negociáveis)

1. **Retrocompatibilidade Absoluta (Zero Regressão):**
   * O **Modo RAW** de chamada direta à LLM permanece intacto.
   * O sistema de **Memória (`.spec-memory`)**, handoffs (`handoffs/latest.md`), sessões e contagem de toques/tokens devem continuar funcionando sem alterações quebrantes.
   * Prompts existentes de templates são preservados como arquétipos ou convertidos em instruções base de skills.

2. **Modelo de Dois Níveis (Padrão Templates e ECC):**
   * **Global / Hub ECC:** Catálogo de referência (`ECC-main`) com Skills, Instincts e Rules de mercado.
   * **Local / Projeto:** O usuário escolhe quais skills instalar em `projects/<repo>/.skills/`. Cada projeto é autônomo no Git.

3. **Segurança e Human-in-the-Loop:**
   * O agente roda restrito ao diretório do projeto ativo (`projects/<repoName>`).
   * Toda alteração sugerida pela IA em arquivos é apresentada como **proposta de diff** para aprovação do usuário antes de commitar ou gravar.

---

## 📋 Detalhamento das Fases de Implementação

---

### 🔹 FASE 1: Curadoria do ECC-main & Definição do Formato de Skills
**Objetivo:** Extrair e padronizar o primeiro conjunto de Skills, Instincts e Rules a partir do diretório `ECC-main`, sem alterar o código de produção.

- [x] **1.1** Analisar a pasta `ECC-main/` e mapear as categorias mais relevantes para documentação viva e governança:
  - `consistency-auditor`: Validação de termos do Dicionário Ubíquo e integridade de links no Grafo.
  - `spec-architect`: Criação e refinamento estruturado de especificações técnicas / ADRs.
  - `code-sync`: Verificação de alinhamento entre documentação (`/docs`) e código-fonte (`/src`).
- [x] **1.2** Definir o schema formal do arquivo `SKILL.md` (frontmatter YAML com nome, versão, descrição, tools necessárias e templates sugeridos) em `server/src/modules/skills/skills.types.ts`.
- [x] **1.3** Criar o diretório de sementes globais do Hub: `server/src/modules/skills/seeds/seeds.data.ts` contendo as skills catalogadas prontas para instalação.

---

### 🔹 FASE 2: Backend Core — Tool Registry & Motor Híbrido (`AIService`)
**Objetivo:** Implementar o catálogo de ferramentas nativas e capacitar o `AIService` a rodar chamadas com tools em loop (ReAct), mantendo o modo direto intacto.

- [x] **2.1** Criar `server/src/modules/ai/tools/tool.types.ts` e `ToolRegistry.ts`.
- [x] **2.2** Encapsular as capacidades existentes do projeto como **Tools Seguras**:
  - `docs_get_graph`: Consulta dependências e links de documentos (`docs-metadata.service.ts`).
  - `dictionary_validate_terms`: Validação contra a linguagem ubíqua (`dictionary.service.ts`).
  - `docs_read_file` e `docs_propose_diff`: Leitura e geração de propostas de alteração no workspace.
  - `memory_get_handoff`: Integração nativa com `.spec-memory`.
  - `templates_get_template`: Leitura e resolução de templates.
- [x] **2.3** Evoluir `AIService.callLLM` para suportar modo híbrido:
  - Se a requisição for modo direto (RAW): executa exatamente como hoje.
  - Se for modo agente com tools: executa o loop de chamadas (ReAct / Tool Calling) multi-provider (Gemini, OpenAI, Anthropic) até a resolução da tarefa.
- [x] **2.4** Garantir que eventos de chat, toques e sessões sejam registrados igualmente em ambos os modos.

---

### 🔹 FASE 3: Package Manager de Skills (`SkillsService`)
**Objetivo:** Criar a gestão de instalação, atualização e desinstalação de skills nos repositórios locais.

- [x] **3.1** Criar `server/src/modules/skills/skills.service.ts` e `skills.routes.ts`.
- [x] **3.2** Implementar endpoints de gerenciamento:
  - `GET /api/skills/hub`: Lista o catálogo global disponível para instalação.
  - `GET /api/skills/project`: Lista as skills instaladas em `projects/<repo>/.skills/`.
  - `POST /api/skills/install`: Copia a skill do Hub para o projeto e atualiza `.skills.manifest.json`.
  - `DELETE /api/skills/uninstall/:id`: Remove a skill do projeto.
  - `PUT /api/skills/project/:id`: Permite customização local (Fork) da skill.
- [x] **3.3** Integrar com o carregador de contexto do `AIService` para injetar as instruções da skill ativa e suas tools no prompt do sistema quando `skill_id` for informado.

---

### 🔹 FASE 4: Indexador Híbrido de Grafo & Conexões Semânticas
**Objetivo:** Automatizar a injeção do Grafo de Documentos e regras de coerência no contexto da IA.

- [x] **4.1** Expandir `docs-metadata.service.ts` para prover resolução de vizinhança de grafo (1º e 2º graus de dependência de cada documento).
- [x] **4.2** Criar resolvedor de contexto semântico: quando um documento for aberto no editor, montar o briefing com:
  - O documento atual.
  - Documentos diretamente conectados via links markdown.
  - Termos do Dicionário Ubíquo pertinentes ao conteúdo.
  - Último handoff de `.spec-memory`.
- [x] **4.3** Expor endpoint `GET /api/workspace/context-bundle` para consumo pelo frontend e agentes.

---

### 🔹 FASE 5: Interface do Usuário (Frontend)
**Objetivo:** Fornecer aos usuários controle visual total sobre as Skills, modo RAW e ações do agente.

- [x] **5.1** Criar a tela/modal **Hub de Skills** (Marketplace) no frontend (`SkillsHubModal.tsx`):
  - Visualizar catálogo, pesquisar por categorias, ler documentação da skill, ver ferramentas vinculadas e botão "Instalar no Projeto".
- [x] **5.2** Adicionar seletor no Editor / Chat (`AICopilotPanel.tsx`):
  - Alternador entre **Modo RAW (Direto)** e **Skill Ativa** (ex: *Governança de Docs*, *Auditor de Coerência*, etc.).
- [x] **5.3** Renderizar a **Timeline de Ações do Agente (Tools)** nas mensagens do assistente exibindo as ferramentas executadas e status.
- [x] **5.4** Criar caixa de **Revisão de Diffs**: O usuário visualiza o rationale da alteração proposta e aplica com 1 clique no documento.

---

### 🔹 FASE 6: Validação E2E & Conexão de Engenharia
**Objetivo:** Homologar o fluxo completo, testar retrocompatibilidade e exportar contexto para desenvolvedores.

- [x] **6.1** Validar compilação e tipagem TypeScript tanto no Backend (`server/`) quanto no Frontend (`frontend/`).
- [x] **6.2** Preservação verificada do modo RAW, toques/sessões e persistência de `.spec-memory`.
- [x] **6.3** Documentar o Plano Mestre e endpoints prontos para conexão de agentes externos (Cursor, Claude Code, etc.).

---

## 📝 Registro de Decisões de Arquitetura (ADRs) & Changelog

* **2026-09-26:** Conclusão da **Fase 5 e Fase 6** (Componente `SkillsHubModal`, barra de modo RAW/Skill no Copilot, timeline de ferramentas nas mensagens, revisor de propostas de diffs e compilação E2E aprovada com 0 erros).
* **2026-09-26:** Conclusão da **Fase 4** (Resolução de vizinhança de 1º e 2º graus de grafo em `docs-metadata.service.ts`, empacotador de context bundle e endpoint `GET /api/workspace/context-bundle`).
* **2026-09-26:** Conclusão da **Fase 3** (Implementação do `SkillsService`, manifesto `.skills.manifest.json`, rotas REST de Hub e Projeto, e injeção automática de skills e tools na rota `/api/chat`).
* **2026-09-26:** Conclusão da **Fase 2** (Implementação do `ToolRegistry`, ferramentas nativas com sandboxing de repositório, evolução do `AIService` com loop de tools multi-provider e integração com a rota `/api/chat` preservando o modo direto/RAW e `.spec-memory`).
* **2026-09-25:** Conclusão da **Fase 1** (Curadoria do ECC-main, tipos formais `skills.types.ts` e catálogo semente `seeds.data.ts` com as 5 primeiras skills essenciais: *living-docs-governance*, *architecture-decision-records*, *consistency-auditor*, *contract-first-api* e *context-memory-guard*).
* **2026-09-25:** Criação do Plano Mestre de Evolução Arquitetural. Decisão de manter 100% de retrocompatibilidade com o Modo RAW e o sistema `.spec-memory`, adotando a estrutura de catálogo de dois níveis inspirada no `ECC-main`.
