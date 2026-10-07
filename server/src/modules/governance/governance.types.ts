export interface DepartmentConfig {
  id: string; // e.g. "engineering", "finance", "legal", "hr", "executive"
  name: string; // e.g. "Engenharia", "Financeiro"
  folder: string; // pasta raiz associada no repositório
  color: string; // cor do departamento/cofre
  icon?: string;
  description?: string;
}

export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'engineering',
    name: 'Engenharia',
    folder: 'engineering',
    color: '#6366f1',
    icon: 'code',
    description: 'Documentos técnicos, código-fonte, arquitetura e especificações de sistemas',
  },
  {
    id: 'finance',
    name: 'Financeiro',
    folder: 'finance',
    color: '#10b981',
    icon: 'payments',
    description: 'Balancetes, relatórios contábeis, faturamento e auditoria financeira',
  },
  {
    id: 'legal',
    name: 'Jurídico',
    folder: 'legal',
    color: '#a855f7',
    icon: 'gavel',
    description: 'Contratos, termos de serviço, compliance e registros regulatórios',
  },
  {
    id: 'hr',
    name: 'Recursos Humanos',
    folder: 'hr',
    color: '#ec4899',
    icon: 'badge',
    description: 'Políticas de contratação, avaliações de desempenho e dados de pessoal',
  },
  {
    id: 'executive',
    name: 'Executivo',
    folder: 'executive',
    color: '#f43f5e',
    icon: 'diamond',
    description: 'Diretoria executiva, conselho e decisões estratégicas',
  },
];

export type GitHubPermission = 'admin' | 'push' | 'pull' | 'triage' | 'maintain';

export interface CollaboratorInfo {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  permission: GitHubPermission;
  role?: string;
  role_name?: string;
  is_owner: boolean;
  status?: 'active' | 'pending' | 'revoked';
  invited_at?: string;
  departments?: string[];
  allowed_paths?: string[];
  denied_paths?: string[];
}

export interface QuorumRule {
  min_approvals?: number;
  min_approvals_default?: number;
  enforce_code_owners?: boolean;
  dismiss_stale_reviews_on_push?: boolean;
  require_review_from_code_owners?: boolean;
  require_review_before_merge?: boolean;
  enforce_admins_on_branch?: boolean;
  required_status_checks?: string[];
  strict?: boolean;
  mode?: string;
  anti_self_approval?: boolean;
}

export type GovernanceQuorumRules = QuorumRule;

export interface BranchProtectionConfig {
  branch?: string;
  protected?: boolean;
  required_approvals?: number;
  dismiss_stale_reviews?: boolean;
  require_code_owner_reviews?: boolean;
  enforce_admins?: boolean;
  enabled?: boolean;
  required_approving_review_count?: number;
  allow_force_pushes?: boolean;
  allow_deletions?: boolean;
}

export type BranchProtectionStatus = BranchProtectionConfig;

export interface GovernanceAuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | 'COLLABORATOR_INVITED'
    | 'COLLABORATOR_UPDATED'
    | 'COLLABORATOR_REMOVED'
    | 'BRANCH_PROTECTED'
    | 'QUORUM_UPDATED'
    | 'PR_APPROVED'
    | 'PR_MERGED'
    | 'PR_REJECTED'
    | 'PR_EDITED'
    | 'PR_CONFLICT_RESOLVED'
    | 'DEPARTMENT_CONFIG_UPDATED'
    | 'SECRET_BLOCKED';
  actor: string;
  target?: string;
  details: string;
  commit_hash?: string;
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

export interface OrganizationTeamInfo {
  id: number;
  slug: string;
  name: string;
  description?: string;
  permission?: GitHubPermission | string;
  members_count?: number;
  privacy?: string;
}

export interface OrganizationMemberInfo {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  role?: 'admin' | 'member' | string;
}

export interface RepoTeamInfo {
  id: number;
  slug: string;
  name: string;
  description?: string;
  permission: GitHubPermission | string;
  permissions?: {
    pull?: boolean;
    triage?: boolean;
    push?: boolean;
    maintain?: boolean;
    admin?: boolean;
  };
}

export interface OrgTeamMemberInfo {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  role: 'member' | 'maintainer' | string;
}

export interface CreateOrgTeamPayload {
  org: string;
  name: string;
  description?: string;
  privacy?: 'closed' | 'secret';
}

export interface OrgInvitePayload {
  org: string;
  username?: string;
  email?: string;
  role?: 'admin' | 'direct_member' | 'billing_manager';
  team_ids?: number[];
}

export interface EffectiveUserPermission {
  login: string;
  isOrgOwner: boolean;
  isOrgMember: boolean;
  isOutsideCollaborator: boolean;
  repoPermission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull' | 'none';
  roleName: string;
  allowedActions: {
    canRead: boolean;
    canWrite: boolean;
    canTriage: boolean;
    canMaintain: boolean;
    canAdmin: boolean;
    canManageGovernance: boolean;
    canManageTeams: boolean;
    canDeleteRepo: boolean;
    canManageBranchProtection: boolean;
  };
  teamMemberships: string[];
}

export interface GovernanceActionWorkflowStatus {
  installed: boolean;
  path: string;
  content?: string;
}


