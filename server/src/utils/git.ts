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
  token?: string
): Promise<{ success: boolean; message: string }> {
  if (!fs.existsSync(repoDir)) {
    fs.mkdirSync(repoDir, { recursive: true });
  }

  const gitExists = await isGitRepo(repoDir);
  if (!gitExists) {
    // 1. Git Init
    const initRes = await executeGitCommand('git init -b main', repoDir);
    if (!initRes.success) {
      await executeGitCommand('git init', repoDir);
      await executeGitCommand('git branch -M main', repoDir);
    }

    // 2. Ensure .gitignore
    const gitignorePath = path.join(repoDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const defaultGitignore = `.DS_Store\nnode_modules/\n*.log\n.env\n`;
      fs.writeFileSync(gitignorePath, defaultGitignore, 'utf-8');
    }

    // 3. User config local
    const authorName = user?.name || user?.login || 'Context OS Developer';
    const authorEmail = user?.email || (user?.login ? `${user.login}@users.noreply.github.com` : 'dev@contextos.local');
    await executeGitCommand(`git config user.name "${authorName}"`, repoDir);
    await executeGitCommand(`git config user.email "${authorEmail}"`, repoDir);

    // 4. Initial commit if directory has files
    await executeGitCommand('git add .', repoDir);
    await executeGitCommand('git commit -m "chore: initial commit with Context OS structure"', repoDir);
  } else {
    // Configure author if present
    if (user?.name || user?.login) {
      const authorName = user.name || user.login;
      const authorEmail = user.email || `${user.login}@users.noreply.github.com`;
      await executeGitCommand(`git config user.name "${authorName}"`, repoDir);
      await executeGitCommand(`git config user.email "${authorEmail}"`, repoDir);
    }
  }

  // 5. Remote Setup
  if (remoteUrl) {
    let authRemoteUrl = remoteUrl;
    if (token && remoteUrl.startsWith('https://github.com/')) {
      const repoPath = remoteUrl.replace('https://github.com/', '').replace(/\.git$/, '');
      authRemoteUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`;
    }

    const remoteCheck = await executeGitCommand('git remote get-url origin', repoDir);
    if (remoteCheck.success) {
      await executeGitCommand(`git remote set-url origin "${authRemoteUrl}"`, repoDir);
    } else {
      await executeGitCommand(`git remote add origin "${authRemoteUrl}"`, repoDir);
    }

    // Pull remote files if available on remote main
    try {
      await executeGitCommand('git fetch origin', repoDir);
      await executeGitCommand('git pull origin main --allow-unrelated-histories --no-edit', repoDir);
    } catch {}
  }

  return { success: true, message: 'Repositório Git inicializado e pronto.' };
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
): Promise<{ success: boolean; message: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, message: 'Diretório não é um repositório Git.' };

  // 1. Fetch remote
  await executeGitCommand(`git fetch ${remote}`, repoDir);

  // 2. Pull
  let pullRes = await executeGitCommand(`git pull ${remote} ${branch} --allow-unrelated-histories --no-edit`, repoDir);
  if (!pullRes.success) {
    pullRes = await executeGitCommand(`git pull ${remote} ${branch} --rebase`, repoDir);
  }

  // 3. Push
  const pushRes = await executeGitCommand(`git push -u ${remote} ${branch}`, repoDir);

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
  };
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
