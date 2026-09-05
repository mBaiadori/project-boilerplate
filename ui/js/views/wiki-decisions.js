import { API } from '../api.js';
import { ChatMemoryStoreService } from '../services/chat-memory-store.js';

export function initWikiDecisionsView({ getActiveRepo }) {
  const container = document.getElementById('subview-wiki');
  if (!container) return { loadWiki: () => {} };

  let activeCategory = 'all'; // 'all', 'decisions', 'concepts', 'gotchas', '_rules', 'handoffs'
  let searchQuery = '';
  let wikiData = { decisions: [], concepts: [], gotchas: [], _rules: [], handoffs: [] };
  let sessionsData = [];
  let activeEntry = null;

  const CATEGORY_META = {
    decisions: {
      label: 'Decisões Arquiteturais',
      short: 'Decisões',
      badge: 'ADR',
      icon: 'account_balance',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.08)',
      desc: 'Decisões técnicas e escolhas de arquitetura que definem a stack e contratos.'
    },
    _rules: {
      label: 'Regras & Invariantes',
      short: 'Regras',
      badge: 'REGRA',
      icon: 'shield',
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.08)',
      desc: 'Políticas inegociáveis de segurança, dados e qualidade seguidas em todo prompt.'
    },
    concepts: {
      label: 'Conceitos & Domínio',
      short: 'Conceitos',
      badge: 'CONCEITO',
      icon: 'extension',
      color: '#7c3aed',
      bg: 'rgba(124, 58, 237, 0.08)',
      desc: 'Glossário ubíquo, regras de negócio e limites de contexto do produto.'
    },
    gotchas: {
      label: 'Gotchas & Armadilhas',
      short: 'Gotchas',
      badge: 'GOTCHA',
      icon: 'warning',
      color: '#ea580c',
      bg: 'rgba(234, 88, 12, 0.08)',
      desc: 'Bugs conhecidos, armadilhas de libs e comportamentos não óbvios documentados.'
    },
    handoffs: {
      label: 'Handoffs de Sessão',
      short: 'Handoffs',
      badge: 'HANDOFF',
      icon: 'history_edu',
      color: '#0891b2',
      bg: 'rgba(8, 145, 178, 0.08)',
      desc: 'Passagens de bastão de contexto compiladas para continuidade entre agentes.'
    }
  };

  const STARTER_TEMPLATES = [
    {
      category: 'decisions',
      title: 'ADR 0001: Autenticação Stateless e Segurança',
      slug: '0001-autenticacao-stateless',
      content: `## Contexto & Motivação
A aplicação necessita de um mecanismo de autenticação seguro, escalável horizontalmente e compatível com microserviços e mobile.

## Decisão Tomada
Adotamos autenticação stateless baseada em **JWT (JSON Web Tokens)** assinados com chaves assimétricas **RSA-256 (RS256)**:
- Tokens de acesso com TTL curto (15 minutos).
- Refresh tokens armazenados em cookies seguros com flags \`HttpOnly\`, \`Secure\` e \`SameSite=Strict\`.

## Consequências & Invariantes
- Nenhum estado de sessão é mantido na memória dos nós de aplicação.
- Toda rota autenticada valida a assinatura do token localmente via chave pública.`
    },
    {
      category: '_rules',
      title: 'Regra de Governança: Conformidade LGPD & Logs Sanitizados',
      slug: 'regra-lgpd-sanitizacao-logs',
      content: `## Propósito
Garantir que nenhum dado pessoal sensível (PII), chaves de API, senhas ou tokens trafeguem ou sejam persistidos em logs abertos.

## Invariantes Obrigatórias
1. **Sanitização Automática:** Todos os logs e transcrições passam por filtros de expressão regular antes de gravação no Git.
2. **Sem Credenciais no Código:** Segredos devem ser injetados exclusivamente via variáveis de ambiente ou Infisical.
3. **Auditoria:** Apenas identificadores anônimos (UUID) podem ser indexados em métricas públicas.`
    },
    {
      category: 'gotchas',
      title: 'Gotcha: Idempotência e Retry em Gateways de Pagamento',
      slug: 'gotcha-idempotencia-pagamentos',
      content: `## Descrição do Problema
Chamadas de webhook de pagamento podem sofrer retentativas automáticas em caso de timeout de rede, gerando risco de processamento duplicado.

## Solução Adotada
Toda chamada de cobrança exige um cabeçalho \`Idempotency-Key\` gerado no frontend antes do envio. O backend valida no Redis com lock de 60 segundos antes de processar.`
    }
  ];

  function renderLayout() {
    container.innerHTML = `
      <div class="wiki-view-wrapper" style="display: flex; height: 100%; width: 100%; overflow: hidden; background: var(--bg-main, #f8fafc);">
        
        <!-- Left Sidebar: Categories, Search & Document List -->
        <aside class="wiki-sidebar" style="width: 320px; flex-shrink: 0; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; background: var(--bg-card, #ffffff);">
          
          <!-- Header -->
          <div style="padding: 14px 16px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary, #2563eb);">
                  <span class="material-symbols-outlined" style="font-size: 18px;">menu_book</span>
                </div>
                <div>
                  <h2 style="margin: 0; font-size: 13.5px; font-weight: 700; color: var(--text-heading);">Wiki & Decisões IA</h2>
                  <span style="font-size: 10.5px; color: var(--text-muted);">Memória Git (.spec-memory/)</span>
                </div>
              </div>
              <button id="btn-wiki-new-entry" class="btn btn-primary btn-xs" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px;">
                <span class="material-symbols-outlined icon-xs">add</span> Nova Nota
              </button>
            </div>

            <!-- Search input -->
            <div style="position: relative; display: flex; align-items: center;">
              <span class="material-symbols-outlined icon-xs" style="position: absolute; left: 10px; color: var(--text-muted); pointer-events: none;">search</span>
              <input type="text" id="wiki-search-input" placeholder="Buscar em todas as notas..." value="${escapeHtml(searchQuery)}" style="width: 100%; padding: 7px 28px 7px 30px; font-size: 11.5px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-input, #f8fafc); outline: none;" />
              <button id="btn-wiki-search-clear" type="button" style="position: absolute; right: 8px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: ${searchQuery ? 'block' : 'none'}; padding: 0;">
                <span class="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
          </div>

          <!-- Vertical Category Navigation List -->
          <div style="padding: 10px 12px 6px 12px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 2px;" id="wiki-category-nav">
            <button class="wiki-nav-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 6px; border: none; background: ${activeCategory === 'all' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === 'all' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">library_books</span>
                <span>Todas as Notas</span>
              </div>
              <span id="count-all" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px; font-weight: 600;">0</span>
            </button>

            <button class="wiki-nav-btn ${activeCategory === 'decisions' ? 'active' : ''}" data-cat="decisions" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; border: none; background: ${activeCategory === 'decisions' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === 'decisions' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 11.5px; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #2563eb;">account_balance</span>
                <span>Decisões (ADRs)</span>
              </div>
              <span id="count-decisions" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px;">0</span>
            </button>

            <button class="wiki-nav-btn ${activeCategory === '_rules' ? 'active' : ''}" data-cat="_rules" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; border: none; background: ${activeCategory === '_rules' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === '_rules' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 11.5px; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #16a34a;">shield</span>
                <span>Regras & Invariantes</span>
              </div>
              <span id="count-_rules" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px;">0</span>
            </button>

            <button class="wiki-nav-btn ${activeCategory === 'concepts' ? 'active' : ''}" data-cat="concepts" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; border: none; background: ${activeCategory === 'concepts' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === 'concepts' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 11.5px; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #7c3aed;">extension</span>
                <span>Conceitos & Domínio</span>
              </div>
              <span id="count-concepts" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px;">0</span>
            </button>

            <button class="wiki-nav-btn ${activeCategory === 'gotchas' ? 'active' : ''}" data-cat="gotchas" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; border: none; background: ${activeCategory === 'gotchas' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === 'gotchas' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 11.5px; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #ea580c;">warning</span>
                <span>Gotchas & Armadilhas</span>
              </div>
              <span id="count-gotchas" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px;">0</span>
            </button>

            <button class="wiki-nav-btn ${activeCategory === 'handoffs' ? 'active' : ''}" data-cat="handoffs" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; border-radius: 6px; border: none; background: ${activeCategory === 'handoffs' ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; color: ${activeCategory === 'handoffs' ? 'var(--primary, #2563eb)' : 'var(--text-body)'}; font-size: 11.5px; cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #0891b2;">history_edu</span>
                <span>Handoffs de Sessão</span>
              </div>
              <span id="count-handoffs" class="badge-count" style="font-size: 10.5px; background: #e2e8f0; padding: 1px 6px; border-radius: 10px;">0</span>
            </button>
          </div>

          <!-- Document List in Sidebar -->
          <div style="padding: 8px 12px 4px 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Documentos</span>
            <button id="btn-back-to-hub" class="btn btn-ghost btn-xs" style="font-size: 10px; color: var(--primary); display: none; padding: 1px 4px;">
              Ver Painel Hub
            </button>
          </div>
          <div id="wiki-entries-list" style="flex: 1; overflow-y: auto; padding: 6px 12px 12px 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 12px;">Carregando páginas...</div>
          </div>
        </aside>

        <!-- Main Content Area: Hub Dashboard OR Viewer/Editor -->
        <main class="wiki-main-pane" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-card, #ffffff);">
          <div id="wiki-content-header" style="padding: 12px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; min-height: 58px;">
            <div id="wiki-header-details" style="min-width: 0; flex: 1;">
              <h1 id="wiki-doc-title" style="margin: 0 0 2px 0; font-size: 16px; font-weight: 700; color: var(--text-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Hub de Conhecimento & Decisões IA</h1>
              <div id="wiki-doc-meta" style="font-size: 11px; color: var(--text-muted);">Padrão Karpathy LLM-Wiki no Git (.spec-memory/)</div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <!-- Dev Memory Reset Button (Development Mode) -->
              <button id="btn-open-dev-memory-modal" class="btn btn-ghost btn-xs" style="color: #ea580c; border: 1px dashed rgba(234, 88, 12, 0.4); display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 6px;" title="Painel de desenvolvimento para resetar sessões, logs e wiki de forma granular">
                <span class="material-symbols-outlined" style="font-size: 15px;">cleaning_services</span>
                <span>Reset Memória (Dev)</span>
              </button>

              <div id="wiki-header-actions" style="display: none; gap: 8px; flex-shrink: 0; align-items: center;">
                <button id="btn-wiki-delete-entry" class="btn btn-ghost btn-sm" style="color: var(--md-sys-color-error, #ef4444); display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px;" title="Excluir página do Git">
                  <span class="material-symbols-outlined icon-xs">delete</span> Excluir
                </button>
                <button id="btn-wiki-edit-toggle" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px;">
                  <span class="material-symbols-outlined icon-xs">edit</span> Editar
                </button>
                <button id="btn-wiki-save-entry" class="btn btn-primary btn-sm" style="display: none; align-items: center; gap: 4px; font-size: 11.5px;">
                  <span class="material-symbols-outlined icon-xs">save</span> Salvar no Git
                </button>
              </div>
            </div>
          </div>

          <!-- Body Container: Interactive Hub or Document View/Edit -->
          <div id="wiki-body-container" style="flex: 1; overflow-y: auto; padding: 24px 32px;">
            <!-- Loaded dynamically by renderHubDashboard() or renderActiveEntryView() -->
          </div>
        </main>
      </div>

      <!-- Dev Memory Reset Modal (Granular Reset Panel) -->
      <div id="modal-dev-memory-reset" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 16px;">
        <div class="modal-card" style="width: 100%; max-width: 680px; max-height: 90vh; background: #ffffff; border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
          
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: #fff7ed;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="material-symbols-outlined" style="color: #ea580c; font-size: 22px;">developer_mode</span>
              <div>
                <h3 style="margin: 0; font-size: 14.5px; font-weight: 700; color: #9a3412;">Painel de Desenvolvimento: Reset de Memória</h3>
                <span style="font-size: 11px; color: #c2410c;">Limpeza granular das camadas de memória e persistência do Git (.spec-memory/)</span>
              </div>
            </div>
            <button id="btn-close-dev-memory-modal" class="btn-icon" style="color: #9a3412; border: none; background: transparent; cursor: pointer;">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div style="padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">
              Selecione exatamente qual camada de dados você deseja limpar no repositório ativo (<strong>${escapeHtml(getActiveRepo()?.name || 'default')}</strong>):
            </p>

            <!-- Option 1: Browser Chat RAM / LocalStorage -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">1. Chat RAM & LocalStorage do Navegador</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Limpa o histórico imediato de mensagens em tela e caches de pre-prompt locais.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="localstorage" style="color: #2563eb; font-size: 11px; padding: 4px 10px;">
                Limpar RAM
              </button>
            </div>

            <!-- Option 2: Sessions -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">2. Sessões Gravadas (.spec-memory/sessions/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga as transcrições individuais de diálogos de IA salvas em Markdown.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="sessions" style="color: #ea580c; font-size: 11px; padding: 4px 10px;">
                Resetar Sessões
              </button>
            </div>

            <!-- Option 3: Logs -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">3. Logs Cronológicos de Transcrição (.spec-memory/log-*.md)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga os arquivos de log contínuo mensal de eventos do chat.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="logs" style="color: #ea580c; font-size: 11px; padding: 4px 10px;">
                Resetar Logs
              </button>
            </div>

            <!-- Option 4: Handoffs -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">4. Handoffs de Contexto (.spec-memory/handoffs/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga os resumos de contexto de continuidade dos documentos de especificação.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="handoffs" style="color: #0891b2; font-size: 11px; padding: 4px 10px;">
                Resetar Handoffs
              </button>
            </div>

            <!-- Option 5: Decisions (ADRs) -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">5. Decisões Arquiteturais (.spec-memory/decisions/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga todos os registros de ADRs compilados.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="decisions" style="color: #2563eb; font-size: 11px; padding: 4px 10px;">
                Resetar Decisões
              </button>
            </div>

            <!-- Option 6: Rules -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">6. Regras & Invariantes (.spec-memory/_rules/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga as regras globais de governança do projeto.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="_rules" style="color: #16a34a; font-size: 11px; padding: 4px 10px;">
                Resetar Regras
              </button>
            </div>

            <!-- Option 7: Concepts -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">7. Conceitos de Domínio (.spec-memory/concepts/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga os termos do glossário ubíquo e conceitos de negócio.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="concepts" style="color: #7c3aed; font-size: 11px; padding: 4px 10px;">
                Resetar Conceitos
              </button>
            </div>

            <!-- Option 8: Gotchas -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 12.5px; color: var(--text-heading); display: block;">8. Gotchas & Armadilhas (.spec-memory/gotchas/)</strong>
                <span style="font-size: 11px; color: var(--text-muted);">Apaga os alertas e armadilhas técnicas registradas.</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-trigger-reset" data-scope="gotchas" style="color: #ea580c; font-size: 11px; padding: 4px 10px;">
                Resetar Gotchas
              </button>
            </div>

            <!-- Option 9: Nuclear Reset (All) -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-top: 4px;">
              <div>
                <strong style="font-size: 12.5px; color: #991b1b; display: block;">💥 Reset Total de Memória (Nuclear)</strong>
                <span style="font-size: 11px; color: #b91c1c;">Apaga TODAS as sessões, logs, handoffs, ADRs e regras em .spec-memory/ deste repositório.</span>
              </div>
              <button class="btn btn-primary btn-xs btn-trigger-reset" data-scope="all" style="background: #dc2626; border-color: #dc2626; font-size: 11px; padding: 5px 12px;">
                Resetar Tudo
              </button>
            </div>

          </div>

          <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; background: #f8fafc;">
            <button id="btn-dismiss-dev-memory-modal" class="btn btn-secondary btn-sm" style="font-size: 12px;">Fechar</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    renderHubDashboard();
  }

  function bindEvents() {
    // Search input
    const searchInput = container.querySelector('#wiki-search-input');
    const searchClearBtn = container.querySelector('#btn-wiki-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').trim();
        if (searchClearBtn) {
          searchClearBtn.style.display = searchQuery ? 'block' : 'none';
        }
        renderEntriesList();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        searchClearBtn.style.display = 'none';
        renderEntriesList();
      });
    }

    // Category navigation buttons
    container.querySelectorAll('.wiki-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        container.querySelectorAll('.wiki-nav-btn').forEach(b => {
          const isAct = b === btn;
          b.style.background = isAct ? 'rgba(37, 99, 235, 0.08)' : 'transparent';
          b.style.color = isAct ? 'var(--primary, #2563eb)' : 'var(--text-body)';
          b.classList.toggle('active', isAct);
        });
        renderEntriesList();
        if (!activeEntry) {
          renderHubDashboard();
        }
      });
    });

    // Back to Hub Button
    const btnBackHub = container.querySelector('#btn-back-to-hub');
    if (btnBackHub) {
      btnBackHub.addEventListener('click', () => {
        activeEntry = null;
        btnBackHub.style.display = 'none';
        renderEntriesList();
        renderHubDashboard();
      });
    }

    // New Entry Button
    const btnNew = container.querySelector('#btn-wiki-new-entry');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        createNewEntry();
      });
    }

    // Dev Memory Reset Modal triggers
    const modalReset = container.querySelector('#modal-dev-memory-reset');
    const btnOpenReset = container.querySelector('#btn-open-dev-memory-modal');
    const btnCloseReset = container.querySelector('#btn-close-dev-memory-modal');
    const btnDismissReset = container.querySelector('#btn-dismiss-dev-memory-modal');

    const toggleResetModal = (show) => {
      if (modalReset) {
        modalReset.style.display = show ? 'flex' : 'none';
      }
    };

    if (btnOpenReset) {
      btnOpenReset.addEventListener('click', () => toggleResetModal(true));
    }
    if (btnCloseReset) {
      btnCloseReset.addEventListener('click', () => toggleResetModal(false));
    }
    if (btnDismissReset) {
      btnDismissReset.addEventListener('click', () => toggleResetModal(false));
    }

    // Execute Granular Reset
    container.querySelectorAll('.btn-trigger-reset').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scope = btn.dataset.scope;
        const repo = getActiveRepo()?.name || 'default';

        if (scope === 'localstorage') {
          const okLocal = confirm('Deseja limpar todo o histórico de mensagens e estado do chat local no navegador?');
          if (!okLocal) return;
          try {
            await ChatMemoryStoreService.clearAll();
            window.dispatchEvent(new CustomEvent('ai-memory-cleared', { detail: { repo, scope: 'localstorage' } }));
            alert('Histórico de chat local (RAM/IndexedDB/LocalStorage) limpo com sucesso!');
          } catch (e) {
            alert('Erro ao limpar localstorage: ' + e.message);
          }
          return;
        }

        const scopeLabels = {
          sessions: 'as Sessões Gravadas (.spec-memory/sessions/)',
          logs: 'os Logs de Transcrição (.spec-memory/log-*.md)',
          handoffs: 'os Handoffs de Contexto (.spec-memory/handoffs/)',
          decisions: 'as Decisões Arquiteturais (.spec-memory/decisions/)',
          _rules: 'as Regras & Invariantes (.spec-memory/_rules/)',
          concepts: 'os Conceitos de Domínio (.spec-memory/concepts/)',
          gotchas: 'os Gotchas & Armadilhas (.spec-memory/gotchas/)',
          all: 'TODA A MEMÓRIA GIT (.spec-memory/ completo)'
        };

        const confirmMsg = `Confirma a remoção de ${scopeLabels[scope] || scope} no repositório "${repo}"?`;
        if (!confirm(confirmMsg)) return;

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Limpando...';

        try {
          const { ok, data } = await API.resetMemoryScope({ repo, scope });
          if (ok && data && data.success) {
            // Also clean browser cache if sessions or all memory is reset
            if (scope === 'sessions' || scope === 'all' || scope === 'handoffs') {
              await ChatMemoryStoreService.clearRepo(repo);
              window.dispatchEvent(new CustomEvent('ai-memory-cleared', { detail: { repo, scope } }));
            }
            alert(`Limpeza concluída! ${data.deleted_count || 0} arquivos removidos em .spec-memory/ (${scope}).`);
            activeEntry = null;
            await loadWiki();
          } else {
            alert('Falha ao resetar memória: ' + (data?.error || 'Erro desconhecido'));
          }
        } catch (e) {
          alert('Erro de conexão ao resetar memória: ' + e.message);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });

    // Edit, Save, Delete buttons
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    const btnDelete = container.querySelector('#btn-wiki-delete-entry');

    if (btnEdit && btnSave) {
      btnEdit.addEventListener('click', () => {
        if (!activeEntry) return;
        const isEditing = btnSave.style.display !== 'none';
        if (isEditing) {
          btnSave.style.display = 'none';
          btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
          renderActiveEntryView();
        } else {
          btnSave.style.display = 'inline-flex';
          btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
          renderActiveEntryEditor();
        }
      });

      btnSave.addEventListener('click', async () => {
        const textarea = container.querySelector('#wiki-editor-textarea');
        const titleInput = container.querySelector('#wiki-editor-title-input');
        const catSelect = container.querySelector('#wiki-editor-category-select');
        const slugInput = container.querySelector('#wiki-editor-slug-input');

        if (!textarea || !activeEntry) return;

        const targetCat = catSelect ? catSelect.value : (activeEntry.category || 'decisions');
        const targetSlug = slugInput ? slugInput.value.trim() : activeEntry.slug;
        const targetTitle = titleInput ? titleInput.value.trim() : activeEntry.title;
        const content = textarea.value;

        if (!targetTitle || !targetSlug) {
          alert('Por favor, informe título e slug para a página.');
          return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Gravando no Git...';

        const repo = getActiveRepo()?.name || 'default';

        try {
          const { ok, data } = await API.saveMemoryWikiEntry({
            repo,
            category: targetCat,
            slug: targetSlug,
            title: targetTitle,
            content
          });

          if (ok) {
            btnSave.style.display = 'none';
            btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
            activeCategory = targetCat;
            activeEntry = {
              slug: targetSlug,
              title: targetTitle,
              category: targetCat,
              file_name: `${targetSlug}.md`,
              content
            };
            await loadWiki();
          } else {
            alert('Erro ao salvar página da wiki.');
          }
        } catch (e) {
          alert('Erro de conexão ao salvar no Git.');
        } finally {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar no Git';
        }
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!activeEntry) return;
        const confirmDel = confirm(`Tem certeza que deseja remover "${activeEntry.title}" (.spec-memory/${activeEntry.category}/${activeEntry.slug}.md)?`);
        if (!confirmDel) return;

        btnDelete.disabled = true;
        const repo = getActiveRepo()?.name || 'default';

        try {
          const { ok } = await API.deleteMemoryWikiEntry({
            repo,
            category: activeEntry.category,
            slug: activeEntry.slug
          });
          if (ok) {
            activeEntry = null;
            await loadWiki();
            renderHubDashboard();
          } else {
            alert('Não foi possível excluir o arquivo.');
          }
        } catch (e) {
          alert('Erro de conexão ao excluir da wiki.');
        } finally {
          btnDelete.disabled = false;
        }
      });
    }
  }

  function updateCategoryCounters() {
    let totalAll = 0;
    ['decisions', 'concepts', 'gotchas', '_rules', 'handoffs'].forEach(cat => {
      const list = wikiData[cat] || [];
      totalAll += list.length;
      const counterEl = container.querySelector(`#count-${cat}`);
      if (counterEl) counterEl.textContent = `${list.length}`;
    });
    const countAllEl = container.querySelector('#count-all');
    if (countAllEl) countAllEl.textContent = `${totalAll}`;
  }

  function getFilteredItems() {
    let items = [];
    if (activeCategory === 'all') {
      ['decisions', '_rules', 'concepts', 'gotchas', 'handoffs'].forEach(cat => {
        const catItems = (wikiData[cat] || []).map(i => ({ ...i, category: cat }));
        items.push(...catItems);
      });
    } else {
      items = (wikiData[activeCategory] || []).map(i => ({ ...i, category: activeCategory }));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => {
        const searchStr = `${item.title} ${item.slug} ${item.content} ${item.category}`.toLowerCase();
        return searchStr.includes(q);
      });
    }

    return items;
  }

  function renderEntriesList() {
    const listEl = container.querySelector('#wiki-entries-list');
    if (!listEl) return;

    updateCategoryCounters();
    const items = getFilteredItems();

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 11.5px; background: var(--bg-surface, #fff); border: 1px dashed var(--border-color); border-radius: 6px;">
          <span class="material-symbols-outlined" style="font-size: 20px; opacity: 0.5; margin-bottom: 4px;">search_off</span>
          <p style="margin: 0;">Nenhuma nota encontrada.</p>
        </div>
      `;
      return;
    }

    let html = '';
    items.forEach(item => {
      const isSelected = activeEntry && activeEntry.slug === item.slug && activeEntry.category === item.category;
      const meta = CATEGORY_META[item.category] || { label: item.category, badge: item.category, color: '#64748b', bg: '#f1f5f9' };
      const previewText = (item.content || '').replace(/^[#\-*`>\s]+/gm, '').slice(0, 65).trim();

      html += `
        <button class="wiki-entry-item ${isSelected ? 'selected' : ''}" data-slug="${escapeHtml(item.slug)}" data-cat="${escapeHtml(item.category)}" style="text-align: left; padding: 8px 10px; border-radius: 6px; border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background: ${isSelected ? 'rgba(37, 99, 235, 0.06)' : 'var(--bg-card)'}; cursor: pointer; display: flex; flex-direction: column; gap: 3px; transition: all 0.15s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span style="font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: ${meta.bg}; color: ${meta.color};">${meta.badge}</span>
            <span style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${escapeHtml(item.slug)}</span>
          </div>
          <strong style="font-size: 11.5px; color: var(--text-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.title)}</strong>
          ${previewText ? `<p style="margin: 0; font-size: 10.5px; color: var(--text-muted); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(previewText)}</p>` : ''}
        </button>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.wiki-entry-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.slug;
        const cat = btn.dataset.cat;
        const entry = items.find(i => i.slug === slug && i.category === cat);
        if (entry) {
          activeEntry = { ...entry };
          const btnBackHub = container.querySelector('#btn-back-to-hub');
          if (btnBackHub) btnBackHub.style.display = 'inline-block';
          renderEntriesList();
          renderActiveEntryView();
        }
      });
    });
  }

  function renderHubDashboard() {
    const titleEl = container.querySelector('#wiki-doc-title');
    const metaEl = container.querySelector('#wiki-doc-meta');
    const bodyEl = container.querySelector('#wiki-body-container');
    const actionsEl = container.querySelector('#wiki-header-actions');
    const btnBackHub = container.querySelector('#btn-back-to-hub');

    if (btnBackHub) btnBackHub.style.display = 'none';
    if (titleEl) titleEl.textContent = 'Hub de Conhecimento & Decisões IA';
    if (metaEl) metaEl.innerHTML = `Padrão Karpathy LLM-Wiki no Git &bull; Repositório: <strong>${escapeHtml(getActiveRepo()?.name || 'default')}</strong>`;
    if (actionsEl) actionsEl.style.display = 'none';

    if (!bodyEl) return;

    let totalNotes = 0;
    Object.values(wikiData).forEach(arr => { totalNotes += (arr || []).length; });

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 980px; margin: 0 auto;">
        
        <!-- Hero Banner -->
        <div style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(124, 58, 237, 0.06) 100%); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="material-symbols-outlined" style="color: var(--primary); font-size: 24px;">psychology</span>
              <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text-heading);">Memória Durável & Governança no Git</h2>
            </div>
            <p style="margin: 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; max-width: 640px;">
              Diferente de conversas soltas, o <strong>Wiki AI</strong> compila regras inegociáveis, decisões de arquitetura e aprendizados em Markdown versionado no Git. Todo agente e desenvolvedor carrega essas diretrizes automaticamente.
            </p>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 24px; font-weight: 800; color: var(--primary);">${totalNotes}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Notas Compiladas</div>
          </div>
        </div>

        <!-- 5 Knowledge Category Cards Grid -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-heading);">As 5 Camadas da Memória do Projeto</h3>
            <span style="font-size: 11px; color: var(--text-muted);">Clique em um card para filtrar ou criar</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            
            <!-- 1. Decisões -->
            <div class="wiki-hub-card" data-cat="decisions" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.2s ease;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; color: #2563eb;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">account_balance</span>
                    </div>
                    <strong style="font-size: 13px; color: var(--text-heading);">Decisões (ADRs)</strong>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; background: rgba(37, 99, 235, 0.1); color: #2563eb; padding: 2px 8px; border-radius: 10px;">${(wikiData.decisions || []).length}</span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                  Escolhas arquiteturais fundamentais (ex: auth JWT, DB Postgres) que não podem ser violadas.
                </p>
              </div>
              <button class="btn btn-ghost btn-xs btn-card-create" data-cat="decisions" style="align-self: flex-start; color: #2563eb; font-size: 11px; padding: 2px 6px;">
                + Criar ADR
              </button>
            </div>

            <!-- 2. Regras -->
            <div class="wiki-hub-card" data-cat="_rules" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.2s ease;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(22, 163, 74, 0.1); display: flex; align-items: center; justify-content: center; color: #16a34a;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">shield</span>
                    </div>
                    <strong style="font-size: 13px; color: var(--text-heading);">Regras & Invariantes</strong>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; background: rgba(22, 163, 74, 0.1); color: #16a34a; padding: 2px 8px; border-radius: 10px;">${(wikiData._rules || []).length}</span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                  Invariantes de segurança, sanitização de dados, LGPD e regras aplicadas em todo prompt.
                </p>
              </div>
              <button class="btn btn-ghost btn-xs btn-card-create" data-cat="_rules" style="align-self: flex-start; color: #16a34a; font-size: 11px; padding: 2px 6px;">
                + Criar Regra
              </button>
            </div>

            <!-- 3. Conceitos -->
            <div class="wiki-hub-card" data-cat="concepts" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.2s ease;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(124, 58, 237, 0.1); display: flex; align-items: center; justify-content: center; color: #7c3aed;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">extension</span>
                    </div>
                    <strong style="font-size: 13px; color: var(--text-heading);">Conceitos & Domínio</strong>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; background: rgba(124, 58, 237, 0.1); color: #7c3aed; padding: 2px 8px; border-radius: 10px;">${(wikiData.concepts || []).length}</span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                  Glossário ubíquo, entidades de domínio e termos essenciais compartilhados com o time.
                </p>
              </div>
              <button class="btn btn-ghost btn-xs btn-card-create" data-cat="concepts" style="align-self: flex-start; color: #7c3aed; font-size: 11px; padding: 2px 6px;">
                + Criar Conceito
              </button>
            </div>

            <!-- 4. Gotchas -->
            <div class="wiki-hub-card" data-cat="gotchas" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.2s ease;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(234, 88, 12, 0.1); display: flex; align-items: center; justify-content: center; color: #ea580c;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">warning</span>
                    </div>
                    <strong style="font-size: 13px; color: var(--text-heading);">Gotchas & Armadilhas</strong>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; background: rgba(234, 88, 12, 0.1); color: #ea580c; padding: 2px 8px; border-radius: 10px;">${(wikiData.gotchas || []).length}</span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                  Alertas de bugs conhecidos, peculiaridades de libs e soluções de contorno testadas.
                </p>
              </div>
              <button class="btn btn-ghost btn-xs btn-card-create" data-cat="gotchas" style="align-self: flex-start; color: #ea580c; font-size: 11px; padding: 2px 6px;">
                + Registrar Gotcha
              </button>
            </div>

            <!-- 5. Handoffs -->
            <div class="wiki-hub-card" data-cat="handoffs" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.2s ease;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(8, 145, 178, 0.1); display: flex; align-items: center; justify-content: center; color: #0891b2;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">history_edu</span>
                    </div>
                    <strong style="font-size: 13px; color: var(--text-heading);">Handoffs de Sessão</strong>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; background: rgba(8, 145, 178, 0.1); color: #0891b2; padding: 2px 8px; border-radius: 10px;">${(wikiData.handoffs || []).length}</span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                  Resumos executivos consolidados para transição suave de contexto entre sessões.
                </p>
              </div>
              <button class="btn btn-ghost btn-xs btn-card-create" data-cat="handoffs" style="align-self: flex-start; color: #0891b2; font-size: 11px; padding: 2px 6px;">
                + Criar Handoff
              </button>
            </div>

          </div>
        </div>

        <!-- Starter Kit: Modelos Rápidos para Inicializar com 1 Clique -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="material-symbols-outlined" style="color: #f59e0b; font-size: 18px;">bolt</span>
            <strong style="font-size: 13px; color: var(--text-heading);">Modelos Prontos para Começar (Starter Kit)</strong>
          </div>
          <p style="margin: 0 0 14px 0; font-size: 11.5px; color: var(--text-muted);">
            Clique em qualquer modelo abaixo para carregar um rascunho estruturado e salvar no Git com 1 clique:
          </p>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${STARTER_TEMPLATES.map((tpl, idx) => `
              <button class="btn btn-secondary btn-sm btn-starter-template" data-tpl-idx="${idx}" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; background: #ffffff;">
                <span>📄 ${escapeHtml(tpl.title)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Recent Recorded Sessions in .spec-memory/sessions/ -->
        ${sessionsData && sessionsData.length > 0 ? `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="color: var(--primary); font-size: 18px;">forum</span>
                <strong style="font-size: 13px; color: var(--text-heading);">Sessões de IA Gravadas no Git (${sessionsData.length})</strong>
              </div>
              <span style="font-size: 11px; color: var(--text-muted);">.spec-memory/sessions/</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${sessionsData.slice(0, 4).map(s => {
                const dateStr = s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : '';
                const tokens = s.metrics?.total_tokens || 0;
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; font-size: 11.5px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="material-symbols-outlined icon-xs" style="color: var(--primary);">chat</span>
                      <div>
                        <strong style="color: var(--text-heading);">${escapeHtml(s.target_document || 'Documento Geral')}</strong>
                        <span style="color: var(--text-muted); margin-left: 6px; font-size: 10.5px;">(${dateStr})</span>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      ${tokens > 0 ? `<span style="font-size: 10px; color: var(--text-muted); background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">🏷️ ${tokens.toLocaleString()} tok</span>` : ''}
                      <button class="btn btn-ghost btn-xs btn-extract-session" data-session-id="${escapeHtml(s.session_id)}" data-doc="${escapeHtml(s.target_document || '')}" style="color: var(--primary); font-size: 11px;">
                        ✨ Extrair Decisão
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    // Bind Hub Cards click
    bodyEl.querySelectorAll('.wiki-hub-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-create')) return;
        const cat = card.dataset.cat;
        const navBtn = container.querySelector(`.wiki-nav-btn[data-cat="${cat}"]`);
        if (navBtn) navBtn.click();
      });
    });

    // Bind Create buttons on cards
    bodyEl.querySelectorAll('.btn-card-create').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = btn.dataset.cat;
        activeCategory = cat;
        createNewEntry(cat);
      });
    });

    // Bind Starter template buttons
    bodyEl.querySelectorAll('.btn-starter-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tplIdx, 10);
        const tpl = STARTER_TEMPLATES[idx];
        if (tpl) {
          activeCategory = tpl.category;
          activeEntry = {
            slug: tpl.slug,
            title: tpl.title,
            file_name: `${tpl.slug}.md`,
            content: tpl.content,
            category: tpl.category,
            frontmatter: {}
          };
          renderActiveEntryEditor();
          const actionsEl = container.querySelector('#wiki-header-actions');
          const btnSave = container.querySelector('#btn-wiki-save-entry');
          const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
          if (actionsEl) actionsEl.style.display = 'flex';
          if (btnSave) btnSave.style.display = 'inline-flex';
          if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
        }
      });
    });

    // Bind Extract session buttons
    bodyEl.querySelectorAll('.btn-extract-session').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sid = btn.dataset.sessionId;
        const doc = btn.dataset.doc;
        const defaultSlug = `decisao-${(doc || 'sessao').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now().toString().slice(-4)}`;
        activeCategory = 'decisions';
        activeEntry = {
          slug: defaultSlug,
          title: `Decisão Extraída de ${doc || 'Sessão de IA'}`,
          file_name: `${defaultSlug}.md`,
          content: `## Contexto da Discussão\nExtraído da sessão de IA gravada para o documento \`${doc || 'index.md'}\` (Sessão: \`${sid}\`).\n\n## Decisões & Regras Definidas\n- Descreva os pontos acordados durante o pareamento.\n- Regra 1 estabelecida.\n\n## Invariantes & Próximos Passos\n- Validar implementação com o time.`,
          category: 'decisions',
          frontmatter: { source_session: sid }
        };
        renderActiveEntryEditor();
        const actionsEl = container.querySelector('#wiki-header-actions');
        const btnSave = container.querySelector('#btn-wiki-save-entry');
        const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
        if (actionsEl) actionsEl.style.display = 'flex';
        if (btnSave) btnSave.style.display = 'inline-flex';
        if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
      });
    });
  }

  function renderActiveEntryView() {
    if (!activeEntry) return;

    const titleEl = container.querySelector('#wiki-doc-title');
    const metaEl = container.querySelector('#wiki-doc-meta');
    const bodyEl = container.querySelector('#wiki-body-container');
    const actionsEl = container.querySelector('#wiki-header-actions');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
    const btnBackHub = container.querySelector('#btn-back-to-hub');

    if (btnBackHub) btnBackHub.style.display = 'inline-block';
    if (btnSave) btnSave.style.display = 'none';
    if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
    if (actionsEl) actionsEl.style.display = 'flex';

    const catMeta = CATEGORY_META[activeEntry.category] || { label: activeEntry.category, color: '#2563eb' };

    if (titleEl) titleEl.textContent = activeEntry.title;
    if (metaEl) {
      const author = activeEntry.frontmatter?.author || 'Developer';
      const handle = activeEntry.frontmatter?.author_handle ? `(@${activeEntry.frontmatter.author_handle})` : '';
      metaEl.innerHTML = `<span style="color: ${catMeta.color}; font-weight: 700;">${catMeta.label}</span> &bull; <code>.spec-memory/${activeEntry.category}/${activeEntry.file_name || activeEntry.slug + '.md'}</code> &bull; 👤 <strong>${escapeHtml(author)}</strong> ${escapeHtml(handle)}`;
    }

    if (bodyEl) {
      let parsed = '';
      if (typeof marked !== 'undefined' && marked.parse) {
        parsed = marked.parse(activeEntry.content);
      } else {
        parsed = `<pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(activeEntry.content)}</pre>`;
      }
      bodyEl.innerHTML = `
        <div style="max-width: 860px; margin: 0 auto;">
          <div class="wiki-rendered-markdown" style="font-size: 14px; line-height: 1.7; color: var(--text-body);">
            ${parsed}
          </div>
        </div>
      `;
    }
  }

  function renderActiveEntryEditor() {
    if (!activeEntry) return;
    const bodyEl = container.querySelector('#wiki-body-container');
    if (!bodyEl) return;

    const currentCat = activeEntry.category || (activeCategory === 'all' ? 'decisions' : activeCategory);

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; height: 100%; max-width: 900px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 200px 1fr 200px; gap: 12px;">
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: var(--text-heading); display: block; margin-bottom: 4px;">Categoria Git:</label>
            <select id="wiki-editor-category-select" style="width: 100%; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 12.5px; background: #fff;">
              <option value="decisions" ${currentCat === 'decisions' ? 'selected' : ''}>🏛️ Decisões (ADRs)</option>
              <option value="_rules" ${currentCat === '_rules' ? 'selected' : ''}>🛡️ Regras & Invariantes</option>
              <option value="concepts" ${currentCat === 'concepts' ? 'selected' : ''}>🧩 Conceitos & Domínio</option>
              <option value="gotchas" ${currentCat === 'gotchas' ? 'selected' : ''}>⚠️ Gotchas & Armadilhas</option>
              <option value="handoffs" ${currentCat === 'handoffs' ? 'selected' : ''}>📜 Handoffs de Sessão</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: var(--text-heading); display: block; margin-bottom: 4px;">Título da Página:</label>
            <input type="text" id="wiki-editor-title-input" value="${escapeHtml(activeEntry.title)}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13.5px;" />
          </div>
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: var(--text-heading); display: block; margin-bottom: 4px;">Identificador (Slug):</label>
            <input type="text" id="wiki-editor-slug-input" value="${escapeHtml(activeEntry.slug)}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 12.5px; font-family: monospace;" />
          </div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <label style="font-size: 11.5px; font-weight: 600; color: var(--text-heading);">Conteúdo em Markdown:</label>
            <span style="font-size: 10.5px; color: var(--text-muted);">Suporta cabeçalhos, tabelas, código e listas</span>
          </div>
          <textarea id="wiki-editor-textarea" style="width: 100%; flex: 1; min-height: 420px; padding: 14px; border: 1px solid var(--border-color); border-radius: 6px; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 13px; line-height: 1.6; resize: vertical;" spellcheck="false">${escapeHtml(activeEntry.content)}</textarea>
        </div>
      </div>
    `;
  }

  function createNewEntry(preferredCat = null) {
    const selectedCat = preferredCat || (activeCategory === 'all' ? 'decisions' : activeCategory);
    const defaultSlug = `nova-${selectedCat.replace('_', '')}-${Date.now().toString().slice(-4)}`;
    activeEntry = {
      slug: defaultSlug,
      title: 'Nova Decisão / Regra',
      file_name: `${defaultSlug}.md`,
      content: `## Contexto & Motivação\nDescreva aqui o problema, a motivação e os requisitos...\n\n## Decisão & Diretrizes\nO que foi acordado com o time e com a IA para este repositório...\n\n## Consequências & Invariantes\n- Regra inegociável 1\n- Invariante a ser respeitada`,
      category: selectedCat,
      frontmatter: {}
    };
    renderActiveEntryEditor();
    const actionsEl = container.querySelector('#wiki-header-actions');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
    const btnBackHub = container.querySelector('#btn-back-to-hub');
    if (btnBackHub) btnBackHub.style.display = 'inline-block';
    if (actionsEl) actionsEl.style.display = 'flex';
    if (btnSave) btnSave.style.display = 'inline-flex';
    if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
  }

  async function loadWiki() {
    const repo = getActiveRepo()?.name || 'default';
    try {
      const [wikiRes, histRes] = await Promise.all([
        API.getMemoryWiki({ repo }),
        API.getMemoryHistory({ repo })
      ]);

      if (wikiRes.ok && wikiRes.data && wikiRes.data.wiki) {
        wikiData = wikiRes.data.wiki;
      }
      if (histRes.ok && histRes.data && Array.isArray(histRes.data.sessions)) {
        sessionsData = histRes.data.sessions;
      }

      renderEntriesList();

      if (activeEntry) {
        const allItems = getFilteredItems();
        const updated = allItems.find(i => i.slug === activeEntry.slug && i.category === activeEntry.category);
        if (updated) {
          activeEntry = { ...updated };
          renderActiveEntryView();
        } else {
          renderHubDashboard();
        }
      } else {
        renderHubDashboard();
      }
    } catch (e) {
      console.warn('Could not load project wiki:', e);
    }
  }

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderLayout();

  return {
    loadWiki
  };
}
