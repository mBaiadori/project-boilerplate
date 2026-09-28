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
  getGitStatus,
  getGitDiff,
  rollbackToCommit,
} from '../../utils/git.js';
import { computeDiff } from '../../utils/diff.js';
import { isPathHidden, loadHiddenFiles } from '../../utils/hidden-files.js';
import { aiService } from '../ai/ai.service.js';

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

  async generatePRSummary(repoNameQuery?: string) {
    const cfg = loadConfig();
    const repoName = repoNameQuery || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const hiddenList = loadHiddenFiles(repoDir);

    // 1. Gather files from workspace_changes
    const wsChanges = (cfg.workspace_changes?.[repoName] || []).filter(
      (c) => !isPathHidden(c.path, hiddenList),
    );

    // 2. Gather files from git status (covers untracked and working tree changes)
    const gitStatus = await getGitStatus(repoDir);
    const gitFiles = (gitStatus.files || []).filter(
      (f) => !isPathHidden(f.path, hiddenList),
    );

    const allPathsSet = new Set<string>([
      ...wsChanges.map((c) => c.path),
      ...gitFiles.map((f) => f.path),
    ]);

    const changedPaths = Array.from(allPathsSet);

    if (changedPaths.length === 0) {
      return {
        success: true,
        title: 'docs: atualização de especificações',
        description: 'Nenhuma alteração pendente detectada no repositório.',
        body: 'Nenhuma alteração pendente detectada no repositório.',
        type: 'docs',
        layer: 'Geral',
      };
    }

    // 3. Extract diff snippets for the modified files
    const diffSnippets: string[] = [];
    for (const p of changedPaths.slice(0, 10)) {
      const wsChange = wsChanges.find((c) => c.path === p);
      if (wsChange && (wsChange.old_content || wsChange.new_content)) {
        const diffData = computeDiff(wsChange.old_content || '', wsChange.new_content || '', p);
        if (diffData.diff_text) {
          diffSnippets.push(`--- ${p} (${wsChange.type}) ---\n${diffData.diff_text.slice(0, 1000)}`);
          continue;
        }
      }

      const fileDiff = await getGitDiff(repoDir, p);
      if (fileDiff?.diff) {
        diffSnippets.push(`--- ${p} ---\n${fileDiff.diff.slice(0, 1000)}`);
      } else {
        diffSnippets.push(`--- ${p} (adicionado/modificado) ---`);
      }
    }

    const combinedDiff = diffSnippets.join('\n\n').slice(0, 4000);

    // 4. If AI provider is configured, try calling LLM
    if (cfg.ai_settings && (cfg.ai_settings.api_key || cfg.ai_settings.provider === 'ollama' || cfg.ai_settings.custom_endpoint)) {
      try {
        const aiPrompt = `Você é um Engenheiro de Software Sênior especialista em Governança Documental e Arquitetura de Software.
Analise o resumo das seguintes alterações de arquivos e diffs no repositório "${repoName}":

ARQUIVOS MODIFICADOS (${changedPaths.length}):
${changedPaths.map((p) => `- ${p}`).join('\n')}

DIFFS E CONTEÚDOS:
${combinedDiff || 'Arquivos adicionados ou atualizados no repositório.'}

Sua tarefa:
Gere um título e uma descrição em Markdown para o Pull Request (Proposta de Evolução).

Retorne APENAS um JSON válido no formato:
{
  "title": "<Título conciso em Conventional Commits, ex: docs(automovel): adicionar especificações canônicas de veículos, motor e combustíveis>",
  "description": "<Resumo claro com seções em Markdown detalhando: Visão Geral, Principais Mudanças e Impacto na Governança>"
}`;

        const aiResult = await aiService.callLLM(
          cfg.ai_settings,
          aiPrompt,
          '',
          'git-diff',
          [],
          'Você é o assistente gerador de resumos de Pull Requests do Context OS. Responda apenas com o JSON requerido.',
          repoName,
        );

        if (aiResult?.reply) {
          let cleanJson = aiResult.reply.trim();
          if (cleanJson.includes('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          } else if (cleanJson.includes('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
          }

          try {
            const parsed = JSON.parse(cleanJson);
            if (parsed.title && (parsed.description || parsed.body)) {
              const desc = parsed.description || parsed.body;
              return {
                success: true,
                title: parsed.title,
                description: desc,
                body: desc,
                type: 'docs',
                layer: 'Especificações',
              };
            }
          } catch {
            if (cleanJson.length > 20) {
              const firstLine = cleanJson.split('\n')[0].replace(/^[#*\s-]+/, '').trim();
              const autoTitle = firstLine.length < 80 ? firstLine : `docs: atualização de ${changedPaths.length} documento(s)`;
              return {
                success: true,
                title: autoTitle,
                description: cleanJson,
                body: cleanJson,
                type: 'docs',
                layer: 'Especificações',
              };
            }
          }
        }
      } catch (aiErr) {
        console.warn('[PRsService] Falha ao gerar resumo com LLM, usando fallback heurístico:', aiErr);
      }
    }

    // 5. Intelligent Deterministic Heuristic Fallback (Zero-Config, Instant, No API Key Required)
    const fileDetails: Array<{ path: string; name: string; title: string; action: string; module: string }> = [];

    for (const p of changedPaths) {
      const fullPath = path.join(repoDir, p);
      let docTitle = path.basename(p, path.extname(p));
      let action = 'Modificado';

      const gitItem = gitFiles.find((f) => f.path === p);
      const wsItem = wsChanges.find((c) => c.path === p);

      if (gitItem?.status === '??' || wsItem?.type === 'ADDED') {
        action = 'Novo Documento';
      } else if (gitItem?.status === 'D' || wsItem?.type === 'DELETED') {
        action = 'Removido';
      }

      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Match YAML frontmatter title or # Heading 1
          const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatterMatch) {
            const titleMatch = frontmatterMatch[1].match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
            if (titleMatch && titleMatch[1].trim()) {
              docTitle = titleMatch[1].trim();
            }
          }
          if (docTitle === path.basename(p, path.extname(p))) {
            const h1Match = content.match(/^#\s+([^\r\n]+)/m);
            if (h1Match && h1Match[1].trim()) {
              docTitle = h1Match[1].replace(/^[📄🏛️📌✨🔧📋\s]+/, '').trim();
            }
          }
        } catch {}
      }

      const parts = p.split('/');
      const moduleName = parts.length > 1 ? parts[0] : 'raiz';

      fileDetails.push({
        path: p,
        name: path.basename(p),
        title: docTitle,
        action,
        module: moduleName,
      });
    }

    const allNew = fileDetails.every((f) => f.action === 'Novo Documento');
    const allDeleted = fileDetails.every((f) => f.action === 'Removido');
    const commitPrefix = allNew ? 'feat' : allDeleted ? 'refactor' : 'docs';

    const uniqueModules = Array.from(new Set(fileDetails.map((f) => f.module).filter((m) => m !== 'raiz')));
    const moduleScope = uniqueModules.length === 1 ? `(${uniqueModules[0]})` : uniqueModules.length > 1 ? `(${uniqueModules.slice(0, 2).join('-')})` : '';

    const titleAction = allNew ? 'adicionar' : allDeleted ? 'remover' : 'atualizar';
    const namesList = fileDetails.slice(0, 4).map((f) => f.name.replace(/\.md$/i, '')).join(', ');
    const autoTitle = `${commitPrefix}${moduleScope}: ${titleAction} especificações de ${namesList}${fileDetails.length > 4 ? ` e mais ${fileDetails.length - 4} arquivos` : ''}`;

    const autoDescription = `## 📋 Visão Geral da Proposta\n\n` +
      `Esta proposta de evolução reúne alterações em **${fileDetails.length} documento(s)** no repositório \`${repoName}\`.\n\n` +
      `### 📂 Documentos Impactados:\n\n` +
      `| Documento | Módulo / Domínio | Ação | Título Canônico |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      fileDetails.map((f) => `| \`${f.path}\` | \`${f.module}\` | **${f.action}** | ${f.title} |`).join('\n') +
      `\n\n### 🎯 Objetivos de Governança:\n` +
      `- Manter a documentação viva e canônica sincronizada com a arquitetura.\n` +
      `- Rastrear as evoluções através do fluxo formal de revisão e Pull Request.\n\n` +
      `*Gerado automaticamente pelo motor de governança do Context OS.*`;

    return {
      success: true,
      title: autoTitle,
      description: autoDescription,
      body: autoDescription,
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
    const repoDir = this.getRepoDir(repoName);
    const hiddenList = loadHiddenFiles(repoDir);
    const gitStatus = await getGitStatus(repoDir);
    const gitFiles = (gitStatus.files || []).filter(
      (f) => !isPathHidden(f.path, hiddenList),
    );
    const rawChanges = (cfg.workspace_changes?.[repoName] || []).filter(
      (c) => !isPathHidden(c.path, hiddenList),
    );

    const allChangedPaths = Array.from(
      new Set([...rawChanges.map((c) => c.path), ...gitFiles.map((f) => f.path)])
    );

    if (allChangedPaths.length === 0) {
      throw new Error('Não há alterações pendentes para criar um PR.');
    }

    if (!cfg.prs) cfg.prs = [];

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

    const detailedChanges = allChangedPaths.map((p) => {
      const wsChange = rawChanges.find((c) => c.path === p);
      if (wsChange) {
        const diffData = computeDiff(wsChange.old_content || '', wsChange.new_content || '', wsChange.path);
        return {
          path: wsChange.path,
          type: wsChange.type,
          additions: diffData.additions,
          deletions: diffData.deletions,
          diff_text: diffData.diff_text,
          old_content: wsChange.old_content,
          new_content: wsChange.new_content,
        };
      }
      const gitItem = gitFiles.find((f) => f.path === p);
      const isNew = gitItem?.status === '??' || gitItem?.status === 'A';
      const isDeleted = gitItem?.status === 'D';
      return {
        path: p,
        type: isNew ? 'ADDED' : isDeleted ? 'DELETED' : 'MODIFIED',
        additions: 1,
        deletions: 0,
        diff_text: '',
        old_content: '',
        new_content: '',
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

  async rollbackRevision(payload: { id?: string | number; commit_hash?: string; repo?: string }) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = payload.repo || activeRepo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);

    let targetHash = payload.commit_hash;
    let targetTitle = '';

    if (!targetHash && payload.id) {
      // Check PR list
      const pr = (cfg.prs || []).find((p: any) => String(p.id) === String(payload.id));
      if (pr) {
        targetHash = pr.commit_hash || String(pr.id);
        targetTitle = pr.title || '';
      } else {
        targetHash = String(payload.id);
      }
    }

    if (!targetHash) {
      throw new Error('Identificador da versão ou código da revisão não informado.');
    }

    const result = await rollbackToCommit(repoDir, targetHash, targetTitle);
    if (!result.success) {
      throw new Error(result.message);
    }

    // If GitHub remote repo is active and authenticated, push to remote main
    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local && activeRepo?.name === repoName) {
      try {
        await executeGitCommand(`git push origin main`, repoDir);
      } catch (pushErr) {
        console.warn('[PRsService] Aviso ao sincronizar rollback com o GitHub remoto:', pushErr);
      }
    }

    clearWorkspaceChanges(repoName);

    return {
      success: true,
      message: result.message,
      new_commit_hash: result.newCommitHash,
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
