import type { DictionaryTerm } from '../../types';
import type { ApiResponse } from './client';

export const dictionaryApi = {
  async getDictionary(): Promise<ApiResponse<{ terms: DictionaryTerm[] }>> {
    const res = await fetch('/api/dictionary');
    return { ok: res.ok, data: await res.json() };
  },

  async saveDictionary(terms: DictionaryTerm[]): Promise<ApiResponse<any>> {
    const res = await fetch('/api/dictionary/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectDomainsDocs(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/domains-docs');
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectSyncStatus(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/sync-status');
    return { ok: res.ok, data: await res.json() };
  },
};
