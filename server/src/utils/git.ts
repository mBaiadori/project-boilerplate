import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isPathHidden, loadHiddenFiles, isSystemPath } from "./hidden-files.js";

const execAsync = promisify(exec);

export async function executeGitCommand(
  command: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (error: any) {
    return {
      stdout: "",
      stderr: error.message || String(error),
      success: false,
    };
  }
}

import { loadConfig } from "../config/storage.js";

export function resolveGitProviderBaseUrl(customUrl?: string, provider?: string): { baseUrl: string; isForgejo: boolean } {
  if (provider === 'github') {
    return { baseUrl: 'https://api.github.com', isForgejo: false };
  }
  if (customUrl && customUrl.startsWith('http')) {
    const isForgejo = !customUrl.includes('api.github.com') && !customUrl.includes('github.com');
    return { baseUrl: customUrl.replace(/\/$/, ''), isForgejo };
  }
  if (provider === 'forgejo' || provider === 'gitea') {
    const baseUrl = (customUrl || 'http://localhost:3000/api/v1').replace(/\/$/, '');
    return { baseUrl, isForgejo: true };
  }
  const cfg = loadConfig();
  if (
    cfg.git_provider === 'forgejo' ||
    cfg.git_provider === 'gitea' ||
    (cfg.git_provider_url && !cfg.git_provider_url.includes('api.github.com')) ||
    (cfg.active_repo?.html_url && !cfg.active_repo.html_url.includes('github.com'))
  ) {
    const baseUrl = (cfg.git_provider_url || 'http://localhost:3000/api/v1').replace(/\/$/, '');
    return { baseUrl, isForgejo: true };
  }
  return { baseUrl: 'https://api.github.com', isForgejo: false };
}

export async function callGitHubAPI(
  endpoint: string,
  token: string,
  method: string = "GET",
  data: any = null,
  customBaseUrl?: string,
  provider?: string,
): Promise<{ statusCode: number; data: any }> {
  let url: string;
  let isForgejo = false;

  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    url = endpoint;
    isForgejo = !endpoint.includes("api.github.com") && !endpoint.includes("github.com");
  } else {
    const resolved = resolveGitProviderBaseUrl(customBaseUrl, provider);
    url = `${resolved.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    isForgejo = resolved.isForgejo;
  }

  const headers: Record<string, string> = {
    Accept: "application/json, application/vnd.github+json",
    "User-Agent": "Context-OS-Spec-Driven",
  };

  if (token) {
    headers["Authorization"] = isForgejo ? `token ${token}` : `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers["Content-Type"] = "application/json";
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
    return {
      statusCode: 500,
      data: { message: err.message || "Erro de conexão com o Provedor Git" },
    };
  }
}

export const callGitProviderAPI = callGitHubAPI;

export async function applyBranchProtection(
  repoFullName: string,
  branch: string,
  token: string,
  requiredApprovals: number = 1,
): Promise<{ statusCode: number; data: any }> {
  const { isForgejo } = resolveGitProviderBaseUrl();

  if (isForgejo) {
    const endpoint = `/repos/${repoFullName}/branch_protections`;
    const body = {
      branch_name: branch,
      enable_push: false,
      enable_push_whitelist: false,
      required_approvals: requiredApprovals,
      enable_approvals_whitelist: false,
      protected_file_patterns: ".keymap.json;.project.config.json;.gitignore;.scripts/**;.github/**",
    };
    const res = await callGitHubAPI(endpoint, token, "POST", body);
    if (res.statusCode === 200 || res.statusCode === 201) {
      return res;
    }
    if (res.statusCode === 409 || (res.data?.message && res.data.message.includes("already exists"))) {
      const patchEndpoint = `/repos/${repoFullName}/branch_protections/${encodeURIComponent(branch)}`;
      return await callGitHubAPI(patchEndpoint, token, "PATCH", body);
    }
    return res;
  }

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

  return await callGitHubAPI(endpoint, token, "PUT", body);
}

