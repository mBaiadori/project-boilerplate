import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, recordChange } from '../../config/storage.js';

export class DictionaryService {
  private getDictionaryPath(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local', 'project', 'dictionary.json');
  }

  getDictionary() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const dictPath = this.getDictionaryPath(repoName);

    if (fs.existsSync(dictPath)) {
      try {
        const data = fs.readFileSync(dictPath, 'utf-8');
        return JSON.parse(data);
      } catch (e) {
        console.error('Erro ao ler dicionário:', e);
      }
    }

    return {
      version: '1.0.0',
      terms: [],
      domains: [],
    };
  }

  saveDictionary(data: any) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const dictPath = this.getDictionaryPath(repoName);

    let oldContent = '';
    if (fs.existsSync(dictPath)) {
      oldContent = fs.readFileSync(dictPath, 'utf-8');
    } else {
      fs.mkdirSync(path.dirname(dictPath), { recursive: true });
    }

    const newContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(dictPath, newContent, 'utf-8');

    recordChange(repoName, 'project/dictionary.json', oldContent ? 'MODIFIED' : 'ADDED', oldContent, newContent);

    return {
      success: true,
      dictionary: data,
    };
  }
}

export const dictionaryService = new DictionaryService();
