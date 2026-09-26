import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  Trash2, 
  Search, 
  ShieldCheck, 
  FileCode2, 
  Terminal, 
  Brain, 
  CheckCircle2, 
  Layers, 
  BookOpen, 
  X,
  ExternalLink,
  Wrench
} from 'lucide-react';
import { API } from '../../services/api';
import type { SkillItem } from '../../types';

interface SkillsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRepo?: string;
  onSkillSelect?: (skill: SkillItem) => void;
}

export const SkillsHubModal: React.FC<SkillsHubModalProps> = ({
  isOpen,
  onClose,
  activeRepo,
  onSkillSelect,
}) => {
  const [activeTab, setActiveTab] = useState<'hub' | 'installed'>('hub');
  const [hubSkills, setHubSkills] = useState<SkillItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeRepo]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hubRes, projRes] = await Promise.all([
        API.getSkillsHub(),
        API.getSkillsProject(activeRepo),
      ]);

      if (hubRes.ok && hubRes.data) {
        setHubSkills(hubRes.data.skills || []);
      }
      if (projRes.ok && projRes.data) {
        setInstalledSkills(projRes.data.installed_skills || []);
      }
    } catch (err) {
      console.error('Erro ao carregar skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (skill: SkillItem) => {
    try {
      setActionMessage(`Instalando '${skill.title || skill.name}'...`);
      const res = await API.installSkill(skill.id, activeRepo);
      if (res.ok) {
        setActionMessage(`Skill '${skill.title || skill.name}' instalada com sucesso!`);
        await loadData();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(`Erro: ${err.message}`);
    }
  };

  const handleUninstall = async (skillId: string) => {
    try {
      setActionMessage('Desinstalando skill...');
      const res = await API.uninstallSkill(skillId, activeRepo);
      if (res.ok) {
        setActionMessage('Skill desinstalada.');
        await loadData();
        if (selectedSkill?.id === skillId) {
          setSelectedSkill(null);
        }
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(`Erro: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const isInstalled = (id: string) => installedSkills.some((s) => s.id === id);

  const displayedList = activeTab === 'hub' ? hubSkills : installedSkills;
  const filteredSkills = displayedList.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      s.description.toLowerCase().includes(q) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)));
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'governance':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'architecture':
        return <FileCode2 className="w-4 h-4 text-blue-400" />;
      case 'quality':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'engineering':
        return <Terminal className="w-4 h-4 text-purple-400" />;
      case 'memory':
        return <Brain className="w-4 h-4 text-pink-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Hub de Skills do Agente
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Padrão ECC
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Instale habilidades, regras e ferramentas autônomas no projeto <span className="text-slate-200 font-mono">projects/{activeRepo || 'local'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div className="bg-indigo-900/40 border-b border-indigo-500/30 px-6 py-2 text-xs text-indigo-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
            {actionMessage}
          </div>
        )}

        {/* Modal Body: Split View (List + Details) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Search, Filter and Skill Cards */}
          <div className="w-7/12 border-r border-slate-800 flex flex-col p-4 bg-slate-900/40">
            
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('hub')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'hub'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Catálogo Global ECC ({hubSkills.length})
              </button>
              <button
                onClick={() => setActiveTab('installed')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'installed'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Instaladas no Projeto ({installedSkills.length})
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Pesquisar skills por nome, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas Categorias</option>
                <option value="governance">Governança</option>
                <option value="architecture">Arquitetura</option>
                <option value="quality">Qualidade</option>
                <option value="engineering">Engenharia</option>
                <option value="memory">Memória</option>
              </select>
            </div>

            {/* Skills Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">Carregando catálogo de skills...</div>
              ) : filteredSkills.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  {activeTab === 'installed'
                    ? 'Nenhuma skill instalada neste projeto ainda. Explore o Catálogo Global!'
                    : 'Nenhuma skill encontrada para o filtro.'}
                </div>
              ) : (
                filteredSkills.map((skill) => {
                  const installed = isInstalled(skill.id);
                  const isSelected = selectedSkill?.id === skill.id;

                  return (
                    <div
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill)}
                      className={`p-3 rounded-lg border transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(skill.category)}
                          <h4 className="text-xs font-semibold text-white">
                            {skill.title || skill.name}
                          </h4>
                          {installed && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Instalada
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">v{skill.version}</span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {skill.description}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {skill.tools && skill.tools.slice(0, 3).map((tool) => (
                          <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1">
                            <Wrench className="w-2.5 h-2.5 text-indigo-400" />
                            {tool}
                          </span>
                        ))}
                        {skill.tools && skill.tools.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{skill.tools.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Skill Deep View & Actions */}
          <div className="w-5/12 flex flex-col p-5 bg-slate-950/80 overflow-y-auto">
            {selectedSkill ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(selectedSkill.category)}
                      <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">
                        {selectedSkill.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {selectedSkill.title || selectedSkill.name}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      id: {selectedSkill.id} • v{selectedSkill.version}
                    </div>
                  </div>

                  {isInstalled(selectedSkill.id) ? (
                    <button
                      onClick={() => handleUninstall(selectedSkill.id)}
                      className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Desinstalar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(selectedSkill)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Instalar no Projeto
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  {selectedSkill.description}
                </p>

                {/* Ferramentas permitidas */}
                <div>
                  <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                    Ferramentas Nativas Vinculadas
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSkill.tools && selectedSkill.tools.length > 0 ? (
                      selectedSkill.tools.map((tool) => (
                        <span key={tool} className="text-xs px-2 py-1 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-mono">
                          {tool}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">Nenhuma ferramenta especial requerida.</span>
                    )}
                  </div>
                </div>

                {/* Arquétipos / Templates sugeridos */}
                {selectedSkill.suggested_templates && selectedSkill.suggested_templates.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      Templates Recomendados
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkill.suggested_templates.map((tpl) => (
                        <span key={tpl} className="text-xs px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                          {tpl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conteúdo do SKILL.md */}
                {selectedSkill.content && (
                  <div>
                    <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Instruções do Agente (SKILL.md)
                    </h5>
                    <pre className="text-[11px] text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-56 whitespace-pre-wrap font-mono">
                      {selectedSkill.content}
                    </pre>
                  </div>
                )}

                {/* Ação rápida para selecionar skill no chat */}
                {onSkillSelect && isInstalled(selectedSkill.id) && (
                  <button
                    onClick={() => {
                      onSkillSelect(selectedSkill);
                      onClose();
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ativar esta Skill no Copilot Agora
                  </button>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
                <Sparkles className="w-10 h-10 text-slate-700 mb-3" />
                <h4 className="text-sm font-semibold text-slate-400">Selecione uma Skill</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Clique em qualquer habilidade da lista ao lado para ver detalhes, ferramentas associadas e instalá-la no repositório ativo.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Repositório de Origem ECC:</span>
            <a
              href="https://github.com/mBaiadori/ECC"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline flex items-center gap-1"
            >
              mBaiadori/ECC <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
