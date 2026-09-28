import path from 'node:path';
import fs from 'node:fs';
import { PROJECTS_DIR } from '../../../config/constants.js';

export interface ContextPointerOptions {
  repoName: string;
  activeFilePath?: string;
  skillId?: string;
}

export class ContextPointerService {
  /**
   * Constrói as diretrizes de contexto baseadas em ponteiros de arquivos e regras locais
   */
  buildContextPointers(options: ContextPointerOptions): string[] {
    const { repoName, activeFilePath, skillId } = options;
    const pointers: string[] = [];

    const projectRoot = path.join(PROJECTS_DIR, repoName || 'local');
    pointers.push(`- Diretório raiz do projeto ativo: ${projectRoot}`);

    // Dicionário Ubíquo
    const projectDict = path.join(projectRoot, '.dictionary.json');
    const defaultDict = path.join(PROJECTS_DIR, 'default', '.dictionary.json');
    if (fs.existsSync(projectDict)) {
      pointers.push(`- Dicionário Ubíquo do projeto: ${projectDict} (consulte para termos de domínio e tipos)`);
    } else if (fs.existsSync(defaultDict)) {
      pointers.push(`- Dicionário Ubíquo padrão: ${defaultDict} (consulte para regras gerais de domínio)`);
    }

    // Configuração do Projeto
    const projectConfig = path.join(projectRoot, '.project.config.json');
    if (fs.existsSync(projectConfig)) {
      pointers.push(`- Configurações e stack do projeto: ${projectConfig}`);
    }

    // Documento Ativo
    if (activeFilePath) {
      const fullActivePath = path.isAbsolute(activeFilePath) 
        ? activeFilePath 
        : path.join(projectRoot, activeFilePath);
      pointers.push(`- Arquivo atualmente em foco no editor: ${fullActivePath}`);
    }

    // Pasta de Skills Locais do Projeto
    const skillsDir = path.join(projectRoot, '.skills');
    if (fs.existsSync(skillsDir)) {
      pointers.push(`- Skills instaladas neste projeto: ${skillsDir}`);
      if (skillId) {
        const targetSkillPath = path.join(skillsDir, skillId, 'SKILL.md');
        if (fs.existsSync(targetSkillPath)) {
          pointers.push(`- Instrução da Skill Ativa: ${targetSkillPath}`);
        }
      }
    }

    // Memória / Handoff
    const memoryDir = path.join(projectRoot, '.spec-memory');
    if (fs.existsSync(memoryDir)) {
      pointers.push(`- Memória viva e histórico de decisões: ${memoryDir}`);
    }

    return pointers;
  }
}

export const contextPointerService = new ContextPointerService();
