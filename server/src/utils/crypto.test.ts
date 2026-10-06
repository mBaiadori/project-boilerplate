import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  canAccessDocument,
  scanContentForSecrets,
  mergePlaintext3Way,
} from './crypto.js';

describe('Utilitários de Segurança e 3-Way Merge', () => {
  it('Deve verificar acesso a documentos com base em departamento e rotas', () => {
    const adminUser = { isOwner: true };
    assert.strictEqual(canAccessDocument(adminUser, { department: 'finance', path: 'finance/plan.md' }), true);

    const engUser = { departments: ['engineering'], allowed_paths: ['engineering/**'], isOwner: false };
    assert.strictEqual(canAccessDocument(engUser, { department: 'engineering', path: 'engineering/arch.md' }), true);
    assert.strictEqual(canAccessDocument(engUser, { department: 'finance', path: 'finance/plan.md' }), false);
  });

  it('Deve detectar segredos reais em arquivos de código ou texto', () => {
    const withToken = 'export const TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const scan = scanContentForSecrets(withToken, 'src/api.ts');
    assert.strictEqual(scan.hasSecrets, true);
    assert.strictEqual(scan.violations[0].rule, 'GITHUB_PAT_DETECTED');

    const clean = '# Guia de Uso\n\nTexto perfeitamente seguro sem segredos.';
    const cleanScan = scanContentForSecrets(clean, 'docs/guide.md');
    assert.strictEqual(cleanScan.hasSecrets, false);
  });

  it('Deve executar 3-Way Merge sem conflitos quando alterações forem em linhas diferentes', () => {
    const base = 'Linha 1\nLinha 2\nLinha 3\n';
    const ours = 'Linha 1 modificada\nLinha 2\nLinha 3\n';
    const theirs = 'Linha 1\nLinha 2\nLinha 3 modificada\n';

    const result = mergePlaintext3Way(base, ours, theirs);

    assert.strictEqual(result.hasConflicts, false);
    assert.strictEqual(result.conflictCount, 0);
    assert.ok(result.mergedContent.includes('Linha 1 modificada'));
    assert.ok(result.mergedContent.includes('Linha 3 modificada'));
  });

  it('Deve inserir marcadores de conflito legíveis em português quando houver colisão na mesma linha', () => {
    const base = 'Linha 1\nLinha original\nLinha 3\n';
    const ours = 'Linha 1\nAlteração da Alice\nLinha 3\n';
    const theirs = 'Linha 1\nAlteração do Bob\nLinha 3\n';

    const result = mergePlaintext3Way(base, ours, theirs, {
      ours: 'Versão da Alice',
      base: 'Original',
      theirs: 'Versão do Bob',
    });

    assert.strictEqual(result.hasConflicts, true);
    assert.ok(result.conflictCount >= 1);
    assert.ok(result.mergedContent.includes('<<<<<<< Versão da Alice'));
    assert.ok(result.mergedContent.includes('Alteração da Alice'));
    assert.ok(result.mergedContent.includes('======='));
    assert.ok(result.mergedContent.includes('Alteração do Bob'));
    assert.ok(result.mergedContent.includes('>>>>>>> Versão do Bob'));
  });
});
