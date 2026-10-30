// Contrato con el proceso Rust. En el navegador (npm run dev sin Tauri)
// se usa una implementación simulada para poder iterar sobre la interfaz.

import type { ChatMessage, ChatResult, ConfigInput, PublicConfig, ShortcutStatus, UsageRecord } from '../types';

export type ResizeDirection =
  | 'North' | 'South' | 'East' | 'West'
  | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';

export type BackendEvent = 'summoned' | 'hiding' | 'quit' | 'placement';

export interface Backend {
  getConfig(): Promise<PublicConfig | null>;
  saveConfig(input: ConfigInput): Promise<PublicConfig>;
  /** Modelos disponibles con los datos del formulario (aún sin guardar). */
  listModels(input: ConfigInput): Promise<string[]>;
  /** Envía la conversación; `onText` recibe la respuesta a trozos. */
  sendChat(messages: ChatMessage[], onText: (text: string) => void): Promise<ChatResult>;
  cancelChat(): Promise<void>;
  /** Registro de consumo completo (una entrada por respuesta). */
  usageRecords(): Promise<UsageRecord[]>;
  clearUsage(): Promise<void>;
  dataDir(): Promise<string>;
  getAutostart(): Promise<boolean>;
  setAutostart(enabled: boolean): Promise<boolean>;
  shortcutStatus(): Promise<ShortcutStatus | null>;
  hideWindow(): Promise<void>;
  /** Vuelve a acoplar la ventana al borde derecho. */
  dockWindow(): Promise<void>;
  startDragging(): Promise<void>;
  startResize(direction: ResizeDirection): Promise<void>;
  quit(): Promise<void>;
  /** `placement` lleva `true` si la ventana está acoplada, `false` si flota. */
  on(event: BackendEvent, fn: (payload: unknown) => void): Promise<() => void>;
}

export const isTauri = '__TAURI_INTERNALS__' in window;

export async function createBackend(): Promise<Backend> {
  if (isTauri) return (await import('./tauriBackend')).tauriBackend;
  return (await import('./mockBackend')).createMockBackend();
}
