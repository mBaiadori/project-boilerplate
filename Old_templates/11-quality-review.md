---
id: "feature-{{DOMAIN_NAME}}-{{SUBDOMAIN_NAME}}-{{FEATURE_NAME}}-quality"
title: "Qualidade & Review: {{FEATURE_NAME}}"
type: "quality"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/quality/review.md"
parent: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/specs/behavior.md"
lifecycle:
  stage: "quality"
  previous_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/specs/behavior.md"
  next_stage: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/quality/monitoring.md"
  feedback_loops:
    on_security_failure: "src/domain/"
    on_qa_regression: "domains/{{DOMAIN_NAME}}/{{SUBDOMAIN_NAME}}/{{FEATURE_NAME}}/specs/behavior.md"
---

Navegação: [Projeto](file://../../../../../project/index.md) / [{{DOMAIN_TITLE}}](file://../../../../index.md) / [{{SUBDOMAIN_TITLE}}](file://../../../index.md) / [{{FEATURE_NAME}}](file://../index.md) / **Qualidade & Review**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Relatório de Qualidade & Revisão: {{FEATURE_NAME}}

## 1. Cobertura de Testes Automatizados (TDD)
- [ ] **Testes de Unidade:** Cobertura de 100% das invariantes do Domínio.
- [ ] **Testes de Integração:** Cobertura dos casos de uso e adaptadores de infraestrutura.
- [ ] **Mapeamento BDD:** 100% dos cenários de `specs/behavior.md` implementados e verdes.

---

## 2. Auditoria de Segurança (SAST / SCA)
- **Status do Pipeline de Segurança:** `APPROVED` / `PENDING`
- **Vulnerabilidades Críticas / Altas:** 0
- **Conformidade LGPD / PII:** Nenhuma informação pessoal sensível exposta em logs.

---

## 3. Checklist de Arquitetura & Clean Code
- [ ] **Isolamento de Camadas:** A camada de domínio não possui acoplamento com frameworks ou banco de dados.
- [ ] **SOLID:** Casos de uso possuem responsabilidade única e dependem de abstrações (interfaces).
- [ ] **Tratamento de Exceções:** Erros de negócio lançam exceções tipadas de domínio.

---

### Navegação da Esteira

* **Etapa Anterior:** [06 - Especificações BDD (Specs)](file://../specs/behavior.md)
* **Próxima Etapa:** [08 - Monitoramento & Produção](file://./monitoring.md)
* **Feedback Loops:**
  * Falhas de segurança no SAST -> [Retornar para Implementação de Código](file://../../../../src/)
  * Falhas de integração ou regressão em QA -> [Retornar para Especificações BDD](file://../specs/behavior.md)
