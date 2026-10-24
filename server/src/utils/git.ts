import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { isPathHidden, loadHiddenFiles, isSystemPath } from "./hidden-files.js";
import { vaultService, VAULT_KEYS } from "../modules/vault/vault.service.js";
import { loadConfig } from "../config/storage.js";
import {
  assertCommitish,
  assertRemoteName,
  assertBranchName,
  assertGitPath,
} from "./git-validate.js";

const execFileAsync = promisify(execFile);

export interface GitProgressEvent {
  stage: string;
  percent: number;
  message?: string;
}

export function parseGitProgress(line: string): GitProgressEvent | null {
  const match = line.match(/(Receiving objects|Resolving deltas|Compressing objects|Counting objects|Updating files):\s+(\d+)%/i);
  if (match) {
    const rawStage = match[1];
    const percent = parseInt(match[2], 10);
    let stageLabel = rawStage;
    if (/receiving/i.test(rawStage)) stageLabel = "Recebendo objetos";
    else if (/resolving/i.test(rawStage)) stageLabel = "Resolvendo deltas";
    else if (/compressing/i.test(rawStage)) stageLabel = "Comprimindo";
    else if (/counting/i.test(rawStage)) stageLabel = "Contando objetos";
    else if (/updating/i.test(rawStage)) stageLabel = "Atualizando arquivos";
    return {
      stage: stageLabel,
      percent,
      message: line.trim(),
    };
  }
  return null;
}

