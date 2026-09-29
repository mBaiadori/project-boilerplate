---
description: Regra Obrigatória — Uso Estrito de Taxonomias (Tags, Categorias, Status, Badges) e Cores do .project.config.json
globs: "{frontend/**/*,ui/**/*,server/**/*,projects/**/*}"
---

# Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`

Esta regra é de cumprimento estrito por todos os agentes de IA e desenvolvedores neste repositório.

---

## 1. Proibição de Listas Fixas (Zero Hardcoded Taxonomies)

**NUNCA crie listas estáticas do zero ou valores fictícios/padrão no código para:**
- **Tags**
- **Categorias**
- **Status de Governança** (ex: `draft`, `proposed`, `review`, `approved`, etc.)
- **Badges / Tipos de Documento** (ex: `RFC`, `ADR`, `PRD`, `DOC`, `API`, `SPEC`, etc.)
- **Camadas Arquiteturais e Domínios**

### O que fazer:
1. **Consultar o `.project.config.json`**: Todos os valores autorizados residem no arquivo `.project.config.json` do repositório/workspace ativo.
2. **Frontend React / TypeScript**:
   - Consumir via `useWorkspace()` através de `projectMetaOptions`, `projectConfig` ou `loadProjectConfig()`.
   - Seletor / Dropdown / Autocomplete deve renderizar dinamicamente os itens cadastrados no projeto ativo.
   - Em caso de valor customizado existente no documento que não conste na lista, preserve-o dinamicamente sem descartar.

---

## 2. Uso Obrigatório das Cores Configuradas nas Chips / Badges

As cores associadas a cada tag, categoria, status e badge no `.project.config.json` existem para garantir identificação visual imediata e coerência de governança em todo o sistema.

### Regras Visuais para Chips / Badges:
1. **Cor do Item (`item.color`)**:
   - Todo chip ou badge que representa um **Status**, **Categoria**, **Tag** ou **Badge/Tipo** DEVE utilizar a cor configurada no objeto (`color: string`).
2. **Estilização Padrão de Chip com Cor Dinâmica**:
   - Fundo translúcido derivado da cor ou `color + '18'` / `rgba(...)`.
   - Borda sutil com a cor `color + '40'`.
   - Texto ou ponto indicador com a cor `color` (ou contraste adequado).
   - Exemplo de estilo inline ou utilitário:
     ```tsx
     <span
       className="badge"
       style={{
         backgroundColor: `${item.color}15`,
         borderColor: `${item.color}40`,
         color: item.color,
         fontWeight: 600,
       }}
     >
       {item.name}
     </span>
     ```
3. **Não usar cores neutras genéricas ou classes genéricas cinzas** quando o item possuir uma cor definida no `.project.config.json`.

---

## 3. Checklist Obrigatório para Agentes & PRs

Antes de concluir qualquer tarefa que envolva formulários, editores, modais (ex: Scaffold, Frontmatter, Templates, PRs, Revisões, Settings):
- [ ] As opções de tags/categorias/status/badges são obtidas de `projectConfig` / `projectMetaOptions` / `.project.config.json`?
- [ ] Não há arrays estáticos substitutos recriando dados existentes?
- [ ] As chips/badges renderizadas utilizam a propriedade `color` associada ao item no `.project.config.json`?
