// Conversación: preguntas en serif (como los títulos de QuickNotes) y
// respuestas en Markdown. La respuesta en curso se repinta a cada fotograma.

import type { ChatMessage } from '../types';
import { h, kbd } from '../utils/dom';
import { renderMarkdown } from '../utils/markdown';

const COPY =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

export interface ChatViewOptions {
  onCopy(text: string): void;
  onRetry(): void;
}

export class ChatView {
  readonly el: HTMLElement;
  private live: { body: HTMLElement; text: string; frame: number } | null = null;

  constructor(private opts: ChatViewOptions) {
    this.el = h('main', { class: 'chat', 'aria-live': 'polite' });
  }

  render(messages: ChatMessage[]): void {
    this.live = null;
    if (!messages.length) {
      this.el.replaceChildren(this.empty());
      return;
    }
    this.el.replaceChildren(...messages.map((m) => (m.role === 'user' ? this.question(m.display ?? m.content) : this.answer(m.content))));
    this.scrollToEnd(true);
  }

  /** Añade una pregunta y una respuesta vacía que se irá llenando. */
  beginAnswer(question: string): void {
    this.el.querySelector('.chat-empty')?.remove();
    const msg = this.answer('');
    msg.classList.add('pending');
    this.el.append(this.question(question), msg);
    this.live = { body: msg.querySelector('.msg-body')!, text: '', frame: 0 };
    this.scrollToEnd(true);
  }

  append(text: string): void {
    const live = this.live;
    if (!live) return;
    live.text += text;
    live.body.parentElement!.classList.remove('pending');
    if (live.frame) return;
    live.frame = requestAnimationFrame(() => {
      live.frame = 0;
      const stick = this.nearBottom();
      live.body.innerHTML = renderMarkdown(live.text);
      if (stick) this.scrollToEnd();
    });
  }

  /** Cierra la respuesta en curso. Con `error`, la muestra con opción de reintentar. */
  endAnswer(error?: string): void {
    const live = this.live;
    if (!live) return;
    cancelAnimationFrame(live.frame);
    const msg = live.body.parentElement!;
    msg.classList.remove('pending', 'streaming');
    live.body.innerHTML = renderMarkdown(live.text);
    if (error) {
      msg.classList.add('error');
      const retry = h('button', { class: 'msg-retry', type: 'button' }, 'Reintentar');
      retry.addEventListener('click', () => this.opts.onRetry());
      msg.append(h('div', { class: 'msg-error' }, h('span', {}, error), retry));
    } else if (!live.text) {
      msg.remove();
    }
    this.live = null;
    if (this.nearBottom(120)) this.scrollToEnd();
  }

  private question(text: string): HTMLElement {
    return h('div', { class: 'msg msg-user' }, h('div', { class: 'msg-body' }, text));
  }

  private answer(text: string): HTMLElement {
    const body = h('div', { class: 'msg-body md' });
    body.innerHTML = renderMarkdown(text);
    const copy = h('button', { class: 'msg-copy', type: 'button', title: 'Copiar respuesta' });
    copy.innerHTML = COPY;
    copy.addEventListener('click', () => this.opts.onCopy(this.live?.body === body ? this.live.text : text));
    return h('div', { class: 'msg msg-ai streaming' }, body, copy);
  }

  private empty(): HTMLElement {
    return h(
      'div',
      { class: 'chat-empty' },
      h('div', { class: 'chat-empty-title' }, '¿Qué quieres saber?'),
      h('div', { class: 'chat-empty-hint' }, 'Una palabra rara, una fecha, un concepto… Pregunta y vuelve a lo tuyo con ', kbd('Ctrl O'), '.'),
    );
  }

  private nearBottom(margin = 48): boolean {
    return this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < margin;
  }

  private scrollToEnd(force = false): void {
    if (force || this.nearBottom(400)) this.el.scrollTop = this.el.scrollHeight;
  }
}
