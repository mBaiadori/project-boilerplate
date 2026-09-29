# Diretrizes Obrigatórias do Workspace para Agentes de IA (Context OS)

Este repositório possui regras estritas de arquitetura e design que devem ser rigorosamente seguidas por qualquer agente de IA.

---

## 1. Regra de Taxonomias Dinâmicas & Cores do `.project.config.json`
- **NUNCA crie listas estáticas no código**: Tags, categorias, status de governança e badges/tipos de documento já estão definidos no `.project.config.json` de cada projeto/workspace.
- **Leitura Dinâmica**: Sempre consuma os dados via `WorkspaceContext` (`projectMetaOptions`, `projectConfig`, `loadProjectConfig()`) ou endpoints de configuração do projeto.
- **Uso Obrigatório das Cores**: As cores configuradas em cada item (`color`) no `.project.config.json` **DEVEM ser aplicadas nas chips, badges, tags e pílulas visuais** (ex: `backgroundColor: color + '15'`, `borderColor: color + '40'`, `color: color`). Nunca use estilização neutra cinza genérica quando houver cor configurada.

---

## 2. Design System & Tokens
- Respeite as diretrizes de Material Design 3 e tokens CSS em `design-tokens.css` e `dashboard.css`.
- Nunca use valores hexadecimais soltos sem propósito ou classes Tailwind isoladas em modo escuro que quebrem a harmonia com o tema ativo.
- Use sempre ícones do Google Material Symbols via `<span className="material-symbols-outlined">...</span>` ou Lucide Icons quando padronizado no componente, evitando emojis do sistema operacional.
