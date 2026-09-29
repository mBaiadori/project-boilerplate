import { FastifyReply } from 'fastify';
import { watch, type FSWatcher } from 'chokidar';
import { UI_DIR, UI_DIST_DIR, PROJECTS_DIR } from '../../config/constants.js';

type Client = {
  reply: FastifyReply;
};

class EventsService {
  private clients: Set<Client> = new Set();
  private watcher: FSWatcher | null = null;

  constructor() {
    this.initWatcher();
  }

  public addClient(reply: FastifyReply): Client {
    const client: Client = { reply };
    this.clients.add(client);
    return client;
  }

  public removeClient(client: Client): void {
    this.clients.delete(client);
  }

  public broadcast(eventType: string, data: any = {}): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const msg = `event: ${eventType}\ndata: ${payload}\n\n`;

    for (const client of this.clients) {
      try {
        client.reply.raw.write(msg);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  private initWatcher(): void {
    const watchPaths = [UI_DIR, UI_DIST_DIR, PROJECTS_DIR];
    try {
      this.watcher = watch(watchPaths, {
        ignoreInitial: true,
        ignored: [
          /(^|[\/\\])\.git/,
          /node_modules/,
        ],
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50,
        },
      });

      this.watcher.on('all', (event: string, filePath: string) => {
        if (filePath.startsWith(PROJECTS_DIR)) {
          const relativePath = filePath.replace(PROJECTS_DIR, '').replace(/^[/\\]/, '');
          this.broadcast('refresh', {
            timestamp: Date.now(),
            file: relativePath,
            action: event,
          });
          this.broadcast('file_changed', {
            timestamp: Date.now(),
            file: relativePath,
            action: event,
          });
        } else if (filePath.match(/\.(html|css|js|svg|png)$/)) {
          this.broadcast('reload', { timestamp: Date.now(), file: filePath });
        }
      });
    } catch (err) {
      console.error('Erro ao inicializar file watcher:', err);
    }
  }
}

export const eventsService = new EventsService();
