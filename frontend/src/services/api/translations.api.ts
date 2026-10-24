import type { TranslationEngineInfo, DocumentTranslationsResponse, DocumentTranslationFileResponse, SyncToMainPreview } from '../../types';
import type { ApiResponse } from './client';

export const translationsApi = {
  async getTranslationEngines(): Promise<ApiResponse<{ engines: TranslationEngineInfo[] }>> {
    const res = await fetch('/api/translations/engines');
    return { ok: res.ok, data: await res.json() };
  },

  async listTranslations(filePath: string, repo?: string): Promise<ApiResponse<DocumentTranslationsResponse>> {
    const qs = new URLSearchParams();
    qs.set('path', filePath);
    if (repo) qs.set('repo', repo);
    const res = await fetch(`/api/translations/list?${qs.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getTranslationFile(filePath: string, lang: string, repo?: string): Promise<ApiResponse<DocumentTranslationFileResponse>> {
    const qs = new URLSearchParams();
    qs.set('path', filePath);
    qs.set('lang', lang);
    if (repo) qs.set('repo', repo);
    const res = await fetch(`/api/translations/file?${qs.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async translateDocument(payload: {
    path: string;
    targetLang: string;
    engineId?: string;
    repo?: string;
  }): Promise<ApiResponse<{
    filePath: string;
    targetLang: string;
    translationPath: string;
    content: string;
    engineUsed: string;
  }>> {
    const res = await fetch('/api/translations/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async saveTranslation(payload: {
    path: string;
    lang: string;
    content: string;
    repo?: string;
  }): Promise<ApiResponse<{ success: boolean; path: string; lang: string }>> {
    const res = await fetch('/api/translations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteTranslation(payload: {
    path: string;
    lang: string;
    repo?: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    const res = await fetch('/api/translations/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async syncTranslationToMain(payload: {
    path: string;
    translatedContent: string;
    fromLang: string;
    engineId?: string;
    repo?: string;
  }): Promise<ApiResponse<SyncToMainPreview>> {
    const res = await fetch('/api/translations/sync-to-main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async applyTranslationToMain(payload: {
    path: string;
    content: string;
    repo?: string;
  }): Promise<ApiResponse<{ success: boolean; filePath: string; message: string }>> {
    const res = await fetch('/api/translations/apply-to-main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },
};
