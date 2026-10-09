import path from 'node:path';
import { PROJECTS_DIR } from '../config/constants.js';
import { loadConfig } from '../config/storage.js';

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface RepoPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

/**
 * Valida se um segmento de nome de org ou repositório é seguro.
 * Rejeita vazios, caracteres de path traversal (., ..), barras e caracteres inválidos.
 */
export function sanitizeRepoSegment(segment: string): string {
  if (!segment) return '';
  const trimmed = segment.trim();
  if (trimmed === '.' || trimmed === '..' || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`Segmento de repositório inválido: "${segment}"`);
  }
  // Remove sufixo .git se fornecido
  const clean = trimmed.replace(/\.git$/i, '');
  // Permite alfanuméricos, hífens, sublinhados e pontos seguros
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    throw new Error(`Segmento contém caracteres inválidos: "${segment}"`);
  }
  return clean;
}

/**
 * Converte qualquer entrada (string "owner/repo", objeto com owner/name, etc.) em RepoRef canônico.
 */
export function parseRepoRef(
  input: string | { owner?: any; repo?: string; name?: string; full_name?: string } | null | undefined,
  fallbackOwner?: string,
): RepoRef | null {
  if (!input) return null;

  if (typeof input === 'string') {
    const raw = input.trim().replace(/\.git$/i, '');
    if (!raw) return null;

    if (raw.includes('/')) {
      const parts = raw.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const owner = sanitizeRepoSegment(parts[0]);
        const repo = sanitizeRepoSegment(parts.slice(1).join('-'));
        return { owner, repo };
      }
    }

    let owner = fallbackOwner;
    if (!owner) {
      try {
        const cfg = loadConfig();
        if (cfg.active_repo?.name?.toLowerCase() === raw.toLowerCase() && cfg.active_repo?.owner) {
          owner = cfg.active_repo.owner;
        } else {
          owner = cfg.active_repo?.owner || cfg.user?.login || 'local';
        }
      } catch {
        owner = 'local';
      }
    }

    if (owner && raw) {
      return {
        owner: sanitizeRepoSegment(owner),
        repo: sanitizeRepoSegment(raw),
      };
    }

    return null;
  }

  if (typeof input === 'object') {
    const rawFullName = input.full_name;
    if (rawFullName && typeof rawFullName === 'string' && rawFullName.includes('/')) {
      return parseRepoRef(rawFullName, fallbackOwner);
    }

    let rawOwner =
      typeof input.owner === 'string'
        ? input.owner
        : typeof input.owner?.login === 'string'
          ? input.owner.login
          : fallbackOwner;

    const rawRepo = input.repo || input.name;

    if (!rawOwner && rawRepo) {
      try {
        const cfg = loadConfig();
        if (cfg.active_repo?.name?.toLowerCase() === rawRepo.toLowerCase() && cfg.active_repo?.owner) {
          rawOwner = cfg.active_repo.owner;
        } else {
          rawOwner = cfg.active_repo?.owner || cfg.user?.login || 'local';
        }
      } catch {
        rawOwner = 'local';
      }
    }

    if (rawOwner && rawRepo) {
      const owner = sanitizeRepoSegment(rawOwner);
      const repo = sanitizeRepoSegment(rawRepo);
      return { owner, repo };
    }
  }

  return null;
}

/**
 * Chave única em minúsculas para Map/Set/Lookup seguro sem colisão de maiúsculas/minúsculas.
 */
export function repoKey(ref: RepoRef): string {
  return `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`;
}

/**
 * Nome completo no formato "Owner/Repo".
 */
export function repoFullName(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

/**
 * Resolve o caminho de disco canônico e determinístico de um repositório:
 * SEMPRE `projects/<owner>/<repo>`.
 * Nunca cria diretório, nunca faz heurísticas de busca ou fallbacks legados.
 */
export function resolveRepoDirPath(refOrRepo: RepoRef | string, ownerOrOrg?: string): string {
  const ref =
    typeof refOrRepo === 'object' && refOrRepo !== null && 'owner' in refOrRepo && 'repo' in refOrRepo
      ? (refOrRepo as RepoRef)
      : parseRepoRef(refOrRepo, ownerOrOrg);

  if (!ref) {
    throw new Error(
      `Não foi possível resolver o repositório. Identificador inválido: "${String(refOrRepo)}" (owner: "${ownerOrOrg}")`,
    );
  }

  const cleanOwner = sanitizeRepoSegment(ref.owner);
  const cleanRepo = sanitizeRepoSegment(ref.repo);

  const resolved = path.resolve(PROJECTS_DIR, cleanOwner, cleanRepo);
  const rootResolved = path.resolve(PROJECTS_DIR);

  // Validação de segurança para garantir que não escapa de PROJECTS_DIR
  if (!resolved.startsWith(rootResolved + path.sep)) {
    throw new Error(`Caminho fora do diretório de projetos permitido: ${resolved}`);
  }

  return resolved;
}
