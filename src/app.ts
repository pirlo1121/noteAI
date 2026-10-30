// Orquestador: conecta componentes, backend y teclado.
//
//   ┌ Header ────────────────┐
//   │ ChatView (preguntas y  │
//   │ respuestas)            │
//   │ Composer               │
//   └ StatusBar ─────────────┘
//
// Sin configuración, SettingsView ocupa el panel en lugar del chat.

import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';
import { Header } from './components/Header';
import { HelpPanel } from './components/HelpPanel';
import { ResizeHandles } from './components/ResizeHandles';
import { SettingsView } from './components/SettingsView';
import { StatusBar, type ChatStatus } from './components/StatusBar';
import { Toast } from './components/Toast';
import { UsagePanel } from './components/UsagePanel';
import { useHotkeys } from './hooks/useHotkeys';
import { useWindowDrag } from './hooks/useWindowDrag';
import { providerById } from './providers';
import type { Backend } from './services/backend';
import type { ChatMessage, ConfigInput, PublicConfig, UsageRecord } from './types';
import { h } from './utils/dom';
import { formatCost, formatTokens } from './utils/format';

const FONT = { default: 14, min: 11, max: 26, step: 1 };
/** Tras este tiempo sin usarla, al abrir se empieza un chat nuevo. */
const IDLE_NEW_CHAT_MS = 15 * 60 * 1000;
const CHAT_KEY = 'noteai.chat';
const FONT_KEY = 'noteai.fontSize';

interface SavedChat {
  messages: ChatMessage[];
  at: number;
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: el chat vive solo en memoria.
  }
}

export class App {
  private config: PublicConfig | null = null;
  private messages: ChatMessage[] = [];
  private lastActivity = Date.now();
  private busy = false;
  private status: ChatStatus = 'idle';
  private error = '';
  /** Consumo de la última respuesta, para la barra de estado. */
  private lastUsage: UsageRecord | null = null;
  private dataDir = '~/.noteai';

  private root!: HTMLElement;
  private header!: Header;
  private chat!: ChatView;
  private composer!: Composer;
  private statusBar!: StatusBar;
  private settings!: SettingsView;
  private toast = new Toast();
  private help = new HelpPanel(() => this.dataDir);
  private usage = new UsagePanel({
    load: () => this.backend.usageRecords(),
    clear: () => this.backend.clearUsage(),
    provider: () => this.config?.provider ?? null,
  });

  constructor(private backend: Backend) {}

  // ── Arranque ────────────────────────────────────────────────────────────

  mount(host: HTMLElement): void {
    this.header = new Header(
      () => this.newChat(),
      () => this.openSettings(),
      () => this.openUsage(),
    );
    this.chat = new ChatView({
      onCopy: (text) => void this.copy(text),
      onRetry: () => this.retry(),
    });
    this.composer = new Composer({
      onSubmit: (text) => void this.ask(text),
      onRecall: () => [...this.messages].reverse().find((m) => m.role === 'user')?.content ?? null,
    });
    this.statusBar = new StatusBar(
      () => this.help.open(),
      () => this.openUsage(),
    );
    this.settings = new SettingsView({
      save: (input) => this.saveConfig(input),
      listModels: (input) => this.backend.listModels(input),
      close: () => this.closeSettings(),
    });

    this.root = h(
      'div',
      { class: 'app' },
      this.header.el,
      h('div', { class: 'main' }, this.chat.el, this.composer.el, this.settings.el),
      this.statusBar.el,
      this.toast.el,
      this.help.el,
      this.usage.el,
      new ResizeHandles((direction) => void this.backend.startResize(direction)).el,
    );
    host.replaceChildren(this.root);

    this.applyFontSize(load<number>(FONT_KEY) ?? FONT.default);
    this.bindKeys();
    useWindowDrag(this.root, () => void this.backend.startDragging());
  }

