// Proveedores predefinidos. Todos menos Anthropic hablan el protocolo de
// OpenAI (chat/completions), así que «Otro» sirve para cualquier compatible.

import type { Api } from './types';

export interface Provider {
  id: string;
  name: string;
  api: Api;
  baseUrl: string;
  /** Modelo barato y rápido sugerido; «Cargar modelos» muestra el resto. */
  model: string;
  /** Dónde conseguir la API key. */
  keyUrl: string;
  note: string;
  needsKey: boolean;
  /** US$ por millón de tokens del modelo sugerido, si se conoce con certeza. */
  price?: { input: number; output: number };
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic · Claude Haiku',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    keyUrl: 'console.anthropic.com/settings/keys',
    note: 'Claude Haiku 5.5: 0,10 $ / 0,50 $ por millón de tokens. Una pregunta típica cuesta una fracción de céntimo.',
    needsKey: true,
    price: { input: 0.1, output: 0.5 },
  },
  {
    id: 'groq',
    name: 'Groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    keyUrl: 'console.groq.com/keys',
    note: 'Respuestas casi instantáneas y plan gratuito con límites.',
    needsKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyUrl: 'platform.deepseek.com/api_keys',
    note: 'Muy económico.',
    needsKey: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    api: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash-lite',
    keyUrl: 'aistudio.google.com/apikey',
    note: 'Modelos Flash baratos y plan gratuito con límites.',
    needsKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    keyUrl: 'openrouter.ai/keys',
    note: 'Una sola clave para cientos de modelos de distintos proveedores.',
    needsKey: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'platform.openai.com/api-keys',
    note: 'Elige un modelo «mini» o «nano» para que sea barato.',
    needsKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    api: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    keyUrl: '',
    note: 'Modelos en tu propio equipo: gratis y sin conexión. No necesita clave.',
    needsKey: false,
    price: { input: 0, output: 0 },
  },
  {
    id: 'custom',
    name: 'Otro (compatible con OpenAI)',
    api: 'openai',
    baseUrl: '',
    model: '',
    keyUrl: '',
    note: 'Cualquier API compatible con /chat/completions.',
    needsKey: false,
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0];

export function providerById(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
}
