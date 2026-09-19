---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-research"
title: "Research & RAG: {{FEATURE_NAME}}"
type: "research"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/research.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/kpis.md"
conflict_check:
  has_conflicts: false
  conflicts_description: []
lifecycle:
  stage: "research"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/kpis.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
  feedback_loops:
    on_conflict: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/ideacao.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../index.md) / [{{FEATURE_NAME}}](file://./index.md) / **Research**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Pesquisa & Análise de Viabilidade: {{FEATURE_NAME}}

## 1. Alinhamento com o Dicionário Ubíquo
* **Termos Validados:** `[Termo 1]`, `[Termo 2]` (alinhados com `project/index.md`)
* **Novos Termos Sugeridos:** `[Novo Termo]` (a ser submetido para inclusão oficial)

---

## 2. Componentes e Entidades Reutilizáveis
* **Entidades Existentes Reutilizadas:** `[Caminho/Nome da Entidade]`
* **Value Objects Reutilizados:** `[Caminho/Nome do Value Object]`

---

## 3. Avaliação de Conflitos e Invariantes
* **Conflitos Detectados:** Nenhum / [Descrição de potenciais sobreposições de escopo]
* **Violação de Regras de Domínio:** [Avaliação do impacto em outras áreas]

---

### Navegação da Esteira

* **Etapa Anterior:** [02 - KPIs & Invariantes](file://./kpis.md)
* **Próxima Etapa:** [04 - Definição Técnica (Feature Definition)](file://./feature-definition.md)
* **Feedback Loop:** Em caso de violação de regras de negócio, [retornar para Ideação](file://./ideacao.md).
