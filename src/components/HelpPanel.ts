import { COMMAND_HELP } from '../commands';
import { h, kbd } from '../utils/dom';
import { Modal } from './Modal';

const SHORTCUTS: [string, string][] = [
  ['Super I', 'Mostrar / ocultar noteAI (global)'],
  ['↵', 'Enviar la pregunta'],
  ['⇧ ↵', 'Salto de línea'],
  ['↑', 'Con la caja vacía: recuperar la última pregunta'],
  ['Esc', 'Detener la respuesta · si no, ocultar la ventana'],
  ['Ctrl N · Ctrl L', 'Chat nuevo (se puede deshacer)'],
  ['Ctrl ⇧ C', 'Copiar la última respuesta'],
  ['Ctrl ,', 'Proveedor, modelo, API key y precios'],
  ['Ctrl U', 'Consumo de la API: tokens y coste estimado'],
  ['Ctrl + · Ctrl −', 'Texto más grande / más pequeño'],
  ['Ctrl 0', 'Tamaño de texto normal'],
  ['Ctrl W', 'Ocultar ventana'],
  ['Ctrl Q', 'Salir del todo'],
  ['F1', 'Esta ayuda'],
];

export class HelpPanel extends Modal {
  private dir = h('code', {});

  constructor(private dataDir: () => string) {
    super('help');
    this.panel.append(
      h('div', { class: 'modal-title' }, 'Atajos de teclado'),
      h('div', { class: 'help-grid' }, ...SHORTCUTS.flatMap(([k, v]) => [h('span', {}, kbd(k)), h('span', {}, v)])),
      h('div', { class: 'modal-title' }, 'Comandos'),
      h('div', { class: 'help-grid' }, ...COMMAND_HELP.flatMap(([k, v]) => [h('span', {}, h('code', {}, k)), h('span', {}, v)])),
      h(
        'div',
        { class: 'modal-footer' },
        'Configuración en ', this.dir, ' · tras 15 min sin usarla se empieza un chat nuevo · ', kbd('Esc'), ' cerrar',
      ),
    );
  }

  open(): void {
    this.dir.textContent = this.dataDir();
    this.show();
  }
}