export function buildGitEnv(token?: string): {
  env: NodeJS.ProcessEnv;
  activeToken: string | null;
  base64Token: string;
} {
  const activeToken = getActiveBearerToken(token);
  const gitEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  };

  let base64Token = "";
  if (activeToken) {
    base64Token = Buffer.from(`x-access-token:${activeToken}`).toString("base64");
    gitEnv.GIT_CONFIG_COUNT = "1";
    gitEnv.GIT_CONFIG_KEY_0 = "http.extraHeader";
    gitEnv.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${base64Token}`;
  }
  return { env: gitEnv, activeToken, base64Token };
}

export function redactTokens(
  text: string,
  activeToken: string | null,
  base64Token: string,
): string {
  let safe = text;
  if (activeToken) {
    safe = safe.replaceAll(activeToken, "[REDACTED_TOKEN]");
  }
  if (base64Token) {
    safe = safe.replaceAll(base64Token, "[REDACTED_TOKEN]");
  }
  return safe;
}

export type GitExecutionHook = (args: string[], cwd: string) => void;
let gitExecutionHook: GitExecutionHook | null = null;
export function setGitExecutionHook(hook: GitExecutionHook | null): void {
  gitExecutionHook = hook;
}

export function executeGitCommandWithProgress(
  args: string[],
  cwd: string,
  token?: string,
  onProgress?: (p: GitProgressEvent) => void,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  if (gitExecutionHook) {
    try {
      gitExecutionHook(args, cwd);
    } catch {}
  }
  return new Promise((resolve) => {
    const finalArgs = [...args];
    const { env, activeToken, base64Token } = buildGitEnv(token);

    let stdout = "";
    let stderr = "";

    const child = spawn("git", finalArgs, {
      cwd,
      shell: false,
      env,
    });

    const handleData = (chunk: Buffer) => {
      const str = chunk.toString();
      const lines = str.split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const progress = parseGitProgress(line);
        if (progress && onProgress) {
          onProgress(progress);
        }
      }
    };

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      handleData(data);
    });

    child.on("close", (code) => {
      let safeStdout = stdout;
      let safeStderr = stderr;
      if (activeToken) {
        safeStdout = safeStdout.replaceAll(activeToken, "[REDACTED_TOKEN]");
        safeStderr = safeStderr.replaceAll(activeToken, "[REDACTED_TOKEN]");
      }
      if (base64Token) {
        safeStdout = safeStdout.replaceAll(base64Token, "[REDACTED_TOKEN]");
        safeStderr = safeStderr.replaceAll(base64Token, "[REDACTED_TOKEN]");
      }
      resolve({
        stdout: safeStdout.trim(),
        stderr: safeStderr.trim(),
        success: code === 0,
      });
    });

    child.on("error", (err) => {
      resolve({
        stdout,
        stderr: err.message,
        success: false,
      });
    });
  });
}

/**
 * Obtém o Bearer Token ativo do cofre nativo de senhas ou configuração
 */
export function getActiveBearerToken(explicitToken?: string): string | null {
  if (explicitToken === "local_mode") {
    return null;
  }
  if (explicitToken && typeof explicitToken === "string" && explicitToken.trim() && explicitToken !== "local_mode") {
    return explicitToken.trim();
  }
  try {
    const vaultToken = vaultService.getSecret(VAULT_KEYS.GITHUB_TOKEN);
    if (vaultToken && vaultToken.trim() && vaultToken !== "local_mode") {
      return vaultToken.trim();
    }
  } catch {}
  try {
    const cfg = loadConfig();
    if (cfg?.token && cfg.token.trim() && cfg.token !== "local_mode") {
      return cfg.token.trim();
    }
    if (Array.isArray(cfg?.accounts) && cfg.accounts.length > 0) {
      const active = cfg.accounts.find((a: any) => a.isActive && a.token);
      if (active?.token && active.token.trim() && active.token !== "local_mode") {
        return active.token.trim();
      }
      const firstWithToken = cfg.accounts.find((a: any) => a.token && a.token.trim() && a.token !== "local_mode");
      if (firstWithToken?.token) {
        return firstWithToken.token.trim();
      }
    }
  } catch {}
  return null;
}

/**
 * Executa comandos git diretamente via execFile sem invocação de shell (/bin/sh),
 * imune a injeção de comandos, expansão de crases, $(...) e caracteres especiais.
 */
export async function executeGit(
  args: string[],
  cwd: string,
  explicitToken?: string,
  options: { timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  if (gitExecutionHook) {
    try {
      gitExecutionHook(args, cwd);
    } catch {}
  }
  const { env, activeToken, base64Token } = buildGitEnv(explicitToken);

  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      shell: false,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
      timeout: options.timeout || 30000,
      env,
    });

    return {
      stdout: redactTokens(stdout, activeToken, base64Token).trim(),
      stderr: redactTokens(stderr, activeToken, base64Token).trim(),
      success: true,
    };
  } catch (error: any) {
    const stdout = error.stdout
      ? redactTokens(String(error.stdout), activeToken, base64Token).trim()
      : "";
    const stderr = error.stderr
      ? redactTokens(String(error.stderr), activeToken, base64Token).trim()
      : redactTokens(error.message || String(error), activeToken, base64Token).trim();
    return {
      stdout,
      stderr,
      success: false,
    };
  }
}


export async function callGitHubAPI(
  endpoint: string,
  token?: string,
  method: string = "GET",
  data: any = null,
  requestOptions?: { silentStatuses?: number[]; timeoutMs?: number },
): Promise<{ statusCode: number; data: any }> {
  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `https://api.github.com${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Context-OS-Spec-Driven",
  };

  const activeToken = getActiveBearerToken(token);
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }

  const timeoutMs = requestOptions?.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const options: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, options);
    clearTimeout(timer);
    let resData: any = {};
    const text = await res.text();
    try {
      resData = text ? JSON.parse(text) : {};
    } catch {
      resData = { message: text };
    }
    const oauthScopes = res.headers.get("x-oauth-scopes");
    const acceptedScopes = res.headers.get("x-accepted-oauth-scopes");
    
    // No GitHub REST API, 404 em /branches/.../protection significa apenas que a branch não tem regras de proteção ativas.
    const isProtection404 = res.status === 404 && endpoint.includes("/branches/") && endpoint.includes("/protection");
    const isSilenced = requestOptions?.silentStatuses?.includes(res.status) || isProtection404;

    if (res.status >= 400 && !isSilenced) {
      console.warn(`[GitHub API ${res.status}] ${method} ${url}:`, {
        error: resData,
        oauthScopes,
        acceptedScopes,
      });
    }
    return {
      statusCode: res.status,
      data: resData,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err.name === "AbortError" || err.message?.includes("aborted");
    if (isTimeout) {
      console.warn(`[GitHub API Timeout] ${method} ${url} excedeu ${timeoutMs}ms.`);
      return {
        statusCode: 504,
        data: { message: `Tempo limite de conexão com o GitHub excedido (${timeoutMs}ms)` },
      };
    }
    return {
      statusCode: 500,
      data: { message: err.message || "Erro de conexão com o GitHub" },
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
  try {
    const endpoint = `/repos/${repoFullName}/branches/${branch}/protection`;
    const res = await callGitHubAPI(endpoint, token, "GET", null, { silentStatuses: [404] });
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
    ".docs.metadata.json",
    ".spec-memory/workspace_changes.json",
    ".spec-memory/sessions/",
  ];

  const systemPatternsToUnignore = [
    ".hidden_files.json",
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

export async function cloneGitRepo(
  repoDir: string,
  remoteUrl: string,
  token?: string,
  user?: { name?: string; login?: string; email?: string } | null,
  onProgress?: (p: GitProgressEvent) => void,
): Promise<{ success: boolean; message: string }> {
  if (await isGitRepo(repoDir)) {
    return { success: true, message: "Repositório já está clonado localmente." };
  }

  const cleanRemoteUrl = remoteUrl.startsWith("https://") && !remoteUrl.endsWith(".git")
    ? `${remoteUrl}.git`
    : remoteUrl;

  // Diretório residual (sem .git) só é descartado se contiver apenas arquivos gerados automaticamente
  const generated = [
    ".gitignore",
    ".project.config.json",
    ".dictionary.json",
    ".docs.metadata.json",
    ".hidden_files.json",
    ".templates.json",
    ".templates.metadata.json",
    ".github",
  ];
  if (fs.existsSync(repoDir)) {
    const stray = fs.readdirSync(repoDir).filter((n) => n !== ".DS_Store");
    if (!stray.every((n) => generated.includes(n))) {
      return {
        success: false,
        message: "A pasta de destino já existe e contém arquivos locais sem repositório Git.",
      };
    }
  }

  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  const cloneRes = await executeGitCommandWithProgress(
    ["clone", "--progress", cleanRemoteUrl, repoDir],
    parentDir,
    token,
    onProgress,
  );

  if (!cloneRes.success || !(await isGitRepo(repoDir))) {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    return {
      success: false,
      message: cloneRes.stderr || "Falha ao clonar repositório do GitHub.",
    };
  }

  const publicOrigin = cleanRemoteUrl;
  await executeGit(["remote", "set-url", "origin", publicOrigin], repoDir);

  if (user?.name || user?.login) {
    const authorName = (user.name || user.login || "Context OS") as string;
    const authorEmail = (user.email || `${user.login || "context-os"}@users.noreply.github.com`) as string;
    await executeGit(["config", "user.name", authorName], repoDir);
    await executeGit(["config", "user.email", authorEmail], repoDir);
  }

  ensureGitIgnore(repoDir);

  return {
    success: true,
    message: "Repositório clonado com sucesso para trabalhar localmente.",
  };
}

export async function pullGitRepo(
  repoDir: string,
  branch?: string,
  token?: string,
  onProgress?: (p: GitProgressEvent) => void,
): Promise<{ success: boolean; message: string }> {
  if (!(await isGitRepo(repoDir))) {
    return { success: false, message: "Repositório não está clonado localmente." };
  }

  const defaultBranch = await getDefaultBranch(repoDir);
  const branchRes = await executeGit(["rev-parse", "--abbrev-ref", "HEAD"], repoDir);
  const activeBranch = branch || branchRes.stdout?.trim() || defaultBranch;

  const fetchRes = await executeGitCommandWithProgress(
    ["fetch", "--progress", "origin", activeBranch],
    repoDir,
    token,
    onProgress,
  );

  if (!fetchRes.success) {
    return { success: false, message: fetchRes.stderr || "Erro ao buscar atualizações remotas." };
  }

  const pullRes = await executeGitCommandWithProgress(
    ["pull", "--progress", "origin", activeBranch, "--ff-only"],
    repoDir,
    token,
    onProgress,
  );

  if (!pullRes.success) {
    return {
      success: false,
      message: "Não foi possível avançar com fast-forward. Existem alterações locais ou histórico divergente.",
    };
  }

  return {
    success: true,
    message: pullRes.stdout?.trim() || "Repositório atualizado com sucesso.",
  };
}

export async function ensureGitRepo(
  repoDir: string,
  _user?: { name?: string; login?: string; email?: string } | null,
  _remoteUrl?: string,
  _token?: string,
  _repoName?: string,
  _pullLatest: boolean = false,
): Promise<{ success: boolean; message: string }> {
  if (await isGitRepo(repoDir)) {
    return { success: true, message: "Repositório pronto." };
  }
  return { success: false, message: "Repositório não está clonado localmente." };
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

  // Current branch
  const branchRes = await executeGit(["rev-parse", "--abbrev-ref", "HEAD"], repoDir);
  const branch = branchRes.stdout || (await getDefaultBranch(repoDir));

  // Remote URL
  const remoteRes = await executeGit(["remote", "get-url", "origin"], repoDir);
  const remoteUrl = remoteRes.success
    ? remoteRes.stdout.replace(/x-access-token:[^@]+@/, "")
    : undefined;

  // Status porcelain with all untracked files expanded individually
  const statusRes = await executeGit(
    ["status", "--porcelain=v1", "-b", "-uall"],
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
  const logRes = await executeGit(
    ["log", `-n${Number(limit) || 20}`, "--date=short", `--pretty=format:${format}`],
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

  const res = await executeGit(["branch", "--list"], repoDir);
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

  if (branches.length === 0) {
    try {
      const symRes = await executeGit(["symbolic-ref", "--short", "HEAD"], repoDir);
      if (symRes.success && symRes.stdout.trim()) {
        const initial = symRes.stdout.trim();
        return { current: initial, branches: [initial] };
      }
    } catch {}
    return { current: "main", branches: ["main"] };
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

  ensureGitIgnore(repoDir);

  if (Array.isArray(files) && files.length > 0) {
    const validFiles: string[] = [];
    for (const file of files) {
      if (
        file.includes(".docs.metadata.json") ||
        file.includes("workspace_changes.json") ||
        file.includes(".spec-memory/sessions")
      ) {
        continue;
      }
      validFiles.push(assertGitPath(file));
    }
    if (validFiles.length > 0) {
      await executeGit(["add", "--", ...validFiles], repoDir);
    }
  } else {
    await executeGit(["add", "."], repoDir);
  }

  // Garantia pós-staging: desindexa imediatamente arquivos transitórios do sistema caso tenham entrado no index
  try {
    await executeGit(
      [
        "rm",
        "--cached",
        "-r",
        "--ignore-unmatch",
        ".spec-memory/workspace_changes.json",
        ".spec-memory/sessions",
        ".docs.metadata.json",
      ],
      repoDir,
    );
  } catch {}

  const commitRes = await executeGit(["commit", "-m", message], repoDir);

  if (!commitRes.success && !commitRes.stderr.includes("nothing to commit")) {
    return {
      success: false,
      message: commitRes.stderr || "Falha ao executar commit.",
    };
  }

  const hashRes = await executeGit(["rev-parse", "--short", "HEAD"], repoDir);
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

  const safeName = assertBranchName(branchName.trim().replace(/\s+/g, "-"));

  // Check if branch exists
  const checkRes = await executeGit(["checkout", safeName], repoDir);
  if (checkRes.success) {
    return { success: true, message: `Trocou para a branch '${safeName}'.` };
  }

  const createRes = await executeGit(["checkout", "-b", safeName], repoDir);
  if (createRes.success) {
    return {
      success: true,
      message: `Branch '${safeName}' criada com sucesso.`,
    };
  }

  return {
    success: false,
    message: createRes.stderr || "Erro ao criar branch.",
  };
}

export async function getDefaultBranch(repoDir: string): Promise<string> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) return "main";

  // 1. Tenta ler refs/remotes/origin/HEAD
  try {
    const headRes = await executeGit(["symbolic-ref", "refs/remotes/origin/HEAD"], repoDir);
    if (headRes.success && headRes.stdout.trim()) {
      const ref = headRes.stdout.trim();
      const parts = ref.split("/");
      const branch = parts[parts.length - 1];
      if (branch) return branch;
    }
  } catch {}

  // 2. Consulta refs locais diretamente via executeGit (sem chamar getGitBranches ou getGitStatus)
  try {
    const refsRes = await executeGit(
      ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
      repoDir
    );
    if (refsRes.success && refsRes.stdout.trim()) {
      const branches = refsRes.stdout.split("\n").map((b) => b.trim()).filter(Boolean);
      if (branches.includes("main")) return "main";
      if (branches.includes("master")) return "master";
      if (branches.length > 0 && branches[0]) return branches[0];
    }
  } catch {}

  // 3. Fallback para HEAD simbólico (ex: repositório recém-inicializado sem commits)
  try {
    const symHead = await executeGit(["symbolic-ref", "--short", "HEAD"], repoDir);
    if (symHead.success && symHead.stdout.trim()) {
      return symHead.stdout.trim();
    }
  } catch {}

  return "main";
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

  const safeRemote = assertRemoteName(remote);
  const safeBranch = assertBranchName(branch);

  const prevHeadRes = await executeGit(["rev-parse", "HEAD"], repoDir);
  const previousHead = prevHeadRes.success
    ? prevHeadRes.stdout.trim()
    : undefined;

  // 1. Fetch remote
  await executeGit(["fetch", safeRemote], repoDir);

  // 2. Pull
  let pullRes = await executeGit(
    ["pull", safeRemote, safeBranch, "--allow-unrelated-histories", "--no-edit"],
    repoDir,
  );
  if (!pullRes.success) {
    pullRes = await executeGit(
      ["pull", safeRemote, safeBranch, "--rebase"],
      repoDir,
    );
  }

  // 3. Push
  const pushRes = await executeGit(
    ["push", "-u", safeRemote, safeBranch],
    repoDir,
  );

  const currHeadRes = await executeGit(["rev-parse", "HEAD"], repoDir);
  const currentHead = currHeadRes.success
    ? currHeadRes.stdout.trim()
    : undefined;

  let newCommitsCount = 0;
  if (previousHead && currentHead && previousHead !== currentHead) {
    const countRes = await executeGit(
      ["rev-list", "--count", `${previousHead}..${currentHead}`],
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
  options?: { force?: boolean },
): Promise<{ success: boolean; message: string; newCommitHash?: string }> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) {
    return { success: false, message: "Diretório não é um repositório Git." };
  }

  // 1. Verify target commit
  const safeHash = assertCommitish(targetCommitHash, "Target commit hash");
  const checkRes = await executeGit(["cat-file", "-t", safeHash], repoDir);
  if (!checkRes.success || checkRes.stdout !== "commit") {
    return {
      success: false,
      message: `Revisão ${safeHash} inválida ou não encontrada.`,
    };
  }

  // 2. Prevenir perda acidental de alterações não commitadas (C5)
  if (!options?.force) {
    const status = await getGitStatus(repoDir);
    if (!status.isClean) {
      return {
        success: false,
        message: "Existem alterações não commitadas no repositório. Faça commit ou use force para sobrescrever.",
      };
    }
  }

  // 3. Checkout current branch (detect active default or branch)
  let activeBranch = await getDefaultBranch(repoDir);
  const branchRes = await executeGit(["branch", "--show-current"], repoDir);
  if (branchRes.success && branchRes.stdout.trim()) {
    activeBranch = branchRes.stdout.trim();
  }
  await executeGit(["checkout", activeBranch], repoDir).catch(() => {});

  // 3. Check if target commit is already HEAD
  const headRes = await executeGit(["rev-parse", "HEAD"], repoDir);
  const targetFullRes = await executeGit(["rev-parse", safeHash], repoDir);
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
  await executeGit(["reset", "--hard", "HEAD"], repoDir);

  // 5. Restore tree of targetCommitHash (safe rollback preserving history)
  const treeRes = await executeGit(
    ["read-tree", "-u", "--reset", safeHash],
    repoDir,
  );
  if (!treeRes.success) {
    await executeGit(["checkout", safeHash, "--", "."], repoDir);
  }

  // 6. Get short hash of target
  const shortTargetRes = await executeGit(
    ["rev-parse", "--short", safeHash],
    repoDir,
  );
  const shortTarget = shortTargetRes.stdout || safeHash.slice(0, 7);

  const cleanTitle = commitTitle ? `: ${commitTitle.slice(0, 60)}` : "";
  const commitMsg = `Reversão segura: restaurar versão para ${shortTarget}${cleanTitle}`;

  const commitRes = await executeGit(["commit", "-m", commitMsg], repoDir);
  if (!commitRes.success && !commitRes.stderr.includes("nothing to commit")) {
    return {
      success: false,
      message: commitRes.stderr || "Falha ao executar commit de reversão.",
    };
  }

  const newHashRes = await executeGit(["rev-parse", "--short", "HEAD"], repoDir);
  return {
    success: true,
    message: `Revertido com sucesso para a revisão ${shortTarget}.`,
    newCommitHash: newHashRes.stdout || shortTarget,
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

  const headRes = await executeGit(["rev-parse", "HEAD"], repoDir);
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
  const totalCommitsRes = await executeGit(
    ["rev-list", "--count", "HEAD"],
    repoDir,
  );
  const totalCount = totalCommitsRes.success
    ? parseInt(totalCommitsRes.stdout.trim(), 10)
    : 0;
  if (totalCount === 0) return emptyResult;

  // Determine git log / diff revision range
  let cleanLastSeen = "";
  let isValidLastSeen = false;

  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    try {
      assertCommitish(lastSeenHash.trim());
      cleanLastSeen = lastSeenHash.trim();
      const checkHash = await executeGit(
        ["cat-file", "-e", `${cleanLastSeen}^{commit}`],
        repoDir,
      );
      if (checkHash.success) {
        isValidLastSeen = true;
      }
    } catch {
      isValidLastSeen = false;
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
  const logRes = await executeGit(
    ["log", "-n", "50", "--date=short", `--pretty=format:${format}`, `${cleanLastSeen}..HEAD`],
    repoDir,
  );
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

  const numstatArgs = isValidLastSeen
    ? ["diff", "--numstat", `${cleanLastSeen}..HEAD`]
    : ["log", "-n", "15", "--numstat", '--pretty=', "HEAD"];
  const nameStatusArgs = isValidLastSeen
    ? ["diff", "--name-status", `${cleanLastSeen}..HEAD`]
    : ["log", "-n", "15", "--name-status", '--pretty=', "HEAD"];

  const numstatRes = await executeGit(numstatArgs, repoDir);

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

  const nameStatusRes = await executeGit(nameStatusArgs, repoDir);

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
  assertGitPath(cleanPath);

  let cleanLastSeen = "";
  let isValidLastSeen = false;
  if (lastSeenHash && lastSeenHash.trim().length >= 6) {
    try {
      assertCommitish(lastSeenHash.trim());
      cleanLastSeen = lastSeenHash.trim();
      const checkHash = await executeGit(
        ["cat-file", "-e", `${cleanLastSeen}^{commit}`],
        repoDir,
      );
      if (checkHash.success) {
        isValidLastSeen = true;
      }
    } catch {
      isValidLastSeen = false;
    }
  }

  if (isValidLastSeen && cleanLastSeen) {
    const diffRes = await executeGit(
      ["diff", `${cleanLastSeen}..HEAD`, "--", cleanPath],
      repoDir,
    );
    if (diffRes.success && diffRes.stdout) {
      return { diff: diffRes.stdout };
    }
  }

  // Fallback: show the patch from the latest commit that modified this file
  const logShow = await executeGit(
    ["log", "-n", "1", "-p", "HEAD", "--", cleanPath],
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
  assertGitPath(cleanPath);
  const blameRes = await executeGit(
    ["blame", "--line-porcelain", "--", cleanPath],
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
  if (cleanPath) {
    assertGitPath(cleanPath);
  }
  const pathArgs = cleanPath ? ["--", cleanPath] : [];

  // 1. Try git diff HEAD (covers both staged and unstaged modifications against last commit)
  let diffRes = await executeGit(["diff", "HEAD", ...pathArgs], repoDir);
  let baseDiff = (diffRes.success && diffRes.stdout) ? diffRes.stdout : "";

  if (!baseDiff) {
    // 2. Try working tree diff
    diffRes = await executeGit(["diff", ...pathArgs], repoDir);
    if (diffRes.success && diffRes.stdout) {
      baseDiff = diffRes.stdout;
    }
  }

  if (!baseDiff) {
    // 3. Try cached/staged diff
    diffRes = await executeGit(["diff", "--cached", ...pathArgs], repoDir);
    if (diffRes.success && diffRes.stdout) {
      baseDiff = diffRes.stdout;
    }
  }

  // 4. If filePath is untracked, read the file content and format as added lines
  if (cleanPath) {
    if (baseDiff) return { diff: baseDiff };

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
  } else {
    // When no specific file requested, append any untracked files to the overall diff
    try {
      const statusRes = await executeGit(["status", "--porcelain=v1", "-uall"], repoDir);
      if (statusRes.success && statusRes.stdout) {
        const untracked = statusRes.stdout
          .split("\n")
          .filter((l) => l.startsWith("?? "))
          .map((l) => l.substring(3).trim());

        let extraDiff = "";
        for (const uPath of untracked) {
          const fullPath = path.join(repoDir, uPath);
          if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const lines = content.split("\n");
              extraDiff += `--- /dev/null\n+++ b/${uPath}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n") + "\n";
            } catch {}
          }
        }
        if (extraDiff) {
          return { diff: baseDiff ? `${baseDiff}\n${extraDiff}` : extraDiff };
        }
      }
    } catch {}
    if (baseDiff) return { diff: baseDiff };
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
  assertGitPath(cleanPath);
  const format = "%H|%h|%an|%ad|%s";
  const logRes = await executeGit(
    ["log", `-n${Number(limit) || 30}`, "--follow", "--date=short", `--pretty=format:${format}`, "--", cleanPath],
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
  assertCommitish(cleanHash);
  assertGitPath(cleanPath);

  const showRes = await executeGit(
    ["show", `${cleanHash}:${cleanPath}`],
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
  assertGitPath(cleanPath);
  const blameRes = await executeGit(
    ["blame", "--date=short", "-e", "-l", "--", cleanPath],
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

export interface RemoteUpdateCheckResult {
  hasUpdates: boolean;
  localHash: string;
  remoteHash?: string;
  branch?: string;
  behindCount?: number;
  aheadCount?: number;
  error?: string;
}

export async function checkRemoteGitUpdates(
  repoDir: string,
  remoteBranch?: string,
): Promise<RemoteUpdateCheckResult> {
  const isRepo = await isGitRepo(repoDir);
  if (!isRepo) {
    return { hasUpdates: false, localHash: "" };
  }

  // 1. Get current local HEAD commit hash
  const headRes = await executeGit(["rev-parse", "HEAD"], repoDir);
  const localHash = headRes.stdout.trim();
  if (!localHash) {
    return { hasUpdates: false, localHash: "" };
  }

  // 2. Check if repo has remote configured
  const remoteRes = await executeGit(["remote", "get-url", "origin"], repoDir);
  if (!remoteRes.success || !remoteRes.stdout.trim()) {
    return { hasUpdates: false, localHash };
  }

  // Determine branch to compare
  let branch = remoteBranch;
  if (!branch) {
    const branchRes = await executeGit(
      ["rev-parse", "--abbrev-ref", "HEAD"],
      repoDir,
    );
    branch = branchRes.stdout?.trim() || "main";
  }
  assertBranchName(branch);

  // 3. Query remote HEAD commit hash via ls-remote (fast, 0 disk operations, no working tree changes)
  const lsRes = await executeGit(
    ["ls-remote", "origin", `refs/heads/${branch}`],
    repoDir,
  );
  if (!lsRes.success || !lsRes.stdout.trim()) {
    return { hasUpdates: false, localHash, branch, error: lsRes.stderr };
  }

  const parts = lsRes.stdout.trim().split(/\s+/);
  const remoteHash = parts[0]?.trim();

  if (!remoteHash) {
    return { hasUpdates: false, localHash, branch };
  }

  const hasUpdates = remoteHash.toLowerCase() !== localHash.toLowerCase();

  return {
    hasUpdates,
    localHash,
    remoteHash,
    branch,
  };
}

