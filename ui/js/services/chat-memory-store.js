// =============================================================================
// SERVICE: CHAT MEMORY & SESSION STORE (INDEXEDDB + PERSISTENT CACHE)
// =============================================================================
import { API } from "../api.js";

const DB_NAME = "ProjectBoilerplateMemoryDB";
const DB_VERSION = 1;
const STORE_NAME = "chat_sessions";

class ChatMemoryStore {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
  }

  async initDB() {
    if (typeof indexedDB === "undefined") {
      console.warn("IndexedDB not available, fallback to in-memory/localStorage cache.");
      return null;
    }

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => {
          console.warn("Could not open IndexedDB for chat memory.");
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB error:", err);
        resolve(null);
      }
    });
  }

  getKey(repo, docPath) {
    const r = (repo || "default").trim();
    const d = (docPath || "index.md").trim();
    return `${r}::${d}`;
  }

  generateSessionId(docPath) {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const slug = (docPath || "root").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 15);
    return `${dateStr}-${slug}`;
  }

  async loadSession(repo, docPath) {
    await this.initPromise;
    const key = this.getKey(repo, docPath);

    if (this.db) {
      try {
        return new Promise((resolve) => {
          const tx = this.db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch (e) {
        console.warn("IndexedDB load error:", e);
      }
    }

    // Fallback localStorage
    try {
      const raw = localStorage.getItem(`chat_mem_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async saveSession(repo, docPath, sessionData) {
    await this.initPromise;
    const key = this.getKey(repo, docPath);
    const record = {
      key,
      repo: repo || "default",
      docPath: docPath || "index.md",
      sessionId: sessionData.sessionId || this.generateSessionId(docPath),
      history: sessionData.history || [],
      updatedAt: new Date().toISOString(),
      author: sessionData.author || null,
      model: sessionData.model || null,
    };

    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
      } catch (e) {
        console.warn("IndexedDB save error:", e);
      }
    }

    try {
      localStorage.setItem(`chat_mem_${key}`, JSON.stringify(record));
    } catch (e) {}

    return record;
  }

  async clearSession(repo, docPath) {
    await this.initPromise;
    const key = this.getKey(repo, docPath);

    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
      } catch (e) {}
    }

    try {
      localStorage.removeItem(`chat_mem_${key}`);
    } catch (e) {}
  }

  async clearRepo(repo) {
    await this.initPromise;
    const r = (repo || "default").trim();

    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value && cursor.value.repo === r) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      } catch (e) {
        console.warn("IndexedDB clearRepo error:", e);
      }
    }

    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(`chat_mem_${r}::`) || k.startsWith(`chat_mem_${r}`)) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}
  }

  async clearAll() {
    await this.initPromise;

    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
      } catch (e) {
        console.warn("IndexedDB clearAll error:", e);
      }
    }

    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("chat_mem_") || k.startsWith("governance_ai_") || k.startsWith("governance_chat_") || k.startsWith("ai_chat_")) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}
  }
}

export const ChatMemoryStoreService = new ChatMemoryStore();
