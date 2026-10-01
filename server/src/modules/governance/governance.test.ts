import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  SECURITY_LEVELS,
  canAccessLevel,
  deriveLevelKey,
  encryptDocument,
  decryptDocument,
  isEncryptedEnvelope,
  parseEncryptedEnvelope,
  generateLevelCanary,
  verifyLevelCanary,
  createUserKeySlot,
  unlockUserKeySlot,
  scanContentForSecrets,
} from '../../utils/crypto.js';

describe('Criptografia Hierárquica e Governança de Acesso', () => {
  const salt = 'test-salt-context-os-2026';
  const keyLevel0 = deriveLevelKey('root-executive-passphrase-0', salt);
  const keyLevel1 = deriveLevelKey('strategic-arch-passphrase-1', salt);
  const keyLevel2 = deriveLevelKey('engineering-team-passphrase-2', salt);
  const keyLevel3 = deriveLevelKey('operational-basic-passphrase-3', salt);

  describe('Regra de Hierarquia Invertida (canAccessLevel)', () => {
    it('Level 0 (Root) deve ter acesso a TODOS os níveis (0, 1, 2, 3 e público)', () => {
      assert.strictEqual(canAccessLevel(0, 0), true);
      assert.strictEqual(canAccessLevel(0, 1), true);
      assert.strictEqual(canAccessLevel(0, 2), true);
      assert.strictEqual(canAccessLevel(0, 3), true);
      assert.strictEqual(canAccessLevel(0, SECURITY_LEVELS.PUBLIC), true);
    });

    it('Level 1 (Estratégico) deve acessar 1, 2, 3 e público, mas NÃO Level 0', () => {
      assert.strictEqual(canAccessLevel(1, 0), false);
      assert.strictEqual(canAccessLevel(1, 1), true);
      assert.strictEqual(canAccessLevel(1, 2), true);
      assert.strictEqual(canAccessLevel(1, 3), true);
    });

    it('Level 2 (Engenharia) deve acessar 2, 3 e público, mas NÃO Level 0 ou 1', () => {
      assert.strictEqual(canAccessLevel(2, 0), false);
      assert.strictEqual(canAccessLevel(2, 1), false);
      assert.strictEqual(canAccessLevel(2, 2), true);
      assert.strictEqual(canAccessLevel(2, 3), true);
    });

    it('Documentos públicos são acessíveis por qualquer nível', () => {
      assert.strictEqual(canAccessLevel(3, SECURITY_LEVELS.PUBLIC), true);
      assert.strictEqual(canAccessLevel(999, SECURITY_LEVELS.PUBLIC), true);
    });
  });

  describe('Criptografia e Descriptografia de Envelopes (AES-256-GCM)', () => {
    const confidentialPlaintext = `# Especificação Confidencial de Faturamento
Esta é uma regra estratégica ultrassecreta de margem de lucro.`;

    it('Deve criptografar documento e produzir envelope válido ilegível', () => {
      const envelope = encryptDocument(confidentialPlaintext, 0, keyLevel0, {
        title: 'Faturamento Estratégico',
      });

      assert.strictEqual(isEncryptedEnvelope(envelope), true);
      assert.strictEqual(envelope.includes('-----BEGIN CONTEXT ENCRYPTED PAYLOAD-----'), true);
      assert.strictEqual(envelope.includes('-----END CONTEXT ENCRYPTED PAYLOAD-----'), true);
      assert.strictEqual(envelope.includes('security_level: 0'), true);
      assert.strictEqual(envelope.includes('ultrassecreta'), false);

      const parsed = parseEncryptedEnvelope(envelope);
      assert.strictEqual(parsed.isEncrypted, true);
      assert.strictEqual(parsed.header?.security_level, 0);
      assert.strictEqual(parsed.payloadData?.alg, 'AES-256-GCM');
    });

    it('Engenheiro Level 0 deve conseguir descriptografar documento de Level 0 com perfeição', () => {
      const envelope = encryptDocument(confidentialPlaintext, 0, keyLevel0, {
        title: 'Faturamento Estratégico',
      });

      const decResult = decryptDocument(envelope, { 0: keyLevel0 });
      assert.strictEqual(decResult.success, true);
      assert.strictEqual(decResult.content, confidentialPlaintext);
      assert.strictEqual(decResult.level, 0);
    });

    it('Engenheiro Level 0 deve conseguir abrir documento de Level 2 usando chaves desbloqueadas', () => {
      const level2Doc = `# Arquitetura do Banco de Dados
Configurações de cluster PostgreSQL e índices.`;

      const envelopeL2 = encryptDocument(level2Doc, 2, keyLevel2, {
        title: 'Cluster DB',
      });

      const userLevel0Keys = { 0: keyLevel0, 1: keyLevel1, 2: keyLevel2 };
      const decResult = decryptDocument(envelopeL2, userLevel0Keys);
      assert.strictEqual(decResult.success, true);
      assert.strictEqual(decResult.content, level2Doc);
    });

    it('Engenheiro Level 2 SEM a chave de Level 0 deve ter acesso negado ao tentar abrir documento Level 0', () => {
      const envelopeL0 = encryptDocument(confidentialPlaintext, 0, keyLevel0, {
        title: 'Faturamento Estratégico',
      });

      const userLevel2Keys = { 2: keyLevel2, 3: keyLevel3 };
      const decResult = decryptDocument(envelopeL0, userLevel2Keys);
      assert.strictEqual(decResult.success, false);
      assert.strictEqual(decResult.content, undefined);
      assert.strictEqual(decResult.error?.includes('Acesso bloqueado'), true);
    });
  });

  describe('Validação Criptográfica Canary & User Key Slots', () => {
    it('Deve gerar Canary probe e validar senha correta com sucesso', () => {
      const canary = generateLevelCanary('strategic', keyLevel1);
      assert.strictEqual(canary.level_id, 'strategic');
      assert.strictEqual(verifyLevelCanary(keyLevel1, canary), true);
    });

    it('Deve rejeitar senha/chave incorreta na verificação Canary (evita falso positivo de desbloqueio)', () => {
      const canary = generateLevelCanary('strategic', keyLevel1);
      const wrongKey = deriveLevelKey('completely-wrong-password', salt);
      assert.strictEqual(verifyLevelCanary(wrongKey, canary), false);
    });

    it('Deve proteger DEK em UserKeySlot individual e desbloquear apenas com a senha do usuário', () => {
      const userPass = 'my-personal-super-secret-pwd';
      const slot = createUserKeySlot('dev_alice', userPass, 'engineering', keyLevel2, salt);

      assert.strictEqual(slot.user, 'dev_alice');
      assert.strictEqual(slot.level_id, 'engineering');

      // Desbloqueio com senha correta
      const unlockCorrect = unlockUserKeySlot('dev_alice', userPass, slot, salt);
      assert.strictEqual(unlockCorrect.success, true);
      assert.strictEqual(unlockCorrect.dek?.toString('hex'), keyLevel2.toString('hex'));

      // Desbloqueio com senha errada
      const unlockWrong = unlockUserKeySlot('dev_alice', 'wrong-pass', slot, salt);
      assert.strictEqual(unlockWrong.success, false);
      assert.strictEqual(unlockWrong.dek, undefined);
    });
  });

  describe('Pre-Commit / Pre-PR Secret & Clearance Scanner', () => {
    it('Deve detectar GitHub PATs e bloquear', () => {
      const badCode = `const token = "ghp_1234567890abcdefghijklmnopqrstuvwx";`;
      const res = scanContentForSecrets(badCode, 'src/api.ts');
      assert.strictEqual(res.hasSecrets, true);
      assert.strictEqual(res.violations.some((v: any) => v.rule === 'GITHUB_PAT_DETECTED'), true);
    });

    it('Deve detectar OpenAI API Keys e bloquear', () => {
      const badCode = `const key = "sk-proj-1234567890abcdef1234567890abcdef";`;
      const res = scanContentForSecrets(badCode, 'src/ai.ts');
      assert.strictEqual(res.hasSecrets, true);
      assert.strictEqual(res.violations.some((v: any) => v.rule === 'AI_API_KEY_DETECTED'), true);
    });

    it('Deve detectar documento confidencial de Level 0 desprotegido em texto claro', () => {
      const unencryptedConfidential = `---
title: "Métricas Confidenciais"
security_level: 0
---
# Segredos
Estratégia ultra confidencial.`;
      const res = scanContentForSecrets(unencryptedConfidential, 'specs/finances.md');
      assert.strictEqual(res.hasSecrets, true);
      assert.strictEqual(res.violations.some((v: any) => v.rule === 'UNENCRYPTED_CONFIDENTIAL_SPEC'), true);
    });

    it('Deve aceitar documento confidencial quando devidamente criptografado no envelope AES-256-GCM', () => {
      const encrypted = encryptDocument('Estratégia confidencial', 0, keyLevel0, { title: 'Métricas' });
      const res = scanContentForSecrets(encrypted, 'specs/finances.md');
      assert.strictEqual(res.hasSecrets, false);
      assert.strictEqual(res.violations.length, 0);
    });
  });
});
