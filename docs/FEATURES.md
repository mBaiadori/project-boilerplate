# Funcionalidades Atualizadas — Spec-Driven Context OS

> **Visão Geral:** Plataforma unificada de engenharia de especificações técnicas, memória de desenvolvimento para IA e documentação viva de arquitetura (*Spec-Driven Development*).

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
  * Navegação limpa por pastas e arquivos do repositório (`domains/`, `templates/`, `wiki/`, `index.md`).
  * Criação rápida de estruturas completas de domínios, subdomínios e esteiras de features com scaffold em 1 clique.
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
  * Busca em tempo real para localização rápida de decisões e contextos históricos (Padrão Karpathy LLM-Wiki).

---

## 7. 📚 Templates & Boilerplates (`/templates`)
* **Biblioteca de Modelos Padronizados:**
  * Templates pré-configurados para especificações técnicas, contratos de API e modelos de domínio.
  * Assistentes de IA especialistas embutidos em cada template.

---

## 8. 🔀 Integração Git & Pull Requests (`/prs`)
* **Gestão de Pull Requests & Diffs:**
  * Visualização de PRs e branches ativas no repositório.
  * Criação de PRs diretamente pela interface, com *diff viewer* unificado para revisão prévia.

---

## 9. 🎓 Tutoriais & Guias Práticos (`/tutorials`)
* **Base de Conhecimento Prático:**
  * Guias passo a passo com exemplos reais de desenvolvimento guiado por especificações (DDD, SDD, BDD, TDD).

---

## 10. ⚙️ Configurações & Personalização (`/settings`)
* **Configuração de Provedores de IA:** Gestão de chaves de API, seleção de modelos e controle de endpoints.
* **Layout e Interface:** Painéis redimensionáveis com persistência no `localStorage`.
