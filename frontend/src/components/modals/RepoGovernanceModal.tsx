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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Governança & Acessos"
      subtitle={
        <>
          Nível de permissão em{' '}
          <code
            style={{
              color: 'var(--md-sys-color-primary, #1a73e8)',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            {orgLogin}/{repoName}
          </code>
        </>
      }
      icon={<Shield size={20} />}
      footer={
        <div className="repo-gov-footer">
          <span className="repo-gov-footer-total">
            Total:{' '}
            <strong>
              {activeTab === 'people' ? filteredPeople.length : filteredTeams.length}
            </strong>{' '}
            {activeTab === 'people' ? 'pessoa(s)' : 'time(s)'}
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="repo-gov-container">
        {/* Toolbar: Segmented Controls + Reload */}
        <div className="repo-gov-toolbar">
          <div className="repo-gov-segmented">
            <button
              type="button"
              className={`repo-gov-seg-btn ${activeTab === 'people' ? 'active' : ''}`}
              onClick={() => setActiveTab('people')}
            >
              <User size={14} />
              <span>Pessoas</span>
              <span className="repo-gov-counter">{collaborators.length}</span>
            </button>
            <button
              type="button"
              className={`repo-gov-seg-btn ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              <Users size={14} />
              <span>Times</span>
              <span className="repo-gov-counter">{teams.length}</span>
            </button>
          </div>

          <IconButton
            size="sm"
            variant="ghost"
            tooltip="Recarregar acessos"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw
              size={14}
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </IconButton>
        </div>

        {/* Search Filter */}
        <div className="repo-gov-search-wrap">
          <Search size={14} className="repo-gov-search-icon" />
          <input
            type="text"
            className="repo-gov-search-input"
            placeholder={
              activeTab === 'people'
                ? 'Filtrar pessoas por nome ou @username...'
                : 'Filtrar times por nome...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="repo-gov-search-clear"
              onClick={() => setSearchQuery('')}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Content List */}
        <div className="repo-gov-list custom-scrollbar">
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                gap: '10px',
                color: 'var(--md-sys-color-on-surface-variant, #5f6368)',
              }}
            >
              <Spinner size="md" />
              <span style={{ fontSize: '12px' }}>Consultando permissões de acesso...</span>
            </div>
          ) : errorMsg ? (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'var(--md-sys-color-error-container, #fce8e6)',
                color: 'var(--md-sys-color-on-error-container, #c5221f)',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          ) : activeTab === 'people' ? (
            filteredPeople.length === 0 ? (
              <div className="repo-gov-empty">
                <User size={32} className="repo-gov-empty-icon" />
                <p style={{ margin: 0 }}>Nenhuma pessoa encontrada.</p>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSearchQuery('')}
                    style={{ marginTop: '4px' }}
                  >
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              filteredPeople.map((person) => {
                const badge = getPermissionBadge(person.permission);
                return (
                  <div key={`person-${person.login}`} className="repo-gov-card">
                    <div className="repo-gov-card-left">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.login}
                          className="repo-gov-avatar"
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div className="repo-gov-avatar-fallback">
                          {person.login?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="repo-gov-info">
                        <div className="repo-gov-name-row">
                          <span className="repo-gov-name">
                            {(person as any).name || person.login}
                          </span>
                          {person.is_owner && (
                            <span className="repo-gov-owner-badge">Proprietário</span>
                          )}
                        </div>
                        <span className="repo-gov-sub">@{person.login}</span>
                      </div>
                    </div>

                    <div className="repo-gov-card-right">
                      <span
                        className="repo-gov-perm-badge"
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
                          className="repo-gov-external-link"
                          title="Ver perfil no GitHub"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : filteredTeams.length === 0 ? (
            <div className="repo-gov-empty">
              <Users size={32} className="repo-gov-empty-icon" />
              <p style={{ margin: 0 }}>Nenhum time vinculado a este repositório.</p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setSearchQuery('')}
                  style={{ marginTop: '4px' }}
                >
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            filteredTeams.map((team) => {
              const badge = getPermissionBadge(team.permission);
              return (
                <div key={`team-${team.id || team.slug}`} className="repo-gov-card">
                  <div className="repo-gov-card-left">
                    <div className="repo-gov-team-icon">
                      <Users size={16} />
                    </div>
                    <div className="repo-gov-info">
                      <div className="repo-gov-name-row">
                        <span className="repo-gov-name">{team.name}</span>
                        {(team as any).members_count !== undefined && (
                          <span
                            className="repo-gov-owner-badge"
                            style={{
                              background: 'var(--md-sys-color-surface-container-high, #e8eaed)',
                              color: 'var(--md-sys-color-on-surface-variant, #5f6368)',
                              borderColor: 'var(--md-sys-color-outline-variant, #dadce0)',
                            }}
                          >
                            {(team as any).members_count}{' '}
                            {(team as any).members_count === 1 ? 'membro' : 'membros'}
                          </span>
                        )}
                      </div>
                      {team.description && (
                        <span className="repo-gov-sub" style={{ maxWidth: '280px' }}>
                          {team.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="repo-gov-card-right">
                    <span
                      className="repo-gov-perm-badge"
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
          )}
        </div>
      </div>
    </Modal>
  );
};
