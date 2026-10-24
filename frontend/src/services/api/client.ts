export interface ApiResponse<T = any> {
  ok: boolean;
  data: T;
}

export async function safeParseJson<T = any>(res: Response, fallback: T = {} as T): Promise<T> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      if (!res.ok) {
        return { error: `Servidor indisponível (${res.status} ${res.statusText || 'Sem resposta'})` } as any;
      }
      return fallback;
    }
    return JSON.parse(text);
  } catch {
    return { error: `Resposta inválida do servidor (${res.status})` } as any;
  }
}
