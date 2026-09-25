import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function executeGitCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (error: any) {
    return { stdout: '', stderr: error.message || String(error), success: false };
  }
}

export async function callGitHubAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  data: any = null
): Promise<{ statusCode: number; data: any }> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Context-OS-Spec-Driven',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, options);
    let resData: any = {};
    const text = await res.text();
    try {
      resData = text ? JSON.parse(text) : {};
    } catch {
      resData = { message: text };
    }
    return { statusCode: res.status, data: resData };
  } catch (err: any) {
    return { statusCode: 500, data: { message: err.message || 'Erro de conexão com o GitHub' } };
  }
}

export async function applyBranchProtection(
  repoFullName: string,
  branch: string,
  token: string,
  requiredApprovals: number = 1
): Promise<{ statusCode: number; data: any }> {
  const endpoint = `/repos/${repoFullName}/branches/${branch}/protection`;
  const body = {
    required_status_checks: null,
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: requiredApprovals,
    },
    restrictions: null,
  };

  return await callGitHubAPI(endpoint, token, 'PUT', body);
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | 'U' | 'R' | 'C' | '??';
  staged: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  tracking?: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  files: GitFileStatus[];
  remoteUrl?: string;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export async function isGitRepo(repoDir: string): Promise<boolean> {
  if (!fs.existsSync(repoDir)) return false;
  const gitDir = path.join(repoDir, '.git');
  return fs.existsSync(gitDir);
}

