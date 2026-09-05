---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-kpis"
title: "KPIs & Invariantes: {{FEATURE_NAME}}"
type: "kpis"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/kpis.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/ideacao.md"
lifecycle:
  stage: "kpis"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/ideacao.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/research.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../index.md) / [{{FEATURE_NAME}}](file://./index.md) / **KPIs**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# KPIs e Invariantes: {{FEATURE_NAME}}

## 1. Métricas de Sucesso

### A. Indicadores Antecipadores (Leading Indicators)
* **[Nome da Métrica 1]:** Meta: [Ex: Taxa de adoção > 80% nos primeiros 15 dias]
* **[Nome da Métrica 2]:** Meta: [Ex: Latência p95 < 500ms]

### B. Indicadores de Resultado (Lagging Indicators)
* **[Nome da Métrica 1]:** Meta: [Ex: Redução de 30% em custos operacionais]
* **[Nome da Métrica 2]:** Meta: [Ex: Aumento de 15% na retenção de usuários]

---

## 2. Invariantes de Negócio (Regras Imutáveis)
1. **[Invariante 1]:** [Regra imutável de estado que o sistema jamais deve violar]
2. **[Invariante 2]:** [Exigência estrita de integridade ou idempotência]

---

### Navegação da Esteira

* **Etapa Anterior:** [01 - Ideação](file://./ideacao.md)
* **Próxima Etapa:** [03 - Pesquisa e RAG](file://./research.md)
