# CLAUDE.md — noteAI

Chat de IA mínimo para Linux (Debian/Ubuntu). `Ctrl+O` muestra/oculta un panel lateral siempre encima; se pregunta algo rápido (p. ej. una palabra mientras se lee) y se vuelve a ocultar. Hermano de QuickNotes (`../notesLx`): mismo diseño y misma gestión de ventana. El usuario trae su propia API key de un proveedor barato.

Todo el proyecto (código, comentarios, textos de la interfaz, commits, README) está en **español**. Mantenerlo así.

## Comandos

```sh
make dev            # app completa (Tauri + Vite en :1421) con recarga en caliente
npm run dev         # solo interfaz en el navegador, con mockBackend (respuestas simuladas)
make check          # tsc --noEmit + cargo check
make test           # cargo test (parseo SSE y de tokens, cuerpo de las peticiones, config, coste)
npm run build       # typecheck + build del frontend a dist/
make deb            # paquete .deb en src-tauri/target/release/bundle/deb/
cd src-tauri && cargo clippy   # debe salir sin avisos
```

Antes de dar un cambio por bueno: `npm run build` y `cd src-tauri && cargo test && cargo clippy`.

## Arquitectura

Rust es dueño de la red y de la configuración; el frontend solo pinta e interactúa.

```
src-tauri/src/
├── main.rs      Proceso residente. Plugins: single-instance (primero), autostart (--hidden), global-shortcut.
│                AppState { config: Mutex<Option<Config>>, http: reqwest::Client, generation: AtomicU64 }
├── window.rs    Copia de QuickNotes con sed: panel acoplado/flotante, toggle, colocación en ~/.noteai/.window.json.
│                Eventos al frontend: nai://summoned, nai://hiding, nai://quit, nai://placement
├── x11.rs       Copia literal de QuickNotes: fuerza el foco en GNOME/X11 vía _NET_ACTIVE_WINDOW.
├── config.rs    ~/.noteai/config.json (escritura atómica, permisos 600). DEFAULT_SYSTEM_PROMPT.
│                PublicConfig = config sin la clave (solo keyHint "…abcd"). ConfigInput.merge conserva la clave
│                si apiKey es null o vacío.
├── llm.rs       Dos protocolos (enum Api): Anthropic Messages (POST {base}/messages) y OpenAI chat/completions
│                (POST {base}/chat/completions). Streaming SSE parseado a mano, devuelve Usage (tokens);
│                list_models (GET {base}/models).
├── usage.rs     Consumo: Record por respuesta en ~/.noteai/usage.jsonl (append), coste con los precios de Config.
└── commands.rs  IPC: get_config, save_config, list_models, send_chat (Channel<ChatEvent> → ChatResult
                 {finished, usage}), cancel_chat, usage_records, clear_usage, data_dir, get/set_autostart,
                 shortcut_status, hide_window, dock_window, quit_app.

src/
├── main.ts           Fuentes (fontsource) + CSS + arranque.
├── app.ts            Orquestador: estado del chat, ask/run/retry/stop, newChat, settings, teclado, zoom.
├── commands.ts       /clear, /def, /tr[:idioma]: parseCommand() → clear | ask {content, display} | error. Lista para F1.
├── providers.ts      Presets: id, api, baseUrl, modelo barato sugerido, keyUrl, nota, needsKey.
├── types.ts          Tipos espejo de Rust (camelCase por serde rename_all).
├── components/       Header, ChatView, Composer, SettingsView, UsagePanel, StatusBar, HelpPanel, Modal, Toast, ResizeHandles
├── hooks/            useHotkeys, useWindowDrag (copiados de QuickNotes, useWindowDrag adaptado)
├── services/         backend.ts (contrato), tauriBackend.ts (invoke/Channel/listen), mockBackend.ts
├── utils/dom.ts      h(tag, attrs, ...children) y kbd()
├── utils/markdown.ts Markdown mínimo: escapa TODO antes de transformar; nunca insertar HTML del modelo
├── utils/format.ts   Cifras en es-ES: tokens, coste (US$), fechas
└── styles/main.css   Tema «tinta y marfil» (tokens en :root iguales a QuickNotes) + estilos del chat
```

Flujo de una pregunta: `Composer` ↵ → `App.ask` → `ChatView.beginAnswer` → `backend.sendChat(messages, onText)` → Rust `send_chat` sube `generation`, hace streaming y manda `{type:"delta", text}` por el Channel → `ChatView.append` repinta con requestAnimationFrame → al terminar Rust guarda el `Record` de consumo y devuelve `ChatResult`; el frontend hace `endAnswer`, añade el mensaje `assistant` y muestra los tokens/coste en la barra de estado.

## Decisiones y detalles que conviene saber

