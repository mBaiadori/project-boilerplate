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
import { isPathHidden, loadHiddenFiles, isSystemPath, getSystemFileFriendlyName } from '../../utils/hidden-files.js';
import { aiService } from '../ai/ai.service.js';
import { scanContentForSecrets } from '../../utils/crypto.js';
import { governanceService } from '../governance/governance.service.js';

export interface PRApprovalAudit {
  user: string;
  role?: string;
  timestamp: string;
  commit_hash?: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED';
  comment?: string;
}

export class PRsService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  private getGovernanceRules(repoName: string): { min_approvals: number; is_solo: boolean; anti_self_approval: boolean } {
    const repoDir = this.getRepoDir(repoName);
    const projectConfigPath = path.join(repoDir, '.project.config.json');
    let minApprovals = 1;
    let isSolo = true;
    let antiSelfApproval = false;

    if (fs.existsSync(projectConfigPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
        const collabs = parsed.governance_collaborators || {};
        const memberCount = Object.keys(collabs).length;
        isSolo = memberCount <= 1;

        if (parsed.governance_rules?.min_approvals_default !== undefined) {
          const num = Number(parsed.governance_rules.min_approvals_default);
          if (!isNaN(num) && num >= 1) {
            minApprovals = num;
          }
        }
        antiSelfApproval = parsed.governance_rules?.anti_self_approval !== undefined
          ? parsed.governance_rules.anti_self_approval
          : !isSolo;
      } catch {}
    } else {
      const cfg = loadConfig();
      minApprovals = cfg.governance?.min_approvals || 1;
    }

