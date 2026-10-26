import { authApi } from './auth.api';
import { reposApi } from './repos.api';
import { gitApi } from './git.api';
import { workspaceApi } from './workspace.api';
import { prsApi } from './prs.api';
import { templatesApi } from './templates.api';
import { dictionaryApi } from './dictionary.api';
import { aiApi } from './ai.api';
import { skillsApi } from './skills.api';
import { systemApi } from './system.api';
import { translationsApi } from './translations.api';
import { governanceApi } from './governance.api';
import { notificationsApi } from './notifications.api';

export * from './client';
export * from './auth.api';
export * from './repos.api';
export * from './git.api';
export * from './workspace.api';
export * from './prs.api';
export * from './templates.api';
export * from './dictionary.api';
export * from './ai.api';
export * from './skills.api';
export * from './system.api';
export * from './translations.api';
export * from './governance.api';
export * from './notifications.api';

/**
 * Fachada unificada retrocompatível da API do Context OS.
 * Agrega todos os domínios modulares sem quebrar nenhuma importação no aplicativo.
 */
export const API = {
  ...authApi,
  ...reposApi,
  ...gitApi,
  ...workspaceApi,
  ...prsApi,
  ...templatesApi,
  ...dictionaryApi,
  ...aiApi,
  ...skillsApi,
  ...systemApi,
  ...translationsApi,
  ...governanceApi,
  ...notificationsApi,
};


