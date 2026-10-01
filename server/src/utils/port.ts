import net from 'node:net';

/**
 * Encontra uma porta TCP livre a partir de startPort com tentativas incrementais.
 */
export async function findAvailablePort(startPort: number = 4100, maxAttempts: number = 50): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen({ port, host: '0.0.0.0' }, () => {
        server.close(() => resolve(true));
      });
    });
    if (isFree) return port;
  }
  return startPort;
}
