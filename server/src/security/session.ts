import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let activeSessionToken: string | null = null;

function getTokenStoragePath(): string {
  const home = process.env.HOME || os.homedir();
  const dir = path.join(home, '.context-os');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return path.join(dir, 'session-token');
}

/**
 * Retorna o token de sessão local ativo (ou gera e persiste um novo com permissão 0600).
 */
export function getSessionToken(): string {
  if (activeSessionToken) {
    return activeSessionToken;
  }

  const tokenPath = getTokenStoragePath();
  if (fs.existsSync(tokenPath)) {
    try {
      const stored = fs.readFileSync(tokenPath, 'utf-8').trim();
      if (stored.length === 64) {
        activeSessionToken = stored;
        return activeSessionToken;
      }
    } catch {}
  }

  const newToken = crypto.randomBytes(32).toString('hex');
  activeSessionToken = newToken;
  try {
    fs.writeFileSync(tokenPath, newToken, { mode: 0o600, encoding: 'utf-8' });
  } catch (e) {
    console.warn('[SessionSecurity] Não foi possível persistir token no disco:', e);
  }

  return activeSessionToken;
}

/**
 * Validação de token em tempo constante usando timingSafeEqual para mitigar ataques de temporização.
 */
export function isValidSessionToken(candidate?: string | null): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const current = getSessionToken();
  const candBuf = Buffer.from(candidate);
  const curBuf = Buffer.from(current);

  if (candBuf.length !== curBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candBuf, curBuf);
}

/**
 * Validação estrita do header Host para proteção contra ataques de DNS Rebinding.
 */
export function isValidHostHeader(hostHeader?: string): boolean {
  if (!hostHeader) return false; // Requisições HTTP legítimas exigem cabeçalho Host
  const clean = hostHeader.trim().toLowerCase();

  // Remove porta (ex: localhost:4100 -> localhost)
  let hostname = clean;
  if (clean.startsWith('[')) {
    // IPv6 ex: [::1]:4100
    const closeIdx = clean.indexOf(']');
    if (closeIdx > 0) {
      hostname = clean.substring(0, closeIdx + 1);
    }
  } else {
    hostname = clean.split(':')[0];
  }

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Parser leve e nativo de cookies do HTTP request.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const parts = cookieHeader.split(';');

  for (const part of parts) {
    const [rawKey, rawVal] = part.trim().split('=');
    if (rawKey && rawVal !== undefined) {
      try {
        cookies[rawKey.trim()] = decodeURIComponent(rawVal.trim());
      } catch {
        cookies[rawKey.trim()] = rawVal.trim();
      }
    }
  }

  return cookies;
}
