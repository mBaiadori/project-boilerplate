export interface ModelPricing {
  promptPerMillion: number;
  completionPerMillion: number;
  isLocal?: boolean;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // Google Gemini
  'gemini-2.5-flash': { promptPerMillion: 0.075, completionPerMillion: 0.30 },
  'gemini-2.0-flash': { promptPerMillion: 0.075, completionPerMillion: 0.30 },
  'gemini-1.5-flash': { promptPerMillion: 0.075, completionPerMillion: 0.30 },
  'gemini-2.5-pro': { promptPerMillion: 1.25, completionPerMillion: 5.00 },
  'gemini-1.5-pro': { promptPerMillion: 1.25, completionPerMillion: 5.00 },
  'gemini-pro': { promptPerMillion: 1.25, completionPerMillion: 5.00 },
  
  // OpenAI
  'gpt-4o': { promptPerMillion: 2.50, completionPerMillion: 10.00 },
  'gpt-4o-mini': { promptPerMillion: 0.15, completionPerMillion: 0.60 },
  'gpt-4-turbo': { promptPerMillion: 10.00, completionPerMillion: 30.00 },
  'gpt-3.5-turbo': { promptPerMillion: 0.50, completionPerMillion: 1.50 },

  // Anthropic Claude
  'claude-3-5-sonnet-20241022': { promptPerMillion: 3.00, completionPerMillion: 15.00 },
  'claude-3-5-sonnet': { promptPerMillion: 3.00, completionPerMillion: 15.00 },
  'claude-3-7-sonnet': { promptPerMillion: 3.00, completionPerMillion: 15.00 },
  'claude-3-5-haiku': { promptPerMillion: 0.80, completionPerMillion: 4.00 },
  'claude-3-opus': { promptPerMillion: 15.00, completionPerMillion: 75.00 },

  // Connected Agents & Local Models
  'antigravity': { promptPerMillion: 0.00, completionPerMillion: 0.00, isLocal: true },
  'claude-code': { promptPerMillion: 3.00, completionPerMillion: 15.00 },
  'ollama': { promptPerMillion: 0.00, completionPerMillion: 0.00, isLocal: true },
  'local': { promptPerMillion: 0.00, completionPerMillion: 0.00, isLocal: true },
};

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

export function getPricingForModel(modelName: string): ModelPricing {
  const normalized = (modelName || '').toLowerCase().trim();
  
  if (normalized.includes('ollama') || normalized.includes('local') || normalized.includes('llama')) {
    return { promptPerMillion: 0.00, completionPerMillion: 0.00, isLocal: true };
  }
  if (normalized.includes('antigravity') || normalized.includes('agy')) {
    return { promptPerMillion: 0.00, completionPerMillion: 0.00, isLocal: true };
  }
  if (normalized.includes('claude-3-5-haiku') || normalized.includes('claude-haiku')) {
    return MODEL_PRICING_TABLE['claude-3-5-haiku'];
  }
  if (normalized.includes('claude-3-5-sonnet') || normalized.includes('claude-3-7-sonnet') || normalized.includes('claude-code') || normalized.includes('sonnet')) {
    return MODEL_PRICING_TABLE['claude-3-5-sonnet'];
  }
  if (normalized.includes('gpt-4o-mini')) {
    return MODEL_PRICING_TABLE['gpt-4o-mini'];
  }
  if (normalized.includes('gpt-4o') || normalized.includes('gpt-4')) {
    return MODEL_PRICING_TABLE['gpt-4o'];
  }
  if (normalized.includes('gemini-2.5-pro') || normalized.includes('gemini-1.5-pro') || normalized.includes('gemini-pro')) {
    return MODEL_PRICING_TABLE['gemini-2.5-pro'];
  }
  if (normalized.includes('gemini')) {
    return MODEL_PRICING_TABLE['gemini-2.5-flash'];
  }

  return MODEL_PRICING_TABLE['gemini-2.5-flash'];
}

export interface TokenCostResult {
  costUsd: number;
  formula: string;
  isLocal: boolean;
  promptRate: number;
  completionRate: number;
}

export function calculateTokenCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number
): TokenCostResult {
  const pricing = getPricingForModel(modelName);

  if (pricing.isLocal) {
    return {
      costUsd: 0,
      formula: 'Execução Local / CLI Harness (Custo: $0.00)',
      isLocal: true,
      promptRate: 0,
      completionRate: 0,
    };
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.promptPerMillion;
  const completionCost = (completionTokens / 1_000_000) * pricing.completionPerMillion;
  const totalCost = promptCost + completionCost;

  const formula = `(${promptTokens.toLocaleString()} in × $${pricing.promptPerMillion}/1M) + (${completionTokens.toLocaleString()} out × $${pricing.completionPerMillion}/1M) = $${totalCost.toFixed(6)}`;

  return {
    costUsd: totalCost,
    formula,
    isLocal: false,
    promptRate: pricing.promptPerMillion,
    completionRate: pricing.completionPerMillion,
  };
}

export function formatCostUsd(cost: number | undefined | null, isLocal?: boolean): string {
  if (isLocal || cost === 0) return '$0.00 (Local)';
  if (typeof cost !== 'number' || isNaN(cost)) return '$0.00';
  if (cost < 0.0001) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(3)}`;
}

export function formatTokenCount(tokens: number | undefined | null): string {
  if (typeof tokens !== 'number' || isNaN(tokens)) return '0 tok';
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M tok`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k tok`;
  }
  return `${tokens.toLocaleString()} tok`;
}
