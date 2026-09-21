import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, saveConfig, clearWorkspaceChanges } from '../../config/storage.js';
import {
  callGitHubAPI,
  ensureGitRepo,
  commitChanges,
  createAndCheckoutBranch,
  executeGitCommand,
} from '../../utils/git.js';
import { computeDiff } from '../../utils/diff.js';

export class PRsService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

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

    const repoDir = this.getRepoDir(repoName);
    const remoteUrl = activeRepo?.html_url;
    await ensureGitRepo(repoDir, cfg.user, remoteUrl, cfg.token);

    const newId = cfg.prs.length + 1;
    const branchName = payload.branch || `gov/update-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    // 1. Create and checkout new Git branch
    await createAndCheckoutBranch(repoDir, branchName);

    // 2. Commit changes to Git branch
    const commitMsg = payload.title || `Atualização de Governança #${newId}`;
    await commitChanges(repoDir, commitMsg);

    // 3. GitHub Remote PR (if authenticated and remote repo)
    let githubPRData: any = null;
    let prHtmlUrl = activeRepo?.html_url ? `${activeRepo.html_url}/pull/${newId}` : '';

    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local) {
      try {
        // Push branch to remote
        await executeGitCommand(`git push -u origin "${branchName}"`, repoDir);

        // Open real PR on GitHub
        const defaultBranch = activeRepo.default_branch || 'main';
        const ghRes = await callGitHubAPI(
          `/repos/${activeRepo.full_name}/pulls`,
          cfg.token,
          'POST',
          {
            title: payload.title,
            body: payload.description || `Atualização de governança Context OS`,
            head: branchName,
            base: defaultBranch,
          }
        );

        if (ghRes.statusCode === 201 && ghRes.data) {
          githubPRData = ghRes.data;
          prHtmlUrl = ghRes.data.html_url || prHtmlUrl;
        }
      } catch (err) {
        console.warn('[PRsService] Aviso ao abrir PR no GitHub remoto:', err);
      }
    }

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
      id: githubPRData?.number || newId,
      github_id: githubPRData?.id,
      github_number: githubPRData?.number,
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
      html_url: prHtmlUrl,
    };

    cfg.prs.unshift(newPR);
    if (!cfg.workspace_changes) cfg.workspace_changes = {};
    cfg.workspace_changes[repoName] = [];
    saveConfig(cfg);

    return {
      success: true,
      pr: newPR,
      message: `Pull Request #${newPR.id} criado com sucesso na branch '${branchName}'!`,
    };
  }

  async approvePR(prId: number | string, approverName?: string) {
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
      await this.executeMerge(target);
      target.status = 'MERGED';
      target.merged_at = new Date().toISOString();
      saveConfig(cfg);

      return {
        success: true,
        auto_merged: true,
        pr: target,
        message: `🎉 Quórum de aprovação atingido (${target.approvals.length}/${minApprovals})! O PR #${prId} foi aprovado e mesclado automaticamente na branch main.`,
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

  async mergePR(prId: number | string) {
    const cfg = loadConfig();
    const prs = cfg.prs || [];
    const target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    await this.executeMerge(target);
    target.status = 'MERGED';
    target.merged_at = new Date().toISOString();
    saveConfig(cfg);

    return {
      success: true,
      pr: target,
      message: `PR #${prId} mesclado com sucesso na branch main!`,
    };
  }

  async rejectPR(prId: number | string, reason?: string) {
    const cfg = loadConfig();
    const prs = cfg.prs || [];
    const target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    target.status = 'CLOSED';
    target.closed_at = new Date().toISOString();
    target.rejection_reason = reason || 'Proposta rejeitada pelo revisor.';

    // If GitHub PR exists, close it on GitHub
    const activeRepo = cfg.active_repo;
    if (cfg.authenticated && cfg.token && activeRepo?.full_name && target.github_number) {
      try {
        await callGitHubAPI(
          `/repos/${activeRepo.full_name}/pulls/${target.github_number}`,
          cfg.token,
          'PATCH',
          { state: 'closed' }
        );
      } catch (err) {
        console.warn(`[PRsService] Aviso ao fechar PR no GitHub:`, err);
      }
    }

    saveConfig(cfg);

    return {
      success: true,
      pr: target,
      message: `PR #${prId} foi rejeitado e fechado.`,
    };
  }

  private async executeMerge(targetPR: any) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = targetPR.repo_name || activeRepo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const targetBranch = targetPR.target_branch || 'main';

    try {
      // 1. Local Git Merge
      await executeGitCommand(`git checkout ${targetBranch}`, repoDir);
      if (targetPR.branch) {
        await executeGitCommand(`git merge "${targetPR.branch}" --no-ff -m "Merge PR #${targetPR.id}: ${targetPR.title}"`, repoDir);
      }

      // 2. Remote GitHub Merge (if GitHub PR)
      if (cfg.authenticated && cfg.token && activeRepo?.full_name && targetPR.github_number) {
        await callGitHubAPI(
          `/repos/${activeRepo.full_name}/pulls/${targetPR.github_number}/merge`,
          cfg.token,
          'PUT',
          {
            commit_title: `Merge PR #${targetPR.id}: ${targetPR.title}`,
            merge_method: 'merge',
          }
        );
        // Push local main to remote
        await executeGitCommand(`git push origin ${targetBranch}`, repoDir);
      }

      clearWorkspaceChanges(repoName);
    } catch (err) {
      console.warn(`[PRsService] Aviso ao executar merge de Git:`, err);
    }
  }
}

export const prsService = new PRsService();