export async function checkBranchProtection(
  repoFullName: string,
  branch: string,
  token: string,
): Promise<{ isProtected: boolean; details?: string }> {
  if (!token || !repoFullName) {
    return { isProtected: false };
  }
  const { isForgejo } = resolveGitProviderBaseUrl();
  try {
    if (isForgejo) {
      const endpoint = `/repos/${repoFullName}/branch_protections`;
      const res = await callGitHubAPI(endpoint, token, "GET");
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        const found = res.data.some(
          (p: any) => p.branch_name === branch || p.rule_name === branch,
        );
        return {
          isProtected: found,
          details: found ? "Proteção ativa no Forgejo" : "Sem proteção ativa",
        };
      }
      return { isProtected: false, details: "Sem proteção ativa" };
    }

    const endpoint = `/repos/${repoFullName}/branches/${branch}/protection`;
    const res = await callGitHubAPI(endpoint, token, "GET");
    if (res.statusCode === 200) {
      return { isProtected: true, details: "Proteção ativa no GitHub" };
    }
    return { isProtected: false, details: "Sem proteção ativa" };
  } catch (e: any) {
    return { isProtected: false, details: e.message || "Não foi possível verificar" };
  }
}

export interface GitFileStatus {
  path: string;
  status: "M" | "A" | "D" | "U" | "R" | "C" | "??";
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
  systemFiles: GitFileStatus[];
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
  const gitDir = path.join(repoDir, ".git");
  return fs.existsSync(gitDir);
}

export function ensureGitIgnore(repoDir: string): void {
  const gitignorePath = path.join(repoDir, ".gitignore");
  const requiredPatterns = [
    ".DS_Store",
    "node_modules/",
    "*.log",
    ".env",
  ];

  const systemPatternsToUnignore = [
    ".hidden_files.json",
    ".docs.metadata.json",
    ".dictionary.json",
    ".templates.json",
    ".templates.metadata.json",
    ".project.config.json",
    ".spec-memory/",
    ".skills/",
    ".agents/",
    ".tools/",
  ];

  let currentContent = "";
  if (fs.existsSync(gitignorePath)) {
    try {
      currentContent = fs.readFileSync(gitignorePath, "utf-8");
    } catch {
      currentContent = "";
    }
  }

  // Remove lines that mistakenly ignored project system files
  let lines = currentContent.split("\n").map((l) => l.trim()).filter((l) => {
    return l && !systemPatternsToUnignore.includes(l) && l !== "# Context OS Internal Metadata";
  });

  for (const pattern of requiredPatterns) {
    if (!lines.includes(pattern)) {
      lines.push(pattern);
    }
  }

  const newContent = lines.join("\n") + "\n";
  if (newContent !== currentContent) {
    try {
      fs.writeFileSync(gitignorePath, newContent, "utf-8");
    } catch (e) {
      console.warn(`[Git] Falha ao atualizar .gitignore em ${repoDir}:`, e);
    }
  }
}

const gitSyncLocks = new Map<string, Promise<{ success: boolean; message: string }>>();

export async function ensureGitRepo(
  repoDir: string,
  user?: { name?: string; login?: string; email?: string } | null,
  remoteUrl?: string,
  token?: string,
  repoName?: string,
  pullLatest: boolean = true,
): Promise<{ success: boolean; message: string }> {
  const lockKey = path.resolve(repoDir);
  const existingLock = gitSyncLocks.get(lockKey);
  if (existingLock) {
    return await existingLock;
  }

  const syncPromise = (async () => {
    try {
      return await internalEnsureGitRepo(repoDir, user, remoteUrl, token, repoName, pullLatest);
    } finally {
      gitSyncLocks.delete(lockKey);
    }
  })();

  gitSyncLocks.set(lockKey, syncPromise);
  return await syncPromise;
}

