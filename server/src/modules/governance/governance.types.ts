export type GitHubPermission = 'pull' | 'triage' | 'push' | 'maintain' | 'admin';

export type SecurityLevelNumber = number;

export interface DepartmentConfig {
  id: string; // e.g. "engineering", "finance", "legal", "hr", "executive"
  name: string; // e.g. "Engenharia", "Financeiro", "Jurídico"
  folder: string; // pasta relativa na raiz ou em docs/ (e.g. "engineering", "finance")
  color: string;
  default_level: number; // 0, 1, 2, 3 ou 999
  icon?: string;
  description?: string;
}

export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'engineering',
    name: 'Engenharia',
    folder: 'engineering',
    color: '#6366f1',
    default_level: 2,
    icon: 'code',
    description: 'Arquitetura técnica, features e especificações de software',
  },
  {
    id: 'finance',
    name: 'Financeiro',
    folder: 'finance',
    color: '#10b981',
    default_level: 1,
    icon: 'payments',
    description: 'Orçamentos, DRE, notas fiscais e relatórios financeiros',
  },
  {
    id: 'legal',
    name: 'Jurídico',
    folder: 'legal',
    color: '#a855f7',
    default_level: 1,
    icon: 'gavel',
    description: 'Contratos, termos de uso, compliance e propriedade intelectual',
  },
  {
    id: 'hr',
    name: 'Recursos Humanos',
    folder: 'hr',
    color: '#ec4899',
    default_level: 2,
    icon: 'badge',
    description: 'Pessoas, cargos, salários e cultura organizacional',
  },
  {
    id: 'executive',
    name: 'Executivo',
    folder: 'executive',
    color: '#f43f5e',
    default_level: 0,
    icon: 'diamond',
    description: 'Diretoria executiva, conselho e decisões estratégicas de nível 0',
  },
];

export interface DynamicSecurityLevel {
  id: string; // e.g. "0", "1", "2", "3", "999" ou nomes legados
  level: number; // 0 = Root, 1 = Estratégico, 2 = Engenharia, 3 = Operacional, 999 = Público
  rank: number; // alias para level (retrocompatibilidade)
  name: string;
  color: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export function normalizeDynamicSecurityLevel(lvl: any, index = 0): DynamicSecurityLevel {
  if (!lvl || typeof lvl !== 'object') {
    return {
      id: String(index),
      level: index,
      rank: index,
      name: `Level ${index}`,
      color: '#3b82f6',
      description: '',
    };
  }
  const levelNum = typeof lvl.level === 'number' ? lvl.level : (typeof lvl.rank === 'number' ? lvl.rank : index);
  const id = String(lvl.id ?? levelNum);
  const name = lvl.name || lvl.label || (levelNum === 999 ? 'Público / Geral' : `Level ${levelNum}`);
  const color = lvl.color || (levelNum === 0 ? '#ef4444' : levelNum === 1 ? '#f97316' : levelNum === 2 ? '#eab308' : levelNum === 3 ? '#3b82f6' : '#10b981');
  const description = lvl.description || (levelNum === 999 ? 'Texto plano sem criptografia, acessível para todos os membros' : '');

  return {
    id,
    level: levelNum,
    rank: levelNum,
    name,
    color,
    description,
    created_at: lvl.created_at,
    updated_at: lvl.updated_at,
  };
}

export const DEFAULT_DYNAMIC_SECURITY_LEVELS: DynamicSecurityLevel[] = [
  {
    id: '0',
    level: 0,
    rank: 0,
    name: 'Root / Executivo',
    color: '#ef4444',
    description: 'Acesso Irrestrito Supremo (Abre todos os níveis e documentos)',
  },
  {
    id: '1',
    level: 1,
    rank: 1,
    name: 'Estratégico / Liderança',
    color: '#f97316',
    description: 'Acesso Amplo de Liderança, Arquitetura e Decisões Estratégicas',
  },
  {
    id: '2',
    level: 2,
    rank: 2,
    name: 'Engenharia / Time Técnico',
    color: '#eab308',
    description: 'Acesso Técnico de Engenharia e Especificações de Features',
  },
  {
    id: '3',
    level: 3,
    rank: 3,
    name: 'Operacional / Restrito Básico',
    color: '#3b82f6',
    description: 'Acesso Básico Operacional para Colaboradores e Prestadores',
  },
  {
    id: '999',
    level: 999,
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
  role?: string;
  role_name?: string; // retrocompatibilidade
  security_level: number; // 0, 1, 2, 3, 999
  level?: number; // alias direto para security_level
  security_level_id?: string;
  departments?: string[]; // e.g. ["engineering"], ["finance", "executive"] ou ["*"] (retrocompatibilidade)
  allowed_paths?: string[]; // Pastas/rotas permitidas (e.g. ["docs/engenharia", "docs/financeiro"] ou ["*"])
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
    | 'PR_EDITED'
    | 'PR_CONFLICT_RESOLVED'
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
