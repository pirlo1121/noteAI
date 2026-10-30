# noteAI

> Pregunta, lee la respuesta y vuelve a lo tuyo.

Un chat de IA mínimo para Debian/Linux, hermano de [QuickNotes](https://github.com/pirlo1121/simple_notes_Linux) y con el mismo diseño. Estás leyendo y aparece una palabra rara: pulsas **Ctrl+O**, se abre un panel encima de todo en el borde derecho, preguntas «¿qué significa *procrastinar*?», lees la respuesta y vuelves a pulsar **Ctrl+O**.

- Tauri 2 + Rust + TypeScript sin framework.
- Usa **tu propia API key** de un proveedor barato: Anthropic (Claude Haiku), Groq, DeepSeek, Gemini, OpenRouter, OpenAI, Ollama (local) o cualquier API compatible con OpenAI.
- Respuestas en streaming, en Markdown y breves por defecto.
- La clave se guarda solo en tu equipo (`~/.noteai/config.json`, permisos 600) y nunca llega a la interfaz web: las llamadas a la API las hace Rust.

---

## Primer uso

Al abrir la app por primera vez aparece **Conecta un modelo**:

1. Elige el proveedor. La opción por defecto es **Anthropic · Claude Haiku 5.5**: cuesta 0,10 $ por millón de tokens de entrada y 0,50 $ por millón de salida, así que una consulta típica sale por una fracción de céntimo. Groq y Gemini tienen planes gratuitos con límites.
2. Pega la API key. Debajo del campo se indica dónde conseguirla.
3. Deja el modelo sugerido o pulsa **Cargar modelos** para ver los que ofrece tu clave.
4. **Guardar**.

Para cambiarlo después: `Ctrl ,` o el engranaje de la cabecera. En **Avanzado** puedes cambiar la URL de la API y las instrucciones que recibe el modelo (por defecto: responder breve, en tu idioma y con un ejemplo cuando se pregunta por una palabra).

## Uso

| Acción | Tecla |
|---|---|
| Mostrar / ocultar (global) | `Ctrl O` |
| Enviar la pregunta | `↵` |
| Salto de línea | `⇧ ↵` |
| Recuperar la última pregunta (con la caja vacía) | `↑` |
| Detener la respuesta · si no hay ninguna, ocultar | `Esc` |
| Chat nuevo (con «Recuperar el anterior») | `Ctrl N` / `Ctrl L` |
| Copiar la última respuesta | `Ctrl ⇧ C` (o el icono al pasar el ratón) |
| Configuración | `Ctrl ,` |
| Consumo de la API | `Ctrl U` (o el icono de barras de la cabecera) |
| Texto más grande / más pequeño / normal | `Ctrl +` / `Ctrl −` / `Ctrl 0` (o `Ctrl` + rueda) |
| Ocultar ventana | `Ctrl W` |
| Salir del todo | `Ctrl Q` |
| Ayuda | `F1` |

**Chats cortos a propósito:** si pasan más de 15 minutos sin usarla, al abrirla empieza un chat nuevo. Así cada consulta suelta no arrastra la conversación anterior, y cada pregunta es más rápida y más barata. El aviso que aparece permite recuperar el chat anterior.

**Consumo:** cada respuesta guarda sus tokens de entrada y salida en `~/.noteai/usage.jsonl`. La barra de estado muestra los de la última respuesta (`320 → 85 tokens · 0,000075 US$`); al pulsarla, o con `Ctrl U`, se abre el panel con el gasto de hoy, los últimos 7 días, el mes y el total, el desglose por modelo y las últimas respuestas.

- Los tokens los informa el proveedor. Si no lo hace (o se detiene la respuesta antes del recuento), se estiman a ~4 caracteres por token y se marcan con `≈`.
- El coste usa el **precio por millón de tokens** que indiques en `Ctrl ,` (viene relleno para Claude Haiku 5.5 y para Ollama, que es gratis). Se calcula al guardar cada respuesta, así que cambiar el precio no reescribe el historial.
- Es una estimación local: el consumo facturado está en la consola de tu proveedor.

**Ventana:** igual que QuickNotes. Panel acoplado a la derecha, siempre encima, se redimensiona desde cualquier borde y se arrastra desde cualquier zona sin texto. Recuerda su tamaño y posición en `~/.noteai/.window.json`.

> **Nota sobre Ctrl+O:** mientras noteAI está en marcha, el atajo global captura `Ctrl+O` en todo el escritorio, así que «Abrir archivo» de otros programas deja de responder a esa tecla. Si te molesta, usa otra combinación (ver abajo).

Variables de entorno opcionales:

- `NOTEAI_DIR`: otra carpeta de configuración (por defecto `~/.noteai`).
- `NOTEAI_SHORTCUT`: otro atajo (p. ej. `super+a`, `ctrl+alt+o`). Para el atajo del escritorio: `sh packaging/setup-shortcut.sh '<Super>a'`.

## Instalar

Requisitos y pasos idénticos a QuickNotes (Debian 12/13 o Ubuntu 22.04+, X11 o Wayland):

```sh
make deps        # dependencias del sistema (sudo), Rust y npm
make deb         # genera src-tauri/target/release/bundle/deb/noteAI_0.1.0_amd64.deb
make install     # lo instala con apt (sudo)
```

Ábrela desde el menú (**noteAI**) o con `noteai`. La primera vez se activa el inicio automático (arranca oculta con la sesión), así que `Ctrl+O` funciona siempre.

### Atajo Ctrl+O

En X11 la app registra `Ctrl+O` sola. En **Wayland** (o si otro programa ya lo usa) aparece un aviso; registra el atajo en el escritorio:

```sh
sh /usr/share/noteai/setup-shortcut.sh            # GNOME: Ctrl+O → noteai --toggle
sh /usr/share/noteai/setup-shortcut.sh '<Super>a' # otra combinación
```

En KDE, XFCE, i3, sway o Hyprland el script indica qué comando poner (`noteai --toggle`).

### Desarrollo

```sh
make dev     # app completa con recarga en caliente
npm run dev  # solo la interfaz en el navegador (http://localhost:1421), con respuestas simuladas
make test    # tests de Rust (parseo del streaming, tokens, coste, configuración)
```

## Cómo está hecho

```
src-tauri/src/
├── main.rs      Proceso residente, plugins (atajo global, instancia única, autoarranque)
├── window.rs    Panel lateral, mostrar/ocultar, colocación (el mismo de QuickNotes)
├── x11.rs       Activar la ventana en GNOME/X11
├── config.rs    ~/.noteai/config.json (permisos 600); la clave no sale de Rust
├── llm.rs       Streaming SSE para Anthropic Messages y OpenAI chat/completions; tokens; lista de modelos
├── usage.rs     Registro de consumo ~/.noteai/usage.jsonl y cálculo de coste
└── commands.rs  Comandos IPC; las respuestas llegan al frontend por un Channel
src/
├── app.ts       Orquestador: chat, configuración, teclado
├── providers.ts Proveedores predefinidos (URL, modelo barato sugerido, dónde sacar la clave)
├── components/  Header, ChatView, Composer, SettingsView, UsagePanel, StatusBar, HelpPanel, Toast…
├── services/    Backend Tauri y backend simulado para el navegador
└── utils/markdown.ts  Markdown mínimo y seguro (todo se escapa antes)
```

La conversación actual se guarda en el almacenamiento local de la ventana para sobrevivir a reinicios; la API recibe solo el chat en curso.
