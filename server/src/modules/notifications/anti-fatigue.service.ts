import crypto from 'node:crypto';
import type { NotificationEvent } from './notification.types.js';

interface DispatchRecord {
  timestamp: number;
}

export class AntiFatigueService {
  private readonly history = new Map<string, DispatchRecord>();

  /**
   * Constrói a chave de deduplicação normalizada
   */
  public buildKey(repo: string, event: NotificationEvent, resourceId?: string | number, recipientEmail?: string): string {
    const raw = `${repo.toLowerCase().trim()}:${event}:${String(resourceId || '')}:${(recipientEmail || '').toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Verifica se o envio está permitido de acordo com a janela de cooldown
   * @param cooldownMinutes Minutos mínimos entre alertas idênticos (default: 15)
   */
  public isAllowed(
    repo: string,
    event: NotificationEvent,
    resourceId?: string | number,
    recipientEmail?: string,
    cooldownMinutes = 15
  ): boolean {
    const key = this.buildKey(repo, event, resourceId, recipientEmail);
    const last = this.history.get(key);
    if (!last) return true;

    const cooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;
    const elapsed = Date.now() - last.timestamp;
    return elapsed >= cooldownMs;
  }

  /**
   * Registra o disparo de uma notificação com o timestamp atual
   */
  public recordDispatch(
    repo: string,
    event: NotificationEvent,
    resourceId?: string | number,
    recipientEmail?: string
  ): void {
    const key = this.buildKey(repo, event, resourceId, recipientEmail);
    this.history.set(key, { timestamp: Date.now() });

    // Limpeza oportunista caso o mapa cresça demais (> 5000 entradas)
    if (this.history.size > 5000) {
      const now = Date.now();
      for (const [k, rec] of this.history.entries()) {
        if (now - rec.timestamp > 24 * 60 * 60 * 1000) {
          this.history.delete(k);
        }
      }
    }
  }

  /**
   * Limpa o histórico de envios (útil para testes ou reset manual do projeto)
   */
  public reset(): void {
    this.history.clear();
  }
}

export const antiFatigueService = new AntiFatigueService();