- **La API key nunca sale de Rust.** No añadir ningún comando que la devuelva. El frontend solo ve `keyHint`.
- **Cancelar** = incrementar `AppState.generation`; `stream_chat` lo comprueba entre trozos. Un `send_chat` nuevo cancela el anterior.
- **Anthropic**: modelo por defecto `claude-haiku-5-5`, cabeceras `x-api-key` y `anthropic-version: 2023-06-01`, `output_config: {effort: "low"}` para respuestas rápidas y baratas, `max_tokens: 8192`, sin parámetro `thinking` (en Haiku 5.5 el pensamiento adaptativo está activo por defecto; los `thinking_delta` se ignoran). No enviar `budget_tokens`, `temperature` ni prefill: Haiku 5.5 responde 400. El historial se reenvía solo con texto (sin bloques de pensamiento).
- **OpenAI-compatible**: el system prompt va como primer mensaje `role: system`; sin clave no se envía `Authorization` (Ollama). Se pide `stream_options: {include_usage: true}`; si el proveedor responde 400 mencionando `stream_options`, se reintenta sin él.
- **Consumo (tokens)**: Anthropic da la entrada en `message_start` (`input_tokens` + `cache_*`) y la salida acumulada en `message_delta`; OpenAI en el último trozo (`usage.prompt_tokens/completion_tokens`, con `choices: []`); Groq en `x_groq.usage`. Si falta algo (o se cancela antes), `send_chat` estima a 4 caracteres/token y marca `estimated: true` (se muestra con `≈`).
- **Coste**: `Config.price_input/price_output` en US$ por millón de tokens (opcionales; `None` = sin coste). Se calcula al guardar cada `Record`, no al mostrarlo, para que cambiar precios no reescriba el historial. Precios conocidos en `providers.ts` (`price`): solo Haiku 5.5 (0,10/0,50, válido para prompts ≤100K tokens) y Ollama (0). No inventar precios de otros proveedores: dejar que el usuario los rellene.
- `usage.jsonl` es append-only; `read_all` ignora líneas dañadas. «Borrar registro» pide dos clics (no usar `confirm()`).
- Los modelos sugeridos para Groq/DeepSeek/Gemini/OpenRouter/OpenAI en `providers.ts` pueden quedar viejos; el botón «Cargar modelos» es la vía para elegir uno vigente.
- **Comandos**: solo frontend. `ChatMessage.display` guarda lo que escribió el usuario (se muestra y se recupera con ↑); `content` es lo que va al modelo. Rust ignora `display` (serde descarta campos desconocidos). El idioma va pegado al comando (`/tr:en`) para no confundirse con el texto («/tr de nada»). Solo `/palabra` o `/palabra:opción` cuenta como comando. Para añadir uno: un `case` en `parseCommand` y una línea en `COMMAND_HELP`.
- **Persistencia del chat**: `localStorage` (`noteai.chat` = `{messages, at}`, `noteai.fontSize`, `noteai.autostartInitialized`, `noteai.shortcutHintShown`). Tras `IDLE_NEW_CHAT_MS` (15 min) sin uso, al invocar la ventana empieza un chat nuevo (toast con «Recuperar el anterior»).
- **`run()` captura `const messages = this.messages`** para que, si se empieza un chat nuevo mientras llega una respuesta, esta no se cuele en el nuevo.
- **`useHotkeys` separa combinaciones por comas**, así que `Ctrl+,` (configuración) se gestiona aparte en el listener de captura de `App.bindKeys`. Lo mismo valdría para cualquier atajo con coma.
- **Arrastre de ventana**: `useWindowDrag` no arrastra sobre `.msg-body`, `.settings`, `textarea`, `.modal` (ahí se selecciona texto).
- **Atajo global**: `ctrl+o` o `NOTEAI_SHORTCUT`. En Wayland no se puede registrar; `packaging/setup-shortcut.sh` crea el atajo de GNOME que ejecuta `noteai --toggle`. Ojo: captura Ctrl+O en todo el escritorio.
- **Puerto de Vite 1421** (QuickNotes usa 1420) para poder desarrollar ambas a la vez.
- `NOTEAI_DIR` cambia la carpeta de datos (por defecto `~/.noteai`).
- Iconos: se generan desde `packaging/icon.svg` con `npx tauri icon packaging/icon.svg -o src-tauri/icons` (borrar después android/, ios/, Square*, .ico, .icns).

## Convenciones de código

- TypeScript sin framework: cada componente crea su DOM con `h()` en el constructor, expone `el` y métodos de render. Nada de librerías nuevas sin necesidad (el bundle de JS ronda 25 KB).
- Comentarios breves en español explicando el porqué; cabecera de comentario al inicio de cada archivo.
- Colores y tamaños solo vía tokens CSS de `:root`. `--chat-size` lo controla Ctrl +/−.
- Rust: errores de comandos como `String` legible para el usuario (en español); tests unitarios en el mismo archivo (`#[cfg(test)]`).
- Si se toca `window.rs` o `x11.rs`, valorar llevar el mismo cambio a QuickNotes (`../notesLx`) y viceversa.

## Añadir un proveedor

1. Si habla OpenAI chat/completions: solo añadir una entrada en `PROVIDERS` (`src/providers.ts`).
2. Si tiene protocolo propio: nueva variante en `config::Api` (Rust) y en `type Api` (`types.ts`); ramas en `llm::request`, `llm::body`, `llm::delta` y la ruta en `stream_chat`/`list_models`; añadir test de parseo en `llm.rs`.

## Estado y pendientes

- Verificado: build del frontend, `cargo test` (9 tests) y `cargo clippy` limpios.
- **Sin verificar todavía**: uso real con API keys de cada proveedor y revisión visual en la app de escritorio.
- Ideas no hechas: historial de chats anteriores, pegar automáticamente el texto seleccionado (selección primaria de X11) al abrir, tamaño de respuesta configurable, límite de gasto mensual con aviso, exportar consumo a CSV.
