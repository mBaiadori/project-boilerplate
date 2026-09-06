---
description: Regra Arquitetural Obrigatória — Proibição Total de Dados Hardcoded em Telas e Componentes de UI
globs: ui/**/*, server.py, projects/**/*
---

# Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica

Esta regra estabelece o padrão obrigatório para estruturação, sugestão, edição e persistência de dados em toda a aplicação Context OS / Agentic SDLC.

---

## 1. Princípio Fundamental (Zero Hardcoding)

**Nunca introduza listas estáticas, catálogos, opções de seleção (dropdowns), templates ou taxonomias fixas diretamente no código de frontend (`ui/js/`, `ui/html`).**

Todos os dados de domínio, camadas arquiteturais, níveis de criticidade/importância, badges, templates e workflows devem ser:
1. Definidos no arquivo de configuração raiz de schemas: `projects/project.config.json` (ou `projects_config.json`).
2. Servidos dinamicamente pelos endpoints do backend (`server.py`, ex: `/api/projects/config`).
3. Consumidos e renderizados dinamicamente pelo frontend (`API.getProjectConfig()`).
4. Salvos e versionados no arquivo de configuração do projeto individual (`project/project.config.json`).

---

## 2. Padrão Universal: Sugestão $\rightarrow$ Customização $\rightarrow$ Persistência

Sempre que a interface apresentar itens configuráveis (ex: Domínios, Subdomínios, Camadas de Arquitetura, Níveis de Criticidade, Workflows):

1. **Sugestões Oferecidas pelo Framework**:
   - Vêm do catálogo mestre (`suggested_domains`, `suggested_layers`, `suggested_importance_levels`, etc.).
   - São exibidas em áreas de sugestão expansíveis/colapsáveis ou como opções iniciais.
2. **Edição Livre & Customização**:
   - O usuário pode adicionar novas opções personalizadas que não existiam no catálogo mestre.
   - Os componentes de renderização (como `<select>`) **nunca devem descartar opções customizadas**: se um valor já salvo não constar na lista de sugestões, ele deve ser injetado dinamicamente no componente para preservar a integridade dos dados.
3. **Persistência Completa**:
   - Todas as escolhas, modificações e novas criações são salvas no `project/project.config.json` do repositório ativo e registradas no staging do workspace.

---

## 3. Checklist de Implementação de Novos Campos / Listas

Ao criar ou estender qualquer nova aba, modal ou formulário:
- [ ] O schema e as sugestões padrão foram adicionados em `projects/project.config.json`?
- [ ] O endpoint correspondente em `server.py` (`get_project_config` ou similar) expõe a chave de sugestões?
- [ ] O JavaScript da UI obtém a lista via API em tempo de execução?
- [ ] Caso o usuário informe um valor customizado, a UI o preserva sem sobrescrever com o padrão?
- [ ] Foi criado teste unitário em `tests/` validando o carregamento dinâmico e a persistência?

---

## 4. Validação de Identificadores (Slugs) & Prevenção de Conflitos

Para todos os identificadores de Domínios (`#dominio`) e Subdomínios (`#dominio/subdominio`):
1. **Formato Padrão (`kebab-case`)**: Devem conter apenas caracteres alfanuméricos minúsculos e hífens (`^[a-z0-9]+(-[a-z0-9]+)*$`), sem acentos ou caracteres especiais.
2. **Nomespacing Hierárquico de Subdomínios**:
   - Subdomínios devem ser sempre referenciados com o prefixo de seu domínio pai (ex: `#financeiro/faturamento`, `#engenharia/backend`), refletindo sua hierarquia física de diretórios (`domains/<dominio>/<subdominio>/index.md`).
3. **Unicidade e Prevenção de Conflitos**:
   - Domínios e subdomínios não podem ter slugs conflitantes.
   - O frontend e o backend aplicam validação em tempo real e resolução automática de conflitos (sufixos `-2`, `-3`), informando o usuário visualmente sobre a validade do slug.

---

## 5. Padrão Global de Ícones & Componente `IconPicker`

- Toda seleção de ícones na interface do software deve utilizar o componente padrão [`IconPicker`](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/ui/js/components/icon-picker.js) (`window.IconPicker`).
- O seletor oferece busca em tempo real e categorização temática de Google Material Symbols (Negócios & Finanças, Engenharia, Governança, Operações, Marketing, Arquitetura, Qualidade & QA).
