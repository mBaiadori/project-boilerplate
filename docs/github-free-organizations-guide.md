# Guia de Recursos: GitHub Free for Organizations

Este documento resume as capacidades, limites de uso, modelo de permissões, recursos de segurança e governança disponíveis no plano **GitHub Free para Organizações**.

---

## 1. Repositórios e Capacidade Geral
* **Repositórios Ilimitados:** Criação sem limites de repositórios públicos e privados.
* **Organização Centralizada:** Agrupamento de repositórios sob uma mesma identidade institucional (`github.com/sua-organizacao`).
* **Issues, Projects & Wikis:** Acesso total a GitHub Projects (Boards no estilo Kanban, visões de tabela e roadmap), GitHub Issues ilimitadas e Wikis de documentação por repositório.

---

## 2. Gestão de Usuários e Equipes (Teams)
* **Membros Ilimitados:** Não há limite no número de membros na organização (*seats* gratuitos ilimitados).
* **Níveis de Papéis da Organização:**
  * **Owner (Proprietário):** Controle administrativo total da organização (faturamento, exclusão, configurações globais e membros).
  * **Member (Membro):** Usuários regulares pertencentes à organização.
* **Outside Collaborators (Colaboradores Externos):** Possibilidade de convidar terceiros ou freelancers para repositórios específicos sem conceder acesso a toda a organização.
* **Teams (Equipes):**
  * Criação de equipes (ex.: `@sua-org/frontend`, `@sua-org/backend`).
  * Atribuição de permissões de repositório em lote para equipes inteiras.
  * *Observação:* O plano Free não possui suporte a equipes aninhadas (hierarquia/sub-equipes).

---

## 3. Níveis de Acesso e Permissões em Repositórios
Permissões atribuíveis diretamente por usuário ou via equipes:
* **Read (Leitura):** Clonar, visualizar código e abrir issues/PRs.
* **Triage (Triagem):** Gerenciar issues e PRs sem permissão de escrita direta no código.
* **Write (Escrita):** Push direto, abertura e merge de PRs.
* **Maintain (Manutenção):** Gerenciar o repositório sem acesso a ações destrutivas (não pode excluir repositório).
* **Admin (Administração):** Controle total sobre as configurações e membros do repositório.
* *Observação:* **Custom Roles** (papéis personalizados com permissões granulares) não estão disponíveis no Free (exclusivo do plano Enterprise).

---

## 4. Limites de Recursos & GitHub Actions

| Recurso | Repositórios Públicos | Repositórios Privados (Free) |
| :--- | :--- | :--- |
| **GitHub Actions (Minutos)** | **Ilimitado** (gratuitos) | **2.000 minutos/mês** por organização |
| **GitHub Packages (Armazenamento)** | 500 MB | **500 MB** compartilhados |
| **Largura de Banda de Packages** | Ilimitada | **1 GB/mês** |
| **Git LFS (Large File Storage)** | 1 GB storage / 1 GB bandwidth | **1 GB storage / 1 GB bandwidth** |
| **Self-Hosted Runners** | ✅ Permitido | ✅ **Permitido** (não consome cota de minutos) |

> 💡 **Estratégia para CI/CD:** Se a cota mensal de 2.000 minutos for atingida, é possível configurar servidores próprios (EC2, Droplets ou máquinas locais) como **Self-Hosted Runners** para executar pipelines sem limite de minutos.

---

## 5. Controle de Segurança e Governança

* **2FA Obrigatório (Require 2FA):** O proprietário pode exigir autenticação em dois fatores para todos os membros da organização.
* **Dependabot Alerts:** Identificação automática de vulnerabilidades conhecidas em bibliotecas e dependências (público e privado).
* **Dependabot Security Updates:** Abertura automática de Pull Requests corrigindo versões vulneráveis.
* **Dependency Graph & SBOM:** Mapeamento visual de dependências e exportação de Software Bill of Materials (SBOM).
* **Secret Scanning (Básico):** Ativo para repositórios públicos (bloqueio de commits com credenciais e alertas). Em repositórios privados, requer add-on do GitHub Advanced Security.
* **Security Advisories:** Publicação e discussão privada de vulnerabilidades antes da divulgação pública.

---

## 6. Diferenças Críticas: Repositórios Públicos vs. Privados no Free

| Recurso | Repositórios Públicos | Repositórios Privados (Free) |
| :--- | :---: | :---: |
| **Branch Protection Rules** (Exigir PR, aprovações mínimas, checks de CI obrigatórios) | ✅ Sim | ❌ **Não** *(Exige plano Team/Pro)* |
| **CODEOWNERS (Obrigatório)** | ✅ Sim | ⚠️ *(Arquivo existe, mas aplicação obrigatória depende de branch protection)* |
| **GitHub Pages** | ✅ Sim | ❌ **Não** *(Exige plano pago)* |
| **SAML / SSO Corporativo (Okta, Azure AD)** | ❌ Não | ❌ **Não** *(Exige GitHub Enterprise)* |
| **Auditoria Avançada (Audit Log API / Streaming)** | ❌ Não | ❌ **Não** *(Exige GitHub Enterprise)* |

---

## 7. Critérios de Decisão (Free vs. Team)

* **Manter no GitHub Free se:**
  * O time precisa de membros ilimitados sem custos fixos por licença.
  * O volume de CI/CD fica dentro de 2.000 min/mês (ou usa *self-hosted runners*).
  * A governança de branch pode ser mantida por convenção da equipe.
* **Migrar para o GitHub Team ($4/usuário/mês) se:**
  * For obrigatório impor **Branch Protection Rules** e aprovações obrigatórias de PR em repositórios **privados**.
  * For necessário hospedar documentações/sites internos com **GitHub Pages em repositórios privados**.
  * A cota padrão de Actions precisar ser ampliada (3.000 min/mês inclusos).
