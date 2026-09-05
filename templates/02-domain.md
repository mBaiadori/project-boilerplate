---
id: "domain-{{DOMAIN_NAME}}"
title: "Domínio: {{DOMAIN_TITLE}}"
type: "domain"
version: "1.0.0"
status: "active"
layer: "L2_DOMAIN"
path: "domains/{{DOMAIN_NAME}}/index.md"
parent: "project/index.md"
breadcrumb:
  - { title: "Projeto", path: "project/index.md" }
  - { title: "{{DOMAIN_TITLE}}", path: "domains/{{DOMAIN_NAME}}/index.md" }
---

Navegação: [Projeto](file://../../project/index.md) / **{{DOMAIN_TITLE}}**  
Status: `ACTIVE` | Camada: `L2_DOMAIN`

---

# Domínio: {{DOMAIN_TITLE}}

## 1. Escopo e Limites de Responsabilidade
Definição dos limites arquiteturais e fronteiras transacionais deste contexto delimitado.

---

## 2. Invariantes Globais do Domínio
Regras inegociáveis que se aplicam a todas as funcionalidades pertencentes a este domínio:

1. [Invariante Global 1 - Ex: Toda transação exige chave de idempotência]
2. [Invariante Global 2 - Ex: Toda alteração de estado exige registro em log de auditoria]

---

## 3. Subdomínios e Áreas Funcionais

| Área / Subdomínio | Escopo de Atuação | Documento |
| :--- | :--- | :--- |
| `[nome-da-area]` | [Descrição da área funcional e responsabilidade] | [Acessar Área](file://./[nome-da-area]/index.md) |