async function internalEnsureGitRepo(
  repoDir: string,
  user?: { name?: string; login?: string; email?: string } | null,
  remoteUrl?: string,
  token?: string,
  repoName?: string,
  pullLatest: boolean = true,
): Promise<{ success: boolean; message: string }> {
  const gitExists = await isGitRepo(repoDir);

  // Auto-resolve remoteUrl if missing and token exists
  let targetRemoteUrl = remoteUrl;
  const { baseUrl, isForgejo } = resolveGitProviderBaseUrl();
  if (!targetRemoteUrl && token && user?.login && repoName && repoName !== "default" && repoName !== "_default") {
    if (isForgejo) {
      const rootUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
      targetRemoteUrl = `${rootUrl}/${user.login}/${repoName}.git`;
    } else {
      targetRemoteUrl = `https://github.com/${user.login}/${repoName}.git`;
    }
  }

  // Form authenticated clone URL if applicable
  let authRemoteUrl = targetRemoteUrl || "";
  if (targetRemoteUrl && token) {
    if (isForgejo) {
      try {
        const u = new URL(targetRemoteUrl);
        u.username = user?.login || 'token';
        u.password = token;
        authRemoteUrl = u.toString();
      } catch {
        authRemoteUrl = targetRemoteUrl;
      }
    } else if (targetRemoteUrl.startsWith("https://github.com/")) {
      const repoPath = targetRemoteUrl
        .replace("https://github.com/", "")
        .replace(/\.git$/, "");
      authRemoteUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`;
    }
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
      const cloneRes = await executeGitCommand(
        `git clone "${authRemoteUrl}" "${repoDir}"`,
        path.dirname(repoDir),
      );
      if (!cloneRes.success || !(await isGitRepo(repoDir))) {
        console.warn(`[Git] Fallback clone para ${repoDir}:`, cloneRes.stderr);
        // Fallback init
        if (fs.existsSync(repoDir)) {
          try {
            fs.rmSync(repoDir, { recursive: true, force: true });
          } catch {}
        }
        fs.mkdirSync(repoDir, { recursive: true });
        await executeGitCommand("git init -b main", repoDir);
        await executeGitCommand(
          `git remote add origin "${authRemoteUrl}"`,
          repoDir,
        );
        await executeGitCommand("git fetch origin", repoDir);
        await executeGitCommand(
          "git reset --hard origin/main || git reset --hard origin/master || true",
          repoDir,
        );
        await executeGitCommand("git clean -fd", repoDir);
      }
    } else {
      // Ensure remote origin
      const remoteCheck = await executeGitCommand(
        "git remote get-url origin",
        repoDir,
      );
      if (remoteCheck.success) {
        await executeGitCommand(
          `git remote set-url origin "${authRemoteUrl}"`,
          repoDir,
        );
      } else {
        await executeGitCommand(
          `git remote add origin "${authRemoteUrl}"`,
          repoDir,
        );
      }

      // If pullLatest requested, fetch and pull remote changes
      if (pullLatest) {
        try {
          await executeGitCommand("git fetch origin", repoDir);
          const branchRes = await executeGitCommand(
            "git rev-parse --abbrev-ref HEAD",
            repoDir,
          );
          const activeBranch = branchRes.stdout?.trim() || "main";
          await executeGitCommand(
            `git pull origin ${activeBranch} --allow-unrelated-histories --no-edit`,
            repoDir,
          );
        } catch (pullErr) {
          console.warn(`[Git] Aviso ao sincronizar remote em ${repoDir}:`, pullErr);
        }
      }
    }
  } else {
    // Local-only repository
    if (!gitExists) {
      if (!fs.existsSync(repoDir)) {
        fs.mkdirSync(repoDir, { recursive: true });
      }

      const initRes = await executeGitCommand("git init -b main", repoDir);
      if (!initRes.success) {
        await executeGitCommand("git init", repoDir);
        await executeGitCommand("git branch -M main", repoDir);
      }

      ensureGitIgnore(repoDir);

      await executeGitCommand("git add .", repoDir);
      await executeGitCommand('git commit -m "chore: initial commit"', repoDir);
    }
  }

  ensureGitIgnore(repoDir);

  // Configure author
  if (user?.name || user?.login) {
    const authorName = user.name || user.login;
    const authorEmail = user.email || `${user.login}@users.noreply.github.com`;
    await executeGitCommand(`git config user.name "${authorName}"`, repoDir);
    await executeGitCommand(`git config user.email "${authorEmail}"`, repoDir);
  }

  return {
    success: true,
    message: "Repositório Git inicializado e sincronizado com sucesso.",
  };
}

export async function getGitStatus(repoDir: string): Promise<GitStatusResult> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) {
    return {
      isRepo: false,
      branch: "none",
      ahead: 0,
      behind: 0,
      isClean: true,
      files: [],
      systemFiles: [],
    };
  }

  ensureGitIgnore(repoDir);

  // Current branch
  const branchRes = await executeGitCommand(
    "git rev-parse --abbrev-ref HEAD",
    repoDir,
  );
  const branch = branchRes.stdout || "main";

  // Remote URL
  const remoteRes = await executeGitCommand(
    "git remote get-url origin",
    repoDir,
  );
  const remoteUrl = remoteRes.success
    ? remoteRes.stdout.replace(/x-access-token:[^@]+@/, "")
    : undefined;

  // Status porcelain with all untracked files expanded individually
  const statusRes = await executeGitCommand(
    "git status --porcelain=v1 -b -uall",
    repoDir,
  );
  const lines = statusRes.stdout.split("\n").filter(Boolean);

  let ahead = 0;
  let behind = 0;
  let tracking: string | undefined;
  const files: GitFileStatus[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const branchInfo = line.substring(3);
      if (branchInfo.includes("...")) {
        const parts = branchInfo.split("...");
        const right = parts[1] || "";
        tracking = right.split(" ")[0];
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

    const isStaged = indexCode !== " " && indexCode !== "?";
    let statusCode: GitFileStatus["status"] = "M";

    if (indexCode === "?" && workCode === "?") {
      statusCode = "??";
    } else if (indexCode === "A" || workCode === "A") {
      statusCode = "A";
    } else if (indexCode === "D" || workCode === "D") {
      statusCode = "D";
    } else if (indexCode === "R" || workCode === "R") {
      statusCode = "R";
    } else {
      statusCode = "M";
    }

    files.push({
      path: filePath,
      status: statusCode,
      staged: isStaged,
    });
  }

  const hiddenList = loadHiddenFiles(repoDir);
  const visibleFiles = files.filter((f) => !isPathHidden(f.path, hiddenList));
  const systemFiles = files.filter((f) => isSystemPath(f.path));

  return {
    isRepo: true,
    branch,
    tracking,
    ahead,
    behind,
    isClean: visibleFiles.length === 0 && systemFiles.length === 0,
    files: visibleFiles,
    systemFiles,
    remoteUrl,
  };
}

export async function getGitLog(
  repoDir: string,
  limit: number = 20,
): Promise<GitCommitInfo[]> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return [];

  const format = "%H|%h|%an|%ad|%s";
  const logRes = await executeGitCommand(
    `git log -n ${limit} --date=short --pretty=format:"${format}"`,
    repoDir,
  );

  if (!logRes.success || !logRes.stdout) return [];

  const lines = logRes.stdout.split("\n").filter(Boolean);
  return lines.map((line) => {
    const [hash, shortHash, author, date, ...msgParts] = line.split("|");
    return {
      hash: hash || "",
      shortHash: shortHash || "",
      author: author || "Desconhecido",
      date: date || "",
      message: msgParts.join("|") || "",
    };
  });
}

export async function getGitBranches(
  repoDir: string,
): Promise<{ current: string; branches: string[] }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { current: "main", branches: ["main"] };

  const res = await executeGitCommand("git branch --list", repoDir);
  if (!res.success) return { current: "main", branches: ["main"] };

  const lines = res.stdout.split("\n").filter(Boolean);
  let current = "main";
  const branches: string[] = [];

  for (const line of lines) {
    const isCurrent = line.startsWith("*");
    const name = line.replace("*", "").trim();
    if (isCurrent) current = name;
    branches.push(name);
  }

  return { current, branches };
}

export async function commitChanges(
  repoDir: string,
  message: string,
  files?: string[],
): Promise<{ success: boolean; message: string; commitHash?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo)
    return { success: false, message: "Diretório não é um repositório Git." };

  if (files && files.length > 0) {
    for (const file of files) {
      await executeGitCommand(`git add "${file}"`, repoDir);
    }
  } else {
    await executeGitCommand("git add .", repoDir);
  }

  const safeMsg = message.replace(/"/g, '\\"');
  const commitRes = await executeGitCommand(
    `git commit -m "${safeMsg}"`,
    repoDir,
  );

  if (!commitRes.success && !commitRes.stderr.includes("nothing to commit")) {
    return {
      success: false,
      message: commitRes.stderr || "Falha ao executar commit.",
    };
  }

  const hashRes = await executeGitCommand(
    "git rev-parse --short HEAD",
    repoDir,
  );
  return {
    success: true,
    message: commitRes.stdout || "Commit realizado com sucesso.",
    commitHash: hashRes.stdout,
  };
}

export async function createAndCheckoutBranch(
  repoDir: string,
  branchName: string,
): Promise<{ success: boolean; message: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo)
    return { success: false, message: "Diretório não é um repositório Git." };

  const cleanName = branchName.trim().replace(/\s+/g, "-");
  // Check if branch exists
  const checkRes = await executeGitCommand(
    `git checkout "${cleanName}"`,
    repoDir,
  );
  if (checkRes.success) {
    return { success: true, message: `Trocou para a branch '${cleanName}'.` };
  }

  const createRes = await executeGitCommand(
    `git checkout -b "${cleanName}"`,
    repoDir,
  );
  if (createRes.success) {
    return {
      success: true,
      message: `Branch '${cleanName}' criada com sucesso.`,
    };
  }

  return {
    success: false,
    message: createRes.stderr || "Erro ao criar branch.",
  };
}

export async function syncGit(
  repoDir: string,
  remote: string = "origin",
  branch: string = "main",
): Promise<{
  success: boolean;
  message: string;
  previousHead?: string;
  currentHead?: string;
  newCommitsCount?: number;
}> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo)
    return { success: false, message: "Diretório não é um repositório Git." };

  const prevHeadRes = await executeGitCommand("git rev-parse HEAD", repoDir);
  const previousHead = prevHeadRes.success
    ? prevHeadRes.stdout.trim()
    : undefined;

  // 1. Fetch remote
  await executeGitCommand(`git fetch ${remote}`, repoDir);

  // 2. Pull
  let pullRes = await executeGitCommand(
    `git pull ${remote} ${branch} --allow-unrelated-histories --no-edit`,
    repoDir,
  );
  if (!pullRes.success) {
    pullRes = await executeGitCommand(
      `git pull ${remote} ${branch} --rebase`,
      repoDir,
    );
  }

  // 3. Push
  const pushRes = await executeGitCommand(
    `git push -u ${remote} ${branch}`,
    repoDir,
  );

  const currHeadRes = await executeGitCommand("git rev-parse HEAD", repoDir);
  const currentHead = currHeadRes.success
    ? currHeadRes.stdout.trim()
    : undefined;

  let newCommitsCount = 0;
  if (previousHead && currentHead && previousHead !== currentHead) {
    const countRes = await executeGitCommand(
      `git rev-list --count ${previousHead}..${currentHead}`,
      repoDir,
    );
    if (countRes.success) {
      newCommitsCount = parseInt(countRes.stdout.trim(), 10) || 0;
    }
  }

  const msgParts: string[] = [];
  if (pullRes.success) {
    msgParts.push(`Pull: ${pullRes.stdout || "Atualizado com sucesso"}`);
  } else if (pullRes.stderr) {
    msgParts.push(`Pull Aviso: ${pullRes.stderr}`);
  }

  if (pushRes.success) {
    msgParts.push(`Push: ${pushRes.stdout || "Enviado com sucesso"}`);
  } else if (pushRes.stderr) {
    msgParts.push(`Push Aviso: ${pushRes.stderr}`);
  }

  return {
    success: pushRes.success || pullRes.success,
    message: msgParts.join(" | ") || "Sincronizado",
    previousHead,
    currentHead,
    newCommitsCount,
  };
}

export async function rollbackToCommit(
  repoDir: string,
  targetCommitHash: string,
  commitTitle?: string,
): Promise<{ success: boolean; message: string; newCommitHash?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) {
    return { success: false, message: "Diretório não é um repositório Git." };
  }

  // 1. Verify target commit
  const checkRes = await executeGitCommand(
    `git cat-file -t ${targetCommitHash}`,
    repoDir,
  );
  if (!checkRes.success || checkRes.stdout !== "commit") {
    return {
      success: false,
      message: `Revisão ${targetCommitHash} inválida ou não encontrada.`,
    };
  }

  // 2. Checkout main
  await executeGitCommand("git checkout main", repoDir);

  // 3. Check if target commit is already HEAD
  const headRes = await executeGitCommand("git rev-parse HEAD", repoDir);
  const targetFullRes = await executeGitCommand(
    `git rev-parse ${targetCommitHash}`,
    repoDir,
  );
  if (
    headRes.success &&
    targetFullRes.success &&
    headRes.stdout.trim() === targetFullRes.stdout.trim()
  ) {
    return {
      success: false,
      message: "Esta versão já é a versão ativa mais recente.",
    };
  }

  // 4. Discard any unstaged changes in repo
  await executeGitCommand("git reset --hard HEAD", repoDir);

  // 5. Restore tree of targetCommitHash (safe rollback preserving history)
  const treeRes = await executeGitCommand(
    `git read-tree -u --reset ${targetCommitHash}`,
    repoDir,
  );
  if (!treeRes.success) {
    await executeGitCommand(`git checkout ${targetCommitHash} -- .`, repoDir);
  }

  // 6. Get short hash of target
  const shortTargetRes = await executeGitCommand(
    `git rev-parse --short ${targetCommitHash}`,
    repoDir,
  );
  const shortTarget = shortTargetRes.stdout || targetCommitHash.slice(0, 7);

  const cleanTitle = commitTitle ? `: ${commitTitle.slice(0, 60)}` : "";
  const commitMsg = `Reversão segura: restaurar versão para ${shortTarget}${cleanTitle}`;
  const safeMsg = commitMsg.replace(/"/g, '\\"');

  const commitRes = await executeGitCommand(
    `git commit -m "${safeMsg}"`,
    repoDir,
  );
  if (!commitRes.success && !commitRes.stderr.includes("nothing to commit")) {
    return {
      success: false,
      message:
        commitRes.stderr ||
        "Não foi possível criar a nova versão de reversão.",
    };
  }

  const newHashRes = await executeGitCommand(
    "git rev-parse --short HEAD",
    repoDir,
  );
  const newHash = newHashRes.stdout || "";

  return {
    success: true,
    message: `Versão restaurada com sucesso! Uma nova versão (#${newHash}) foi promovida com o estado de #${shortTarget}, preservando todo o histórico anterior.`,
    newCommitHash: newHash,
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
  status: "A" | "M" | "D";
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
  lastSeenHash?: string,
): Promise<WhatsNewSummary> {
  const emptyResult: WhatsNewSummary = {
    hasNewUpdates: false,
    latestHash: "",
    lastSeenHash,
    totalNewCommits: 0,
    commits: [],
    files: [],
    proposals: [],
    summaryMessage: "Nenhuma nova atualização encontrada.",
  };

  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return emptyResult;

  const headRes = await executeGitCommand("git rev-parse HEAD", repoDir);
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
      summaryMessage: "Todas as novidades já foram visualizadas.",
    };
  }

  // Check if repo has at least 1 commit
  const totalCommitsRes = await executeGitCommand(
    "git rev-list --count HEAD",
    repoDir,
  );
  const totalCount = totalCommitsRes.success
    ? parseInt(totalCommitsRes.stdout.trim(), 10)
    : 0;
  if (totalCount === 0) return emptyResult;

  // Determine git log / diff revision range
  let range = "";
  let isValidLastSeen = false;

  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    const checkHash = await executeGitCommand(
      `git cat-file -e "${lastSeenHash.trim()}^{commit}"`,
      repoDir,
    );
    if (checkHash.success) {
      isValidLastSeen = true;
      range = `"${lastSeenHash.trim()}"..HEAD`;
    }
  }

  // If no lastSeenHash was provided (first time opening the repo),
  // baseline is established at current HEAD with 0 unread novidades
  if (!lastSeenHash || !isValidLastSeen) {
    return {
      ...emptyResult,
      hasNewUpdates: false,
      latestHash: currentHead,
      lastSeenHash: currentHead,
      totalNewCommits: 0,
      commits: [],
      files: [],
      proposals: [],
      summaryMessage: "Repositório sincronizado. Nenhuma nova atualização recente encontrada.",
    };
  }

  // 1. Get Commits in Range (only what was pulled/merged after lastSeenHash)
  const format = "%H|%h|%an|%ad|%s";
  const logCmd = `git log -n 50 --date=short --pretty=format:"${format}" ${range}`;
  const logRes = await executeGitCommand(logCmd, repoDir);
  const commits: WhatsNewItem[] = [];
  const proposals: WhatsNewProposal[] = [];
  const seenProposals = new Set<string>();

  if (logRes.success && logRes.stdout) {
    const lines = logRes.stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      const [hash, shortHash, author, date, ...msgParts] = line.split("|");
      const message = msgParts.join("|") || "";
      commits.push({
        hash: hash || "",
        shortHash: shortHash || "",
        author: author || "Equipe",
        date: date || "",
        message,
      });

      // Detect PR / Proposal references in commit message
      const prMatch =
        message.match(/(?:#|PR\s*#?|Proposta\s*#?)(\d+)/i) ||
        message.match(/pull request #(\d+)/i);
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
  let numstatCmd = "";
  let nameStatusCmd = "";

  if (isValidLastSeen && range) {
    numstatCmd = `git diff --numstat ${range}`;
    nameStatusCmd = `git diff --name-status ${range}`;
  } else {
    numstatCmd = `git log -n 15 --numstat --pretty="" HEAD`;
    nameStatusCmd = `git log -n 15 --name-status --pretty="" HEAD`;
  }

  const numstatRes = await executeGitCommand(numstatCmd, repoDir);

  if (numstatRes.success && numstatRes.stdout) {
    const lines = numstatRes.stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const adds = parseInt(parts[0], 10) || 0;
        const dels = parseInt(parts[1], 10) || 0;
        let filePath = parts[2].trim();
        // Handle rename notation like "{src => 01-conceitos-do-nodejs/src}/todos.spec.js" or "old => new"
        if (filePath.includes("=>")) {
          if (filePath.includes("{") && filePath.includes("}")) {
            filePath = filePath
              .replace(/\{[^=>]*=>\s*([^}]+)\}/, "$1")
              .replace(/\/\//g, "/");
          } else {
            const renameParts = filePath.split("=>");
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
              status: "M",
              statusLabel: "Documento Atualizado",
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
    const lines = nameStatusRes.stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        const rawStatus = parts[0][0]; // A, M, D, R
        const filePath = (
          rawStatus === "R" && parts.length >= 3 ? parts[2] : parts[1] || ""
        ).trim();
        if (!filePath) continue;

        const existing = filesMap.get(filePath) || {
          path: filePath,
          status: "M",
          statusLabel: "Documento Atualizado",
          additions: 0,
          deletions: 0,
        };

        if (rawStatus === "A") {
          existing.status = "A";
          existing.statusLabel = "Novo Documento";
        } else if (rawStatus === "D") {
          existing.status = "D";
          existing.statusLabel = "Documento Removido";
        } else {
          existing.status = "M";
          existing.statusLabel = "Documento Atualizado";
        }
        filesMap.set(filePath, existing);
      }
    }
  }

  const hiddenList = loadHiddenFiles(repoDir);
  const files = Array.from(filesMap.values()).filter(
    (f) => !isPathHidden(f.path, hiddenList),
  );

  const hasNewUpdates = commits.length > 0;
  const summaryMessage = hasNewUpdates
    ? `${commits.length} nova(s) publicação(ões) e ${files.length} documento(s) atualizados pela equipe.`
    : "Nenhuma alteração recente encontrada.";

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
  lastSeenHash?: string,
): Promise<{ diff: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { diff: "" };

  const cleanPath = filePath.trim().replace(/^\/+/, "");
  const pathArg = ` -- "${cleanPath}"`;

  let range = "";
  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    const checkHash = await executeGitCommand(
      `git cat-file -e "${lastSeenHash.trim()}^{commit}"`,
      repoDir,
    );
    if (checkHash.success) {
      range = `"${lastSeenHash.trim()}"..HEAD`;
    }
  }

  if (range) {
    const diffRes = await executeGitCommand(
      `git diff ${range}${pathArg}`,
      repoDir,
    );
    if (diffRes.success && diffRes.stdout) {
      return { diff: diffRes.stdout };
    }
  }

  // Fallback: show the patch from the latest commit that modified this file
  const logShow = await executeGitCommand(
    `git log -n 1 -p HEAD${pathArg}`,
    repoDir,
  );
  if (logShow.success && logShow.stdout) {
    return { diff: logShow.stdout };
  }

  return { diff: "" };
}

export async function getGitBlame(
  repoDir: string,
  filePath: string,
): Promise<any> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, blame: [] };

  const cleanPath = filePath.trim().replace(/^\/+/, "");
  const blameRes = await executeGitCommand(
    `git blame --line-porcelain "${cleanPath}"`,
    repoDir,
  );

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
  filePath?: string,
): Promise<{ diff: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { diff: "" };

  const cleanPath = filePath ? filePath.trim().replace(/^\/+/, "") : "";
  const pathArg = cleanPath ? ` -- "${cleanPath}"` : "";

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
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        const diffHeader = `--- /dev/null\n+++ b/${cleanPath}\n@@ -0,0 +1,${lines.length} @@\n`;
        const diffBody = lines.map((line) => `+${line}`).join("\n");
        return { diff: diffHeader + diffBody };
      } catch {}
    }
  }

  return { diff: "" };
}

