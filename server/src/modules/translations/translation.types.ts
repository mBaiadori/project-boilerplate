export interface SupportedLanguage {
  code: string;
  label: string;
  flag: string;
}

export interface DocumentTranslationItem {
  lang: string;
  langLabel: string;
  langFlag: string;
  filePath: string;
  translationPath: string;
  lastModified: number;
  sourceLastModified: number;
  isOutdated: boolean; // Se o documento principal foi editado após a tradução
  isMain: boolean;
}

export interface TranslationEngineInfo {
  id: string;
  name: string;
  description: string;
  isLocal: boolean;
}

export interface TranslationOptions {
  sourceLang?: string;
  targetLang: string;
  preserveFrontmatter?: boolean;
  glossary?: Record<string, string>;
  engineId?: string;
  documentTitle?: string;
}

export interface ITranslationProvider {
  id: string;
  name: string;
  description: string;
  isLocal: boolean;
  translate(text: string, options: TranslationOptions): Promise<string>;
}

export interface SyncToMainPreview {
  filePath: string;
  targetLang: string;
  sourceLang: string;
  originalMainContent: string;
  translatedToMainContent: string;
  summary: string;
}