    return { min_approvals: minApprovals, is_solo: isSolo, anti_self_approval: antiSelfApproval };
  }

  getRepoPRsPath(repoName: string): string {
    const repoDir = this.getRepoDir(repoName);
    return path.join(repoDir, '.spec-memory', 'prs.json');
  }

  loadRepoPRs(repoName: string): any[] {
    const filePath = this.getRepoPRsPath(repoName);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const list = JSON.parse(data);
        if (Array.isArray(list)) return list;
      } catch (e) {
        console.error(`Erro ao carregar prs para ${repoName}:`, e);
      }
    }
    return [];
  }

  saveRepoPRs(repoName: string, prs: any[]): void {
    const filePath = this.getRepoPRsPath(repoName);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(prs, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Erro ao salvar prs para ${repoName}:`, e);
    }
  }

  async getPRs(targetRepoQuery?: string) {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = targetRepoQuery || activeRepo?.name || 'local';
    let allPRs = this.loadRepoPRs(repoName);

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
            this.saveRepoPRs(repoName, allPRs);
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
    const govRules = this.getGovernanceRules(repoName);
    const combinedList = [...repoPRs, ...commitRevisions].map((p: any) => ({
      ...p,
      min_approvals: p.min_approvals || govRules.min_approvals,
      is_solo_mode: govRules.is_solo,
    }));

    return {
      repo: activeRepo,
      repo_name: repoName,
      prs: combinedList,
      count: combinedList.length,
      governance: {
        min_approvals: govRules.min_approvals,
        is_solo_mode: govRules.is_solo,
        anti_self_approval: govRules.anti_self_approval,
        reviewers: cfg.governance?.reviewers || [],
      },
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
      (c) => !isPathHidden(c.path, hiddenList) || isSystemPath(c.path),
    );

    // 2. Gather files from git status (covers untracked and working tree changes)
    const gitStatus = await getGitStatus(repoDir);
    const gitFiles = [
      ...(gitStatus.files || []).filter((f) => !isPathHidden(f.path, hiddenList)),
      ...(gitStatus.systemFiles || []),
    ];

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

        const isLikelyErrorReply = (text: string) => {
          if (!text) return true;
          const lower = text.toLowerCase().trim();
          return (
            lower.startsWith('erro') ||
            lower.startsWith('error') ||
            lower.startsWith('⚠️') ||
            lower.includes('resource has been exhausted') ||
            lower.includes('resourceexhausted') ||
            lower.includes('quota') ||
            lower.includes('rate limit') ||
            lower.includes('429') ||
            lower.includes('503') ||
            lower.includes('não configurada') ||
            lower.includes('não suportado') ||
            lower.includes('overloaded') ||
            lower.includes('high demand') ||
            lower.includes('failed to fetch') ||
            lower.includes('unauthorized') ||
            lower.includes('invalid_api_key')
          );
        };

        if (aiResult?.reply && !isLikelyErrorReply(aiResult.reply)) {
          let cleanJson = aiResult.reply.trim();
          if (cleanJson.includes('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          } else if (cleanJson.includes('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
          }

          try {
            const parsed = JSON.parse(cleanJson);
            if (
              parsed.title &&
              typeof parsed.title === 'string' &&
              (parsed.description || parsed.body)
            ) {
              const desc = String(parsed.description || parsed.body);
              if (!isLikelyErrorReply(parsed.title) && !isLikelyErrorReply(desc)) {
                return {
                  success: true,
                  title: parsed.title,
                  description: desc,
                  body: desc,
                  type: 'docs',
                  layer: 'Especificações',
                };
              }
            }
          } catch {
            console.warn('[PRsService] Resposta da IA não é um JSON válido. Acionando gerador heurístico local.');
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
    const gitFiles = [
      ...(gitStatus.files || []).filter((f) => !isPathHidden(f.path, hiddenList)),
      ...(gitStatus.systemFiles || []),
    ];
    const rawChanges = (cfg.workspace_changes?.[repoName] || []).filter(
      (c) => !isPathHidden(c.path, hiddenList) || isSystemPath(c.path),
    );

    const allChangedPaths = Array.from(
      new Set([...rawChanges.map((c) => c.path), ...gitFiles.map((f) => f.path)])
    );

    if (allChangedPaths.length === 0) {
      throw new Error('Não há alterações pendentes para criar um PR.');
    }

    // 0. Pre-PR / Pre-Commit Secret Scanner Guard
    const violations: Array<{ file: string; rule: string; message: string }> = [];
    for (const p of allChangedPaths) {
      const fullPath = path.join(repoDir, p);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          const scan = scanContentForSecrets(fileContent, p);
          if (scan.hasSecrets) {
            violations.push(...scan.violations);
          }
        } catch {}
      }
    }

    if (violations.length > 0) {
      const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Dev Local';
      const violationSummary = violations.map((v) => `${v.file}: ${v.message}`).join('; ');
      governanceService.logAudit(repoName, {
        action: 'SECRET_BLOCKED',
        actor,
        target: `PR branch '${payload.branch || 'new-pr'}'`,
        details: `Criação de PR bloqueada por violações de segredos: ${violationSummary}`,
      });
      throw new Error(
        `[Secret Guard] Criação de PR bloqueada! Foram detectados segredos ou documentos confidenciais não criptografados: ${violationSummary}`
      );
    }

    const repoPRs = this.loadRepoPRs(repoName);
    const newId = repoPRs.length + 1;
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

    repoPRs.unshift(newPR);
    this.saveRepoPRs(repoName, repoPRs);
    clearWorkspaceChanges(repoName);

    return {
      success: true,
      pr: newPR,
      message: `Pull Request #${newPR.id} criado com sucesso na branch '${branchName}'!`,
    };
  }

  async approvePR(
    prId: number | string,
    payloadOrApprover?: string | { approver?: string; role?: string; comment?: string }
  ) {
    const cfg = loadConfig();
    const repoName = (payloadOrApprover && typeof payloadOrApprover === 'object' && (payloadOrApprover as any).repo) || cfg.active_repo?.name || 'local';
    let prs = this.loadRepoPRs(repoName);
    let target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target && repoName !== 'local') {
      const fallbackPRs = this.loadRepoPRs('local');
      target = fallbackPRs.find((p: any) => String(p.id) === String(prId));
      if (target) prs = fallbackPRs;
    }

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    if (target.status === 'MERGED') {
      throw new Error(`PR #${prId} já está aprovado e mesclado.`);
    }

    if (target.status === 'CLOSED') {
      throw new Error(`PR #${prId} está fechado e não pode ser aprovado.`);
    }

    const repoDir = this.getRepoDir(repoName);
    const govRules = this.getGovernanceRules(repoName);
    const minApprovals = target.min_approvals || govRules.min_approvals || 1;

    let approverName: string | undefined;
    let approverRole: string | undefined;
    let approverComment: string | undefined;

    if (typeof payloadOrApprover === 'string') {
      approverName = payloadOrApprover;
    } else if (payloadOrApprover && typeof payloadOrApprover === 'object') {
      approverName = payloadOrApprover.approver;
      approverRole = payloadOrApprover.role;
      approverComment = payloadOrApprover.comment;
    }

    const userLogin = cfg.user?.login;
    let approver = approverName || (userLogin ? `@${userLogin}` : '@tech-lead');
    if (!approver.startsWith('@')) {
      approver = `@${approver}`;
    }

    // Anti-Self-Approval check (Enforced in Team Mode)
    const authorHandle = (target.author || '').trim();
    const cleanAuthor = authorHandle.replace(/^@/, '').toLowerCase();
    const cleanApprover = approver.replace(/^@/, '').toLowerCase();

    if (!govRules.is_solo && govRules.anti_self_approval && cleanAuthor && cleanAuthor === cleanApprover) {
      throw new Error(`O autor da proposta (${target.author}) não pode aprovar o seu próprio Pull Request no Modo Equipe. É necessária a revisão de um colaborador independente.`);
    }

    // Get current HEAD commit hash of the PR branch for immutable audit trail
    let currentCommitHash = '';
    if (target.branch) {
      try {
        const revRes = await executeGitCommand(`git rev-parse "${target.branch}"`, repoDir);
        if (revRes.success && revRes.stdout) {
          currentCommitHash = revRes.stdout.trim();
        }
      } catch {}
    }
    if (!currentCommitHash) {
      currentCommitHash = target.commit_hash || '';
    }

    if (!Array.isArray(target.approvals)) {
      target.approvals = [];
    }

    // Create structured audit record
    const auditRecord: PRApprovalAudit = {
      user: approver,
      role: approverRole || (govRules.is_solo ? 'Autor / Desenvolvedor Solo' : 'Tech Lead / Revisor'),
      timestamp: new Date().toISOString(),
      commit_hash: currentCommitHash,
      status: 'APPROVED',
      comment: approverComment || '',
    };

    // Replace if this user previously approved, otherwise append
    const existingIdx = target.approvals.findIndex((app: any) => {
      const u = typeof app === 'string' ? app : app.user;
      return u?.toLowerCase() === approver.toLowerCase();
    });

    if (existingIdx >= 0) {
      target.approvals[existingIdx] = auditRecord;
    } else {
      target.approvals.push(auditRecord);
    }

    // Calculate unique valid approvals (excluding author in Team mode)
    const validApprovers = new Set<string>();
    for (const app of target.approvals) {
      const u = typeof app === 'string' ? app : app.user;
      const cleanU = (u || '').replace(/^@/, '').toLowerCase();
      if (govRules.is_solo || cleanU !== cleanAuthor) {
        if (cleanU) validApprovers.add(cleanU);
      }
    }
    const validCount = validApprovers.size;
    const quorumReached = govRules.is_solo ? validCount >= 1 : validCount >= minApprovals;

    target.status = 'OPEN';

    // Synchronize review officially with GitHub API if authenticated
    const activeRepo = cfg.active_repo;
    if (cfg.authenticated && cfg.token && activeRepo?.full_name && target.github_number) {
      try {
        await callGitHubAPI(
          `/repos/${activeRepo.full_name}/pulls/${target.github_number}/reviews`,
          cfg.token,
          'POST',
          {
            event: 'APPROVE',
            body: approverComment || `✓ Aprovado via Context OS Governance Platform por ${approver} (${approverRole || 'Revisor'})`,
          }
        );
      } catch (ghReviewErr) {
        console.warn('[PRsService] Aviso ao sincronizar review no GitHub:', ghReviewErr);
      }
    }

    this.saveRepoPRs(repoName, prs);

    return {
      success: true,
      quorum_reached: quorumReached,
      approvals_count: validCount,
      min_approvals: govRules.is_solo ? 1 : minApprovals,
      is_solo_mode: govRules.is_solo,
      pr: target,
      message: quorumReached
        ? govRules.is_solo
          ? `✓ Aprovação registrada por ${approver} (Modo Solo: merge liberado).`
          : `🎉 Quórum de aprovação atingido (${validCount}/${minApprovals}) com o voto de ${approver}! O merge está liberado para publicação.`
        : `✓ Aprovação registrada por ${approver} (${validCount}/${minApprovals}). Aguardando quórum para liberação do merge.`,
    };
  }

  async mergePR(prId: number | string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    let prs = this.loadRepoPRs(repoName);
    let target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target && repoName !== 'local') {
      const fallbackPRs = this.loadRepoPRs('local');
      target = fallbackPRs.find((p: any) => String(p.id) === String(prId));
      if (target) prs = fallbackPRs;
    }

    if (!target) {
      throw new Error(`PR #${prId} não encontrado.`);
    }

    if (target.status === 'MERGED') {
      throw new Error(`PR #${prId} já foi mesclado anteriormente.`);
    }

    if (target.status === 'CLOSED') {
      throw new Error(`PR #${prId} está arquivado/fechado e não pode ser mesclado.`);
    }

    const govRules = this.getGovernanceRules(repoName);
    const minApprovals = target.min_approvals || govRules.min_approvals || 1;

    // Strict Quorum validation before merge (Solo mode allows author signoff)
    const authorHandle = (target.author || '').trim();
    const cleanAuthor = authorHandle.replace(/^@/, '').toLowerCase();

    const approvalsList = Array.isArray(target.approvals) ? target.approvals : [];
    const validApprovers = new Set<string>();
    for (const app of approvalsList) {
      const u = typeof app === 'string' ? app : app.user;
      const cleanU = (u || '').replace(/^@/, '').toLowerCase();
      if (govRules.is_solo || cleanU !== cleanAuthor) {
        if (cleanU) validApprovers.add(cleanU);
      }
    }

    if (!govRules.is_solo && validApprovers.size < minApprovals) {
      throw new Error(
        `Quórum de aprovação não atingido. São necessárias pelo menos ${minApprovals} aprovações de revisores independentes antes de realizar o merge (atual: ${validApprovers.size}).`
      );
    }

    await this.executeMerge(target);
    target.status = 'MERGED';
    target.merged_at = new Date().toISOString();
    this.saveRepoPRs(repoName, prs);

    return {
      success: true,
      pr: target,
      message: `PR #${prId} aprovado com quórum (${validApprovers.size}/${minApprovals}) e mesclado com sucesso na versão oficial!`,
    };
  }

  async editPRFile(payload: {
    id: number | string;
    filePath: string;
    content: string;
    commitMessage?: string;
    author?: string;
    repo?: string;
  }) {
    const cfg = loadConfig();
    const repoName = payload.repo || cfg.active_repo?.name || 'local';
    const prs = this.loadRepoPRs(repoName);
    const target = prs.find((p: any) => String(p.id) === String(payload.id));

    if (!target) {
      throw new Error(`PR #${payload.id} não encontrado.`);
    }

    if (target.status === 'MERGED' || target.status === 'CLOSED') {
      throw new Error(`Não é possível editar arquivos de um PR finalizado ou arquivado.`);
    }

    const repoDir = this.getRepoDir(repoName);
    const branchName = target.branch;

    if (!branchName) {
      throw new Error(`Branch associada ao PR #${payload.id} não foi encontrada.`);
    }

    // Checkout the PR branch
    await executeGitCommand(`git checkout "${branchName}"`, repoDir);

    // Ensure directory exists and write file
    const fullFilePath = path.join(repoDir, payload.filePath);
    fs.mkdirSync(path.dirname(fullFilePath), { recursive: true });
    fs.writeFileSync(fullFilePath, payload.content, 'utf-8');

    // Commit changes on PR branch
    await executeGitCommand(`git add "${payload.filePath}"`, repoDir);
    const editor = payload.author || cfg.user?.login ? `@${cfg.user?.login}` : 'Colaborador';
    const commitMsg = payload.commitMessage || `docs: edições colaborativas em ${payload.filePath} por ${editor}`;
    await executeGitCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, repoDir);

    // Push to GitHub remote if authenticated
    const activeRepo = cfg.active_repo;
    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local) {
      try {
        await executeGitCommand(`git push origin "${branchName}"`, repoDir);
      } catch (pushErr) {
        console.warn(`[PRsService] Aviso ao sincronizar edição no GitHub:`, pushErr);
      }
    }

    // INVARIÂNCIA DE GOVERNANÇA: Invalida / reseta aprovações anteriores após novas edições
    const prevApprovalsCount = (target.approvals || []).length;
    target.approvals = [];
    target.rejection_reason = undefined;

    // Refresh file list for PR
    if (Array.isArray(target.files)) {
      const fileIdx = target.files.findIndex((f: any) => f.path === payload.filePath);
      const diffData = computeDiff('', payload.content, payload.filePath);
      const fileObj = {
        path: payload.filePath,
        type: fileIdx >= 0 ? 'MODIFIED' : 'ADDED',
        additions: diffData.additions,
        deletions: diffData.deletions,
        diff_text: diffData.diff_text,
        new_content: payload.content,
      };
      if (fileIdx >= 0) {
        target.files[fileIdx] = { ...target.files[fileIdx], ...fileObj };
      } else {
        target.files.push(fileObj);
      }
    }

    this.saveRepoPRs(repoName, prs);

    return {
      success: true,
      reset_approvals: prevApprovalsCount > 0,
      pr: target,
      message: `Documento "${payload.filePath}" atualizado com sucesso na branch '${branchName}'! ${
        prevApprovalsCount > 0
          ? 'As aprovações anteriores foram resetadas para revalidação pelos revisores.'
          : ''
      }`,
    };
  }

  async rejectPR(prId: number | string, reason?: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    let prs = this.loadRepoPRs(repoName);
    let target = prs.find((p: any) => String(p.id) === String(prId));

    if (!target && repoName !== 'local') {
      const fallbackPRs = this.loadRepoPRs('local');
      target = fallbackPRs.find((p: any) => String(p.id) === String(prId));
      if (target) prs = fallbackPRs;
    }

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

    this.saveRepoPRs(repoName, prs);

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
      const prs = this.loadRepoPRs(repoName);
      const pr = prs.find((p: any) => String(p.id) === String(payload.id));
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

    // Format audit trailers for Git merge commit
    const approvalsList = Array.isArray(targetPR.approvals) ? targetPR.approvals : [];
    const auditLines = approvalsList.map((app: any) => {
      if (typeof app === 'string') {
        return `Approved-by: ${app}`;
      }
      const user = app.user || 'Unknown';
      const role = app.role ? ` [${app.role}]` : '';
      const hash = app.commit_hash ? ` (commit: ${app.commit_hash.slice(0, 7)})` : '';
      const date = app.timestamp ? ` on ${app.timestamp.split('T')[0]}` : '';
      return `Approved-by: ${user}${role}${hash}${date}`;
    });

    const trailers = auditLines.length > 0 ? `\n\n${auditLines.join('\n')}\nReviewed-in: Context OS Governance Platform` : '';
    const commitMsg = `Merge PR #${targetPR.id}: ${targetPR.title}${trailers}`;

    try {
      // 1. Local Git Merge
      await executeGitCommand(`git checkout ${targetBranch}`, repoDir);
      if (targetPR.branch) {
        await executeGitCommand(`git merge "${targetPR.branch}" --no-ff -m "${commitMsg.replace(/"/g, '\\"')}"`, repoDir);
      }

      // 2. Remote GitHub Merge (if GitHub PR)
      if (cfg.authenticated && cfg.token && activeRepo?.full_name && targetPR.github_number) {
        await callGitHubAPI(
          `/repos/${activeRepo.full_name}/pulls/${targetPR.github_number}/merge`,
          cfg.token,
          'PUT',
          {
            commit_title: `Merge PR #${targetPR.id}: ${targetPR.title}`,
            commit_message: auditLines.join('\n'),
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
