// Consumo de la API: totales por periodo, por modelo y últimas respuestas.
// Los datos salen de ~/.noteai/usage.jsonl (usage.rs); el coste es una
// estimación con los precios configurados, no la factura del proveedor.

import { providerById } from '../providers';
import type { UsageRecord } from '../types';
import { h, kbd } from '../utils/dom';
import { formatCost, formatTime, formatTokens } from '../utils/format';
import { Modal } from './Modal';

const DAY = 24 * 60 * 60 * 1000;
const RECENT = 12;

interface Totals {
  count: number;
  input: number;
  output: number;
  /** null si ninguna respuesta tiene precio. */
  cost: number | null;
  /** Alguna respuesta no tiene precio: el coste se queda corto. */
  partial: boolean;
}

function totals(records: UsageRecord[]): Totals {
  const t: Totals = { count: 0, input: 0, output: 0, cost: null, partial: false };
  for (const r of records) {
    t.count++;
    t.input += r.inputTokens;
    t.output += r.outputTokens;
    if (r.cost === null) t.partial = true;
    else t.cost = (t.cost ?? 0) + r.cost;
  }
  return t;
}

export interface UsagePanelOptions {
  load(): Promise<UsageRecord[]>;
  clear(): Promise<void>;
  /** Proveedor configurado, para indicar dónde ver el consumo real. */
  provider(): string | null;
}

export class UsagePanel extends Modal {
  private body = h('div', { class: 'usage' });
  private footer = h('div', { class: 'modal-footer usage-footer' });
  private clearBtn = h('button', { class: 'usage-clear', type: 'button' }, 'Borrar registro');
  private confirming = false;

  constructor(private opts: UsagePanelOptions) {
    super('usage-panel');
    this.panel.append(h('div', { class: 'modal-title' }, 'Consumo de la API'), this.body, this.footer);
    this.clearBtn.addEventListener('click', () => void this.onClear());
  }

  async open(): Promise<void> {
    this.confirming = false;
    this.clearBtn.textContent = 'Borrar registro';
    this.body.replaceChildren(h('p', { class: 'usage-empty' }, 'Cargando…'));
    this.renderFooter();
    this.show();
    try {
      this.render(await this.opts.load());
    } catch (e) {
      this.body.replaceChildren(h('p', { class: 'usage-empty error' }, String(e)));
    }
  }

  private render(records: UsageRecord[]): void {
    if (!records.length) {
      this.body.replaceChildren(h('p', { class: 'usage-empty' }, 'Aún no hay consultas registradas. Cada respuesta suma aquí sus tokens y su coste estimado.'));
      return;
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const since = (t: number) => records.filter((r) => r.at >= t);

    const periods: [string, Totals][] = [
      ['Hoy', totals(since(today))],
      ['7 días', totals(since(today - 6 * DAY))],
      ['Este mes', totals(since(month))],
      ['Total', totals(records)],
    ];

    const byModel = new Map<string, UsageRecord[]>();
    for (const r of since(month)) {
      const key = `${r.model}\u0000${r.provider}`;
      byModel.set(key, [...(byModel.get(key) ?? []), r]);
    }
    const models = [...byModel.entries()]
      .map(([key, rs]) => ({ model: key.split('\u0000')[0], provider: rs[0].provider, t: totals(rs) }))
      .sort((a, b) => (b.t.cost ?? 0) - (a.t.cost ?? 0) || b.t.output - a.t.output);

    const cost = (t: Totals) => `${formatCost(t.cost)}${t.partial && t.cost !== null ? '*' : ''}`;
    const anyPartial = periods.some(([, t]) => t.partial);

    this.body.replaceChildren(
      h(
        'div',
        { class: 'usage-cards' },
        ...periods.map(([label, t]) =>
          h(
            'div',
            { class: 'usage-card' },
            h('span', { class: 'usage-card-label' }, label),
            h('span', { class: 'usage-card-cost' }, cost(t)),
            h('span', { class: 'usage-card-meta' }, `${t.count} ${t.count === 1 ? 'pregunta' : 'preguntas'} · ${formatTokens(t.input + t.output)} tokens`),
          ),
        ),
      ),
      h('div', { class: 'usage-section' }, 'Por modelo · este mes'),
      models.length
        ? this.table(
            ['Modelo', 'Preguntas', 'Entrada', 'Salida', 'Coste'],
            models.map(({ model, provider, t }) => [
              h('span', { class: 'usage-model', title: providerById(provider).name }, model),
              String(t.count),
              formatTokens(t.input),
              formatTokens(t.output),
              cost(t),
            ]),
          )
        : h('p', { class: 'usage-empty' }, 'Sin consultas este mes.'),
      h('div', { class: 'usage-section' }, 'Últimas respuestas'),
      this.table(
        ['Cuándo', 'Modelo', 'Entrada', 'Salida', 'Coste'],
        records
          .slice(-RECENT)
          .reverse()
          .map((r) => {
            const approx = r.estimated ? '≈' : '';
            return [
              formatTime(r.at),
              h('span', { class: 'usage-model' }, r.model),
              approx + formatTokens(r.inputTokens),
              approx + formatTokens(r.outputTokens),
              formatCost(r.cost),
            ];
          }),
      ),
      ...(anyPartial
        ? [h('p', { class: 'usage-note' }, '* Algunas respuestas no tienen precio (no estaba configurado): el coste real es mayor. Indica el precio en Ctrl ,')]
        : []),
    );
  }

  private table(head: string[], rows: (string | Node)[][]): HTMLElement {
    return h(
      'table',
      { class: 'usage-table' },
      h('thead', {}, h('tr', {}, ...head.map((c) => h('th', {}, c)))),
      h('tbody', {}, ...rows.map((row) => h('tr', {}, ...row.map((c) => h('td', {}, c))))),
    );
  }

  private renderFooter(): void {
    const id = this.opts.provider();
    const url = id ? providerById(id).keyUrl.split('/')[0] : '';
    this.footer.replaceChildren(
      h(
        'span',
        {},
        'Estimación local en ', h('code', {}, '~/.noteai/usage.jsonl'), ' · ≈ tokens estimados por el texto',
        url ? ` · consumo real en ${url}` : '',
        ' · ', kbd('Esc'), ' cerrar',
      ),
      this.clearBtn,
    );
  }

  /** Dos clics para borrar: sin diálogos del navegador. */
  private async onClear(): Promise<void> {
    if (!this.confirming) {
      this.confirming = true;
      this.clearBtn.textContent = '¿Seguro? Pulsa otra vez';
      return;
    }
    await this.opts.clear();
    this.confirming = false;
    this.clearBtn.textContent = 'Borrar registro';
    this.render([]);
  }
}
