export type GitHubPermission = 'pull' | 'triage' | 'push' | 'maintain' | 'admin';

export type SecurityLevelNumber = number;

export interface DynamicSecurityLevel {
  id: string; // e.g. "root", "strategic", "engineering", "legal", "public"
  rank: number; // 0 = highest privilege (Root), 1 = Strategic, 2 = Engineering, 999 = Public
  name: string;
  color: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export function normalizeDynamicSecurityLevel(lvl: any, index = 0): DynamicSecurityLevel {
  if (!lvl || typeof lvl !== 'object') {
    return {
      id: `level_${index}`,
      rank: index,
      name: `Level ${index}`,
      color: '#3b82f6',
      description: '',
    };
  }
  const rank = typeof lvl.rank === 'number' ? lvl.rank : (typeof lvl.level === 'number' ? lvl.level : index);
  const id = String(lvl.id || (rank === 0 ? 'root' : rank === 1 ? 'strategic' : rank === 2 ? 'engineering' : rank === 3 ? 'operational' : rank === 999 ? 'public' : `level_${rank}`));
  const name = lvl.name || lvl.label || (rank === 999 ? 'Público / Geral' : `Level ${rank}`);
  const color = lvl.color || (rank === 0 ? '#ef4444' : rank === 1 ? '#f97316' : rank === 2 ? '#eab308' : rank === 3 ? '#3b82f6' : '#10b981');
  const description = lvl.description || (rank === 999 ? 'Texto plano sem criptografia, acessível para todos os membros' : '');

  return {
    id,
    rank,
    name,
    color,
    description,
    created_at: lvl.created_at,
    updated_at: lvl.updated_at,
  };
}

export const DEFAULT_DYNAMIC_SECURITY_LEVELS: DynamicSecurityLevel[] = [
  {
    id: 'root',
    rank: 0,
    name: 'Root / Executivo',
    color: '#ef4444',
    description: 'Acesso Irrestrito Supremo (Abre todos os níveis e documentos)',
  },
  {
    id: 'strategic',
    rank: 1,
    name: 'Estratégico / Liderança',
    color: '#f97316',
    description: 'Acesso Amplo de Liderança, Arquitetura e Decisões Estratégicas',
  },
  {
    id: 'engineering',
    rank: 2,
    name: 'Engenharia / Time Técnico',
    color: '#eab308',
    description: 'Acesso Técnico de Engenharia e Especificações de Features',
  },
  {
    id: 'operational',
    rank: 3,
    name: 'Operacional / Restrito Básico',
    color: '#3b82f6',
    description: 'Acesso Básico Operacional para Colaboradores e Prestadores',
  },
  {
    id: 'public',
    rank: 999,
    name: 'Público / Geral',
    color: '#10b981',
    description: 'Texto plano sem criptografia, acessível para todos os membros',
  },
];

export interface UserKeySlot {
  user: string;
  level_id: string;
  encrypted_dek: string; // Base64 ciphertext of the Level DEK
  iv: string; // Base64
  auth_tag: string; // Base64
  updated_at?: string;
}

export interface LevelCanaryProbe {
  level_id: string;
  iv: string; // Base64
  auth_tag: string; // Base64
  probe_ciphertext: string; // Base64
}

export interface CollaboratorInfo {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  permission: GitHubPermission;
  role_name?: string;
  security_level: number; // rank or legacy level number
  security_level_id?: string;
  is_owner?: boolean;
  invited_at?: string;
  status?: 'active' | 'pending';
}

export interface GovernanceQuorumRules {
  mode: 'auto' | 'manual'; // auto: solo if 1 member, team if >1; manual: explicit
  min_approvals_default: number;
  anti_self_approval: boolean;
  require_review_before_merge: boolean;
  dismiss_stale_reviews_on_push: boolean;
  enforce_admins_on_branch: boolean;
}

export interface BranchProtectionStatus {
  enabled: boolean;
  required_approving_review_count?: number;
  dismiss_stale_reviews?: boolean;
  require_code_owner_reviews?: boolean;
  enforce_admins?: boolean;
  allow_force_pushes?: boolean;
  allow_deletions?: boolean;
}

export interface GovernanceAuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | 'COLLABORATOR_INVITED'
    | 'COLLABORATOR_REMOVED'
    | 'BRANCH_PROTECTED'
    | 'QUORUM_UPDATED'
    | 'PR_APPROVED'
    | 'PR_MERGED'
    | 'PR_REJECTED'
    | 'KEY_ROTATED'
    | 'LEVEL_CREATED'
    | 'LEVEL_UPDATED'
    | 'LEVEL_DELETED'
    | 'DOCUMENTS_MIGRATED'
    | 'SECRET_BLOCKED';
  actor: string;
  target?: string;
  details: string;
  commit_hash?: string;
}

export interface SecurityVaultConfig {
  salt: string;
  levels: DynamicSecurityLevel[];
  canaries?: Record<string, LevelCanaryProbe>;
  user_slots?: Record<string, Record<string, UserKeySlot>>; // user -> level_id -> slot
  ai_privacy_policy?: {
    allow_external_ai_for_level_0: boolean;
    allow_external_ai_for_level_1: boolean;
    allow_local_ai_only: boolean;
  };
}

export interface SecretScanViolation {
  rule: string;
  file: string;
  line?: number;
  snippet?: string;
  message: string;
}

export interface SecretScanResult {
  hasSecrets: boolean;
  violations: SecretScanViolation[];
}
