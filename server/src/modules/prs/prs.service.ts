import { loadConfig, saveConfig, clearWorkspaceChanges } from '../../config/storage.js';
import { callGitHubAPI } from '../../utils/git.js';
import { computeDiff } from '../../utils/diff.js';

export class PRsService {
  getPRs() {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = activeRepo?.name || 'local';
    const allPRs = cfg.prs || [];
    const repoPRs = allPRs.filter((p: any) => p.repo_name === repoName || (!p.repo_name && repoName === 'local'));

    return {
      repo: activeRepo,
      prs: repoPRs,
      governance: cfg.governance || { min_approvals: 1, reviewers: [] },
    };
  }

  generatePRSummary() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const changes = cfg.workspace_changes?.[repoName] || [];

    if (changes.length === 0) {
      return {
        title: 'Atualização de Especificações',
        body: 'Nenhuma alteração pendente detectada.',
        type: 'docs',
        layer: 'Geral',
      };
    }

    const modifiedPaths = changes.map((c) => c.path).join(', ');
    const title = `docs: atualização de especificações (${changes.length} arquivos)`;
    const body = `## Resumo das Alterações de Governança\n\nEste Pull Request registra alterações na base de conhecimento e especificações:\n\n` +
      changes.map((c) => `- **${c.type}**: \`${c.path}\``).join('\n') +
      `\n\n### Arquivos Modificados:\n${modifiedPaths}\n\n*Gerado automaticamente pelo Context OS Spec-Driven SDLC.*`;

    return {
      title,
      body,
      type: 'docs',
      layer: 'Especificações',
    };
  }

  async createPR(payload: {
    title: string;
    description: string;
    branch?: string;
    type?: string;
    layer?: string;
    domain?: string;
  }) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = activeRepo?.name || 'local';
    const rawChanges = cfg.workspace_changes?.[repoName] || [];

    if (rawChanges.length === 0) {
      throw new Error('Não há alterações pendentes para criar um PR.');
    }

    if (!cfg.prs) cfg.prs = [];

    const newId = cfg.prs.length + 1;
    const branchName = payload.branch || `gov/update-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    const detailedChanges = rawChanges.map((c) => {
      const diffData = computeDiff(c.old_content || '', c.new_content || '', c.path);
      return {
        path: c.path,
        type: c.type,
        additions: diffData.additions,
        deletions: diffData.deletions,
        diff_text: diffData.diff_text,
        old_content: c.old_content,
        new_content: c.new_content,
      };
    });

    const newPR: any = {
      id: newId,
      repo_name: repoName,
      title: payload.title || `Atualização de Governança #${newId}`,
      description: payload.description || '',
      branch: branchName,
      target_branch: activeRepo?.default_branch || 'main',
      status: 'OPEN',
      created_at: now,
      author: cfg.user?.login ? `@${cfg.user.login}` : 'Dev Local',
      approvals: [],
      type: payload.type || 'docs',
      layer: payload.layer || 'Geral',
      domain: payload.domain || '',
      files: detailedChanges,
      html_url: activeRepo?.html_url ? `${activeRepo.html_url}/pull/${newId}` : '',
    };

    cfg.prs.unshift(newPR);
    clearWorkspaceChanges(repoName);
    saveConfig(cfg);

    return {
      success: true,
      pr: newPR,
      message: `Pull Request #${newId} criado com sucesso na branch '${branchName}'!`,
    };
  }

  approvePR(prId: number | string, approverName?: string) {
    const cfg = loadConfig();
    const prs = cfg.prs || [];
    const target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    const minApprovals = cfg.governance?.min_approvals || 1;
    const userLogin = cfg.user?.login;
    const approver = approverName || (userLogin ? `@${userLogin}` : 'Tech Lead (@tech-leads)');

    if (!Array.isArray(target.approvals)) {
      target.approvals = [];
    }

    if (!target.approvals.includes(approver)) {
      target.approvals.push(approver);
    }

    if (target.approvals.length >= minApprovals) {
      target.status = 'MERGED';
      target.merged_at = new Date().toISOString();
      saveConfig(cfg);

      return {
        success: true,
        auto_merged: true,
        pr: target,
        message: `🎉 Quórum de aprovação atingido (${target.approvals.length}/${minApprovals})! O PR #${prId} foi aprovado e o merge foi executado automaticamente na branch main.`,
      };
    } else {
      target.status = 'OPEN';
      saveConfig(cfg);

      return {
        success: true,
        auto_merged: false,
        pr: target,
        message: `✓ Aprovação registrada por ${approver} (${target.approvals.length}/${minApprovals}). Aguardando quórum para auto-merge.`,
      };
    }
  }

  mergePR(prId: number | string) {
    const cfg = loadConfig();
    const prs = cfg.prs || [];
    const target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    target.status = 'MERGED';
    target.merged_at = new Date().toISOString();
    saveConfig(cfg);

    return {
      success: true,
      pr: target,
      message: `PR #${prId} mesclado com sucesso na branch main!`,
    };
  }
}

export const prsService = new PRsService();
