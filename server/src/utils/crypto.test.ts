import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateX25519KeyPair,
  generateDEK,
  sealDEKForPublicKey,
  openDEKWithPrivateKey,
  encryptFileToEnc,
  decryptEncFile,
  mergePlaintext3Way,
  isEncryptedEnvelope,
} from './crypto.js';

describe('Criptografia Assimétrica X25519 & 3-Way Merge', () => {
  it('Deve gerar par de chaves X25519 com fingerprint SHA-256 válido', () => {
    const kp = generateX25519KeyPair();
    assert.ok(kp.publicKeyPem.includes('BEGIN PUBLIC KEY'));
    assert.ok(kp.privateKeyPem.includes('BEGIN PRIVATE KEY'));
    assert.ok(kp.publicKeyBase64.length > 0);
    assert.strictEqual(kp.fingerprint.length, 16);
  });

  it('Deve selar uma DEK para Alice e Alice conseguir abrir com sua chave privada', () => {
    const alice = generateX25519KeyPair();
    const dek = generateDEK();

    const sealed = sealDEKForPublicKey(dek, alice.publicKeyPem);
    assert.ok(sealed.ephemeral_public_key);
    assert.ok(sealed.ciphertext);
    assert.ok(sealed.auth_tag);

    const openedDEK = openDEKWithPrivateKey(sealed, alice.privateKeyPem);
    assert.deepStrictEqual(openedDEK, dek);
  });

  it('Bob NÃO deve conseguir abrir o slot selado para Alice', () => {
    const alice = generateX25519KeyPair();
    const bob = generateX25519KeyPair();
    const dek = generateDEK();

    const sealedForAlice = sealDEKForPublicKey(dek, alice.publicKeyPem);

    assert.throws(() => {
      openDEKWithPrivateKey(sealedForAlice, bob.privateKeyPem);
    });
  });

  it('Deve criptografar e descriptografar arquivo .enc com DEK', () => {
    const dek = generateDEK();
    const originalText = '# Relatório Financeiro Confidencial\n\nReceita Q3: R$ 5.000.000,00';

    const encContent = encryptFileToEnc(originalText, dek, {
      department: 'finance',
      title: 'Relatório Q3',
    });

    assert.ok(isEncryptedEnvelope(encContent));
    assert.ok(!encContent.includes('Receita Q3'));

    const dec = decryptEncFile(encContent, dek);
    assert.strictEqual(dec.success, true);
    assert.strictEqual(dec.content, originalText);
    assert.strictEqual(dec.header?.department, 'finance');
  });

  it('Deve falhar ao tentar descriptografar com DEK incorreta', () => {
    const dekA = generateDEK();
    const dekB = generateDEK();
    const encContent = encryptFileToEnc('Segredo supremo', dekA);

    const dec = decryptEncFile(encContent, dekB);
    assert.strictEqual(dec.success, false);
    assert.ok(dec.error);
  });

  it('Deve executar 3-Way Merge sem conflitos quando alterações forem em linhas diferentes', () => {
    const base = 'Linha 1: Introdução\nLinha 2: Meio\nLinha 3: Conclusão\n';
    const ours = 'Linha 1: Introdução Atualizada pela Alice\nLinha 2: Meio\nLinha 3: Conclusão\n';
    const theirs = 'Linha 1: Introdução\nLinha 2: Meio\nLinha 3: Conclusão Final do Bob\n';

    const result = mergePlaintext3Way(base, ours, theirs);
    assert.strictEqual(result.hasConflicts, false);
    assert.strictEqual(result.conflictCount, 0);
    assert.ok(result.mergedContent.includes('Introdução Atualizada pela Alice'));
    assert.ok(result.mergedContent.includes('Conclusão Final do Bob'));
    assert.ok(result.mergedContent.includes('Linha 2: Meio'));
  });

  it('Deve inserir marcadores de conflito legíveis em português quando houver colisão na mesma linha', () => {
    const base = 'Parágrafo 1\nValor base\nParágrafo 3\n';
    const ours = 'Parágrafo 1\nValor alterado por Alice\nParágrafo 3\n';
    const theirs = 'Parágrafo 1\nValor alterado por Bob\nParágrafo 3\n';

    const result = mergePlaintext3Way(base, ours, theirs, {
      ours: 'Alice Local',
      theirs: 'Bob Remoto',
    });

    assert.strictEqual(result.hasConflicts, true);
    assert.strictEqual(result.conflictCount, 1);
    assert.ok(result.mergedContent.includes('<<<<<<< Alice Local'));
    assert.ok(result.mergedContent.includes('Valor alterado por Alice'));
    assert.ok(result.mergedContent.includes('======='));
    assert.ok(result.mergedContent.includes('Valor alterado por Bob'));
    assert.ok(result.mergedContent.includes('>>>>>>> Bob Remoto'));
  });
});
