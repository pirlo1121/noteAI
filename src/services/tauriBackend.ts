import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Backend, BackendEvent } from './backend';

type ChatEvent = { type: 'delta'; text: string };

export const tauriBackend: Backend = {
  getConfig: () => invoke('get_config'),
  saveConfig: (input) => invoke('save_config', { input }),
  listModels: (input) => invoke('list_models', { input }),
  sendChat: (messages, onText) => {
    const onEvent = new Channel<ChatEvent>();
    onEvent.onmessage = (e) => {
      if (e.type === 'delta') onText(e.text);
    };
    return invoke('send_chat', { messages, onEvent });
  },
  cancelChat: () => invoke('cancel_chat'),
  usageRecords: () => invoke('usage_records'),
  clearUsage: () => invoke('clear_usage'),
  dataDir: () => invoke('data_dir'),
  getAutostart: () => invoke('get_autostart'),
  setAutostart: (enabled) => invoke('set_autostart', { enabled }),
  shortcutStatus: () => invoke('shortcut_status'),
  hideWindow: () => invoke('hide_window'),
  dockWindow: () => invoke('dock_window'),
  startDragging: () => getCurrentWindow().startDragging(),
  startResize: (direction) => getCurrentWindow().startResizeDragging(direction),
  quit: () => invoke('quit_app'),
  on: (event: BackendEvent, fn) => listen(`nai://${event}`, (e) => fn(e.payload)),
};
