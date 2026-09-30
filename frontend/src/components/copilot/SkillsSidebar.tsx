import React, { useState, useEffect, useMemo } from 'react';
import { useAI } from '../../context/AIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';
import type { SkillItem } from '../../types';
import { Button, IconButton, SearchInput, Badge } from '../ui';
import { SelectDropdown, type SelectOption } from '../common/SelectDropdown';

interface SkillsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SkillsSidebar: React.FC<SkillsSidebarProps> = ({ isOpen, onClose }) => {
  const { activeRepo, projectConfig } = useWorkspace();
  const {
    activeSkillIds,
    setActiveSkillIds,
    toggleSkill,
    templateSkills,
    openSkillsModal,
  } = useAI();

  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const effectiveRepo = activeRepo?.name || 'default';

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen, effectiveRepo]);

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const projRes = await API.getSkillsProject(effectiveRepo);
      const proj = projRes.ok && projRes.data?.installed_skills ? projRes.data.installed_skills : [];
      setAvailableSkills(proj);
    } catch (err) {
      console.warn('[SkillsSidebar] Erro ao carregar skills instaladas no projeto:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract unique categories from installed skills
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of availableSkills) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [availableSkills]);

  // Options for SelectDropdown component
  const categoryOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      {
        value: 'all',
        label: `Todas (${availableSkills.length})`,
        icon: 'apps',
      },
    ];
    for (const cat of categories) {
      const count = availableSkills.filter((s) => s.category === cat).length;
      opts.push({
        value: cat,
        label: `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${count})`,
        icon: 'folder',
      });
    }
    return opts;
  }, [categories, availableSkills]);

  // Filter skills by search query and category
  const filteredSkills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return availableSkills.filter((skill) => {
      const title = (skill.title || skill.name || skill.id).toLowerCase();
      const desc = (skill.description || '').toLowerCase();
      const cat = (skill.category || '').toLowerCase();
      const tags = (skill.tags || []).join(' ').toLowerCase();

      const matchesSearch = !q || title.includes(q) || desc.includes(q) || cat.includes(q) || tags.includes(q);
      const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [availableSkills, searchQuery, selectedCategory]);

  // Group filtered skills into recommended by template vs other project skills
  const templateSkillItems = useMemo(() => {
    return filteredSkills.filter((s) => templateSkills.includes(s.id));
  }, [filteredSkills, templateSkills]);

  const projectSkillItems = useMemo(() => {
    return filteredSkills.filter((s) => !templateSkills.includes(s.id));
  }, [filteredSkills, templateSkills]);

  const projectColor = projectConfig?.primary_color || 'var(--color-primary, #2563eb)';

  const handleDeactivateAll = () => {
    setActiveSkillIds([]);
  };

  if (!isOpen) return null;

  return (
    <aside
      className="ai-copilot-prompt-sidebar ai-copilot-skills-sidebar ui-sidebar-drawer"
      style={{ width: '420px', maxWidth: '50vw' }}
    >
      {/* 1. Header do Painel */}
      <div className="ui-sidebar-drawer__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: `${projectColor}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: projectColor,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              auto_awesome
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '12.5px', color: 'var(--color-text-primary, #0f172a)', whiteSpace: 'nowrap' }}>
              Skills do Projeto
            </strong>
            <span className="ui-text-muted" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
              {activeSkillIds.length} {activeSkillIds.length === 1 ? 'skill ativa' : 'skills ativas'} &bull; {availableSkills.length} {availableSkills.length === 1 ? 'instalada' : 'instaladas'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openSkillsModal()}
            title="Explorar e instalar novas skills do Hub"
            icon={<span className="material-symbols-outlined" style={{ fontSize: '14px', color: projectColor }}>storefront</span>}
          >
            Hub
          </Button>
          {activeSkillIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeactivateAll}
              title="Desativar todas as skills no prompt"
              icon={<span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-danger, #ef4444)' }}>block</span>}
            >
              Limpar
            </Button>
          )}
          <IconButton
            size="sm"
            variant="ghost"
            title="Recarregar skills instaladas"
            onClick={loadSkills}
            icon={<span className="material-symbols-outlined icon-xs">refresh</span>}
          />
          <IconButton
            size="sm"
            variant="ghost"
            title="Fechar painel de skills"
            onClick={onClose}
            icon={<span className="material-symbols-outlined icon-sm">close</span>}
          />
        </div>
      </div>

      {/* 2. Barra de Pesquisa e Filtro por Categoria via SelectDropdown */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-subtle, #e2e8f0)',
          background: 'var(--color-surface, #ffffff)',
          flexShrink: 0,
          alignItems: 'center',
        }}
      >
        {/* Input de Busca */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchInput
            placeholder="Buscar skills no projeto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Dropdown de Categorias usando o componente SelectDropdown */}
        {categories.length > 0 && (
          <div style={{ width: '145px', flexShrink: 0 }}>
            <SelectDropdown
              value={selectedCategory}
              options={categoryOptions}
              onChange={(val) => setSelectedCategory(val)}
              variant="compact"
              placeholder="Categoria"
            />
          </div>
        )}
      </div>

      {/* 3. Lista de Skills com Checkboxes Múltiplos */}
      <div
        className="ui-sidebar-drawer__body"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)', fontSize: '11.5px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', animation: 'spin 1s infinite linear', color: projectColor, display: 'block', margin: '0 auto 8px auto' }}>
              sync
            </span>
            Carregando skills instaladas...
          </div>
        ) : filteredSkills.length > 0 ? (
          <>
            {/* Seção 1: Skills do Template Vinculado */}
            {templateSkillItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-tertiary, #9333ea)' }}>
                    auto_awesome
                  </span>
                  <strong style={{ fontSize: '11px', color: 'var(--color-text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Recomendadas pelo Template ({templateSkillItems.length})
                  </strong>
                </div>

                {templateSkillItems.map((skill) => {
                  const isChecked = activeSkillIds.includes(skill.id);
                  const title = skill.title || skill.name || skill.id;

                  return (
                    <div
                      key={`tpl-${skill.id}`}
                      onClick={() => toggleSkill(skill.id)}
                      style={{
                        padding: '9px 11px',
                        borderRadius: '8px',
                        background: isChecked ? 'var(--color-tertiary-subtle, rgba(147, 51, 234, 0.08))' : 'var(--color-surface, #ffffff)',
                        border: `1px solid ${isChecked ? 'var(--color-tertiary, #9333ea)' : 'var(--color-border-subtle, #e2e8f0)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSkill(skill.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', margin: 0 }}
                          />
                          <strong style={{ fontSize: '12px', color: isChecked ? '#6b21a8' : 'var(--color-text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {title}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <Badge variant="purple" size="sm">
                            Template
                          </Badge>
                          {isChecked && (
                            <Badge variant="primary" size="sm">
                              Ativa
                            </Badge>
                          )}
                        </div>
                      </div>

                      {skill.description && (
                        <p style={{ margin: '2px 0 0 24px', fontSize: '11px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.35 }}>
                          {skill.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Seção 2: Outras Skills Instaladas no Projeto */}
            {projectSkillItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: templateSkillItems.length > 0 ? '6px' : '0' }}>
                {templateSkillItems.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-primary, #2563eb)' }}>
                      extension
                    </span>
                    <strong style={{ fontSize: '11px', color: 'var(--color-text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Skills do Projeto ({projectSkillItems.length})
                    </strong>
                  </div>
                )}

                {projectSkillItems.map((skill) => {
                  const isChecked = activeSkillIds.includes(skill.id);
                  const title = skill.title || skill.name || skill.id;

                  return (
                    <div
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      style={{
                        padding: '9px 11px',
                        borderRadius: '8px',
                        background: isChecked ? 'var(--color-primary-subtle, rgba(37, 99, 235, 0.08))' : 'var(--color-surface, #ffffff)',
                        border: `1px solid ${isChecked ? 'var(--color-primary, #2563eb)' : 'var(--color-border-subtle, #e2e8f0)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSkill(skill.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', margin: 0 }}
                          />
                          <strong style={{ fontSize: '12px', color: isChecked ? 'var(--color-primary, #1d4ed8)' : 'var(--color-text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {title}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {skill.category && (
                            <Badge variant="neutral" size="sm">
                              {skill.category}
                            </Badge>
                          )}
                          {isChecked && (
                            <Badge variant="primary" size="sm">
                              Ativa
                            </Badge>
                          )}
                        </div>
                      </div>

                      {skill.description && (
                        <p style={{ margin: '2px 0 0 24px', fontSize: '11px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.35 }}>
                          {skill.description}
                        </p>
                      )}

                      {skill.tags && skill.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '3px 0 0 24px' }}>
                          {skill.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: '9.5px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'var(--color-surface-container-high, #f1f5f9)',
                                color: 'var(--color-text-secondary, #64748b)',
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="ui-empty-state" style={{ padding: '32px 16px', margin: 'auto 0' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                margin: '0 auto 10px auto',
                borderRadius: '50%',
                background: 'var(--color-primary-subtle, rgba(37, 99, 235, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary, #2563eb)',
              }}
            >
              <span className="material-symbols-outlined icon-md">
                {searchQuery ? 'search_off' : 'extension_off'}
              </span>
            </div>
            <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--color-text-primary, #0f172a)', marginBottom: '4px' }}>
              {searchQuery ? 'Nenhuma skill encontrada' : 'Nenhuma skill instalada neste projeto'}
            </strong>
            <p className="ui-text-muted" style={{ margin: '0 0 14px 0', fontSize: '11px', lineHeight: 1.4, maxWidth: '280px' }}>
              {searchQuery
                ? `Nenhum resultado corresponde a "${searchQuery}".`
                : 'Instale diretrizes especializadas e agentes do Hub de Skills para enriquecer a inteligência do Copilot neste projeto.'}
            </p>
            {searchQuery ? (
              <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                Limpar Busca
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  openSkillsModal();
                }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: '14px' }}>storefront</span>}
              >
                Explorar Hub de Skills
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
