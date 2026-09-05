---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-entity"
title: "Modelagem de Entidades: {{FEATURE_NAME}}"
type: "entity"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/entity.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/flow.md"
lifecycle:
  stage: "docs"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/flow.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/specs/behavior.md"
  feedback_loops:
    on_missing_details: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/docs/flow.md"
---

Navegação: [Projeto](file://../../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../../index.md) / [{{FEATURE_NAME}}](file://../index.md) / **Modelagem de Entidades**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Modelagem Tática de Domínio (DDD): {{FEATURE_NAME}}

## 1. Aggregate Root & Entidades

Definição dos agregados e métodos com invariantes encapsuladas:

```typescript
export class [NomeDoAgregado] {
  private readonly id: [IdValueObject];
  private status: [StatusEnum];
  private createdAt: Date;

  constructor(id: [IdValueObject], status: [StatusEnum]) {
    this.id = id;
    this.status = status;
    this.createdAt = new Date();
  }

  public executeOperation(): void {
    // Validação estrita de invariantes
    if (this.status === [StatusEnum].COMPLETED) {
      return; // Idempotência
    }
    this.status = [StatusEnum].COMPLETED;
  }
}
```

---

## 2. Objetos de Valor (Value Objects)
* **`[NomeDoValueObject]`**: [Regras de validação e imutabilidade dos dados]
* **`[IdValueObject]`**: Identificador único tipado (UUID ou formato de domínio).

---

## 3. Eventos de Domínio (Domain Events)
* **`[FeatureExecutadaEvent]`**: Evento emitido após a alteração de estado com sucesso para notificar outros contextos.

---

### Navegação da Esteira

* **Etapa Anterior:** [05 - Fluxo Gráfico](file://./flow.md)
* **Próxima Etapa:** [06 - Especificações BDD (Specs)](file://../specs/behavior.md)
* **Feedback Loop:** Se faltarem detalhes de regras ou dados, [retornar para Fluxo Gráfico](file://./flow.md).
