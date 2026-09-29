import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { IAgentProvider, ProviderCapabilities, ProviderId, ProviderMessage, ProviderMode, ProviderSessionConfig, ProviderStatus, ProviderStreamEvent } from './provider.types.js';
import { loadConfig } from '../../../config/storage.js';
import { PROJECTS_DIR } from '../../../config/constants.js';

interface ActiveProcessSession {
  config: ProviderSessionConfig;
  process?: ChildProcess;
  outputBuffer: string;
  isWaitingApproval: boolean;
  approvalPrompt?: string;
  onEvent?: (event: ProviderStreamEvent) => void;
}

export class AntigravityAdapter implements IAgentProvider {
  readonly id: ProviderId = 'antigravity';
  readonly name = 'Google Antigravity Agent (agy)';
  readonly description = 'Execução de tarefas via agente local Antigravity com acesso ao workspace e ferramentas nativas';
  readonly mode: ProviderMode = 'connected';

  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsApprovals: true,
    supportsLocalFileSystem: true,
    supportsTerminalExecution: true,
  };

  private activeSessions = new Map<string, ActiveProcessSession>();

  /**
   * Identifica o executável ou comando do Antigravity verificando caminhos reais
   */
  private resolveCliCommand(): { command: string; argsPrefix: string[]; available: boolean } {
    const cfg = loadConfig();
    const customPath = cfg.settings?.antigravity_cli_path || process.env.ANTIGRAVITY_CLI_PATH;

    if (customPath && fs.existsSync(customPath)) {
      try {
        fs.accessSync(customPath, fs.constants.X_OK);
        return { command: customPath, argsPrefix: [], available: true };
      } catch {}
    }

    // Possíveis locais conhecidos do binário agy
    const possiblePaths = [
      path.join(process.env.HOME || '', '.local/bin/agy'),
      '/usr/local/bin/agy',
      '/opt/homebrew/bin/agy',
      path.join(process.env.HOME || '', '.antigravity/antigravity/bin/agy'),
      path.join(process.env.HOME || '', '.antigravity-ide/antigravity-ide/bin/agy'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          return { command: p, argsPrefix: ['--dangerously-skip-permissions', '-p'], available: true };
        } catch {}
      }
    }

    return { command: 'agy', argsPrefix: ['--dangerously-skip-permissions', '-p'], available: false };
  }

  async getStatus(): Promise<ProviderStatus> {
    const cli = this.resolveCliCommand();
    const geminiDir = path.join(process.env.HOME || '', '.gemini');
    const hasGeminiEnv = fs.existsSync(geminiDir);

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      mode: this.mode,
      isAvailable: cli.available,
      isAuthenticated: hasGeminiEnv,
      statusMessage: cli.available
        ? `CLI do Antigravity pronta (${cli.command})`
        : 'CLI do Antigravity (agy) não localizada no PATH. Configure o caminho em Configurações.',
      capabilities: this.capabilities,
    };
  }

  async startSession(config: ProviderSessionConfig): Promise<void> {
    this.activeSessions.set(config.sessionId, {
      config,
      outputBuffer: '',
      isWaitingApproval: false,
    });
  }

  async sendMessage(
    sessionId: string,
    message: string,
    onEvent: (event: ProviderStreamEvent) => void,
    options?: {
      history?: ProviderMessage[];
      briefing?: string;
      contextPointers?: string[];
    }
  ): Promise<{ reply: string; toolCalls?: any[] }> {
    const cli = this.resolveCliCommand();

    if (!cli.available) {
      const errMsg = `⚠️ O executável da CLI do Antigravity ('agy') não foi localizado no seu sistema.\n\nPara resolver:\n1. Verifique se a CLI está instalada no seu terminal ou defina o caminho em 'Configurações > Antigravity CLI Path'.\n2. Ou selecione **Claude Code** ou **Direct API** no seletor de provedor acima para continuar conversando.`;
      
      onEvent({
        type: 'token',
        provider: this.id,
        sessionId,
        text: errMsg,
        timestamp: Date.now(),
      });

      onEvent({
        type: 'done',
        provider: this.id,
        sessionId,
        data: { reply: errMsg },
        timestamp: Date.now(),
      });

      return { reply: errMsg };
    }

    let session = this.activeSessions.get(sessionId);
    if (!session) {
      const targetPath = path.join(PROJECTS_DIR, 'local');
      session = {
        config: { sessionId, repoName: 'local', projectPath: targetPath },
        outputBuffer: '',
        isWaitingApproval: false,
      };
      this.activeSessions.set(sessionId, session);
    }

    session.onEvent = onEvent;
    session.outputBuffer = '';
    session.isWaitingApproval = false;

    const targetCwd = session.config.projectPath || path.join(PROJECTS_DIR, session.config.repoName || 'local');
    if (!fs.existsSync(targetCwd)) {
      fs.mkdirSync(targetCwd, { recursive: true });
    }

    const formattedPrompt = [
      options?.contextPointers && options.contextPointers.length > 0
        ? `[DIRETRIZES DE CONTEXTO DO PROJETO]\n${options.contextPointers.join('\n')}\n`
        : '',
      options?.briefing ? `[MEMÓRIA / HANDOFF]\n${options.briefing}\n` : '',
      `[INSTRUÇÃO DO USUÁRIO]\n${message}`,
    ].filter(Boolean).join('\n\n');

    onEvent({
      type: 'start',
      provider: this.id,
      sessionId,
      data: { cwd: targetCwd, command: cli.command },
      timestamp: Date.now(),
    });

    return new Promise<{ reply: string; toolCalls?: any[] }>((resolve, reject) => {
      let finalReply = '';

      try {
        const cfg = loadConfig();
        const effort = (cfg.settings as any)?.agent_effort || 'medium';
        const model = (cfg.settings as any)?.agent_model;

        const spawnArgs: string[] = ['--dangerously-skip-permissions'];
        if (effort) {
          spawnArgs.push('--effort', effort);
        }
        if (model) {
          spawnArgs.push('--model', model);
        }
        spawnArgs.push('-p', formattedPrompt);

        // Dispara o processo diretamente sem shell intermediário para evitar falha de parse de strings
        const child = spawn(cli.command, spawnArgs, {
          cwd: targetCwd,
          env: {
            ...process.env,
            PAGER: 'cat',
            FORCE_COLOR: '0',
          },
        });

        session!.process = child;

        child.stdout?.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          session!.outputBuffer += text;
          finalReply += text;

          // Detecta pedidos de aprovação comuns de CLI (y/n, confirm, allow)
          const lowerText = text.toLowerCase();
          if (
            lowerText.includes('(y/n)') || 
            lowerText.includes('[y/n]') || 
            lowerText.includes('[y/n]?') || 
            lowerText.includes('deseja continuar') || 
            lowerText.includes('do you want to proceed') ||
            lowerText.includes('approve?')
          ) {
            session!.isWaitingApproval = true;
            session!.approvalPrompt = text.trim();
            onEvent({
              type: 'approval_request',
              provider: this.id,
              sessionId,
              approvalPrompt: text.trim(),
              timestamp: Date.now(),
            });
          } else {
            onEvent({
              type: 'token',
              provider: this.id,
              sessionId,
              text,
              timestamp: Date.now(),
            });
          }
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          const errText = chunk.toString('utf-8');
          onEvent({
            type: 'token',
            provider: this.id,
            sessionId,
            text: `\n[Log]: ${errText}`,
            timestamp: Date.now(),
          });
        });

        child.on('error', (err) => {
          const errMessage = `Erro ao executar o comando '${cli.command}': ${err.message}`;
          onEvent({
            type: 'error',
            provider: this.id,
            sessionId,
            data: errMessage,
            timestamp: Date.now(),
          });
          resolve({ reply: errMessage });
        });

        child.on('close', (code) => {
          session!.process = undefined;
          session!.isWaitingApproval = false;

          const cleanReply = finalReply
            .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
            .trim();

          onEvent({
            type: 'done',
            provider: this.id,
            sessionId,
            data: { exitCode: code, fullOutput: session!.outputBuffer },
            timestamp: Date.now(),
          });

          resolve({
            reply: cleanReply || (code === 0 ? 'Tarefa executada com sucesso pelo Antigravity.' : `Processo finalizado com código ${code}`),
          });
        });
      } catch (err: any) {
        const errMessage = `Falha ao iniciar processo: ${err?.message || String(err)}`;
        onEvent({
          type: 'error',
          provider: this.id,
          sessionId,
          data: errMessage,
          timestamp: Date.now(),
        });
        resolve({ reply: errMessage });
      }
    });
  }

  async sendApproval(sessionId: string, approved: boolean, customInput?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.process || !session.process.stdin) {
      throw new Error(`Nenhum processo ativo aguardando aprovação para a sessão ${sessionId}`);
    }

    const payload = customInput ? `${customInput}\n` : (approved ? 'y\n' : 'n\n');
    session.process.stdin.write(payload);
    session.isWaitingApproval = false;
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.process) {
        session.process.kill('SIGTERM');
      }
      this.activeSessions.delete(sessionId);
    }
  }
}