export async function getFileGitLog(
  repoDir: string,
  filePath: string,
  limit: number = 30,
): Promise<GitCommitInfo[]> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return [];

  const cleanPath = filePath.trim().replace(/^\/+/, "");
  const format = "%H|%h|%an|%ad|%s";
  const logRes = await executeGitCommand(
    `git log -n ${limit} --follow --date=short --pretty=format:"${format}" -- "${cleanPath}"`,
    repoDir,
  );

  if (!logRes.success || !logRes.stdout) return [];

  const lines = logRes.stdout.split("\n").filter(Boolean);
  return lines.map((line) => {
    const [hash, shortHash, author, date, ...msgParts] = line.split("|");
    return {
      hash: hash || "",
      shortHash: shortHash || "",
      author: author || "Desconhecido",
      date: date || "",
      message: msgParts.join("|") || "",
    };
  });
}

export async function getFileContentAtCommit(
  repoDir: string,
  filePath: string,
  commitHash: string,
): Promise<{ success: boolean; content: string; error?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo)
    return { success: false, content: "", error: "Repositório não encontrado" };

  const cleanPath = filePath.trim().replace(/^\/+/, "");
  const cleanHash = commitHash.trim();

  const showRes = await executeGitCommand(
    `git show ${cleanHash}:"${cleanPath}"`,
    repoDir,
  );

  if (!showRes.success) {
    return {
      success: false,
      content: "",
      error: showRes.stderr || "Versão não encontrada",
    };
  }

  return { success: true, content: showRes.stdout };
}

