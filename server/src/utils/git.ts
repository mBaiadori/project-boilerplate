import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function executeGitCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
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
    'Accept': 'application/vnd.github+json',
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
