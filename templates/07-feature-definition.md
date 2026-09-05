---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-definition"
title: "Definição Técnica: {{FEATURE_NAME}}"
type: "feature-definition"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/research.md"
cross_cutting_relations:
  - target: "domains/[TARGET_DOMAIN]/[TARGET_SUBDOMAIN]/[TARGET_FEATURE]/feature-definition.md"
    relation_type: "consumes_service" # consumes_service | triggers_event | shares_vo
    contract_mode: "sync_rpc" # sync_rpc | async_event | shared_lib
    return_ref: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
lifecycle:
  stage: "feature-definition"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/research.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/flow.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../index.md) / [{{FEATURE_NAME}}](file://./index.md) / **Definição Técnica**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Definição Técnica: {{FEATURE_NAME}}

## 1. Dependências Transversais (Cross-Cutting)

| Domínio / Feature Alvo | Modo de Contrato | Natureza da Relação | Documento Alvo |
| :--- | :--- | :--- | :--- |
| `[dominio > feature]` | `Síncrono (gRPC/HTTP)` | Consome validação de identidade | [Abrir Spec](file://../../../[target]/feature-definition.md) |
| `[dominio > feature]` | `Assíncrono (Evento)` | Dispara notificação transacional | [Abrir Spec](file://../../../[target]/feature-definition.md) |

---

## 2. Requisitos Não Funcionais (NFRs)
* **SLA de Latência:** p95 < [tempo_ms], p99 < [tempo_ms]
* **Throughput Previsto:** [X] requisições por segundo em pico
* **Segurança e Privacidade (LGPD):** [Tratamento de dados sensíveis e anonimização]
* **Idempotência & Resiliência:** [Mecanismo de retry e tratamento de falhas transacionais]

---

### Navegação da Esteira

* **Etapa Anterior:** [03 - Pesquisa e RAG](file://./research.md)
* **Próxima Etapa:** [05 - Modelagem e Fluxo (Docs & Flow)](file://./docs/flow.md)
