# noteAI

> Pregunta, lee la respuesta y vuelve a lo tuyo.

Chat de IA mínimo para Debian/Ubuntu, hermano de [QuickNotes](https://github.com/pirlo1121/simple_notes_Linux) y con el mismo diseño. Estás leyendo, aparece una palabra rara: pulsas **Super+I** (tecla de Windows + I), preguntas, lees la respuesta y vuelves a pulsar **Super+I**.

- Usa **tu propia API key** de un proveedor barato: Anthropic (Claude Haiku), Groq, DeepSeek, Gemini, OpenRouter, OpenAI, Ollama (local) o cualquier API compatible con OpenAI.
- Respuestas breves, en streaming y con Markdown.
- La clave se queda en tu equipo (`~/.noteai/config.json`, permisos 600).
- Ligera: ~100 MB de RAM y 0 % de CPU mientras está oculta.

## Instalar

Requisitos: Debian 12/13 o Ubuntu 22.04+ (64 bits), con X11 o Wayland.

```sh
# 1. Herramientas (solo la primera vez)
sudo apt install -y git nodejs npm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source ~/.cargo/env

# 2. Descargar, compilar e instalar
git clone https://github.com/pirlo1121/noteAI.git && cd noteAI
make deps        # librerías del sistema (sudo) y dependencias de npm
make deb         # tarda unos minutos la primera vez
make install     # instala el paquete (sudo)

# 3. Atajo Super+I (GNOME, KDE, XFCE…)
sh /usr/share/noteai/setup-shortcut.sh

# 4. Abrir
noteai --hidden & disown
```

Desde ahí arranca sola y oculta al iniciar sesión.

> **¿Por qué el paso 3?** En GNOME la tecla Super la reserva el escritorio, así que el atajo hay que crearlo en él. El script lo hace por ti (`noteai --toggle`). Con otra combinación: `sh /usr/share/noteai/setup-shortcut.sh '<Super>j'`. Para quitarlo: `--remove`.

## Primer uso

Al abrirla por primera vez aparece **Conecta un modelo**: elige proveedor, pega la API key y pulsa **Guardar**. Cámbialo cuando quieras con `Ctrl ,`.

| Proveedor | Dónde sacar la clave | |
|---|---|---|
| Anthropic (por defecto) | console.anthropic.com/settings/keys | Claude Haiku 5.5: 0,10 $ / 0,50 $ por millón de tokens |
| Groq | console.groq.com/keys | Muy rápido, plan gratuito |
| Google Gemini | aistudio.google.com/apikey | Plan gratuito |
| DeepSeek | platform.deepseek.com/api_keys | Muy barato |
| OpenRouter | openrouter.ai/keys | Muchos modelos con una clave |
| OpenAI | platform.openai.com/api-keys | Usa un modelo «mini» o «nano» |
| Ollama | — | Local y gratis, sin clave |

Si el modelo sugerido no existe, pulsa **Cargar modelos** y elige uno.

## Uso

| Acción | Tecla |
|---|---|
| Mostrar / ocultar | `Super I` |
| Enviar · salto de línea | `↵` · `⇧ ↵` |
| Recuperar la última pregunta | `↑` (con la caja vacía) |
| Detener la respuesta · ocultar | `Esc` |
| Chat nuevo | `Ctrl N` |
| Copiar la última respuesta | `Ctrl ⇧ C` |
| Configuración · consumo | `Ctrl ,` · `Ctrl U` |
| Tamaño del texto | `Ctrl +` / `Ctrl −` / `Ctrl 0` |
| Salir del todo · ayuda | `Ctrl Q` · `F1` |

| Comando | Qué hace |
|---|---|
| `/clear` | Limpia la conversación |
| `/def palabra` | Definición breve, origen y un ejemplo |
| `/tr texto` | Traduce (español ↔ inglés, u otro idioma → español) |
| `/tr:fr texto` | Traduce a un idioma concreto (`es en fr de it pt ca nl ru ja zh ko ar`) |

- **Chats cortos:** tras 15 min sin usarla empieza un chat nuevo (se puede recuperar el anterior). Así cada consulta es más rápida y barata.
- **Consumo (`Ctrl U`):** tokens y coste estimado de hoy, la semana, el mes y por modelo. El coste usa el precio por millón de tokens que pongas en `Ctrl ,` (viene relleno para Claude Haiku). La factura real está en la consola de tu proveedor.

## Archivos

Todo vive en `~/.noteai/`: `config.json` (proveedor, modelo y **tu API key**), `usage.jsonl` (consumo) y `.window.json` (tamaño y posición). Para llevarlo a otro equipo, copia la carpeta con la app cerrada (`noteai --quit`). No la compartas: contiene tu clave.

## Actualizar y desinstalar

```sh
# Actualizar
cd noteAI && git pull && npm install
noteai --quit
make deb && make install
noteai --hidden & disown

# Desinstalar
sh /usr/share/noteai/setup-shortcut.sh --remove
sudo apt remove note-ai
rm -r ~/.noteai          # opcional: borra configuración y API key
```

## Problemas

- **Super+I no hace nada:** ejecuta el paso 3 y comprueba que la app está en marcha (`pgrep noteai`; si no, `noteai --hidden & disown`).
- **Ventana en blanco** (algunos drivers NVIDIA): `WEBKIT_DISABLE_DMABUF_RENDERER=1 noteai`.
- **Ventana descolocada:** cierra la app y borra `~/.noteai/.window.json`.
- **Errores de la API:** 401 = clave incorrecta · 404 = modelo inexistente (usa **Cargar modelos**) · 429 = límite o sin saldo.

## Desarrollo

```sh
make dev       # app completa con recarga en caliente
npm run dev    # solo la interfaz en el navegador (http://localhost:1421), respuestas simuladas
make test      # tests de Rust
```

Tauri 2 + Rust + TypeScript sin framework. La arquitectura y las decisiones de diseño están en [CLAUDE.md](CLAUDE.md).
