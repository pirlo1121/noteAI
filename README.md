# noteAI

> Pregunta, lee la respuesta y vuelve a lo tuyo.

Un chat de IA mínimo para Debian/Linux, hermano de [QuickNotes](https://github.com/pirlo1121/simple_notes_Linux) y con el mismo diseño. Estás leyendo y aparece una palabra rara: pulsas **Ctrl+O**, se abre un panel encima de todo en el borde derecho, preguntas «¿qué significa *procrastinar*?», lees la respuesta y vuelves a pulsar **Ctrl+O**.

- Tauri 2 + Rust + TypeScript sin framework.
- Usa **tu propia API key** de un proveedor barato: Anthropic (Claude Haiku), Groq, DeepSeek, Gemini, OpenRouter, OpenAI, Ollama (local) o cualquier API compatible con OpenAI.
- Respuestas en streaming, en Markdown y breves por defecto.
- La clave se guarda solo en tu equipo (`~/.noteai/config.json`, permisos 600) y nunca llega a la interfaz web: las llamadas a la API las hace Rust.

**Instalación rápida** (Debian/Ubuntu, con Rust y Node.js ya instalados):

```sh
git clone https://github.com/pirlo1121/noteAI.git && cd noteAI
make deps && make deb && make install
noteai
```

La guía completa, paso a paso y para un equipo nuevo, está en [Instalar](#instalar).

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

**Comandos** (escríbelos en la caja de la pregunta; F1 los lista):

| Comando | Qué hace |
|---|---|
| `/clear` (`/limpiar`) | Limpia la conversación (con «Recuperar el anterior») |
| `/def palabra` | Definición breve, origen y un ejemplo |
| `/tr texto` | Traduce: del español al inglés, o de otro idioma al español |
| `/tr:en texto` | Traduce a un idioma concreto (`es en fr de it pt ca nl ru ja zh ko ar`) |

En el chat se ve lo que escribiste (`/def inefable`); al modelo le llega una petición más precisa. `↑` recupera el comando tal cual.

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

Hay dos caminos:

- **A. Instalar un `.deb` ya compilado**: rápido, no necesita herramientas de desarrollo.
- **B. Compilar desde el código fuente**: necesario si no tienes un `.deb` o quieres modificar la app.

En los dos casos, al final necesitas una **API key** de algún proveedor (o Ollama instalado, que no la necesita). Ver [Primer uso](#primer-uso).

### Requisitos

| | Mínimo |
|---|---|
| Sistema | Debian 12 (bookworm) o 13 (trixie), 64 bits (`amd64`). También Ubuntu 22.04+ y derivadas |
| Escritorio | Cualquiera con X11 o Wayland (GNOME, KDE, XFCE, i3, sway, Hyprland…) |
| Para ejecutar | `libwebkit2gtk-4.1-0`, `libgtk-3-0` (apt las instala solas con el `.deb`) y conexión a internet (salvo con Ollama) |
| Para compilar | `git`, Rust ≥ 1.77 (vía rustup), Node.js ≥ 18 con npm, y las librerías `-dev` del paso B.2 |
| Espacio para compilar | ~3 GB libres (la carpeta `src-tauri/target` crece bastante) |

### A. Instalar un `.deb` ya compilado

1. En el equipo donde compilaste (camino B), el paquete está en
   `src-tauri/target/release/bundle/deb/noteAI_0.1.0_amd64.deb`. Cópialo al otro equipo (USB, `scp`…).
2. En el equipo nuevo:

   ```sh
   sudo apt update
   sudo apt install ./noteAI_0.1.0_amd64.deb
   ```

3. Ábrela desde el menú de aplicaciones (**noteAI**) o con `noteai` en una terminal.
4. Sigue con el [paso 5 (primer arranque)](#5-primer-arranque-api-key) y el [paso 6 (atajo Ctrl+O)](#6-atajo-ctrlo).

### B. Compilar desde el código fuente

#### 1. Clonar el repositorio

```sh
sudo apt update
sudo apt install -y git
git clone https://github.com/pirlo1121/noteAI.git
cd noteAI
```

#### 2. Instalar las dependencias del sistema

```sh
sudo apt install -y build-essential curl wget file pkg-config libssl-dev \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev
```

#### 3. Instalar Rust y Node.js

```sh
# Rust (no uses el rustc de apt: puede ser demasiado antiguo)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env
rustc --version          # debe ser ≥ 1.77

# Node.js ≥ 18 (el de Debian 12 y 13 sirve)
sudo apt install -y nodejs npm
node --version
```

> Atajo: los pasos 2 y 3 (y el `npm install` del paso 4) se hacen de una vez con `make deps`,
> aunque Node.js debe estar instalado antes.

#### 4. Compilar e instalar

```sh
npm install
make deb                 # = npm run tauri build -- --bundles deb
make install             # = sudo apt install ./src-tauri/target/release/bundle/deb/noteAI_*_amd64.deb
```

La primera compilación tarda varios minutos. El paquete instala:

- `/usr/bin/noteai`
- la entrada de menú **noteAI** y sus iconos
- `/usr/share/noteai/setup-shortcut.sh`

> ¿Solo quieres probarla sin instalar? `make dev` la compila y la abre en modo desarrollo.

#### 5. Primer arranque: API key

Abre la app (menú de aplicaciones o `noteai`). Aparece **Conecta un modelo**: elige el proveedor, pega la API key y pulsa **Guardar** (detalles en [Primer uso](#primer-uso)). Dónde conseguir la clave:

| Proveedor | Clave en | Nota |
|---|---|---|
| Anthropic (por defecto) | console.anthropic.com/settings/keys | Claude Haiku 5.5, muy barato; requiere saldo |
| Groq | console.groq.com/keys | Muy rápido, plan gratuito con límites |
| Google Gemini | aistudio.google.com/apikey | Plan gratuito con límites |
| DeepSeek | platform.deepseek.com/api_keys | Muy económico |
| OpenRouter | openrouter.ai/keys | Una clave para muchos modelos |
| OpenAI | platform.openai.com/api-keys | Elige un modelo «mini» o «nano» |
| Ollama | — | Local y gratis: instala [Ollama](https://ollama.com) y `ollama pull llama3.2` |

La clave queda en `~/.noteai/config.json` con permisos 600 (solo tu usuario puede leerla).

En el primer arranque la app también se configura para **iniciarse oculta con la sesión**, así `Ctrl+O` funciona siempre sin abrirla a mano.

#### 6. Atajo Ctrl+O

En X11 la app registra `Ctrl+O` sola. Hace falta un atajo del escritorio en dos casos (la app avisa una vez):

- **Wayland**: las aplicaciones no pueden capturar atajos globales.
- **Otro programa ya usa Ctrl+O** como atajo global.

Ejecuta una vez:

```sh
sh /usr/share/noteai/setup-shortcut.sh            # GNOME: Ctrl+O → noteai --toggle
sh /usr/share/noteai/setup-shortcut.sh '<Super>a' # otra combinación
sh /usr/share/noteai/setup-shortcut.sh --remove   # quitar el atajo
```

En KDE, XFCE, i3, sway o Hyprland el script indica qué añadir (el comando es `noteai --toggle`).

Opciones de línea de comandos:

- `--toggle`: mostrar u ocultar.
- `--hidden`: arrancar en segundo plano.
- `--quit`: salir.

### Llevarte tu configuración a otro equipo (opcional)

Todo está en `~/.noteai/`: `config.json` (proveedor, modelo, precios y **tu API key**), `usage.jsonl` (historial de consumo) y `.window.json` (tamaño y posición). Cópiala con la app cerrada (`noteai --quit`) y conservando los permisos:

```sh
rsync -a ~/.noteai/ usuario@equipo-nuevo:~/.noteai/
```

No la subas a ningún repositorio ni la compartas: contiene tu clave.

### Actualizar a una versión nueva

```sh
cd noteAI
git pull
npm install
noteai --quit
make deb && make install
noteai &
```

La configuración y el consumo de `~/.noteai` no se tocan.

### Desinstalar

```sh
sudo apt remove note-ai          # si no lo encuentra: dpkg -S /usr/bin/noteai muestra el nombre del paquete
sh /usr/share/noteai/setup-shortcut.sh --remove   # antes de desinstalar, si creaste el atajo de GNOME
```

La configuración sigue en `~/.noteai/` (incluida la API key). Bórrala si ya no la quieres: `rm -r ~/.noteai`. Si la app se iniciaba con la sesión, borra también `~/.config/autostart/noteAI.desktop` si quedó.

### Problemas conocidos

- **Ventana en blanco** con algunos drivers NVIDIA: `WEBKIT_DISABLE_DMABUF_RENDERER=1 noteai`.
- **Ctrl+O no responde**: ejecuta `setup-shortcut.sh` (ver paso 6).
- **La ventana se abre fuera de sitio o con un tamaño raro**: cierra la app y borra `~/.noteai/.window.json`.
- **«API key no válida» (401/403)**: revisa la clave en `Ctrl ,`.
- **«Modelo o URL no encontrados» (404)**: pulsa **Cargar modelos** y elige uno de la lista.
- **«Límite de uso alcanzado o sin saldo» (429)**: espera un poco o añade saldo en la consola del proveedor.
- **«Sin conexión»**: revisa internet o, con Ollama, que esté en marcha (`ollama serve`).

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
