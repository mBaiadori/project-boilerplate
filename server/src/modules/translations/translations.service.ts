import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, resolveRepoDir } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { dictionaryService } from '../dictionary/dictionary.service.js';
import { docsMetadataService } from '../workspace/docs-metadata.service.js';
import { translationProviderManager } from './providers/TranslationProviderManager.js';
import {
  SupportedLanguage,
  DocumentTranslationItem,
  SyncToMainPreview,
} from './translation.types.js';

export const DEFAULT_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', label: '中文 (Mandarin)', flag: '🇨🇳' },
  { code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
];

export class TranslationsService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const active = repoName || cfg.active_repo?.name || 'local';
    const effectiveOwner = cfg.active_repo?.name === active ? cfg.active_repo?.owner : undefined;
    return resolveRepoDir(active, effectiveOwner);
  }

  getProjectLanguageConfig(repoName?: string): {
    defaultLanguage: string;
    supportedLanguages: SupportedLanguage[];
    translationEngine: string;
  } {
    const repoDir = this.getRepoDir(repoName);
    const configPath = path.join(repoDir, '.project.config.json');

    let defaultLanguage = 'pt-BR';
    let supportedLanguages = DEFAULT_SUPPORTED_LANGUAGES;
    let translationEngine = 'lightweight-local';

    if (fs.existsSync(configPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (data.default_language && typeof data.default_language === 'string') {
          defaultLanguage = data.default_language;
        }
        if (Array.isArray(data.supported_languages) && data.supported_languages.length > 0) {
          supportedLanguages = data.supported_languages;
        }
        if (data.translation_engine && typeof data.translation_engine === 'string') {
          translationEngine = data.translation_engine;
        }
      } catch (err) {
        console.warn(`[TranslationsService] Erro ao ler .project.config.json em ${repoDir}:`, err);
      }
    }

    return {
      defaultLanguage,
      supportedLanguages,
      translationEngine,
    };
  }

  listTranslations(repoName: string, filePath: string): {
    defaultLanguage: string;
    supportedLanguages: SupportedLanguage[];
    translations: DocumentTranslationItem[];
  } {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const mainFileFullPath = path.join(repoDir, cleanPath);

    const { defaultLanguage, supportedLanguages } = this.getProjectLanguageConfig(repoName);

    let sourceMtime = 0;
    if (fs.existsSync(mainFileFullPath)) {
      sourceMtime = fs.statSync(mainFileFullPath).mtimeMs;
    }

    const translations: DocumentTranslationItem[] = [];

    for (const lang of supportedLanguages) {
      const isMain = lang.code.toLowerCase() === defaultLanguage.toLowerCase();
      const translationRelPath = isMain
        ? cleanPath
        : path.join('.translations', lang.code, cleanPath).replace(/\\/g, '/');
      const translationFullPath = path.join(repoDir, translationRelPath);

      const exists = fs.existsSync(translationFullPath);
      if (exists) {
        const stat = fs.statSync(translationFullPath);
        const transMtime = stat.mtimeMs;
        const isOutdated = !isMain && sourceMtime > transMtime + 2000; // tolerância de 2s

        translations.push({
          lang: lang.code,
          langLabel: lang.label,
          langFlag: lang.flag,
          filePath: cleanPath,
          translationPath: translationRelPath,
          lastModified: transMtime,
          sourceLastModified: sourceMtime,
          isOutdated,
          isMain,
        });
      }
    }

    return {
      defaultLanguage,
      supportedLanguages,
      translations,
    };
  }

  getTranslation(repoName: string, lang: string, filePath: string): {
    path: string;
    lang: string;
    content: string;
    isMain: boolean;
    isOutdated: boolean;
    lastModified: number;
  } {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const { defaultLanguage } = this.getProjectLanguageConfig(repoName);

    const isMain = !lang || lang.toLowerCase() === defaultLanguage.toLowerCase();
    const relPath = isMain
      ? cleanPath
      : path.join('.translations', lang, cleanPath).replace(/\\/g, '/');
    const fullPath = path.join(repoDir, relPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Tradução para idioma '${lang}' no arquivo '${cleanPath}' não encontrada.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const stat = fs.statSync(fullPath);

    let isOutdated = false;
    if (!isMain) {
      const mainFullPath = path.join(repoDir, cleanPath);
      if (fs.existsSync(mainFullPath)) {
        const mainStat = fs.statSync(mainFullPath);
        isOutdated = mainStat.mtimeMs > stat.mtimeMs + 2000;
      }
    }

    return {
      path: relPath,
      lang: isMain ? defaultLanguage : lang,
      content,
      isMain,
      isOutdated,
      lastModified: stat.mtimeMs,
    };
  }

  saveTranslation(repoName: string, lang: string, filePath: string, content: string) {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const { defaultLanguage } = this.getProjectLanguageConfig(repoName);

    const isMain = !lang || lang.toLowerCase() === defaultLanguage.toLowerCase();
    const relPath = isMain
      ? cleanPath
      : path.join('.translations', lang, cleanPath).replace(/\\/g, '/');
    const fullPath = path.join(repoDir, relPath);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');

    return {
      success: true,
      path: relPath,
      lang: isMain ? defaultLanguage : lang,
      isMain,
    };
  }

  deleteTranslation(repoName: string, lang: string, filePath: string) {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const { defaultLanguage } = this.getProjectLanguageConfig(repoName);

    if (lang.toLowerCase() === defaultLanguage.toLowerCase()) {
      throw new Error('Não é permitido deletar o documento no idioma oficial via API de tradução.');
    }

    const relPath = path.join('.translations', lang, cleanPath).replace(/\\/g, '/');
    const fullPath = path.join(repoDir, relPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.cleanEmptyParentDirs(path.dirname(fullPath), path.join(repoDir, '.translations', lang));
    }

    return { success: true };
  }

  /**
   * Atualiza e move os caminhos das traduções quando um arquivo ou pasta é renomeado ou movido na árvore
   */
  renameTranslationsForPath(repoName: string, oldPath: string, newPath: string): void {
    const repoDir = this.getRepoDir(repoName);
    const translationsBaseDir = path.join(repoDir, '.translations');
    if (!fs.existsSync(translationsBaseDir)) return;

    const cleanOld = (oldPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const cleanNew = (newPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanOld || !cleanNew) return;

    try {
      const langEntries = fs.readdirSync(translationsBaseDir, { withFileTypes: true });
      for (const entry of langEntries) {
        if (!entry.isDirectory()) continue;
        const langCode = entry.name;
        const langOldFullPath = path.join(translationsBaseDir, langCode, cleanOld);
        const langNewFullPath = path.join(translationsBaseDir, langCode, cleanNew);

        if (fs.existsSync(langOldFullPath)) {
          // Garante a criação do diretório pai de destino
          fs.mkdirSync(path.dirname(langNewFullPath), { recursive: true });
          fs.renameSync(langOldFullPath, langNewFullPath);

          // Limpa pastas vazias remanescentes na origem
          this.cleanEmptyParentDirs(path.dirname(langOldFullPath), path.join(translationsBaseDir, langCode));
        }
      }
    } catch (err) {
      console.warn(`[TranslationsService] Erro ao renomear caminhos de tradução de '${cleanOld}' para '${cleanNew}':`, err);
    }
  }

  /**
   * Migra arquivos de tradução correspondentes entre repositórios distintos
   */
  migrateTranslations(sourceRepo: string, targetRepo: string, oldPath: string, newPath: string): void {
    const sourceRepoDir = this.getRepoDir(sourceRepo);
    const targetRepoDir = this.getRepoDir(targetRepo);
    const sourceTransBase = path.join(sourceRepoDir, '.translations');
    const targetTransBase = path.join(targetRepoDir, '.translations');

    if (!fs.existsSync(sourceTransBase)) return;

    const cleanOld = (oldPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const cleanNew = (newPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanOld || !cleanNew) return;

    try {
      const langEntries = fs.readdirSync(sourceTransBase, { withFileTypes: true });
      for (const entry of langEntries) {
        if (!entry.isDirectory()) continue;
        const langCode = entry.name;
        const langOldFullPath = path.join(sourceTransBase, langCode, cleanOld);
        const langNewFullPath = path.join(targetTransBase, langCode, cleanNew);

        if (fs.existsSync(langOldFullPath)) {
          fs.mkdirSync(path.dirname(langNewFullPath), { recursive: true });
          fs.cpSync(langOldFullPath, langNewFullPath, { recursive: true, force: true });
          fs.rmSync(langOldFullPath, { recursive: true, force: true });
          this.cleanEmptyParentDirs(path.dirname(langOldFullPath), path.join(sourceTransBase, langCode));
        }
      }
    } catch (err) {
      console.warn(`[TranslationsService] Erro ao migrar traduções de '${sourceRepo}:${cleanOld}' para '${targetRepo}:${cleanNew}':`, err);
    }
  }

  /**
   * Remove arquivos de tradução correspondentes quando um arquivo ou diretório é excluído da árvore
   */
  deleteTranslationsForPath(repoName: string, filePath: string): void {
    const repoDir = this.getRepoDir(repoName);
    const translationsBaseDir = path.join(repoDir, '.translations');
    if (!fs.existsSync(translationsBaseDir)) return;

    const cleanPath = (filePath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanPath) return;

    try {
      const langEntries = fs.readdirSync(translationsBaseDir, { withFileTypes: true });
      for (const entry of langEntries) {
        if (!entry.isDirectory()) continue;
        const langCode = entry.name;
        const langTargetFullPath = path.join(translationsBaseDir, langCode, cleanPath);

        if (fs.existsSync(langTargetFullPath)) {
          if (fs.statSync(langTargetFullPath).isDirectory()) {
            fs.rmSync(langTargetFullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(langTargetFullPath);
          }
          this.cleanEmptyParentDirs(path.dirname(langTargetFullPath), path.join(translationsBaseDir, langCode));
        }
      }
    } catch (err) {
      console.warn(`[TranslationsService] Erro ao deletar caminhos de tradução para '${cleanPath}':`, err);
    }
  }

  private cleanEmptyParentDirs(dir: string, stopAt: string): void {
    try {
      let current = dir;
      while (current.length > stopAt.length && fs.existsSync(current)) {
        const files = fs.readdirSync(current);
        if (files.length === 0) {
          fs.rmdirSync(current);
          current = path.dirname(current);
        } else {
          break;
        }
      }
    } catch {}
  }

  async translateDocument(
    repoName: string,
    filePath: string,
    targetLang: string,
    engineId?: string
  ): Promise<{
    filePath: string;
    targetLang: string;
    translationPath: string;
    content: string;
    engineUsed: string;
  }> {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const mainFullPath = path.join(repoDir, cleanPath);

    if (!fs.existsSync(mainFullPath)) {
      throw new Error(`Documento principal '${cleanPath}' não encontrado.`);
    }

    const mainContent = fs.readFileSync(mainFullPath, 'utf-8');
    const { defaultLanguage, translationEngine } = this.getProjectLanguageConfig(repoName);

    const selectedEngineId = engineId || translationEngine;
    const provider = translationProviderManager.getProvider(selectedEngineId);

    // Carregar termos do dicionário para montar glossário
    const dictData = dictionaryService.getDictionary(repoName);
    const dictionaryTerms = Array.isArray(dictData?.terms) ? dictData.terms : [];
    const glossary: Record<string, string> = {};
    for (const item of dictionaryTerms) {
      if (item.term && item.definition) {
        glossary[item.term] = item.definition;
      }
    }

    // Obter título do documento
    const docMeta = docsMetadataService.getDocMetadata(repoName, cleanPath);
    const documentTitle = docMeta?.title || path.basename(cleanPath, path.extname(cleanPath));

    const translatedContent = await provider.translate(mainContent, {
      sourceLang: defaultLanguage,
      targetLang,
      glossary,
      preserveFrontmatter: true, // Preserva e traduz metadados textuais (title, description)
      documentTitle,
    });

    // Salvar arquivo traduzido (com frontmatter traduzido e corpo traduzido)
    const translationRelPath = path.join('.translations', targetLang, cleanPath).replace(/\\/g, '/');
    const translationFullPath = path.join(repoDir, translationRelPath);
    const dir = path.dirname(translationFullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(translationFullPath, translatedContent.trim(), 'utf-8');

    return {
      filePath: cleanPath,
      targetLang,
      translationPath: translationRelPath,
      content: translatedContent.trim(),
      engineUsed: provider.name,
    };
  }

  async translateBackToMain(
    repoName: string,
    filePath: string,
    translatedContent: string,
    fromLang: string,
    engineId?: string
  ): Promise<SyncToMainPreview> {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const mainFullPath = path.join(repoDir, cleanPath);

    const originalMainContent = fs.existsSync(mainFullPath)
      ? fs.readFileSync(mainFullPath, 'utf-8')
      : '';

    const { defaultLanguage, translationEngine } = this.getProjectLanguageConfig(repoName);
    const selectedEngineId = engineId || translationEngine;
    const provider = translationProviderManager.getProvider(selectedEngineId);

    const dictData = dictionaryService.getDictionary(repoName);
    const dictionaryTerms = Array.isArray(dictData?.terms) ? dictData.terms : [];
    const glossary: Record<string, string> = {};
    for (const item of dictionaryTerms) {
      if (item.term && item.definition) {
        glossary[item.term] = item.definition;
      }
    }

    // 1. Extrair título do frontmatter da versão traduzida (caso o usuário tenha editado o título no idioma alvo)
    const transFmMatch = translatedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    let transTitle: string | null = null;
    let pureTranslatedBody = translatedContent;
    if (transFmMatch) {
      pureTranslatedBody = translatedContent.slice(transFmMatch[0].length);
      const titleLineMatch = transFmMatch[1].match(/^\s*title\s*:\s*(?:["'](.*?)["']|(.*))$/m);
      if (titleLineMatch) {
        transTitle = (titleLineMatch[1] || titleLineMatch[2] || '').trim();
      }
    }

    // 2. Traduz o corpo do idioma de preferência para o idioma oficial padrão mantendo formatações
    const translatedBody = await provider.translate(pureTranslatedBody, {
      sourceLang: fromLang,
      targetLang: defaultLanguage,
      glossary,
      preserveFrontmatter: false,
    });

    // 3. Tratar Frontmatter do documento oficial (SSOT)
    const origFmMatch = originalMainContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    let finalFrontmatter = '';

    if (origFmMatch) {
      let fmContent = origFmMatch[1];
      // Se a versão traduzida continha um título, traduz o título de volta para o idioma padrão
      if (transTitle) {
        try {
          const backTranslatedTitle = await provider.translate(transTitle, {
            sourceLang: fromLang,
            targetLang: defaultLanguage,
            glossary,
            preserveFrontmatter: false,
          });
          const safeBackTitle = backTranslatedTitle.trim().replace(/"/g, '\\"');
          if (/^\s*title\s*:/im.test(fmContent)) {
            fmContent = fmContent.replace(/^(\s*title\s*:\s*).*$/im, `$1"${safeBackTitle}"`);
          } else {
            fmContent = `title: "${safeBackTitle}"\n${fmContent}`;
          }
        } catch (e) {
          console.warn('[TranslationsService] Falha ao traduzir título reverso:', e);
        }
      }
      finalFrontmatter = `---\n${fmContent.trim()}\n---\n\n`;
    } else if (transTitle) {
      try {
        const backTranslatedTitle = await provider.translate(transTitle, {
          sourceLang: fromLang,
          targetLang: defaultLanguage,
          glossary,
          preserveFrontmatter: false,
        });
        finalFrontmatter = `---\ntitle: "${backTranslatedTitle.trim().replace(/"/g, '\\"')}"\n---\n\n`;
      } catch {}
    }

    // 4. Monta o conteúdo final do documento oficial
    const translatedToMainContent = finalFrontmatter
      ? `${finalFrontmatter}${translatedBody.trim()}`
      : translatedBody.trim();

    return {
      filePath: cleanPath,
      targetLang: defaultLanguage,
      sourceLang: fromLang,
      originalMainContent,
      translatedToMainContent,
      summary: `Tradução reversa gerada de ${fromLang.toUpperCase()} para o idioma oficial ${defaultLanguage.toUpperCase()} via ${provider.name} com metadados e formatação estrutural preservados.`,
    };
  }

  applyToMain(repoName: string, filePath: string, content: string) {
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const mainFullPath = path.join(repoDir, cleanPath);

    const dir = path.dirname(mainFullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(mainFullPath, content, 'utf-8');

    return {
      success: true,
      filePath: cleanPath,
      message: 'Documento oficial atualizado com sucesso.',
    };
  }
}

export const translationsService = new TranslationsService();
