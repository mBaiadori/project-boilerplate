---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-flow"
title: "Fluxo Gráfico: {{FEATURE_NAME}}"
type: "flow"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/flow.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
lifecycle:
  stage: "flow"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/entity.md"
  feedback_loops:
    on_incomplete_flow: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/feature-definition.md"
---

Navegação: [Projeto](file://../../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../../index.md) / [{{FEATURE_NAME}}](file://../index.md) / **Fluxo Gráfico**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Fluxo Lógico e Gráfico: {{FEATURE_NAME}}

## 1. Diagrama de Sequência

```mermaid
sequenceDiagram
    autonumber
    actor User as Ator Principal
    participant API as Gateway / Controller
    participant App as Application (Use Case)
    participant Domain as Entidade de Domínio
    participant DB as Infrastructure (Repo)

    User->>API: Envia solicitação com Payload
    API->>App: Executa Use Case (DTO)
    App->>Domain: Aplica regras de invariantes
    alt Regras Válidas
        Domain-->>App: Estado atualizado
        App->>DB: Persiste transação
        DB-->>App: Confirmação
        App-->>API: Resultado de sucesso
        API-->>User: HTTP 200 OK (com dados)
    else Violação de Invariante
        Domain-->>App: Lança DomainException
        App-->>API: Propaga erro de domínio
        API-->>User: HTTP 400/422 (Erro formatado)
    end
```

---

## 2. Diagrama de Estados da Entidade

```mermaid
stateDiagram-v2
    [*] --> CRIADO: Nova solicitação
    CRIADO --> EM_PROCESSAMENTO: Início do Use Case
    EM_PROCESSAMENTO --> CONCLUIDO: Transação confirmada
    EM_PROCESSAMENTO --> FALHA: Erro ou timeout
    CONCLUIDO --> [*]
    FALHA --> [*]
```

---

### Navegação da Esteira

* **Etapa Anterior:** [04 - Definição Técnica](file://../feature-definition.md)
* **Próxima Etapa:** [05 - Modelagem de Entidades (Docs/Entity)](file://./entity.md)
* **Feedback Loop:** Se o fluxo estiver incompleto ou inconsistente, [retornar para Feature Definition](file://../feature-definition.md).
