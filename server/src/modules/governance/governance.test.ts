import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  canAccessDocument,
  scanContentForSecrets,
} from '../../utils/crypto.js';

describe('Governança de Acesso por Departamentos e Rotas', () => {
  describe('Controle por Departamento (canAccessDocument)', () => {
    const ownerUser = { isOwner: true, departments: ['*'], allowed_paths: ['*'] };
    const devUser = { role: 'collaborator', departments: ['engineering'], allowed_paths: ['docs/engenharia/**', 'docs/geral/**'] };
    const cfoUser = { role: 'collaborator', departments: ['finance'], allowed_paths: ['docs/financeiro/**'] };

    it('Owner deve ter acesso irrestrito a todos os departamentos e rotas', () => {
      assert.strictEqual(canAccessDocument(ownerUser, { department: 'executive', path: 'docs/executivo/estrategia.md' }), true);
      assert.strictEqual(canAccessDocument(ownerUser, { department: 'finance', path: 'docs/financeiro/dre.md' }), true);
      assert.strictEqual(canAccessDocument(ownerUser, { department: 'engineering', path: 'docs/engenharia/api.md' }), true);
    });

    it('Dev da Engenharia deve acessar documentos da engenharia, mas ser bloqueado no departamento do Financeiro', () => {
      assert.strictEqual(canAccessDocument(devUser, { department: 'engineering', path: 'docs/engenharia/api.md' }), true);
      assert.strictEqual(canAccessDocument(devUser, { department: 'finance', path: 'docs/financeiro/dre.md' }), false);
    });

    it('CFO do Financeiro deve acessar docs do financeiro e ser bloqueado em rotas fora do escopo', () => {
      assert.strictEqual(canAccessDocument(cfoUser, { department: 'finance', path: 'docs/financeiro/dre.md' }), true);
      assert.strictEqual(canAccessDocument(cfoUser, { department: 'legal', path: 'docs/juridico/contrato.md' }), false);
    });

    it('Documentos gerais/públicos devem ser acessíveis por qualquer membro', () => {
      assert.strictEqual(canAccessDocument(devUser, { department: 'general', path: 'docs/geral/termos.md' }), true);
      assert.strictEqual(canAccessDocument(devUser, { path: 'docs/geral/readme.md' }), true);
    });

    it('Deve herdar acesso a subpastas mas bloquear subpastas especificadas em denied_paths (Deny over Allow)', () => {
      const auditorUser = {
        role: 'collaborator',
        departments: ['finance'],
        allowed_paths: ['docs/financeiro/**'],
        denied_paths: ['docs/financeiro/salarios-executivos/**'],
      };

      // Subpasta permitida por herança da pasta pai docs/financeiro
      assert.strictEqual(
        canAccessDocument(auditorUser, { department: 'finance', path: 'docs/financeiro/relatorios/2026/balanco.md' }),
        true
      );
      assert.strictEqual(
        canAccessDocument(auditorUser, { department: 'finance', path: 'docs/financeiro/notas-fiscais/nf01.md' }),
        true
      );

      // Subpasta com restrição específica / exceção
      assert.strictEqual(
        canAccessDocument(auditorUser, { department: 'finance', path: 'docs/financeiro/salarios-executivos/bonus.md' }),
        false
      );
      assert.strictEqual(
        canAccessDocument(auditorUser, { department: 'finance', path: 'docs/financeiro/salarios-executivos/diretoria/planilha.xlsx' }),
        false
      );
    });
  });

  describe('Pre-Commit / Pre-PR Secret Scanner', () => {
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
  });
});