  async start(): Promise<void> {
    const [config, shortcut, dir] = await Promise.all([
      this.backend.getConfig(),
      this.backend.shortcutStatus().catch(() => null),
      this.backend.dataDir().catch(() => this.dataDir),
    ]);
    this.config = config;
    this.dataDir = dir;

    const saved = load<SavedChat>(CHAT_KEY);
    if (saved && Date.now() - saved.at < IDLE_NEW_CHAT_MS) {
      this.messages = saved.messages;
      this.lastActivity = saved.at;
    }
    this.chat.render(this.messages);
    this.renderHeader();

    if (!config) this.openSettings();
    else this.composer.focus();
    this.renderStatus();

    this.backend.on('summoned', () => this.onSummoned());
    this.backend.on('quit', () => void this.quit());
    this.backend.on('placement', (docked) => this.root.classList.toggle('floating', docked === false));

    await this.firstRun(shortcut?.registered ?? true, shortcut?.wayland ?? false);
  }

  private async firstRun(shortcutOk: boolean, wayland: boolean): Promise<void> {
    if (!load<boolean>('noteai.autostartInitialized')) {
      store('noteai.autostartInitialized', true);
      try {
        await this.backend.setAutostart(true);
      } catch (e) {
        console.error('autostart', e);
      }
    }
    if ((!shortcutOk || wayland) && !load<boolean>('noteai.shortcutHintShown')) {
      store('noteai.shortcutHintShown', true);
      this.toast.show('Ctrl+O no está disponible para la app. Ejecuta: sh /usr/share/noteai/setup-shortcut.sh', undefined, 10000);
    }
  }

  private onSummoned(): void {
    this.help.close();
    this.usage.close();
    if (this.settings.isOpen) return;
    // Para consultas sueltas: tras un rato sin usarla, un chat limpio (y más barato).
    if (!this.busy && this.messages.length && Date.now() - this.lastActivity > IDLE_NEW_CHAT_MS) {
      this.newChat(false);
    }
    this.composer.focus(true);
  }

  // ── Chat ────────────────────────────────────────────────────────────────

  private async ask(text: string): Promise<void> {
    if (this.busy) return;
    if (!this.config) return this.openSettings();
    this.composer.value = '';
    this.messages.push({ role: 'user', content: text });
    this.chat.beginAnswer(text);
    await this.run();
  }

  /** Pide la respuesta a la última pregunta de `messages`. */
  private async run(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.setStatus('thinking');
    this.touch();
    let answer = '';
    // Si mientras tanto se empieza un chat nuevo, la respuesta va al chat que la pidió.
    const messages = this.messages;
    try {
      const { finished, usage } = await this.backend.sendChat(messages, (piece) => {
        if (!answer) this.setStatus('streaming');
        answer += piece;
        this.chat.append(piece);
      });
      this.chat.endAnswer(finished || answer ? undefined : 'Detenido.');
      if (answer) messages.push({ role: 'assistant', content: answer });
      if (usage) this.lastUsage = usage;
      this.setStatus('idle');
    } catch (e) {
      this.error = String(e);
      this.chat.endAnswer(this.error);
      // La respuesta a medias se descarta: al reintentar se pide entera.
      this.setStatus('error');
    } finally {
      this.busy = false;
      this.touch();
    }
  }

  private retry(): void {
    if (this.busy || this.messages[this.messages.length - 1]?.role !== 'user') return;
    this.chat.render(this.messages.slice(0, -1));
    this.chat.beginAnswer(this.messages[this.messages.length - 1].content);
    void this.run();
  }

  private stop(): void {
    void this.backend.cancelChat();
  }

  private newChat(undoable = true): void {
    if (this.busy) this.stop();
    const previous = this.messages;
    if (!previous.length) return this.composer.focus();
    this.messages = [];
    this.error = '';
    this.chat.render(this.messages);
    this.touch();
    this.setStatus('idle');
    this.composer.focus();
    this.toast.show(undoable ? 'Chat nuevo' : 'Chat nuevo tras un rato sin usar noteAI', {
      label: 'Recuperar el anterior',
      run: () => {
        if (this.busy) return;
        this.messages = previous;
        this.chat.render(this.messages);
        this.touch();
      },
    }, 6000);
  }

  private touch(): void {
    this.lastActivity = Date.now();
    store(CHAT_KEY, { messages: this.messages, at: this.lastActivity } satisfies SavedChat);
  }

