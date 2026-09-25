import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, saveConfig, clearWorkspaceChanges } from '../../config/storage.js';
import {
  callGitHubAPI,
  ensureGitRepo,
  commitChanges,
  createAndCheckoutBranch,
  executeGitCommand,
  getGitLog,
} from '../../utils/git.js';
import { computeDiff } from '../../utils/diff.js';

export class PRsService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  async getPRs(targetRepoQuery?: string) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = targetRepoQuery || activeRepo?.name || 'local';
    let allPRs = cfg.prs || [];

    // Auto-sync remote GitHub Pull Requests if authenticated and target matches active repo
    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local && activeRepo?.name === repoName) {
      try {
        const ghRes = await callGitHubAPI(`/repos/${activeRepo.full_name}/pulls?state=all`, cfg.token);
        if (ghRes.statusCode === 200 && Array.isArray(ghRes.data)) {
          let modified = false;
          for (const ghPR of ghRes.data) {
            const existingIdx = allPRs.findIndex((p: any) =>
              (p.github_number && p.github_number === ghPR.number) ||
              (p.github_id && p.github_id === ghPR.id) ||
              (p.repo_name === repoName && String(p.id) === String(ghPR.number))
            );
            const status = ghPR.merged_at ? 'MERGED' : ghPR.state === 'closed' ? 'CLOSED' : 'OPEN';
            if (existingIdx >= 0) {
              const existing = allPRs[existingIdx];
              if (existing.status !== status || !existing.html_url) {
                existing.status = status;
                existing.html_url = ghPR.html_url;
                if (ghPR.merged_at) existing.merged_at = ghPR.merged_at;
                if (ghPR.closed_at) existing.closed_at = ghPR.closed_at;
                modified = true;
              }
            } else {
              allPRs.unshift({
                id: ghPR.number,
                github_id: ghPR.id,
                github_number: ghPR.number,
                repo_name: repoName,
                title: ghPR.title || `PR #${ghPR.number}`,
                description: ghPR.body || '',
                branch: ghPR.head?.ref || '',
                target_branch: ghPR.base?.ref || 'main',
                status,
                created_at: ghPR.created_at,
                merged_at: ghPR.merged_at,
                closed_at: ghPR.closed_at,
                author: ghPR.user?.login ? `@${ghPR.user.login}` : 'GitHub User',
                approvals: [],
                type: 'docs',
                layer: 'Geral',
                domain: '',
                files: [],
                html_url: ghPR.html_url,
              });
              modified = true;
            }
          }
          if (modified) {
            cfg.prs = allPRs;
            saveConfig(cfg);
          }
        }
      } catch (ghErr) {
        console.warn('[PRsService] Aviso ao sincronizar PRs do GitHub:', ghErr);
      }
    }

    // 1. STRICT ISOLATION: Filter PRs belonging to this specific repository
    const repoPRs = allPRs.filter((p: any) => p.repo_name === repoName || (!p.repo_name && repoName === 'local'));

    // 2. Fetch Git Commits on main as Official Revisions (all changes on main are revisions)
    const repoDir = this.getRepoDir(repoName);
    const gitCommits = await getGitLog(repoDir, 50);

    const existingHashes = new Set(repoPRs.map((p: any) => String(p.commit_hash || p.github_number || p.id)));
    const existingTitles = new Set(repoPRs.map((p: any) => (p.title || '').trim().toLowerCase()));

    const commitRevisions: any[] = [];
    for (const c of gitCommits) {
      // Avoid duplicating if commit was already created by a PR
      if (existingHashes.has(c.hash) || existingHashes.has(c.shortHash) || existingTitles.has((c.message || '').trim().toLowerCase())) {
        continue;
      }

      // Retrieve files changed in this commit
      let commitFiles: any[] = [];
      try {
        const numStatRes = await executeGitCommand(`git show --numstat --pretty="" ${c.hash}`, repoDir);
        if (numStatRes.success && numStatRes.stdout) {
          commitFiles = numStatRes.stdout.split('\n').filter(Boolean).map((line) => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
              const additions = parseInt(parts[0], 10) || 0;
              const deletions = parseInt(parts[1], 10) || 0;
              const filePath = parts[2];
              return {
                path: filePath,
                type: additions > 0 && deletions === 0 ? 'ADDED' : deletions > 0 && additions === 0 ? 'DELETED' : 'MODIFIED',
                additions,
                deletions,
              };
            }
            return null;
          }).filter(Boolean);
        }
      } catch (err) {
        console.warn(`[PRsService] Erro ao obter files do commit ${c.hash}:`, err);
      }

      commitRevisions.push({
        id: c.shortHash,
        short_id: c.shortHash,
        commit_hash: c.hash,
        repo_name: repoName,
        title: c.message,
        description: `Revisão oficial comitada diretamente na branch main em ${c.date}`,
        branch: 'main',
        target_branch: 'main',
        status: 'MERGED',
        created_at: c.date,
        merged_at: c.date,
        author: c.author ? (c.author.startsWith('@') ? c.author : `@${c.author}`) : 'Git Committer',
        approvals: ['Oficial (main)'],
        type: c.message.startsWith('feat') ? 'feat' : c.message.startsWith('fix') ? 'fix' : 'docs',
        layer: 'Versão Oficial (main)',
        domain: '',
        is_direct_commit: true,
        files: commitFiles,
        html_url: activeRepo?.html_url ? `${activeRepo.html_url}/commit/${c.hash}` : '',
      });
    }

    // Combine: open PRs first, then merged PRs and commit revisions
    const combinedList = [...repoPRs, ...commitRevisions];

    return {
      repo: activeRepo,
      repo_name: repoName,
      prs: combinedList,
      count: combinedList.length,
      governance: cfg.governance || { min_approvals: 1, reviewers: [] },
    };
  }

  async getPRFileDiff(repoName: string, filePath: string, commitHash?: string) {
    const repoDir = this.getRepoDir(repoName);
    if (commitHash) {
      const res = await executeGitCommand(`git show ${commitHash} -- "${filePath}"`, repoDir);
      return res.stdout || '';
    }
    return '';
  }

  generatePRSummary(repoNameQuery?: string) {
    const cfg = loadConfig();
    const repoName = repoNameQuery || cfg.active_repo?.name || 'local';
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
    repo?: string;
  }) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = payload.repo || activeRepo?.name || 'local';
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
