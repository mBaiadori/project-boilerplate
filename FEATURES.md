# Funcionalidades Atualizadas — Spec-Driven Context OS & Architecture Governance

> **Visão Geral:** Plataforma unificada de governança de especificações técnicas, memória de desenvolvimento para IA e gestão de documentação arquitetural (*Spec-Driven Development*).

---

## 1. 🔐 Autenticação e Gestão de Repositórios
* **Autenticação Flexível:**
  * Suporte a GitHub Personal Access Token (PAT) com escopos de repositórios e pull requests.
  * Suporte a modo local/offline para desenvolvimento sem dependência de internet ou Git remoto.
* **Hub de Repositórios & Workspaces:**
  * Listagem, busca e alternância rápida entre múltiplos repositórios.
  * Persistência de sessão, status de sincronização e repositório ativo.

---

## 2. 🧭 Roteamento SPA & Live Reload
* **Centralized SPA Hash Router:**
  * Roteamento por hash (`#/workspace/:repo/:subview?file=...&line=...`) com suporte a histórico nativo do browser e *deep linking* direto para arquivos, linhas de código e abas.
  * *Navigation Guards* para validação de integridade de estado e autenticação antes de cada transição.
* **Fast Refresh em Tempo Real (SSE):**
  * Servidor multithread com *Server-Sent Events* (SSE) e *file watcher* integrado para recarregar alterações de arquivos instantaneamente sem perder o estado da UI.

---

## 3. 📝 Editor Inteligente & Gestão de Documentos (`/editor` — Visão Principal)
* **Árvore de Documentos & Explorador:**
  * Navegação limpa por pastas e arquivos do repositório (`specs/`, `adrs/`, `wiki/`, `docs/`).
* **Editor WYSIWYG / Notion-style em Markdown:**
  * **Frontmatter Parser:** Edição dinâmica e visual de metadados YAML (autor, status, tags, versão, contexto).
  * **Tabelas Ricas Interativas:** Adição/remoção de colunas, ordenação, tipos de dados e edição inline.
  * **Slash Commands (`/`) & Bubble Menu:** Menu flutuante para formatação rápida de texto e blocos avançados.
  * **Draft Store Local:** Persistência automática de rascunhos no navegador para prevenir perda de dados.
* **Visual Inspector Mode (UI Inspector):**
  * Modo de inspeção visual com *overlay* CSS e seleção de seções do documento com badges para envio direto ao contexto do chat com IA.
* **Inline Diffs & Patching com IA:**
  * Visualização e aplicação de *diffs* sugeridos pela IA diretamente no corpo do documento (aceitar/rejeitar patches com um clique).

---

## 4. 🤖 Copilot de IA & Memória de Desenvolvimento
* **Modos de Assistência:**
  * **Contextual Copilot (Editor):** Focado no documento aberto, aplicando regras específicas e histórico do arquivo.
  * **Global AI Copilot:** Painel lateral redimensionável e retrátil para consultas globais de arquitetura do repositório.
* **Injeção de Contexto Estruturado:**
  * Injeção automática de termos do dicionário ubíquo, decisões (ADRs) e regras ativas no prompt do modelo.
* **Streaming de Respostas:** Respostas geradas em tempo real via SSE.
* **Gestão e Reset de Memória Granular:**
  * Painel para inspecionar, reiniciar ou ajustar a memória de contexto da IA.

---

## 5. 📖 Dicionário Ubíquo & Vocabulário Oficial (`/dictionary`)
* **Catálogo Unificado de Termos:**
  * Cadastro e padronização de termos técnicos, codenames para código-fonte e definições oficiais.
  * Registro de sinônimos e aliases.
  * Busca e exportação rápida da estrutura em JSON.

---

## 6. 📜 Wiki & Registro de Decisões Arquiteturais (ADRs) (`/wiki`)
* **Ciclo de Vida de ADRs:**
  * Criação, categorização e acompanhamento de status de decisões arquiteturais (`Proposed`, `Accepted`, `Superseded`, `Deprecated`).
* **Busca Textual e Indexação:**
  * Busca em tempo real para localização rápida de decisões e contextos históricos.

---

## 7. 🕸️ Grafo de Dependências & Relacionamentos (`/graph`)
* **Visualização Interativa de Conexões:**
  * Grafo interativo de nós conectando documentos, especificações e dependências do repositório.

---

## 8. 🛡️ Auditoria & Drift Detection (`/audit`)
* **Verificação de Conformidade:**
  * Análise de conformidade das especificações de governança e documentação.
  * Relatórios detalhados de regras violadas e pendências.

---

## 9. 📚 Templates & Boilerplates (`/templates`)
* **Biblioteca de Modelos Padronizados:**
  * Templates pré-configurados para especificações técnicas, ADRs, contratos de API e políticas.

---

## 10. 🔀 Integração Git & Pull Requests (`/prs`)
* **Governança de Pull Requests:**
  * Visualização de PRs e branches ativas no repositório.
  * Criação de PRs diretamente pela interface, com *diff viewer* unificado para revisão prévia.

---

## 11. 🎓 Tutoriais & Guias Práticos (`/tutorials`)
* **Base de Conhecimento Prático:**
  * Guias passo a passo com exemplos reais de desenvolvimento guiado por especificações.

---

## 12. ⚙️ Configurações & Personalização (`/settings`)
* **Configuração de Provedores de IA:** Gestão de chaves de API, seleção de modelos e controle de temperatura.
* **Layout e Interface:** Painéis redimensionáveis com persistência no `localStorage`.
