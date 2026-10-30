// Proveedor, API key y modelo. Ocupa el panel entero: es lo primero que se
// ve si aún no hay configuración, y se abre luego con Ctrl+, o el engranaje.

import { DEFAULT_PROVIDER, PROVIDERS, providerById, type Provider } from '../providers';
import type { ConfigInput, PublicConfig } from '../types';
import { h } from '../utils/dom';

export interface SettingsOptions {
  save(input: ConfigInput): Promise<void>;
  listModels(input: ConfigInput): Promise<string[]>;
  close(): void;
}

export class SettingsView {
  readonly el: HTMLElement;
  private provider = h('select', { class: 'field-input', id: 'cfg-provider' });
  private key = h('input', { class: 'field-input', id: 'cfg-key', type: 'password', autocomplete: 'off', spellcheck: 'false' });
  private model = h('input', { class: 'field-input', id: 'cfg-model', list: 'cfg-models', spellcheck: 'false', autocomplete: 'off' });
  private models = h('datalist', { id: 'cfg-models' });
  private priceIn = h('input', { class: 'field-input', id: 'cfg-price-in', inputmode: 'decimal', autocomplete: 'off', placeholder: 'entrada' });
  private priceOut = h('input', { class: 'field-input', id: 'cfg-price-out', inputmode: 'decimal', autocomplete: 'off', placeholder: 'salida' });
  private baseUrl = h('input', { class: 'field-input', id: 'cfg-url', spellcheck: 'false', autocomplete: 'off' });
  private prompt = h('textarea', { class: 'field-input field-prompt', id: 'cfg-prompt', rows: 4, spellcheck: 'false' });
  private note = h('p', { class: 'settings-note' });
  private keyHelp = h('p', { class: 'field-help' });
  private message = h('p', { class: 'settings-message', role: 'status' });
  private loadBtn = h('button', { class: 'btn', type: 'button' }, 'Cargar modelos');
  private saveBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar');
  private closeBtn = h('button', { class: 'btn', type: 'button' }, 'Volver al chat');
  private advanced = h('details', { class: 'settings-advanced' });
  private current: PublicConfig | null = null;

