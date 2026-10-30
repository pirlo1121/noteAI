// Tipos compartidos con Rust (config.rs, llm.rs, window.rs).

export type Api = 'anthropic' | 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  /** Lo que recibe el modelo. */
  content: string;
  /** Lo que escribió el usuario, si un comando lo transformó (p. ej. «/def inefable»). Rust lo ignora. */
  display?: string;
}

/** Configuración tal como la ve el frontend: sin la API key. */
export interface PublicConfig {
  provider: string;
  api: Api;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  defaultSystemPrompt: string;
  /** US$ por millón de tokens; null si no se ha indicado. */
  priceInput: number | null;
  priceOutput: number | null;
  /** Últimos caracteres de la clave guardada, o null si no hay. */
  keyHint: string | null;
}

export interface ConfigInput {
  provider: string;
  api: Api;
  baseUrl: string;
  model: string;
  /** null = conservar la clave guardada. */
  apiKey: string | null;
  systemPrompt: string;
  priceInput: number | null;
  priceOutput: number | null;
}

/** Una respuesta en ~/.noteai/usage.jsonl (usage.rs). */
export interface UsageRecord {
  /** Milisegundos desde 1970. */
  at: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens estimados por caracteres: el proveedor no los informó. */
  estimated: boolean;
  /** US$; null si no hay precios configurados. */
  cost: number | null;
}

export interface ChatResult {
  /** false si se canceló. */
  finished: boolean;
  usage: UsageRecord | null;
}

export interface ShortcutStatus {
  accelerator: string;
  registered: boolean;
  wayland: boolean;
  error: string | null;
}
