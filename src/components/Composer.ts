// Caja de la pregunta: crece con el texto, ↵ envía y ⇧↵ hace salto de línea.

import { h, kbd } from '../utils/dom';

const MAX_HEIGHT = 180;

export interface ComposerOptions {
  onSubmit(text: string): void;
  /** ↑ con la caja vacía: devuelve la última pregunta para editarla. */
  onRecall(): string | null;
}

export class Composer {
  readonly el: HTMLElement;
  readonly input: HTMLTextAreaElement;

  constructor(opts: ComposerOptions) {
    this.input = h('textarea', {
      class: 'composer-input',
      rows: 1,
      placeholder: 'Pregunta algo…',
      spellcheck: 'true',
      'aria-label': 'Pregunta',
    });
    this.el = h('div', { class: 'composer' }, this.input, h('span', { class: 'composer-hint' }, kbd('↵')));

    this.input.addEventListener('input', () => this.autosize());
    this.input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const text = this.input.value.trim();
        if (text) opts.onSubmit(text);
      } else if (e.key === 'ArrowUp' && !this.input.value) {
        const last = opts.onRecall();
        if (last) {
          e.preventDefault();
          this.value = last;
        }
      }
    });
  }

  get value(): string {
    return this.input.value;
  }

  set value(v: string) {
    this.input.value = v;
    this.autosize();
    this.input.setSelectionRange(v.length, v.length);
  }

  focus(selectAll = false): void {
    this.input.focus();
    if (selectAll) this.input.select();
  }

  private autosize(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, MAX_HEIGHT)}px`;
  }
}
