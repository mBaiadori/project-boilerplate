import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ragService } from './rag.service.js';
import { PROJECTS_DIR, resolveRepoDir } from '../../config/constants.js';

describe('Phase 03: RAG Service & Context Injection (INC-02 / EVO-01)', () => {
  let tmpRepoDir: string;
  const repoName = 'test-rag-repo';

  beforeEach(() => {
    tmpRepoDir = resolveRepoDir(repoName);
    fs.mkdirSync(tmpRepoDir, { recursive: true });

    // Cria arquivos markdown com conteúdo semântico relevante
    fs.writeFileSync(
      path.join(tmpRepoDir, 'architecture.md'),
      `# Arquitetura do Sistema
Este documento define o pipeline de ingestão e governança de dados.
O fluxo de mensageria utiliza filas assíncronas com garantia de entrega.`
    );

    fs.writeFileSync(
      path.join(tmpRepoDir, 'security.md'),
      `# Políticas de Segurança
O controle de acesso é estritamente baseado em RBAC e tokens de sessão efêmeros.
Criptografia em repouso utiliza chaves AES-256.`
    );

    // Força indexação
    ragService.reindex(repoName);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRepoDir, { recursive: true, force: true });
    } catch {}
  });

  it('buildContextPrompt deve retornar bloco formatado com trechos relevantes', () => {
    const contextBlock = ragService.buildContextPrompt('governança e mensageria', repoName, 3);
    assert.ok(contextBlock.includes('[REFERÊNCIAS RELEVANTES DO PROJETO (RAG)]'));
    assert.ok(contextBlock.includes('architecture.md'));
    assert.ok(contextBlock.includes('pipeline de ingestão'));
  });

  it('buildContextPrompt deve retornar vazio se não houver termos correspondentes', () => {
    const contextBlock = ragService.buildContextPrompt('palavraInexistenteXyz123', repoName, 3);
    assert.strictEqual(contextBlock, '');
  });
});
