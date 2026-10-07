import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { Spinner } from '../ui';
import { API } from '../../services/api';
import type {
  OrganizationTeamInfo,
  OrganizationMemberInfo,
  RepoTeamInfo,
  CollaboratorInfo,
} from '../../types';

export interface SelectedGovernanceTeam {
  slug: string;
  name: string;
  permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' | string;
  members_count?: number;
}

export interface SelectedGovernanceMember {
  username: string;
  name?: string;
  avatar_url?: string;
  permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' | string;
  role?: string;
}

export interface AccessGovernanceManagerProps {
  /** Organização alvo para sincronizar times e membros */
  orgLogin: string;
  /** Nome do repositório (opcional para modo direto/live) */
  repoName?: string;
  /** Modo: 'form' (controlado por props) ou 'live' (faz mutações diretas via API) */
  mode?: 'form' | 'live';
  /** Estado de times selecionados (modo form) */
  selectedTeams?: SelectedGovernanceTeam[];
  /** Callback para alteração de times (modo form) */
  onChangeTeams?: (teams: SelectedGovernanceTeam[]) => void;
  /** Estado de membros selecionados (modo form) */
  selectedMembers?: SelectedGovernanceMember[];
  /** Callback para alteração de membros (modo form) */
  onChangeMembers?: (members: SelectedGovernanceMember[]) => void;
  /** Estilo de layout compacto para modais */
  compact?: boolean;
}

const PERMISSION_OPTIONS = [
  {
    id: 'pull',
    label: 'Leitura (Pull)',
    description: 'Apenas ler e clonar documentos',
    color: '#0284c7', // Sky
    bg: 'rgba(2, 132, 199, 0.12)',
  },
  {
    id: 'triage',
    label: 'Triagem (Triage)',
    description: 'Criar issues e gerenciar discussões',
    color: '#0d9488', // Teal
    bg: 'rgba(13, 148, 136, 0.12)',
  },
  {
    id: 'push',
    label: 'Escrita (Push)',
    description: 'Criar branches, editar e propor PRs',
    color: '#10b981', // Emerald
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'maintain',
    label: 'Mantenedor (Maintain)',
    description: 'Gerenciar branches e merge de PRs',
    color: '#8b5cf6', // Indigo / Purple
    bg: 'rgba(139, 92, 246, 0.12)',
  },
  {
    id: 'admin',
    label: 'Administrador (Admin)',
    description: 'Acesso total, governança e configurações',
    color: '#ec4899', // Rose / Pink
    bg: 'rgba(236, 72, 153, 0.12)',
  },
];

