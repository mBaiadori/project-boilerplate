import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Verifica se um endereço IP (v4 ou v6) pertence a faixas privadas, loopback ou reservadas.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  const cleanIP = ip.trim().toLowerCase();

  // Tratamento para IPv4-mapped IPv6 (ex: ::ffff:127.0.0.1)
  if (cleanIP.startsWith('::ffff:')) {
    const embeddedIpv4 = cleanIP.slice(7);
    if (net.isIPv4(embeddedIpv4)) {
      return isPrivateOrReservedIP(embeddedIpv4);
    }
  }

  // IPv6
  if (net.isIPv6(cleanIP)) {
    // Loopback IPv6
    if (cleanIP === '::1' || cleanIP === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (cleanIP === '::' || cleanIP === '0:0:0:0:0:0:0:0') return true;
    // Unique local (fc00::/7 -> fc.. ou fd..)
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIP)) return true;
    // Link-local (fe80::/10 -> fe8.., fe9.., fea.., feb..)
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIP)) return true;
    return false;
  }

  // IPv4
  if (net.isIPv4(cleanIP)) {
    const parts = cleanIP.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Inválido -> bloquear
    }

    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Rede atual)
    if (a === 0) return true;

    // 10.0.0.0/8 (Privado RFC1918)
    if (a === 10) return true;

    // 100.64.0.0/10 (Carrier-grade NAT RFC6598)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (Privado RFC1918: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (a === 192 && b === 88 && c === 99) return true;

    // 192.168.0.0/16 (Privado RFC1918)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 (Multicast: 224 - 239)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reservado: 240 - 255)
    if (a >= 240) return true;

    return false;
  }

  return true; // Se não for IPv4 nem IPv6 reconhecido, bloquear preventivamente
}

/**
 * Valida uma URL contra ataques SSRF:
 * 1. Verifica se o protocolo é estritamente http: ou https:
 * 2. Resolve o hostname via DNS e bloqueia se qualquer endereço resolvido for privado/loopback/reservado.
 */
export async function validateUrlForSSRF(
  urlString: string,
  options?: { allowLocalhost?: boolean }
): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error(`URL inválida ou malformada: ${urlString}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(
      `Protocolo não permitido: '${parsedUrl.protocol}'. Apenas conexões HTTP e HTTPS são suportadas.`
    );
  }

  // Rejeitar credenciais embutidas na URL (ex: http://user:pass@host)
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('Credenciais embutidas na URL não são permitidas por motivos de segurança.');
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').trim().toLowerCase();

  // Tratamento de localhost / loopback
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLoopback) {
    if (options?.allowLocalhost) {
      return parsedUrl;
    }
    throw new Error(
      `Endereço de destino restrito: 'localhost' não pode ser acessado por este serviço.`
    );
  }

  // Se já for um IP literal
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error(
        `Endereço de destino restrito: IP '${hostname}' pertence a uma faixa privada ou reservada.`
      );
    }
    return parsedUrl;
  }

  // Resolução DNS completa
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      const isRecordLoopback = record.address === '127.0.0.1' || record.address === '::1';
      if (isRecordLoopback && options?.allowLocalhost) {
        continue;
      }
      if (isPrivateOrReservedIP(record.address)) {
        throw new Error(
          `Endereço de destino restrito: o domínio '${hostname}' resolve para o IP restrito '${record.address}'.`
        );
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('Endereço de destino restrito')) {
      throw err;
    }
    throw new Error(`Falha na resolução de DNS para o domínio '${hostname}': ${errMsg}`);
  }

  return parsedUrl;
}
