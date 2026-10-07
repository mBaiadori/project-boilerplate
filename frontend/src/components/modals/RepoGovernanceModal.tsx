import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Users, User, Search, X, RefreshCw, ExternalLink } from 'lucide-react';
import { Modal, IconButton, Button, Spinner } from '../ui';
import { API } from '../../services/api';
import type { CollaboratorInfo, RepoTeamInfo } from '../../types';

interface RepoGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgLogin: string;
  repoName: string;
}

const PERMISSION_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  admin: {
    label: 'Administrador',
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.28)',
  },
  maintain: {
    label: 'Mantenedor',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.28)',
  },
  push: {
    label: 'Escrita',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
  },
  write: {
    label: 'Escrita',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
  },
  triage: {
    label: 'Triagem',
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.12)',
    border: 'rgba(13, 148, 136, 0.28)',
  },
  pull: {
    label: 'Leitura',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.12)',
    border: 'rgba(2, 132, 199, 0.28)',
  },
  read: {
    label: 'Leitura',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.12)',
    border: 'rgba(2, 132, 199, 0.28)',
  },
};

const getPermissionBadge = (perm: string = 'pull') => {
  const key = perm.toLowerCase();
  return (
    PERMISSION_BADGES[key] || {
      label: perm || 'Leitura',
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.12)',
      border: 'rgba(100, 116, 139, 0.28)',
    }
  );
};

export const RepoGovernanceModal: React.FC<RepoGovernanceModalProps> = ({
  isOpen,
  onClose,
  orgLogin,
  repoName,
}) => {
  const [activeTab, setActiveTab] = useState<'people' | 'teams'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [teams, setTeams] = useState<RepoTeamInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!repoName) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [collabRes, teamsRes] = await Promise.all([
        API.getGovernanceCollaborators(repoName),
        orgLogin && orgLogin !== 'local' && orgLogin !== 'all'
          ? API.getRepoTeams(orgLogin, repoName)
          : Promise.resolve({ ok: true, data: { teams: [] } }),
      ]);

      if (collabRes.ok && collabRes.data?.collaborators) {
        setCollaborators(collabRes.data.collaborators as any);
      } else {
        setCollaborators([]);
      }

      if (teamsRes.ok && teamsRes.data?.teams) {
        setTeams(teamsRes.data.teams);
      } else {
        setTeams([]);
      }
    } catch (err: any) {
      console.warn('[RepoGovernanceModal] Falha ao carregar acessos:', err);
      setErrorMsg('Não foi possível carregar a lista de acessos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      loadData();
    }
  }, [isOpen, repoName, orgLogin]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return collaborators;
    return collaborators.filter(
      (c) =>
        c.login?.toLowerCase().includes(q) ||
        (c as any).name?.toLowerCase().includes(q) ||
        c.role_name?.toLowerCase().includes(q) ||
        c.permission?.toLowerCase().includes(q)
    );
  }, [collaborators, searchQuery]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.slug?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.permission?.toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      {/* Modal Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-main/15 flex items-center justify-center text-primary-light">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Governança & Acessos
            </h3>
            <p className="text-xs text-text-muted">
              Nível de permissão em <span className="font-mono text-primary-light">{orgLogin}/{repoName}</span>
            </p>
          </div>
        </div>

        <IconButton
          icon={<X className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Fechar"
        />
      </div>

      {/* Tabs & Search Filter */}
      <div className="px-4 pt-3 pb-2 border-b border-surface-subtle bg-surface-subtle/10 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Segmented Control */}
          <div className="flex items-center p-0.5 bg-surface-subtle/60 rounded-lg text-xs">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'people'
                  ? 'bg-surface-elevated text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('people')}
            >
              <User className="w-3.5 h-3.5" />
              <span>Pessoas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                {collaborators.length}
              </span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'teams'
                  ? 'bg-surface-elevated text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('teams')}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Times</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                {teams.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md transition-colors"
            title="Recarregar acessos"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={activeTab === 'people' ? 'Filtrar pessoas por nome ou @username...' : 'Filtrar times por nome...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-surface-elevated border border-surface-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Content List */}
      <div className="p-4 max-h-[50vh] min-h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
            <Spinner size="md" />
            <span className="text-xs">Consultando permissões de acesso...</span>
          </div>
        ) : errorMsg ? (
          <div className="text-center py-8 text-xs text-rose-500">
            {errorMsg}
          </div>
        ) : activeTab === 'people' ? (
          filteredPeople.length === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted flex flex-col items-center gap-1.5">
              <User className="w-6 h-6 opacity-40 mb-1" />
              <p>Nenhuma pessoa encontrada.</p>
              {searchQuery && (
                <button
                  type="button"
                  className="text-primary hover:underline text-[11px]"
                  onClick={() => setSearchQuery('')}
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            filteredPeople.map((person) => {
              const badge = getPermissionBadge(person.permission);
              return (
                <div
                  key={`person-${person.login}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-surface-subtle bg-surface-elevated hover:border-surface-highlight transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.login}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {person.login?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {(person as any).name || person.login}
                        </span>
                        {person.is_owner && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 shrink-0">
                            Proprietário
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted font-mono truncate block">
                        @{person.login}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>

                    {person.html_url && (
                      <a
                        href={person.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-text-muted hover:text-text-primary transition-colors"
                        title="Ver perfil no GitHub"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          filteredTeams.length === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted flex flex-col items-center gap-1.5">
              <Users className="w-6 h-6 opacity-40 mb-1" />
              <p>Nenhum time vinculado a este repositório.</p>
              {searchQuery && (
                <button
                  type="button"
                  className="text-primary hover:underline text-[11px]"
                  onClick={() => setSearchQuery('')}
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            filteredTeams.map((team) => {
              const badge = getPermissionBadge(team.permission);
              return (
                <div
                  key={`team-${team.id || team.slug}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-surface-subtle bg-surface-elevated hover:border-surface-highlight transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {team.name}
                        </span>
                        {(team as any).members_count !== undefined && (
                          <span className="text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-surface-subtle shrink-0">
                            {(team as any).members_count} {(team as any).members_count === 1 ? 'membro' : 'membros'}
                          </span>
                        )}
                      </div>
                      {team.description && (
                        <p className="text-[11px] text-text-muted truncate max-w-[280px]">
                          {team.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Modal Footer */}
      <div className="flex items-center justify-between p-3.5 border-t border-surface-subtle bg-surface-subtle/20">
        <span className="text-[11px] text-text-muted">
          Total: {activeTab === 'people' ? `${collaborators.length} pessoa(s)` : `${teams.length} time(s)`}
        </span>
        <Button variant="primary" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
};
