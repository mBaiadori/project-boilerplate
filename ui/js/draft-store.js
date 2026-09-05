// =============================================================================
// PERSISTENT DRAFT STORE (LOCALSTORAGE AUTO-SAVE & DRAFT RECOVERY)
// =============================================================================

const DRAFT_PREFIX = 'ag_draft:';
const CHAT_DRAFT_PREFIX = 'ag_chat_draft:';

class DraftStore {
  constructor() {
    this.debounceTimers = new Map();
  }

  _makeKey(prefix, repo, filePath) {
    const cleanRepo = (repo || 'default').trim();
    const cleanPath = (filePath || 'index.md').trim();
    return `${prefix}${cleanRepo}:${cleanPath}`;
  }

  /**
   * Salva o rascunho de um documento (debounced por padrão)
   * @param {string} repo Nome do repositório
   * @param {string} filePath Caminho do arquivo (ex: domains/auth/spec.md)
   * @param {object} draftData { body, metadata, rawContent }
   * @param {number} debounceMs Tempo de debounce em ms (default: 500)
   */
  saveDocDraft(repo, filePath, draftData, debounceMs = 500) {
    const key = this._makeKey(DRAFT_PREFIX, repo, filePath);

    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      try {
        const payload = {
          repo,
          filePath,
          body: draftData.body || '',
          metadata: draftData.metadata || null,
          rawContent: draftData.rawContent || '',
          timestamp: Date.now(),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(payload));
        this.debounceTimers.delete(key);
      } catch (err) {
        console.warn('[DraftStore] Falha ao salvar rascunho local:', err);
      }
    }, debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Obtém o rascunho salvo de um documento
   * @param {string} repo
   * @param {string} filePath
   * @returns {object|null}
   */
  getDocDraft(repo, filePath) {
    try {
      const key = this._makeKey(DRAFT_PREFIX, repo, filePath);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[DraftStore] Erro ao ler rascunho:', err);
      return null;
    }
  }

  /**
   * Verifica se há rascunho não comitado para o arquivo
   */
  hasDocDraft(repo, filePath) {
    const key = this._makeKey(DRAFT_PREFIX, repo, filePath);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Limpa o rascunho de um documento (ex: após salvar com sucesso no workspace)
   */
  clearDocDraft(repo, filePath) {
    const key = this._makeKey(DRAFT_PREFIX, repo, filePath);
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('[DraftStore] Erro ao limpar rascunho:', err);
    }
  }

  /**
   * Salva rascunho de mensagem digitada no chat da IA
   */
  saveChatDraft(repo, filePath, text) {
    const key = this._makeKey(CHAT_DRAFT_PREFIX, repo, filePath);
    try {
      if (!text || !text.trim()) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify({
          text,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.warn('[DraftStore] Erro ao salvar chat draft:', err);
    }
  }

  /**
   * Recupera rascunho do prompt de chat
   */
  getChatDraft(repo, filePath) {
    try {
      const key = this._makeKey(CHAT_DRAFT_PREFIX, repo, filePath);
      const raw = localStorage.getItem(key);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed.text || '';
    } catch (err) {
      return '';
    }
  }

  /**
   * Limpa rascunho de prompt de chat
   */
  clearChatDraft(repo, filePath) {
    const key = this._makeKey(CHAT_DRAFT_PREFIX, repo, filePath);
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  }

  /**
   * Lista todos os rascunhos pendentes do repositório
   */
  listAllDrafts(repo) {
    const results = [];
    const prefix = `${DRAFT_PREFIX}${repo || 'default'}:`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            results.push(JSON.parse(raw));
          }
        }
      }
    } catch (err) {
      console.warn('[DraftStore] Erro ao listar rascunhos:', err);
    }
    return results;
  }
}

export const DraftStoreService = new DraftStore();
