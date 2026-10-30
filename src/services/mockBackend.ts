// Backend simulado para `npm run dev` en el navegador: responde con texto de
// ejemplo, a trozos, como lo haría un modelo real.

import type { PublicConfig, UsageRecord } from '../types';
import type { Backend } from './backend';

const DEFAULT_PROMPT = 'Eres un asistente de consulta rápida.';

export function createMockBackend(): Backend {
  let config: PublicConfig | null = null;
  let generation = 0;
  let usage: UsageRecord[] = [];

  return {
    async getConfig() {
      return config;
    },
    async saveConfig(input) {
      config = {
        provider: input.provider,
        api: input.api,
        baseUrl: input.baseUrl,
        model: input.model,
        systemPrompt: input.systemPrompt,
        defaultSystemPrompt: DEFAULT_PROMPT,
        priceInput: input.priceInput,
        priceOutput: input.priceOutput,
        keyHint: input.apiKey ? `…${input.apiKey.slice(-4)}` : config?.keyHint ?? null,
      };
      return config;
    },
    async listModels(input) {
      return [input.model, 'modelo-rapido', 'modelo-grande'].filter(Boolean);
    },
    async sendChat(messages, onText) {
      const mine = ++generation;
      const question = messages[messages.length - 1]?.content ?? '';
      const answer =
        `**${question.slice(0, 40)}** es una respuesta simulada (modo navegador).\n\n` +
        '- Ejecuta `npm run tauri dev` para hablar con un modelo real.\n- Aquí solo se prueba la interfaz.\n\n' +
        '```sh\nmake dev\n```';
      for (const word of answer.split(/(?<=\s)/)) {
        await new Promise((r) => setTimeout(r, 25));
        if (mine !== generation) return { finished: false, usage: null };
        onText(word);
      }
      const inputTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + 60;
      const outputTokens = Math.ceil(answer.length / 4);
      const record: UsageRecord = {
        at: Date.now(),
        provider: config?.provider ?? 'mock',
        model: config?.model ?? 'mock',
        inputTokens,
        outputTokens,
        estimated: false,
        cost:
          config?.priceInput != null && config.priceOutput != null
            ? (inputTokens * config.priceInput + outputTokens * config.priceOutput) / 1e6
            : null,
      };
      usage.push(record);
      return { finished: true, usage: record };
    },
    async cancelChat() {
      generation++;
    },
    async usageRecords() {
      return usage;
    },
    async clearUsage() {
      usage = [];
    },
    async dataDir() {
      return '~/.noteai';
    },
    async getAutostart() {
      return false;
    },
    async setAutostart(enabled) {
      return enabled;
    },
    async shortcutStatus() {
      return null;
    },
    async hideWindow() {},
    async dockWindow() {},
    async startDragging() {},
    async startResize() {},
    async quit() {},
    async on() {
      return () => {};
    },
  };
}