export async function ensureGitRepo(
  repoDir: string,
  user?: { name?: string; login?: string; email?: string } | null,
  remoteUrl?: string,
  token?: string,
  repoName?: string
): Promise<{ success: boolean; message: string }> {
  const gitExists = await isGitRepo(repoDir);

  // Form authenticated clone URL if applicable
  let authRemoteUrl = remoteUrl || '';
  if (remoteUrl && token && remoteUrl.startsWith('https://github.com/')) {
    const repoPath = remoteUrl.replace('https://github.com/', '').replace(/\.git$/, '');
    authRemoteUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`;
  }

  if (authRemoteUrl) {
    if (!gitExists) {
      // Clean non-git directory if it was created as empty or partial folder
      if (fs.existsSync(repoDir)) {
        try {
          fs.rmSync(repoDir, { recursive: true, force: true });
        } catch {}
      }
      fs.mkdirSync(path.dirname(repoDir), { recursive: true });
      const cloneRes = await executeGitCommand(`git clone "${authRemoteUrl}" "${repoDir}"`, path.dirname(repoDir));
      if (!cloneRes.success || !(await isGitRepo(repoDir))) {
        console.warn(`[Git] Fallback clone para ${repoDir}:`, cloneRes.stderr);
        // Fallback init
        fs.mkdirSync(repoDir, { recursive: true });
        await executeGitCommand('git init -b main', repoDir);
        await executeGitCommand(`git remote add origin "${authRemoteUrl}"`, repoDir);
      }
    }

    // Ensure remote origin and pull/sync latest files
    if (await isGitRepo(repoDir)) {
      const remoteCheck = await executeGitCommand('git remote get-url origin', repoDir);
      if (remoteCheck.success) {
        await executeGitCommand(`git remote set-url origin "${authRemoteUrl}"`, repoDir);
      } else {
        await executeGitCommand(`git remote add origin "${authRemoteUrl}"`, repoDir);
      }

      try {
        await executeGitCommand('git fetch origin', repoDir);
        const branchRes = await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoDir);
        let currentBranch = branchRes.stdout || 'main';
        if (currentBranch === 'HEAD') {
          currentBranch = 'main';
        }

        const pullRes = await executeGitCommand(`git pull origin ${currentBranch} --ff-only`, repoDir);
        if (!pullRes.success) {
          // If pull fails due to divergent histories (e.g. dummy local commit), sync to remote branch
          const checkRemote = await executeGitCommand(`git rev-parse --verify origin/${currentBranch}`, repoDir);
          if (checkRemote.success) {
            await executeGitCommand(`git reset --hard origin/${currentBranch}`, repoDir);
            await executeGitCommand(`git branch -u origin/${currentBranch} ${currentBranch}`, repoDir);
          } else {
            // Check if origin has master
            const checkMaster = await executeGitCommand('git rev-parse --verify origin/master', repoDir);
            if (checkMaster.success) {
              await executeGitCommand('git checkout -B master origin/master', repoDir);
            }
          }
        }
      } catch (syncErr) {
        console.warn(`[Git] Aviso de sincronização remota para ${repoDir}:`, syncErr);
      }
    }
  } else {
    // Local-only repository
    if (!gitExists) {
      if (!fs.existsSync(repoDir)) {
        fs.mkdirSync(repoDir, { recursive: true });
      }

      const initRes = await executeGitCommand('git init -b main', repoDir);
      if (!initRes.success) {
        await executeGitCommand('git init', repoDir);
        await executeGitCommand('git branch -M main', repoDir);
      }

      const gitignorePath = path.join(repoDir, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        const defaultGitignore = `.DS_Store\nnode_modules/\n*.log\n.env\n`;
        fs.writeFileSync(gitignorePath, defaultGitignore, 'utf-8');
      }

      await executeGitCommand('git add .', repoDir);
      await executeGitCommand('git commit -m "chore: initial commit"', repoDir);
    }
  }

  // Configure author
  if (user?.name || user?.login) {
    const authorName = user.name || user.login;
    const authorEmail = user.email || `${user.login}@users.noreply.github.com`;
    await executeGitCommand(`git config user.name "${authorName}"`, repoDir);
    await executeGitCommand(`git config user.email "${authorEmail}"`, repoDir);
  }

  return { success: true, message: 'Repositório Git inicializado e sincronizado com sucesso.' };
}

export async function getGitStatus(repoDir: string): Promise<GitStatusResult> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) {
    return {
      isRepo: false,
      branch: 'none',
      ahead: 0,
      behind: 0,
      isClean: true,
      files: [],
    };
  }

  // Current branch
  const branchRes = await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoDir);
  const branch = branchRes.stdout || 'main';

  // Remote URL
  const remoteRes = await executeGitCommand('git remote get-url origin', repoDir);
  const remoteUrl = remoteRes.success ? remoteRes.stdout.replace(/x-access-token:[^@]+@/, '') : undefined;

  // Status porcelain
  const statusRes = await executeGitCommand('git status --porcelain -b', repoDir);
  const lines = statusRes.stdout.split('\n').filter(Boolean);

  let ahead = 0;
  let behind = 0;
  let tracking: string | undefined;
  const files: GitFileStatus[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const branchInfo = line.substring(3);
      if (branchInfo.includes('...')) {
        const parts = branchInfo.split('...');
        const right = parts[1] || '';
        tracking = right.split(' ')[0];
        const aheadMatch = right.match(/ahead (\d+)/);
        const behindMatch = right.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      }
      continue;
    }

    const indexCode = line[0];
    const workCode = line[1];
    const filePath = line.substring(3).trim();

    const isStaged = indexCode !== ' ' && indexCode !== '?';
    let statusCode: GitFileStatus['status'] = 'M';

    if (indexCode === '?' && workCode === '?') {
      statusCode = '??';
    } else if (indexCode === 'A' || workCode === 'A') {
      statusCode = 'A';
    } else if (indexCode === 'D' || workCode === 'D') {
      statusCode = 'D';
    } else if (indexCode === 'R' || workCode === 'R') {
      statusCode = 'R';
    } else {
      statusCode = 'M';
    }

    files.push({
      path: filePath,
      status: statusCode,
      staged: isStaged,
    });
  }

  return {
    isRepo: true,
    branch,
    tracking,
    ahead,
    behind,
    isClean: files.length === 0,
    files,
    remoteUrl,
  };
}

export async function getGitLog(repoDir: string, limit: number = 20): Promise<GitCommitInfo[]> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return [];

  const format = '%H|%h|%an|%ad|%s';
  const logRes = await executeGitCommand(
    `git log -n ${limit} --date=short --pretty=format:"${format}"`,
    repoDir
  );

  if (!logRes.success || !logRes.stdout) return [];

  const lines = logRes.stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [hash, shortHash, author, date, ...msgParts] = line.split('|');
    return {
      hash: hash || '',
      shortHash: shortHash || '',
      author: author || 'Desconhecido',
      date: date || '',
      message: msgParts.join('|') || '',
    };
  });
}

export async function getGitBranches(repoDir: string): Promise<{ current: string; branches: string[] }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { current: 'main', branches: ['main'] };

  const res = await executeGitCommand('git branch --list', repoDir);
  if (!res.success) return { current: 'main', branches: ['main'] };

  const lines = res.stdout.split('\n').filter(Boolean);
  let current = 'main';
  const branches: string[] = [];

  for (const line of lines) {
    const isCurrent = line.startsWith('*');
    const name = line.replace('*', '').trim();
    if (isCurrent) current = name;
    branches.push(name);
  }

  return { current, branches };
}

export async function commitChanges(
  repoDir: string,
  message: string,
  files?: string[]
): Promise<{ success: boolean; message: string; commitHash?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, message: 'Diretório não é um repositório Git.' };

  if (files && files.length > 0) {
    for (const file of files) {
      await executeGitCommand(`git add "${file}"`, repoDir);
    }
  } else {
    await executeGitCommand('git add .', repoDir);
  }

  const safeMsg = message.replace(/"/g, '\\"');
  const commitRes = await executeGitCommand(`git commit -m "${safeMsg}"`, repoDir);

  if (!commitRes.success && !commitRes.stderr.includes('nothing to commit')) {
    return { success: false, message: commitRes.stderr || 'Falha ao executar commit.' };
  }

  const hashRes = await executeGitCommand('git rev-parse --short HEAD', repoDir);
  return {
    success: true,
    message: commitRes.stdout || 'Commit realizado com sucesso.',
    commitHash: hashRes.stdout,
  };
}

export async function createAndCheckoutBranch(
  repoDir: string,
  branchName: string
): Promise<{ success: boolean; message: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, message: 'Diretório não é um repositório Git.' };

  const cleanName = branchName.trim().replace(/\s+/g, '-');
  // Check if branch exists
  const checkRes = await executeGitCommand(`git checkout "${cleanName}"`, repoDir);
  if (checkRes.success) {
    return { success: true, message: `Trocou para a branch '${cleanName}'.` };
  }

  const createRes = await executeGitCommand(`git checkout -b "${cleanName}"`, repoDir);
  if (createRes.success) {
    return { success: true, message: `Branch '${cleanName}' criada com sucesso.` };
  }

  return { success: false, message: createRes.stderr || 'Erro ao criar branch.' };
}

export async function syncGit(
  repoDir: string,
  remote: string = 'origin',
  branch: string = 'main'
): Promise<{ success: boolean; message: string; previousHead?: string; currentHead?: string; newCommitsCount?: number }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, message: 'Diretório não é um repositório Git.' };

  const prevHeadRes = await executeGitCommand('git rev-parse HEAD', repoDir);
  const previousHead = prevHeadRes.success ? prevHeadRes.stdout.trim() : undefined;

  // 1. Fetch remote
  await executeGitCommand(`git fetch ${remote}`, repoDir);

  // 2. Pull
  let pullRes = await executeGitCommand(`git pull ${remote} ${branch} --allow-unrelated-histories --no-edit`, repoDir);
  if (!pullRes.success) {
    pullRes = await executeGitCommand(`git pull ${remote} ${branch} --rebase`, repoDir);
  }

  // 3. Push
  const pushRes = await executeGitCommand(`git push -u ${remote} ${branch}`, repoDir);

  const currHeadRes = await executeGitCommand('git rev-parse HEAD', repoDir);
  const currentHead = currHeadRes.success ? currHeadRes.stdout.trim() : undefined;

  let newCommitsCount = 0;
  if (previousHead && currentHead && previousHead !== currentHead) {
    const countRes = await executeGitCommand(`git rev-list --count ${previousHead}..${currentHead}`, repoDir);
    if (countRes.success) {
      newCommitsCount = parseInt(countRes.stdout.trim(), 10) || 0;
    }
  }

  const msgParts: string[] = [];
  if (pullRes.success) {
    msgParts.push(`Pull: ${pullRes.stdout || 'Atualizado com sucesso'}`);
  } else if (pullRes.stderr) {
    msgParts.push(`Pull Aviso: ${pullRes.stderr}`);
  }

  if (pushRes.success) {
    msgParts.push(`Push: ${pushRes.stdout || 'Enviado com sucesso'}`);
  } else if (pushRes.stderr) {
    msgParts.push(`Push Aviso: ${pushRes.stderr}`);
  }

  return {
    success: pushRes.success || pullRes.success,
    message: msgParts.join(' | ') || 'Sincronizado',
    previousHead,
    currentHead,
    newCommitsCount,
  };
}

export interface WhatsNewItem {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface WhatsNewFile {
  path: string;
  status: 'A' | 'M' | 'D';
  statusLabel: string;
  additions: number;
  deletions: number;
}

export interface WhatsNewProposal {
  id: string | number;
  title: string;
  author?: string;
  commitHash?: string;
}

export interface WhatsNewSummary {
  hasNewUpdates: boolean;
  latestHash: string;
  lastSeenHash?: string;
  totalNewCommits: number;
  commits: WhatsNewItem[];
  files: WhatsNewFile[];
  proposals: WhatsNewProposal[];
  summaryMessage: string;
}

export async function getWhatsNewSummary(
  repoDir: string,
  lastSeenHash?: string
): Promise<WhatsNewSummary> {
  const emptyResult: WhatsNewSummary = {
    hasNewUpdates: false,
    latestHash: '',
    lastSeenHash,
    totalNewCommits: 0,
    commits: [],
    files: [],
    proposals: [],
    summaryMessage: 'Nenhuma nova atualização encontrada.',
  };

  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return emptyResult;

  const headRes = await executeGitCommand('git rev-parse HEAD', repoDir);
  if (!headRes.success || !headRes.stdout.trim()) {
    return emptyResult;
  }
  const currentHead = headRes.stdout.trim();

  // If lastSeenHash equals currentHead, there are no unread updates
  if (lastSeenHash && lastSeenHash.trim() === currentHead) {
    return {
      ...emptyResult,
      latestHash: currentHead,
      lastSeenHash: currentHead,
      summaryMessage: 'Todas as novidades já foram visualizadas.',
    };
  }

  // Check if repo has at least 1 commit
  const totalCommitsRes = await executeGitCommand('git rev-list --count HEAD', repoDir);
  const totalCount = totalCommitsRes.success ? parseInt(totalCommitsRes.stdout.trim(), 10) : 0;
  if (totalCount === 0) return emptyResult;

  // Determine git log / diff revision range
  let range = '';
  let isValidLastSeen = false;

  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    const checkHash = await executeGitCommand(`git cat-file -e "${lastSeenHash.trim()}^{commit}"`, repoDir);
    if (checkHash.success) {
      isValidLastSeen = true;
      range = `"${lastSeenHash.trim()}"..HEAD`;
    }
  }

  // 1. Get Commits in Range
  const format = '%H|%h|%an|%ad|%s';
  let logCmd = `git log -n 20 --date=short --pretty=format:"${format}" HEAD`;
  if (isValidLastSeen && range) {
    logCmd = `git log -n 30 --date=short --pretty=format:"${format}" ${range}`;
  }

  const logRes = await executeGitCommand(logCmd, repoDir);
  const commits: WhatsNewItem[] = [];
  const proposals: WhatsNewProposal[] = [];
  const seenProposals = new Set<string>();

  if (logRes.success && logRes.stdout) {
    const lines = logRes.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const [hash, shortHash, author, date, ...msgParts] = line.split('|');
      const message = msgParts.join('|') || '';
      commits.push({
        hash: hash || '',
        shortHash: shortHash || '',
        author: author || 'Equipe',
        date: date || '',
        message,
      });

      // Detect PR / Proposal references in commit message
      const prMatch = message.match(/(?:#|PR\s*#?|Proposta\s*#?)(\d+)/i) || message.match(/pull request #(\d+)/i);
      if (prMatch) {
        const prId = prMatch[1];
        if (!seenProposals.has(prId)) {
          seenProposals.add(prId);
          proposals.push({
            id: prId,
            title: message,
            author,
            commitHash: shortHash,
          });
        }
      }
    }
  }

  // 2. Get Changed Files in Range
  const filesMap = new Map<string, WhatsNewFile>();

  // Numstat for additions/deletions
  let numstatCmd = '';
  let nameStatusCmd = '';

  if (isValidLastSeen && range) {
    numstatCmd = `git diff --numstat ${range}`;
    nameStatusCmd = `git diff --name-status ${range}`;
  } else {
    numstatCmd = `git log -n 15 --numstat --pretty="" HEAD`;
    nameStatusCmd = `git log -n 15 --name-status --pretty="" HEAD`;
  }

  const numstatRes = await executeGitCommand(numstatCmd, repoDir);

  if (numstatRes.success && numstatRes.stdout) {
    const lines = numstatRes.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const adds = parseInt(parts[0], 10) || 0;
        const dels = parseInt(parts[1], 10) || 0;
        let filePath = parts[2].trim();
        // Handle rename notation like "{src => 01-conceitos-do-nodejs/src}/todos.spec.js" or "old => new"
        if (filePath.includes('=>')) {
          if (filePath.includes('{') && filePath.includes('}')) {
            filePath = filePath.replace(/\{[^=>]*=>\s*([^}]+)\}/, '$1').replace(/\/\//g, '/');
          } else {
            const renameParts = filePath.split('=>');
            filePath = (renameParts[1] || renameParts[0]).trim();
          }
        }
        if (filePath) {
          const existing = filesMap.get(filePath);
          if (existing) {
            existing.additions += adds;
            existing.deletions += dels;
          } else {
            filesMap.set(filePath, {
              path: filePath,
              status: 'M',
              statusLabel: 'Documento Atualizado',
              additions: adds,
              deletions: dels,
            });
          }
        }
      }
    }
  }

  const nameStatusRes = await executeGitCommand(nameStatusCmd, repoDir);

  if (nameStatusRes.success && nameStatusRes.stdout) {
    const lines = nameStatusRes.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        const rawStatus = parts[0][0]; // A, M, D, R
        const filePath = (rawStatus === 'R' && parts.length >= 3 ? parts[2] : parts[1] || '').trim();
        if (!filePath) continue;

        const existing = filesMap.get(filePath) || {
          path: filePath,
          status: 'M',
          statusLabel: 'Documento Atualizado',
          additions: 0,
          deletions: 0,
        };

        if (rawStatus === 'A') {
          existing.status = 'A';
          existing.statusLabel = 'Novo Documento';
        } else if (rawStatus === 'D') {
          existing.status = 'D';
          existing.statusLabel = 'Documento Removido';
        } else {
          existing.status = 'M';
          existing.statusLabel = 'Documento Atualizado';
        }
        filesMap.set(filePath, existing);
      }
    }
  }

  const files = Array.from(filesMap.values());

  const hasNewUpdates = commits.length > 0;
  const summaryMessage = hasNewUpdates
    ? `${commits.length} nova(s) publicação(ões) e ${files.length} documento(s) atualizados pela equipe.`
    : 'Nenhuma alteração recente encontrada.';

  return {
    hasNewUpdates,
    latestHash: currentHead,
    lastSeenHash,
    totalNewCommits: commits.length,
    commits,
    files,
    proposals,
    summaryMessage,
  };
}

export async function getWhatsNewFileDiff(
  repoDir: string,
  filePath: string,
  lastSeenHash?: string
): Promise<{ diff: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { diff: '' };

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const pathArg = ` -- "${cleanPath}"`;

  let range = '';
  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    const checkHash = await executeGitCommand(`git cat-file -e "${lastSeenHash.trim()}^{commit}"`, repoDir);
    if (checkHash.success) {
      range = `"${lastSeenHash.trim()}"..HEAD`;
    }
  }

  if (range) {
    const diffRes = await executeGitCommand(`git diff ${range}${pathArg}`, repoDir);
    if (diffRes.success && diffRes.stdout) {
      return { diff: diffRes.stdout };
    }
  }

  // Fallback: show the patch from the latest commit that modified this file
  const logShow = await executeGitCommand(`git log -n 1 -p HEAD${pathArg}`, repoDir);
  if (logShow.success && logShow.stdout) {
    return { diff: logShow.stdout };
  }

  return { diff: '' };
}

export async function getGitBlame(repoDir: string, filePath: string): Promise<any> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, blame: [] };

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const blameRes = await executeGitCommand(`git blame --line-porcelain "${cleanPath}"`, repoDir);

  if (!blameRes.success) {
    return { success: false, blame: [], message: blameRes.stderr };
  }

  return {
    success: true,
    raw: blameRes.stdout,
  };
}

export async function getGitDiff(
  repoDir: string,
  filePath?: string
): Promise<{ diff: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { diff: '' };

  const cleanPath = filePath ? filePath.trim().replace(/^\/+/, '') : '';
  const pathArg = cleanPath ? ` -- "${cleanPath}"` : '';

  // 1. Try git diff HEAD (covers both staged and unstaged modifications against last commit)
  let diffRes = await executeGitCommand(`git diff HEAD${pathArg}`, repoDir);
  if (diffRes.success && diffRes.stdout) {
    return { diff: diffRes.stdout };
  }

  // 2. Try working tree diff
  diffRes = await executeGitCommand(`git diff${pathArg}`, repoDir);
  if (diffRes.success && diffRes.stdout) {
    return { diff: diffRes.stdout };
  }

  // 3. Try cached/staged diff
  diffRes = await executeGitCommand(`git diff --cached${pathArg}`, repoDir);
  if (diffRes.success && diffRes.stdout) {
    return { diff: diffRes.stdout };
  }

  // 4. If filePath is untracked, read the file content and format as added lines
  if (cleanPath) {
    const fullPath = path.join(repoDir, cleanPath);
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const diffHeader = `--- /dev/null\n+++ b/${cleanPath}\n@@ -0,0 +1,${lines.length} @@\n`;
        const diffBody = lines.map((line) => `+${line}`).join('\n');
        return { diff: diffHeader + diffBody };
      } catch {}
    }
  }

  return { diff: '' };
}

export async function getFileGitLog(
  repoDir: string,
  filePath: string,
  limit: number = 30
): Promise<GitCommitInfo[]> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return [];

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const format = '%H|%h|%an|%ad|%s';
  const logRes = await executeGitCommand(
    `git log -n ${limit} --follow --date=short --pretty=format:"${format}" -- "${cleanPath}"`,
    repoDir
  );

  if (!logRes.success || !logRes.stdout) return [];

  const lines = logRes.stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [hash, shortHash, author, date, ...msgParts] = line.split('|');
    return {
      hash: hash || '',
      shortHash: shortHash || '',
      author: author || 'Desconhecido',
      date: date || '',
      message: msgParts.join('|') || '',
    };
  });
}

export async function getFileContentAtCommit(
  repoDir: string,
  filePath: string,
  commitHash: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, content: '', error: 'Repositório não encontrado' };

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const cleanHash = commitHash.trim();

  const showRes = await executeGitCommand(
    `git show ${cleanHash}:"${cleanPath}"`,
    repoDir
  );

  if (!showRes.success) {
    return { success: false, content: '', error: showRes.stderr || 'Versão não encontrada' };
  }

  return { success: true, content: showRes.stdout };
}

export async function getFileBlameDetails(
  repoDir: string,
  filePath: string
): Promise<{ success: boolean; blame: Array<{ line: number; author: string; date: string; commit: string; content: string }> }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, blame: [] };

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  const blameRes = await executeGitCommand(`git blame --date=short -e -l "${cleanPath}"`, repoDir);

  if (!blameRes.success || !blameRes.stdout) {
    return { success: false, blame: [] };
  }

  const lines = blameRes.stdout.split('\n').filter(Boolean);
  const result: Array<{ line: number; author: string; date: string; commit: string; content: string }> = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    // Format: hash (<author-email> date line) content
    const match = rawLine.match(/^([0-9a-fA-F]+)\s+\(<([^>]+)>\s+([0-9\-]+)\s+(\d+)\)\s?(.*)$/);
    if (match) {
      result.push({
        commit: match[1].slice(0, 7),
        author: match[2].split('@')[0],
        date: match[3],
        line: parseInt(match[4], 10),
        content: match[5] || '',
      });
    } else {
      result.push({
        commit: 'HEAD',
        author: 'Autor',
        date: '',
        line: idx + 1,
        content: rawLine,
      });
    }
  }

  return { success: true, blame: result };
}
