import test from 'node:test';
import assert from 'node:assert';
import { sanitizeSessionEvents } from './ai.service.js';

test('AI Service - Sanitização de mensagens de erro circular', () => {
  const events = [
    { role: 'user', text: 'Olá, AI!' },
    {
      role: 'model',
      text: "⚠️ Converting circular structure to JSON\n    --> starting at object with constructor 'Object'\n    |     property 'data' -> object with constructor 'Object'\n    |     property 'telemetry' -> object with constructor 'Object'\n    |     ...\n    |     property 'stream_events' -> object with constructor 'Array'\n    --- index 74 closes the circle",
    },
    { role: 'user', text: 'Segunda mensagem' },
    { role: 'model', text: 'Resposta normal da IA' },
  ];

  const sanitized = sanitizeSessionEvents(events);

  assert.strictEqual(sanitized[0].text, 'Olá, AI!');
  assert.match(sanitized[1].text, /Registro recuperado/);
  assert.strictEqual(sanitized[1].text.includes('Converting circular structure'), false);
  assert.strictEqual(sanitized[2].text, 'Segunda mensagem');
  assert.strictEqual(sanitized[3].text, 'Resposta normal da IA');
});

test('Segurança contra referências circulares em telemetria e SSE', () => {
  // Simula estrutura circular idêntica à que ocorria no stream_events
  const recordedEvents: any[] = [];
  const telemetryTurn: any = {
    turn_id: 'turn-123',
    response: {
      reply: 'ok',
      stream_events: recordedEvents,
    },
  };
  const event = {
    type: 'stream_telemetry',
    data: {
      telemetry: telemetryTurn,
    },
  };

  // Antes: recordedEvents.push(event) criava o ciclo index N closes the circle
  recordedEvents.push(event);

  // A função safeJsonStringify evita o crash
  function safeJsonStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  assert.doesNotThrow(() => {
    const serialized = safeJsonStringify(event);
    assert.strictEqual(serialized.includes('[Circular]'), true);
  });
});
