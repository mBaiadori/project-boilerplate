---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-ideacao"
title: "Ideação: {{FEATURE_NAME}}"
type: "ideacao"
version: "1.0.0"
status: "draft"
risk_tier: "tier_2" # tier_1_spike | tier_2_standard | tier_3_mission_critical
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/ideacao.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/index.md"
breadcrumb:
  - { title: "Projeto", path: "project/index.md" }
  - { title: "{{DOMAIN_TITLE}}", path: "domains/{{DOMAIN_NAME}}/index.md" }
  - { title: "{{SUBDOMAIN_TITLE}}", path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/index.md" }
  - { title: "{{FEATURE_NAME}}", path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/index.md" }
lifecycle:
  stage: "ideacao"
  previous_stage: null
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/kpis.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../index.md) / [{{FEATURE_NAME}}](file://./index.md) / **Ideação**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Ideação & Necessidade: {{FEATURE_NAME}}

## 1. Contexto de Negócio & Origem da Demanda
Descrição clara da dor ou oportunidade. Informar se teve origem em métricas de produto, teste A/B, solicitação de clientes ou requisito regulatório.

---

## 2. Atores e Papéis Envolvidos
* **[Ator Principal]**: [Ação que executa ou interesse principal no fluxo]
* **[Sistema Consumidor / Dependência]**: [Impacto esperado no ecossistema]

---

## 3. Jornada do Usuário (User Flow)
1. **Início:** O ator inicia o processo através da interface ou chamada de API.
2. **Processamento:** O sistema valida as regras e efetua o processamento.
3. **Resultado:** Confirmação de conclusão e notificação aos envolvidos.

---

## 4. Critérios de Aceite Iniciais
- [ ] [Critério 1: Condição necessária de sucesso]
- [ ] [Critério 2: Tratamento do principal caso de exceção]

---

### Navegação da Esteira

* **Próxima Etapa:** [02 - KPIs & Invariantes](file://./kpis.md)