export const AccessGovernanceManager: React.FC<AccessGovernanceManagerProps> = ({
  orgLogin,
  repoName,
  mode = 'form',
  selectedTeams = [],
  onChangeTeams,
  selectedMembers = [],
  onChangeMembers,
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<'teams' | 'members'>('teams');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados remotos disponíveis na Org do GitHub
  const [orgTeams, setOrgTeams] = useState<OrganizationTeamInfo[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberInfo[]>([]);

  // Dados locais se em modo live
  const [liveTeams, setLiveTeams] = useState<RepoTeamInfo[]>([]);
  const [liveCollaborators, setLiveCollaborators] = useState<CollaboratorInfo[]>([]);

  // Carrega times e membros da organização
  const fetchOrgData = async () => {
    if (!orgLogin || orgLogin === 'local' || orgLogin === 'all') return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [teamsRes, membersRes] = await Promise.all([
        API.getOrgTeams(orgLogin),
        API.getOrgMembers(orgLogin),
      ]);

      if (teamsRes.ok && teamsRes.data?.teams) {
        setOrgTeams(teamsRes.data.teams);
      }
      if (membersRes.ok && membersRes.data?.members) {
        setOrgMembers(membersRes.data.members);
      }

      if (mode === 'live' && repoName) {
        const [repoTeamsRes, collabRes] = await Promise.all([
          API.getRepoTeams(orgLogin, repoName),
          API.getGovernanceCollaborators(repoName),
        ]);
        if (repoTeamsRes.ok && repoTeamsRes.data?.teams) {
          setLiveTeams(repoTeamsRes.data.teams);
        }
        if (collabRes.ok && collabRes.data?.collaborators) {
          setLiveCollaborators(collabRes.data.collaborators as any);
        }
      }
    } catch (err: any) {
      console.warn('[AccessGovernanceManager] Falha ao carregar dados da Org:', err);
      setErrorMsg('Não foi possível sincronizar times e membros da organização.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, [orgLogin, repoName, mode]);

  // Lista de times a exibir (selecionados vs disponíveis)
  const currentTeams = useMemo(() => {
    if (mode === 'live') {
      return liveTeams.map((t) => ({
        slug: t.slug,
        name: t.name,
        permission: t.permission || 'push',
        members_count: (t as any).members_count || 0,
      }));
    }
    return selectedTeams;
  }, [mode, liveTeams, selectedTeams]);

  // Lista de membros a exibir (selecionados vs disponíveis)
  const currentMembers = useMemo(() => {
    if (mode === 'live') {
      return liveCollaborators.map((c) => ({
        username: c.login,
        name: c.role || c.login,
        avatar_url: c.avatar_url,
        permission: c.permission || 'push',
      }));
    }
    return selectedMembers;
  }, [mode, liveCollaborators, selectedMembers]);

  // Filtragem de sugestões para adicionar
  const availableTeamsToAdd = useMemo(() => {
    const assignedSlugs = new Set(currentTeams.map((t) => t.slug.toLowerCase()));
    return orgTeams
      .filter((t) => !assignedSlugs.has(t.slug.toLowerCase()))
      .filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.slug.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [orgTeams, currentTeams, searchQuery]);

  const availableMembersToAdd = useMemo(() => {
    const assignedUsers = new Set(currentMembers.map((m) => m.username.toLowerCase()));
    return orgMembers
      .filter((m) => !assignedUsers.has(m.login.toLowerCase()))
      .filter((m) => m.login.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [orgMembers, currentMembers, searchQuery]);

  // Ações de Time
  const handleAddTeam = async (team: OrganizationTeamInfo) => {
    const defaultPerm = (team.permission as any) || 'push';
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.addTeamToRepo({
          org: orgLogin,
          teamSlug: team.slug,
          owner: orgLogin,
          repo: repoName,
          permission: defaultPerm,
        });
        if (res.ok) {
          fetchOrgData();
        } else {
          setErrorMsg(res.data?.message || 'Falha ao adicionar time');
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeTeams) {
      onChangeTeams([
        ...selectedTeams,
        {
          slug: team.slug,
          name: team.name,
          permission: defaultPerm,
          members_count: team.members_count,
        },
      ]);
      setSearchQuery('');
    }
  };

  const handleUpdateTeamPerm = async (teamSlug: string, permission: string) => {
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.addTeamToRepo({
          org: orgLogin,
          teamSlug,
          owner: orgLogin,
          repo: repoName,
          permission,
        });
        if (res.ok) fetchOrgData();
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeTeams) {
      onChangeTeams(
        selectedTeams.map((t) => (t.slug === teamSlug ? { ...t, permission } : t)),
      );
    }
  };

  const handleRemoveTeam = async (teamSlug: string) => {
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.removeTeamFromRepo({
          org: orgLogin,
          teamSlug,
          owner: orgLogin,
          repo: repoName,
        });
        if (res.ok) fetchOrgData();
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeTeams) {
      onChangeTeams(selectedTeams.filter((t) => t.slug !== teamSlug));
    }
  };

  // Ações de Membro
  const handleAddMember = async (member: OrganizationMemberInfo) => {
    const defaultPerm = 'push';
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.inviteCollaborator({
          username: member.login,
          permission: defaultPerm,
          repo: repoName,
        });
        if (res.ok) fetchOrgData();
        else setErrorMsg(res.data?.message || 'Falha ao convidar colaborador');
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeMembers) {
      onChangeMembers([
        ...selectedMembers,
        {
          username: member.login,
          name: member.login,
          avatar_url: member.avatar_url,
          permission: defaultPerm,
        },
      ]);
      setSearchQuery('');
    }
  };

  const handleUpdateMemberPerm = async (username: string, permission: string) => {
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.updateCollaboratorClearance({
          username,
          permission,
          repo: repoName,
        });
        if (res.ok) fetchOrgData();
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeMembers) {
      onChangeMembers(
        selectedMembers.map((m) =>
          m.username === username ? { ...m, permission } : m,
        ),
      );
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (mode === 'live' && repoName) {
      setIsMutating(true);
      try {
        const res = await API.removeCollaborator(username, repoName);
        if (res.ok) fetchOrgData();
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsMutating(false);
      }
    } else if (onChangeMembers) {
      onChangeMembers(selectedMembers.filter((m) => m.username !== username));
    }
  };

  const getPermConfig = (permId: string) => {
    return PERMISSION_OPTIONS.find((p) => p.id === permId) || PERMISSION_OPTIONS[2];
  };

  return (
    <div className={`access-governance-manager ${compact ? 'compact-layout' : ''}`}>
      {/* Abas Superiores: Times & Membros */}
      <div className="access-gov-tabs">
        <div className="access-gov-tabs-left">
          <button
            type="button"
            onClick={() => {
              setActiveTab('teams');
              setSearchQuery('');
            }}
            className={`access-gov-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          >
            <Users size={14} />
            Times da Organização ({currentTeams.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('members');
              setSearchQuery('');
            }}
            className={`access-gov-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          >
            <UserCheck size={14} />
            Colaboradores ({currentMembers.length})
          </button>
        </div>

        {isLoading && (
          <div className="access-gov-syncing">
            <Spinner size="sm" />
            <span>Sincronizando GitHub...</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="access-gov-error">
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Seção de Times */}
      {activeTab === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Lista de Times Selecionados / Associados */}
          {currentTeams.length > 0 ? (
            <div>
              <span className="access-gov-section-title">
                Times com Acesso Concedido
              </span>
              <div className="access-gov-list">
                {currentTeams.map((team) => {
                  const permCfg = getPermConfig(team.permission);
                  return (
                    <div key={team.slug} className="access-gov-row">
                      <div className="access-gov-row-left">
                        <div className="access-gov-icon-box">
                          <Users size={14} />
                        </div>
                        <div className="access-gov-info">
                          <span className="access-gov-name">{team.name}</span>
                          <span className="access-gov-sub">
                            @{orgLogin}/{team.slug}
                          </span>
                        </div>
                      </div>

                      <div className="access-gov-row-right">
                        <select
                          value={team.permission}
                          onChange={(e) => handleUpdateTeamPerm(team.slug, e.target.value)}
                          disabled={isMutating}
                          style={{
                            color: permCfg.color,
                            backgroundColor: permCfg.bg,
                            borderColor: `${permCfg.color}40`,
                          }}
                          className="access-gov-select"
                        >
                          {PERMISSION_OPTIONS.map((opt) => (
                            <option
                              key={opt.id}
                              value={opt.id}
                              style={{ background: '#ffffff', color: '#0f172a' }}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(team.slug)}
                          disabled={isMutating}
                          className="access-gov-btn-delete"
                          title="Remover time"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="access-gov-empty">
              Nenhum time associado ainda. Pesquise e adicione times da organização abaixo.
            </div>
          )}

          {/* Campo de Busca de Times da Org */}
          <div className="access-gov-search-section">
            <span className="access-gov-section-title">
              Adicionar Time da Organização
            </span>
            <div className="access-gov-search-box">
              <span className="access-gov-search-icon">
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="Buscar time no GitHub..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="access-gov-search-input"
              />
            </div>

            {availableTeamsToAdd.length > 0 ? (
              <div className="access-gov-suggest-list">
                {availableTeamsToAdd.map((team) => (
                  <div key={team.slug} className="access-gov-suggest-item">
                    <div style={{ minWidth: 0, overflow: 'hidden', paddingRight: '8px' }}>
                      <div className="access-gov-name">{team.name}</div>
                      <div className="access-gov-sub">
                        @{orgLogin}/{team.slug} {team.description ? `• ${team.description}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddTeam(team)}
                      disabled={isMutating}
                      className="access-gov-suggest-btn"
                    >
                      <Plus size={12} />
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: '8px 0' }}>
                Nenhum time encontrado para "{searchQuery}".
              </p>
            ) : orgTeams.length === 0 && !isLoading ? (
              <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: '8px 0' }}>
                Nenhum time configurado nesta organização no GitHub.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Seção de Membros / Colaboradores */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Lista de Colaboradores Selecionados / Associados */}
          {currentMembers.length > 0 ? (
            <div>
              <span className="access-gov-section-title">
                Colaboradores com Acesso Direto
              </span>
              <div className="access-gov-list">
                {currentMembers.map((member) => {
                  const permCfg = getPermConfig(member.permission);
                  return (
                    <div key={member.username} className="access-gov-row">
                      <div className="access-gov-row-left">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.username}
                            className="access-gov-avatar"
                          />
                        ) : (
                          <div className="access-gov-avatar-fallback">
                            {member.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="access-gov-info">
                          <span className="access-gov-name">@{member.username}</span>
                          {member.name && member.name !== member.username && (
                            <span className="access-gov-sub">{member.name}</span>
                          )}
                        </div>
                      </div>

                      <div className="access-gov-row-right">
                        <select
                          value={member.permission}
                          onChange={(e) =>
                            handleUpdateMemberPerm(member.username, e.target.value)
                          }
                          disabled={isMutating}
                          style={{
                            color: permCfg.color,
                            backgroundColor: permCfg.bg,
                            borderColor: `${permCfg.color}40`,
                          }}
                          className="access-gov-select"
                        >
                          {PERMISSION_OPTIONS.map((opt) => (
                            <option
                              key={opt.id}
                              value={opt.id}
                              style={{ background: '#ffffff', color: '#0f172a' }}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.username)}
                          disabled={isMutating}
                          className="access-gov-btn-delete"
                          title="Remover colaborador"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="access-gov-empty">
              Nenhum colaborador individual adicionado diretamente.
            </div>
          )}

          {/* Campo de Busca de Membros da Org */}
          <div className="access-gov-search-section">
            <span className="access-gov-section-title">
              Adicionar Membro da Organização
            </span>
            <div className="access-gov-search-box">
              <span className="access-gov-search-icon">
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="Buscar membro (@username)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="access-gov-search-input"
              />
            </div>

            {availableMembersToAdd.length > 0 ? (
              <div className="access-gov-suggest-list">
                {availableMembersToAdd.map((member) => (
                  <div key={member.login} className="access-gov-suggest-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden', paddingRight: '8px' }}>
                      <img
                        src={member.avatar_url}
                        alt={member.login}
                        className="access-gov-avatar"
                        style={{ width: '22px', height: '22px' }}
                      />
                      <div className="access-gov-info">
                        <span className="access-gov-name">@{member.login}</span>
                        {member.role && (
                          <span className="access-gov-sub">
                            {member.role === 'admin' ? 'Admin Org' : 'Membro'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddMember(member)}
                      disabled={isMutating}
                      className="access-gov-suggest-btn"
                    >
                      <Plus size={12} />
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: '8px 0' }}>
                Nenhum membro encontrado para "{searchQuery}".
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

