# Diretrizes de Arquitetura de Software

Este documento define as regras de organização de código, limites de camadas e convenções técnicas do projeto.

## 1. Separação de Camadas (Clean Architecture)

A arquitetura do sistema divide-se em camadas com dependências unidirecionais voltadas para o Domínio.

### A. Camada de Domínio (Domain)

* **Regra:** Contém a lógica de negócio pura (entidades, value objects, exceções e interfaces). Não deve possuir acoplamento com dependências de banco de dados, ORMs, frameworks web ou clientes HTTP.
* **Validações:** Devem ocorrer no construtor ou em métodos internos das entidades para garantir a consistência das invariantes de negócio.

### B. Camada de Aplicação (Application)

* **Regra:** Orquestra o fluxo de dados. Contém casos de uso (services) e objetos de transferência de dados (DTOs).
* **Dependência:** Comunica-se com adaptadores externos através de interfaces definidas na camada de Domínio.

### C. Camada de Infraestrutura (Infrastructure)

* **Regra:** Contém a implementação concreta de acesso a banco de dados, controladores HTTP, filas e clientes de terceiros.

---

## 2. Princípios SOLID aplicados

* **Single Responsibility (SRP):** Classes de casos de uso devem executar uma única ação de negócio.
* **Open/Closed (OCP):** Comportamentos extensíveis devem ser resolvidos via polimorfismo ou inversão de controle.
* **Liskov Substitution (LSP):** Classes derivadas devem poder substituir suas classes base sem quebrar o sistema.
* **Interface Segregation (ISP):** Interfaces devem ser pequenas e especializadas.
* **Dependency Inversion (DIP):** Camadas de alto nível não dependem de implementações de baixo nível; dependem de abstrações (interfaces).

---

## 3. Convenções de Código

* **Classes e Interfaces:** `PascalCase` (ex: `GerarReembolso`, `IReembolsoRepository`).
* **Funções e Variáveis:** `camelCase` (ex: `processar()`, `valorMinimo`).
* **Arquivos:** `kebab-case` ou delimitados por pontos (ex: `gerar-reembolso.use-case.ts`).
* **Sufixos:** Arquivos devem indicar seu papel arquitetural (ex: `.entity.ts`, `.use-case.ts`, `.repository.ts`).

---

## 4. Tratamento de Exceções

1. **Exceções de Domínio:** A camada de domínio lança exceções específicas de negócio (ex: `InvalidValueException`). Código HTTP ou representações de infraestrutura não devem ser usados no Domínio.
2. **Tratamento Externo:** A camada de infraestrutura (controladores/middlewares) captura as exceções de domínio e formata a resposta adequada para o cliente final.