  constructor(private opts: SettingsOptions) {
    for (const p of PROVIDERS) this.provider.append(h('option', { value: p.id }, p.name));

    const field = (label: string, input: HTMLElement, ...extra: Node[]) =>
      h('label', { class: 'field', for: input.id }, h('span', { class: 'field-label' }, label), input, ...extra);

    this.advanced.append(
      h('summary', {}, 'Avanzado'),
      field('URL de la API', this.baseUrl),
      field('Instrucciones para el modelo', this.prompt),
    );

    const form = h(
      'form',
      { class: 'settings-form' },
      h('h1', { class: 'settings-title' }, 'Conecta un modelo'),
      h('p', { class: 'settings-lead' }, 'Usa tu propia API key. Se guarda solo en este equipo, en ', h('code', {}, '~/.noteai/config.json'), ' (permisos 600).'),
      field('Proveedor', this.provider, this.note),
      field('API key', this.key, this.keyHelp),
      field('Modelo', h('div', { class: 'field-row' }, this.model, this.loadBtn), this.models),
      field(
        'Precio · US$ por millón de tokens',
        h('div', { class: 'field-row' }, this.priceIn, this.priceOut),
        h('p', { class: 'field-help' }, 'Opcional: solo sirve para estimar el coste en «Consumo» (Ctrl U). Ajústalo si cambias de modelo; los precios están en la web del proveedor.'),
      ),
      this.advanced,
      this.message,
      h('div', { class: 'settings-actions' }, this.closeBtn, this.saveBtn),
    );
    this.el = h('section', { class: 'settings', hidden: true }, form);

    this.provider.addEventListener('change', () => this.applyPreset(providerById(this.provider.value)));
    this.loadBtn.addEventListener('click', () => void this.loadModels());
    this.closeBtn.addEventListener('click', () => opts.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(config: PublicConfig | null): void {
    this.current = config;
    const preset = providerById(config?.provider ?? DEFAULT_PROVIDER.id);
    this.provider.value = preset.id;
    this.applyPreset(preset, config);
    this.closeBtn.hidden = !config;
    this.setMessage('');
    this.el.hidden = false;
    (config?.keyHint || !preset.needsKey ? this.model : this.key).focus();
  }

  close(): void {
    this.el.hidden = true;
  }

  private applyPreset(p: Provider, saved: PublicConfig | null = null): void {
    const same = saved ?? (this.current?.provider === p.id ? this.current : null);
    this.model.value = same?.model ?? p.model;
    this.baseUrl.value = same?.baseUrl ?? p.baseUrl;
    this.priceIn.value = formatPrice(same ? same.priceInput : p.price?.input);
    this.priceOut.value = formatPrice(same ? same.priceOutput : p.price?.output);
    this.prompt.value = this.current?.systemPrompt ?? '';
    this.prompt.placeholder = this.current?.defaultSystemPrompt ?? 'Instrucciones por defecto: respuestas breves y directas.';
    this.models.replaceChildren();
    this.key.value = '';
    this.key.placeholder = same?.keyHint ? `Guardada (${same.keyHint}) · escribe otra para cambiarla` : p.needsKey ? 'Pega aquí tu API key' : 'Opcional';
    this.note.textContent = p.note;
    this.keyHelp.textContent = p.keyUrl ? `Consíguela en ${p.keyUrl}` : '';
    this.advanced.open = p.id === 'custom';
  }

  private input(): ConfigInput {
    const p = providerById(this.provider.value);
    const key = this.key.value.trim();
    return {
      provider: p.id,
      api: p.api,
      baseUrl: this.baseUrl.value.trim() || p.baseUrl,
      model: this.model.value.trim(),
      // Al cambiar de proveedor no se reutiliza la clave del anterior.
      apiKey: key || (this.current?.provider === p.id ? null : ''),
      systemPrompt: this.prompt.value.trim(),
      priceInput: parsePrice(this.priceIn.value),
      priceOutput: parsePrice(this.priceOut.value),
    };
  }

  private async loadModels(): Promise<void> {
    this.setMessage('Consultando modelos…');
    this.loadBtn.disabled = true;
    try {
      const ids = await this.opts.listModels(this.input());
      this.models.replaceChildren(...ids.map((id) => h('option', { value: id })));
      this.setMessage(ids.length ? `${ids.length} modelos disponibles: escribe en «Modelo» para filtrarlos.` : 'El proveedor no devolvió modelos.');
      this.model.focus();
    } catch (e) {
      this.setMessage(String(e), true);
    } finally {
      this.loadBtn.disabled = false;
    }
  }

  private async submit(): Promise<void> {
    const input = this.input();
    const p = providerById(input.provider);
    if (!input.baseUrl) return this.setMessage('Falta la URL de la API (en «Avanzado»).', true);
    if (!input.model) return this.setMessage('Falta el modelo.', true);
    if ((this.priceIn.value.trim() && input.priceInput === null) || (this.priceOut.value.trim() && input.priceOutput === null)) {
      return this.setMessage('El precio debe ser un número, p. ej. 0,10.', true);
    }
    if (p.needsKey && !input.apiKey && !(this.current?.provider === p.id && this.current.keyHint)) {
      this.key.focus();
      return this.setMessage('Falta la API key.', true);
    }
    this.saveBtn.disabled = true;
    try {
      await this.opts.save(input);
    } catch (e) {
      this.setMessage(String(e), true);
    } finally {
      this.saveBtn.disabled = false;
    }
  }

  private setMessage(text: string, error = false): void {
    this.message.textContent = text;
    this.message.classList.toggle('error', error);
  }

  /** Esc dentro del formulario: volver al chat si ya hay configuración. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.current) {
      this.opts.close();
      return true;
    }
    return false;
  }
}

function formatPrice(n: number | null | undefined): string {
  return n == null ? '' : String(n).replace('.', ',');
}

/** Acepta coma o punto decimal. null si está vacío o no es un número válido. */
function parsePrice(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
