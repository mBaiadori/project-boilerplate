
Atue como Engenheiro Principal de IA e Arquiteto de Software Especialista em Sistemas Agênticos.

Seu objetivo é analisar todo este repositório — estrutura de arquivos, regras de negócio, modelos de documentos e integrações existentes — para propor a arquitetura definitiva e a estratégia de orquestração de agentes de IA para o nosso framework local.

### Contexto do Nosso Framework

- O framework roda localmente na máquina do usuário.
- O usuário fornece tokens de API (LLM e Git).
- O core do produto auxilia usuários no preenchimento estruturado de documentos, enquanto agentes em background analisam o contexto geral, aplicam regras estritas de conformidade, avaliam coerência semântica e interagem com o Git local/remoto.

### O que você deve analisar no repositório antes de responder

1. Estrutura de pastas, schemas de documentos e regras de validação já definidas.
2. Formas de leitura, escrita e persistência de arquivos.
3. Fluxo de autenticação e comunicação com APIs externas (Git, LLMs).
4. Pontos determinísticos de validação de código vs. pontos que exigem julgamento semântico do LLM.

### Entregáveis Esperados

1. Diagnóstico do Repositório:

   - Identifique quais componentes de negócio já existem e onde estão as lacunas na camada de orquestração de agentes.
2. Desenho da Arquitetura de Agentes:

   - Definição clara dos papéis dos agentes (ex.: Especialista em Preenchimento, Auditor de Regras/Coerência, Integrador Git).
   - O padrão de orquestração recomendado (ex.: Grafo de Estados determinístico com ciclos de feedback vs. Hierarquia de Agentes).
   - Indicação de engine/biblioteca pronta mais adequada para embutir na máquina local (ex.: LangGraph, CrewAI ou loop enxuto nativo), justificando tecnicamente com base no código atual.
3. Estratégia de Ferramentas e MCP (Model Context Protocol):

   - Quais ferramentas devem ser expostas como servidores/clientes MCP (ex.: operações Git, sistema de arquivos, linters de validação).
   - Divisão de responsabilidade: o que deve ser validado via código determinístico (schemas, regex) vs. o que deve ser delegado ao raciocínio dos agentes.
4. Plano de Implementação Passo a Passo:

   - Roadmap técnico indicando os arquivos a serem criados/refatorados para integrar essa camada agêntica sem quebrar a lógica de negócio já presente.

Faça uma varredura completa dos arquivos relevantes e apresente sua proposta técnica estruturada.
