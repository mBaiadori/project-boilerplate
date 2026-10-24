# Context OS — Guia e Checklist de Release Seguro

Este documento estabelece os procedimentos formais e gates obrigatórios para o empacotamento, assinatura de código e publicação de novas versões do Context OS.

---

## 1. Princípios de Segurança na Distribuição

1. **Reprodutibilidade e Integridade**: Nenhum artefato é publicado sem compilação limpa a partir de uma tag Git assinada na branch `main`.
2. **Assinatura de Código Obrigatória**: Binários desktop distribuídos devem ser devidamente assinados e autenticados perante os sistemas operacionais de destino (Apple Notarization no macOS; Authenticode no Windows).
3. **Transparência de Proteção**: O empacotamento com `bytenode` converte scripts em bytecode V8 (`.jsc`), servindo como **ofuscação de propriedade intelectual contra visualização casual**. Conforme definido em [THREAT_MODEL.md](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/docs/THREAT_MODEL.md), o `bytenode` não deve ser tratado como criptografia hermética.

---

## 2. Checklist Pré-Release (Gates Obrigatórios)

Antes de gerar a tag de release:

- [ ] **Typecheck Estrito**:
  - `cd server && npx tsc --noEmit`
  - `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.strict.json --noEmit`
  - `cd desktop && npx tsc --noEmit`
- [ ] **Bateria Completa de Testes Unitários e de Segurança**:
  - `cd server && npm test` (100% dos testes devem passar)
  - `cd frontend && npm test` (100% dos testes devem passar)
- [ ] **Guardas Estáticos de Qualidade**:
  - `node scripts/guards.mjs` (todas as métricas dentro ou abaixo do baseline)
- [ ] **Auditoria de Dependências de Produção**:
  - `cd server && npm audit --omit=dev --audit-level=high`
  - `cd frontend && npm audit --omit=dev --audit-level=high`
- [ ] **Varredura de Segredos (Gitleaks)**:
  - Garantir ausência de tokens, chaves privadas ou credenciais no histórico do Git.

---

## 3. Procedimento de Empacotamento Desktop

### 3.1 macOS (Apple Developer ID & Notarization)

1. **Configuração de Ambiente**:
   - `CSC_LINK`: Caminho ou base64 do certificado Developer ID Application (`.p12`).
   - `CSC_KEY_PASSWORD`: Senha do certificado.
   - `APPLE_ID`: E-mail da conta de desenvolvedor Apple.
   - `APPLE_APP_SPECIFIC_PASSWORD`: Senha de app específica para notarização.
   - `APPLE_TEAM_ID`: Team ID de 10 caracteres no Apple Developer Portal.

2. **Geração e Notarização**:
   ```bash
   cd desktop
   npm run build:ts
   npm run package:mac
   ```
   O `electron-builder` dispara a notarização via `notarytool` da Apple e efetua o *stapling* do ticket no arquivo `.dmg` e no `.app`.

3. **Validação da Notarização**:
   ```bash
   spctl --assess --type execute --verbose dist/mac-arm64/Context\ OS.app
   ```
   Saída esperada: `accepted [source=Notarized Developer ID]`.

---

### 3.2 Windows (Authenticode Signing)

1. **Configuração de Ambiente**:
   - `WIN_CSC_LINK`: Certificado de assinatura de código Windows (`.pfx` ou HSM cloud-based).
   - `WIN_CSC_KEY_PASSWORD`: Senha do certificado.

2. **Geração do Instalador**:
   ```bash
   cd desktop
   npm run package:win
   ```
   Gera o instalador NSIS assinado (`Context-OS-Setup-*.exe`).

---

## 4. Atualizações Automáticas (Auto-Update)

O mecanismo de atualização automática via `electron-updater` utiliza canais seguros:
- Todos os pacotes de atualização (`latest.yml`, `latest-mac.yml`, instaladores) são validados contra o hash SHA-512 assinado.
- Atualizações são baixadas exclusivamente via conexões HTTPS seguras.
- Se a assinatura do arquivo baixado divergir do manifesto, o instalador é descartado imediatamente antes de qualquer execução.