export async function getFileBlameDetails(
  repoDir: string,
  filePath: string,
): Promise<{
  success: boolean;
  blame: Array<{
    line: number;
    author: string;
    date: string;
    commit: string;
    content: string;
  }>;
}> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return { success: false, blame: [] };

  const cleanPath = filePath.trim().replace(/^\/+/, "");
  const blameRes = await executeGitCommand(
    `git blame --date=short -e -l "${cleanPath}"`,
    repoDir,
  );

  if (!blameRes.success || !blameRes.stdout) {
    return { success: false, blame: [] };
  }

  const lines = blameRes.stdout.split("\n").filter(Boolean);
  const result: Array<{
    line: number;
    author: string;
    date: string;
    commit: string;
    content: string;
  }> = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    // Format: hash (<author-email> date line) content
    const match = rawLine.match(
      /^([0-9a-fA-F]+)\s+\(<([^>]+)>\s+([0-9\-]+)\s+(\d+)\)\s?(.*)$/,
    );
    if (match) {
      result.push({
        commit: match[1].slice(0, 7),
        author: match[2].split("@")[0],
        date: match[3],
        line: parseInt(match[4], 10),
        content: match[5] || "",
      });
    } else {
      result.push({
        commit: "HEAD",
        author: "Autor",
        date: "",
        line: idx + 1,
        content: rawLine,
      });
    }
  }

  return { success: true, blame: result };
}
