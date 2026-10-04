import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from './config';

import ptBRCommon from './locales/pt-BR/common.json';
import ptBRAuth from './locales/pt-BR/auth.json';
import ptBRRepos from './locales/pt-BR/repos.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enRepos from './locales/en/repos.json';

export const resources = {
  'pt-BR': {
    common: ptBRCommon,
    auth: ptBRAuth,
    repos: ptBRRepos,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    repos: enRepos,
  },
} as const;

const supportedLngCodes = SUPPORTED_LANGUAGES.map((l) => l.code);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'common',
    ns: ['common', 'auth', 'repos'],
    supportedLngs: supportedLngCodes,
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

// Keep html lang attribute in sync
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || DEFAULT_LANGUAGE;
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

export default i18n;
