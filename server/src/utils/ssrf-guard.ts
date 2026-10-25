import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

/**
 * Normaliza e extrai IPv4 de representações IPv4-mapped IPv6 em formato decimal ou hexadecimal.
 */
function extractIPv4FromMappedIPv6(cleanIP: string): string | null {
  // Trata prefixos como ::ffff: ou 0:0:0:0:0:ffff: ou variações com zeros à esquerda
  const match = cleanIP.match(/^(?:(?:::)|(?:0+:){1,5}:?|:(?:0+:){1,4})ffff:([0-9a-f:.]+)$/i);
  if (!match) return null;
  const tail = match[1];

  // Caso 1: dotted decimal (ex: 127.0.0.1)
  if (net.isIPv4(tail)) {
    return tail;
  }

  // Caso 2: hexadecimais (ex: 7f00:1 ou 7f00:0001)
  const hexParts = tail.split(':');
  if (hexParts.length === 2) {
    const p1 = parseInt(hexParts[0], 16);
    const p2 = parseInt(hexParts[1], 16);
    if (!isNaN(p1) && !isNaN(p2) && p1 >= 0 && p1 <= 0xffff && p2 >= 0 && p2 <= 0xffff) {
      const b1 = (p1 >> 8) & 0xff;
      const b2 = p1 & 0xff;
      const b3 = (p2 >> 8) & 0xff;
      const b4 = p2 & 0xff;
      return `${b1}.${b2}.${b3}.${b4}`;
    }
  }

  return null;
}

/**
 * Verifica se um endereço IP (v4 ou v6) pertence a faixas privadas, loopback ou reservadas.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  const cleanIP = ip.trim().toLowerCase();

  // Tratamento completo para IPv4-mapped IPv6 (decimal e hexadecimal)
  const mappedIpv4 = extractIPv4FromMappedIPv6(cleanIP);
  if (mappedIpv4 && net.isIPv4(mappedIpv4)) {
    return isPrivateOrReservedIP(mappedIpv4);
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

export interface ValidatedSafeEndpoint {
  url: URL;
  safeIp: string;
  ipFamily: number;
}

/**
 * Valida a URL e resolve o IP seguro correspondente com proteção anti-rebinding.
 */
export async function validateUrlAndResolveSafeIP(
  urlString: string,
  options?: { allowLocalhost?: boolean }
): Promise<ValidatedSafeEndpoint> {
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

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('Credenciais embutidas na URL não são permitidas por motivos de segurança.');
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').trim().toLowerCase();

  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLoopback) {
    if (options?.allowLocalhost) {
      return {
        url: parsedUrl,
        safeIp: hostname === 'localhost' ? '127.0.0.1' : hostname,
        ipFamily: hostname === '::1' ? 6 : 4,
      };
    }
    throw new Error(
      `Endereço de destino restrito: 'localhost' não pode ser acessado por este serviço.`
    );
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error(
        `Endereço de destino restrito: IP '${hostname}' pertence a uma faixa privada ou reservada.`
      );
    }
    return { url: parsedUrl, safeIp: hostname, ipFamily: net.isIP(hostname) };
  }

  // Resolução DNS completa
  let safeIp: string | null = null;
  let ipFamily: number = 4;
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      const isRecordLoopback = record.address === '127.0.0.1' || record.address === '::1';
      if (isRecordLoopback && options?.allowLocalhost) {
        if (!safeIp) {
          safeIp = record.address;
          ipFamily = record.family;
        }
        continue;
      }
      if (isPrivateOrReservedIP(record.address)) {
        throw new Error(
          `Endereço de destino restrito: o domínio '${hostname}' resolve para o IP restrito '${record.address}'.`
        );
      }
      if (!safeIp) {
        safeIp = record.address;
        ipFamily = record.family;
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('Endereço de destino restrito')) {
      throw err;
    }
    throw new Error(`Falha na resolução de DNS para o domínio '${hostname}': ${errMsg}`);
  }

  if (!safeIp) {
    throw new Error(`Nenhum endereço IP resolvido para o domínio '${hostname}'.`);
  }

  return { url: parsedUrl, safeIp, ipFamily };
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
  const result = await validateUrlAndResolveSafeIP(urlString, options);
  return result.url;
}

/**
 * Executa uma requisição HTTP/HTTPS com fixação determinística do IP aprovado (IP Pinning),
 * eliminando a janela de Time-of-Check to Time-of-Use (TOCTOU) e ataques de DNS Rebinding.
 */
export async function safeFetch(
  targetUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const { url, safeIp, ipFamily } = await validateUrlAndResolveSafeIP(targetUrl);

  return new Promise<Response>((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const customLookup = (
      _hostname: string,
      opts: unknown,
      cb: unknown
    ): void => {
    interface LookupAddressRecord {
      address: string;
      family: number;
    }
    type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddressRecord[], family?: number) => void;
    let callback = cb as LookupCb;
    let isAll = false;

    if (typeof opts === 'function') {
      callback = opts as LookupCb;
    } else if (opts && typeof opts === 'object' && 'all' in opts) {
      isAll = Boolean((opts as { all?: boolean }).all);
    }

    if (isAll) {
      callback(null, [{ address: safeIp, family: ipFamily }]);
    } else {
      callback(null, safeIp, ipFamily);
    }
    };

    const headers: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }
    if (!headers['host'] && !headers['Host']) {
      headers['Host'] = url.host;
    }

    const port = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);

    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search}`,
        method: options.method || 'GET',
        headers,
        lookup: customLookup,
        servername: isHttps ? url.hostname : undefined, // Preserva SNI TLS
      },
      (res) => {
        const statusCode = res.statusCode || 200;

        // Bloqueio de redirecionamentos (mitigação contra SSRF bypass)
        if (statusCode >= 300 && statusCode < 400) {
          res.resume();
          return reject(
            new Error(
              `Redirecionamentos HTTP são bloqueados por segurança contra SSRF (status: ${statusCode}).`
            )
          );
        }

        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value) {
            if (Array.isArray(value)) {
              value.forEach((v) => responseHeaders.append(key, v));
            } else {
              responseHeaders.set(key, value);
            }
          }
        }

        const webStream = Readable.toWeb(res) as ReadableStream<Uint8Array>;
        const response = new Response(webStream, {
          status: statusCode,
          statusText: res.statusMessage || '',
          headers: responseHeaders,
        });

        resolve(response);
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      if (typeof options.body === 'string') {
        req.write(options.body);
      } else if (Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else {
        req.write(String(options.body));
      }
    }

    req.end();
  });
}
