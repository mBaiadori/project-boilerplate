export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'pt-BR',
    label: 'Português (Brasil)',
    nativeLabel: 'Português',
    flag: '🇧🇷'
  },
  {
    code: 'en',
    label: 'English (US)',
    nativeLabel: 'English',
    flag: '🇺🇸'
  }
];

export const DEFAULT_LANGUAGE = 'pt-BR';
export const FALLBACK_LANGUAGE = 'pt-BR';
export const LANGUAGE_STORAGE_KEY = 'ui-language';

export const NAMESPACES = ['common', 'auth', 'repos'] as const;
export type AppNamespace = (typeof NAMESPACES)[number];
