// Barra superior: nombre, modelo en uso y acceso a la configuración.
// Es zona de arrastre de la ventana (useWindowDrag).

import { h, kbd } from '../utils/dom';

const ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
const GEAR =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

const CHART =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';

export class Header {
  readonly el: HTMLElement;
  private model = h('span', { class: 'brand-model' });

  constructor(onNewChat: () => void, onSettings: () => void, onUsage: () => void) {
    const icon = h('span', { class: 'brand-icon' });
    icon.innerHTML = ICON;
    const newChat = h('button', { class: 'topbar-btn', type: 'button', title: 'Chat nuevo (Ctrl N)' }, kbd('Ctrl N'));
    newChat.addEventListener('click', onNewChat);
    const gear = h('button', { class: 'topbar-btn icon-btn', type: 'button', title: 'Configuración (Ctrl ,)' });
    gear.innerHTML = GEAR;
    gear.addEventListener('click', onSettings);
    const chart = h('button', { class: 'topbar-btn icon-btn', type: 'button', title: 'Consumo de la API (Ctrl U)' });
    chart.innerHTML = CHART;
    chart.addEventListener('click', onUsage);
    this.el = h(
      'header',
      { class: 'topbar' },
      icon,
      h('span', { class: 'brand' }, 'note', h('em', {}, 'AI')),
      this.model,
      h('span', { class: 'spacer' }),
      newChat,
      chart,
      gear,
    );
  }

  setModel(model: string): void {
    this.model.textContent = model;
    this.model.title = model;
  }
}
