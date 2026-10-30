// Comandos de la caja de pregunta: /clear, /def y /tr.
//
// /def y /tr no hacen nada especial en Rust: convierten lo escrito en una
// petición más precisa para el modelo. En el chat se sigue viendo lo que
// escribió el usuario (`display`); al modelo le llega `content`.

export type CommandResult =
  | { kind: 'clear' }
  | { kind: 'ask'; content: string; display: string }
  | { kind: 'error'; message: string };

/** Para la ayuda (F1): [uso, descripción]. */
export const COMMAND_HELP: [string, string][] = [
  ['/clear', 'Limpiar la conversación (también /limpiar)'],
  ['/def palabra', 'Definición breve, origen y un ejemplo'],
  ['/tr texto', 'Traducir: del español al inglés, o de otro idioma al español'],
  ['/tr:en texto', 'Traducir a un idioma concreto (en, es, fr, de, it, pt, ca, ja, zh…)'],
];

const LANGUAGES: Record<string, string> = {
  es: 'español',
  en: 'inglés',
  fr: 'francés',
  de: 'alemán',
  it: 'italiano',
  pt: 'portugués',
  ca: 'catalán',
  nl: 'neerlandés',
  ru: 'ruso',
  ja: 'japonés',
  zh: 'chino',
  ko: 'coreano',
  ar: 'árabe',
};

/**
 * `null` si el texto no es un comando y se envía tal cual. Solo cuenta como
 * comando «/palabra» o «/palabra:opción»: «/etc/hosts ¿qué es?» es una pregunta.
 */
export function parseCommand(text: string): CommandResult | null {
  const match = text.match(/^\/([a-zñ]+(?::[a-z]+)?)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  // «/tr:en» → comando «tr» con opción «en».
  const [name, option = ''] = match[1].toLowerCase().split(':', 2);
  const arg = (match[2] ?? '').trim();

  switch (name) {
    case 'clear':
    case 'limpiar':
      return { kind: 'clear' };

    case 'def':
    case 'definir':
      if (!arg) return { kind: 'error', message: 'Uso: /def palabra' };
      return {
        kind: 'ask',
        display: text,
        content:
          `Define la palabra o expresión «${arg}». Responde en español con: ` +
          'la definición breve (si tiene varias acepciones, solo las principales), ' +
          'su origen en una línea y un ejemplo de uso. Sé conciso.',
      };

    case 'tr':
    case 'traducir': {
      if (!arg) return { kind: 'error', message: 'Uso: /tr texto  ·  /tr:en texto' };
      const target = option ? LANGUAGES[option] : undefined;
      if (option && !target) {
        return { kind: 'error', message: `Idioma desconocido: ${option}  ·  usa ${Object.keys(LANGUAGES).join(', ')}` };
      }
      const instruction = target
        ? `Traduce el siguiente texto al ${target}.`
        : 'Traduce el siguiente texto: si está en español, al inglés; si está en otro idioma, al español.';
      return {
        kind: 'ask',
        display: text,
        content: `${instruction} Devuelve solo la traducción, sin explicaciones ni comillas.\n\n${arg}`,
      };
    }

    default:
      return { kind: 'error', message: `Comando desconocido: /${name}  ·  disponibles: /clear /def /tr` };
  }
}