  private async copy(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show('Respuesta copiada', undefined, 1500);
    } catch {
      this.toast.show('No se pudo copiar');
    }
  }

  // ── Configuración ───────────────────────────────────────────────────────

  private openUsage(): void {
    this.help.close();
    void this.usage.open();
  }

  private openSettings(): void {
    this.help.close();
    this.usage.close();
    this.root.classList.add('configuring');
    this.settings.open(this.config);
    this.renderStatus();
  }

  private closeSettings(): void {
    if (!this.config) return;
    this.settings.close();
    this.root.classList.remove('configuring');
    this.renderStatus();
    this.composer.focus();
  }

  private async saveConfig(input: ConfigInput): Promise<void> {
    this.config = await this.backend.saveConfig(input);
    this.renderHeader();
    this.closeSettings();
    this.toast.show(`Listo: ${providerById(this.config.provider).name} · ${this.config.model}`, undefined, 2500);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  private setStatus(status: ChatStatus): void {
    this.status = status;
    this.root.classList.toggle('busy', status === 'thinking' || status === 'streaming');
    this.renderStatus();
  }

  private renderHeader(): void {
    this.header.setModel(this.config?.model ?? '');
  }

  private renderStatus(): void {
    if (!this.config || this.settings.isOpen) {
      this.statusBar.render(this.config ? 'idle' : 'setup', this.config ? 'Configuración' : 'Añade una API key para empezar');
      return;
    }
    const u = this.lastUsage;
    const meta =
      this.status === 'error'
        ? 'Revisa la clave o el modelo con Ctrl ,'
        : this.status === 'idle'
          ? u && this.messages.length
            ? `${u.estimated ? '≈' : ''}${formatTokens(u.inputTokens)} → ${formatTokens(u.outputTokens)} tokens · ${formatCost(u.cost)}`
            : providerById(this.config.provider).name
          : 'Esc para detener';
    this.statusBar.render(this.status, meta, u !== null && this.status === 'idle' && this.messages.length > 0);
  }

  private applyFontSize(px: number): void {
    const size = Math.min(FONT.max, Math.max(FONT.min, px));
    document.documentElement.style.setProperty('--chat-size', `${size}px`);
    store(FONT_KEY, size);
  }

  private zoom(delta: number | null): void {
    const current = load<number>(FONT_KEY) ?? FONT.default;
    this.applyFontSize(delta === null ? FONT.default : current + delta * FONT.step);
  }

  // ── Teclado ─────────────────────────────────────────────────────────────

  private bindKeys(): void {
    // Los paneles reciben las teclas primero.
    window.addEventListener(
      'keydown',
      (e) => {
        // Ctrl+, va aparte: useHotkeys usa la coma para separar combinaciones.
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ',') {
          e.preventDefault();
          e.stopPropagation();
          if (this.settings.isOpen) this.closeSettings();
          else this.openSettings();
          return;
        }
        const handled = this.help.isOpen
          ? this.help.handleKey(e)
          : this.usage.isOpen
            ? this.usage.handleKey(e)
            : this.settings.isOpen && this.settings.handleKey(e);
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );

    useHotkeys(window, {
      escape: () => {
        if (this.busy) this.stop();
        else void this.backend.hideWindow();
      },
      'ctrl+o,ctrl+w': () => void this.backend.hideWindow(),
      'ctrl+n,ctrl+l': () => this.newChat(),
      'ctrl+shift+c': () => {
        const last = [...this.messages].reverse().find((m) => m.role === 'assistant');
        if (last) void this.copy(last.content);
      },
      'ctrl+plus,ctrl+shift+plus,ctrl+=,ctrl+shift+=': () => this.zoom(1),
      'ctrl+-,ctrl+shift+-': () => this.zoom(-1),
      'ctrl+0': () => this.zoom(null),
      'ctrl+u': () => (this.usage.isOpen ? this.usage.close() : this.openUsage()),
      'ctrl+q': () => void this.quit(),
      f1: () => this.help.open(),
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
  }

  private async quit(): Promise<void> {
    this.touch();
    await this.backend.quit();
  }
}
