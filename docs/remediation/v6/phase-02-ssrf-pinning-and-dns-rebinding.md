# Fase 02 — Eliminação de TOCTOU e DNS Rebinding no SSRF Guard via IP Pinning (A4)

**Objetivo:** Eliminar a janela de Time-of-Check to Time-of-Use (TOCTOU) e ataques de DNS Rebinding no utilitário de proteção contra SSRF, garantindo que o socket de rede conecte-se estritamente ao endereço IP previamente validado e auditado, além de normalizar variações de IPv4-mapped IPv6.  
**Resolve:** Achado **A4** (Severidade Alta).  
**Prioridade:** P0.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/utils/ssrf-guard.ts`
- `server/src/utils/ssrf-guard.test.ts`
- `server/src/modules/skills/custom-tools.service.ts`

---

## 1. Contexto e Diagnóstico da Falha

Atualmente, o fluxo de execução de requisições de ferramentas customizadas (`custom-tools.service.ts`) realiza o seguinte procedimento:

```typescript
// 1. Validação estática prévia de IP e resolução DNS:
const safeUrl = await validateUrlForSSRF(rawUrl);

// 2. Disparo da requisição HTTP real via fetch nativo:
const response = await fetch(safeUrl.toString(), fetchOptions);
```

### O que torna isso uma vulnerabilidade:
1. **Janela de TOCTOU / DNS Rebinding:** O Node.js `fetch` (baseado no `undici`) realiza uma nova resolução de DNS independente no momento em que abre o socket TCP. Se o atacante controlar o servidor DNS com TTL de 0 segundos, o domínio responde com um IP público legítimo (ex: `1.1.1.1`) na chamada de `validateUrlForSSRF`, e imediatamente responde com `127.0.0.1` ou `169.254.169.254` (metadata da AWS/GCP) quando o `fetch` tenta conectar.
2. **Bypass por Notações Mapeadas de IPv6:** Endereços no formato IPv4-mapped podem ser representados em formato hexadecimal (ex: `::ffff:7f00:0001` para `127.0.0.1`) ou com compressões de zeros alternativas (`0:0:0:0:0:ffff:...`) que podem escapar de verificações simples baseadas em `startsWith('::ffff:')`.

---

## 2. Passos de Execução

### 2.1 RED — Testes Unitários de Rebinding e IP Pinning
Adicionar à suíte `server/src/utils/ssrf-guard.test.ts`:
- **Teste 1:** Rejeição de notações IPv4-mapped em formato hexadecimal (`::ffff:7f00:1`) e variações com zeros expandidos (`0:0:0:0:0:ffff:127.0.0.1`).
- **Teste 2:** Simulação de DNS instável (onde a primeira consulta retorna IP público e a segunda retornaria loopback): a conexão deve ser direcionada ao IP original aprovado.
- **Teste 3:** Requisições através de `safeFetch` devem manter o cabeçalho `Host` original e a extensão SNI de TLS corretas, conectando-se diretamente ao IP validado.

**Comando RED:**
```bash
cd server && npx tsx --test src/utils/ssrf-guard.test.ts
```

---

### 2.2 Normalização Canônica de IPv6 em `ssrf-guard.ts`
Expandir a função `isPrivateOrReservedIP` para normalizar formalmente o endereço antes de testar prefixes:
1. Se o endereço contiver representação IPv4 mapeada (mesmo em hex ou sem pontos), converter para o formato decimal pontuado canônico antes de avaliar as faixas RFC 1918 / RFC 6598 / RFC 5737.
2. Bloquear expressamente representações de prefixo `::ffff:0:0/96` e `64:ff9b::/96` (NAT64).

---

### 2.3 Implementação de `safeFetch` com IP Pinning em `ssrf-guard.ts`
Em vez de retornar apenas uma instância de `URL` e confiar que o runtime fará a resolução correta, fornecer uma função de requisição segura que crava o IP resolvido:

```typescript
import http from 'node:http';
import https from 'node:https';

export interface SafeFetchResult {
  response: Response;
}

/**
 * Executa uma requisição HTTP/HTTPS com fixação determinística do IP aprovado (IP Pinning),
 * eliminando qualquer possibilidade de DNS Rebinding durante a conexão do socket.
 */
export async function safeFetch(
  targetUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const parsedUrl = new URL(targetUrl);
  
  // 1. Valida e obtém o IP canônico aprovado
  const validated = await validateUrlAndResolveSafeIP(targetUrl);
  
  // 2. Constrói dispatcher customizado ou lookup determinístico
  // Para fetch nativo / undici, utiliza um lookup customizado que retorna estritamente o IP validado:
  const customLookup: typeof dns.lookup = ((
    _hostname: string,
    opts: any,
    cb: (err: NodeJS.ErrnoException | null, address: any, family: number) => void
  ) => {
    cb(null, validated.safeIp, validated.ipFamily);
  }) as any;

  // Em ambientes Node.js com undici/fetch nativo, podemos injetar um agente HTTP com o lookup customizado
  // ou substituir temporariamente o host pela conexão de IP com cabeçalho Host explícito.
  // ...
}
```

---

### 2.4 Integração em `custom-tools.service.ts`
Substituir o `fetch(safeUrl.toString(), fetchOptions)` pelo utilitário `safeFetch` que garante a invariante de IP validado sem resolução de terceiros não controlada.

---

## 3. Gate de Saída

- [ ] `server/src/utils/ssrf-guard.test.ts` com todos os testes passando.
- [ ] Vetores de DNS Rebinding testados e mitigados com IP Pinning.
- [ ] Invariante de `redirect: 'error'` mantida para evitar bypass via redirecionamentos HTTP 3xx.
- [ ] `npm run verify` executando com sucesso.
