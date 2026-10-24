# Context OS (`spec-driven-context-os`)

Plataforma de Governança de Especificações Orientadas a Domínio (Spec-Driven Development & DDD) integrada a Git e Inteligência Artificial.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js**: v20.x ou superior (testado com Node v24 LTS)
- **Git**: v2.30+ instalado no sistema

### Instalação
```bash
npm install
npm --prefix server install
npm --prefix frontend install
```

### Ambientes de Desenvolvimento

#### 1. Instância Padrão (`npm run dev`)
Inicia o backend Fastify na porta **4100** e o frontend Vite na porta **5173**:
```bash
npm run dev
```
Acesse no navegador: `http://localhost:5173`

#### 2. Segunda Instância para Colaboração (`npm run dev1`)
Simula um segundo desenvolvedor/usuário concorrente em máquina local, utilizando um diretório de dados isolado (`.user2-data`) para evitar colisões de estado, cofre de senhas ou tokens de sessão:
- **Porta do Servidor**: `4101`
- **Porta do Frontend**: `5174`
- **Variáveis aplicadas**: `CONTEXT_OS_USER_DATA=./.user2-data PORT=4101 VITE_PORT=5174 VITE_BACKEND_PORT=4101`
```bash
npm run dev1
```
Acesse no navegador: `http://localhost:5174`

---

## 🛡️ Pipeline de Verificação e Segurança (`npm run verify`)

O repositório possui uma suíte estrita de segurança e qualidade executada em 6 estágios antes de qualquer merge ou deploy:
```bash
npm run verify
```

Estágios verificados:
1. **Server TypeScript Typecheck** (`tsc -p server/tsconfig.json --noEmit`)
2. **Server Test Suite** (`node:test` cobrindo injeção de comandos Git, isolamento de ferramentas customizadas, autenticação de sessão, prevenção de SSRF, canonicalização de symlinks e escrita atômica)
3. **Frontend TypeScript Typecheck** (`tsc -p frontend/tsconfig.json --noEmit`)
4. **Frontend Test Suite** (`vitest` cobrindo sanitização de markdown, SVG, links seguros e neutralização de vetores XSS)
5. **Frontend Production Build** (`vite build` gerando bundle minificado)
6. **Static Security & Quality Guards** (`scripts/guards.mjs` monitorando limites estritos de `new Function`, `executeGitCommand`, e contagem de tipagem `any`)

### Limpeza de Processos de Teste Locais
Caso algum processo de teste fique retido em segundo plano, utilize o utilitário de limpeza:
```bash
./scripts/kill-stale-tests.sh
```

---

## 🏗️ Arquitetura e Segurança

- **Git Shell-less**: todas as execuções utilizam `execFile('git', args, { shell: false })` com validação de branch e parâmetros contra injection.
- **Isolamento de Ferramentas (Custom Tools)**: scripts de ferramentas customizadas executam em processo filho isolado com contexto limpo (`vm.createContext`) e timeout determinístico de 5s, sem acesso a `process`, `fs` ou `require`.
- **Prevenção de SSRF**: validação de DNS e bloqueio estrito de redes privadas (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`).
- **Sessão & Anti-DNS-Rebinding**: token de sessão gerado por `crypto.randomBytes(32)` com verificação em tempo constante (`crypto.timingSafeEqual`) e validação de cabeçalho `Host`.
- **Integridade Atômica**: gravações de arquivos `.json` de governança e estado utilizam escrita em arquivo temporário, `fsync` e substituição atômica (`rename`), prevenindo arquivos corrompidos em caso de encerramento abrupto.
