import { h, kbd } from '../utils/dom';

export type ChatStatus = 'idle' | 'thinking' | 'streaming' | 'error' | 'setup';

const LABELS: Record<ChatStatus, string> = {
  idle: 'Listo',
  thinking: 'Pensando…',
  streaming: 'Respondiendo…',
  error: 'Error',
  setup: 'Falta configurar',
};

export class StatusBar {
  readonly el: HTMLElement;
  private state = h('span', { class: 'status-state' });
  private meta = h('button', { class: 'status-meta', type: 'button', title: 'Consumo de la API (Ctrl U)' });

  constructor(onHelp: () => void, onUsage: () => void) {
    this.meta.addEventListener('click', onUsage);
    const help = h('button', { class: 'status-help', type: 'button', title: 'Atajos de teclado' }, kbd('F1'));
    help.addEventListener('click', onHelp);
    this.el = h('footer', { class: 'statusbar' }, this.state, this.meta, h('span', { class: 'spacer' }), help);
  }

  /** `isUsage`: `meta` es el consumo de la última respuesta (se resalta al pasar el ratón). */
  render(status: ChatStatus, meta: string, isUsage = false): void {
    this.state.dataset.status = status;
    this.state.textContent = LABELS[status];
    this.meta.textContent = meta;
    this.meta.classList.toggle('is-usage', isUsage);
  }
}
