// Comandos IPC expuestos al frontend.

use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;

use crate::{
    config::{self, ConfigInput, PublicConfig},
    llm::{self, ChatMessage},
    usage::{self, Record},
    window::{self, ShortcutStatus},
    AppState,
};

type CmdResult<T> = Result<T, String>;

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> CmdResult<Option<PublicConfig>> {
    Ok(state.config.lock().map_err(|e| e.to_string())?.as_ref().map(PublicConfig::from))
}

#[tauri::command]
pub async fn save_config(state: State<'_, AppState>, input: ConfigInput) -> CmdResult<PublicConfig> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    let next = input.merge(current.as_ref());
    config::save(&next).map_err(|e| format!("No se pudo guardar la configuración: {e}"))?;
    let public = PublicConfig::from(&next);
    *current = Some(next);
    Ok(public)
}

/// Lista los modelos con los datos del formulario (aún sin guardar).
#[tauri::command]
pub async fn list_models(state: State<'_, AppState>, input: ConfigInput) -> CmdResult<Vec<String>> {
    let config = input.merge(state.config.lock().map_err(|e| e.to_string())?.as_ref());
    llm::list_models(&state.http, &config).await
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatEvent {
    Delta { text: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    /// `false` si se canceló.
    pub finished: bool,
    /// Consumo de esta respuesta (ya guardado en usage.jsonl), si hubo alguno.
    pub usage: Option<Record>,
}

/// Envía la conversación; los trozos de respuesta llegan por `on_event`.
#[tauri::command]
pub async fn send_chat(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    on_event: Channel<ChatEvent>,
) -> CmdResult<ChatResult> {
    let config = state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Falta configurar el proveedor y la API key")?;
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let cancelled = || state.generation.load(Ordering::SeqCst) != generation;
    let mut answer_chars = 0;
    let tokens = llm::stream_chat(
        &state.http,
        &config,
        &messages,
        |text| {
            answer_chars += text.chars().count();
            let _ = on_event.send(ChatEvent::Delta { text });
        },
        cancelled,
    )
    .await?;

    // Si el proveedor no informó (o se canceló antes del recuento), se estima por caracteres.
    let mut input = tokens.input;
    let mut output = tokens.output;
    let mut estimated = false;
    if input == 0 {
        let prompt_chars: usize = config.system_prompt().chars().count()
            + messages.iter().map(|m| m.content.chars().count()).sum::<usize>();
        input = usage::estimate_tokens(prompt_chars);
        estimated = true;
    }
    if output == 0 && answer_chars > 0 {
        output = usage::estimate_tokens(answer_chars);
        estimated = true;
    }
    let record = (output > 0).then(|| usage::record(&config, input, output, estimated));
    if let Some(r) = &record {
        if let Err(e) = usage::append(r) {
            eprintln!("noteai: no se pudo guardar el consumo: {e}");
        }
    }
    Ok(ChatResult { finished: !cancelled(), usage: record })
}

#[tauri::command]
pub async fn usage_records() -> CmdResult<Vec<Record>> {
    Ok(usage::read_all())
}

#[tauri::command]
pub async fn clear_usage() -> CmdResult<()> {
    usage::clear().map_err(|e| e.to_string())
}

/// Detiene la respuesta en curso (si la hay).
#[tauri::command]
pub async fn cancel_chat(state: State<'_, AppState>) -> CmdResult<()> {
    state.generation.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn data_dir() -> CmdResult<String> {
    Ok(config::root().display().to_string())
}

#[tauri::command]
pub async fn get_autostart(app: AppHandle) -> CmdResult<bool> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_autostart(app: AppHandle, enabled: bool) -> CmdResult<bool> {
    let manager = app.autolaunch();
    let result = if enabled { manager.enable() } else { manager.disable() };
    result.map(|_| enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn shortcut_status(app: AppHandle) -> CmdResult<Option<ShortcutStatus>> {
    Ok(app.try_state::<ShortcutStatus>().map(|s| s.inner().clone()))
}

#[tauri::command]
pub async fn hide_window(app: AppHandle) -> CmdResult<()> {
    if let Some(w) = app.get_webview_window(window::MAIN) {
        window::hide(&w);
    }
    Ok(())
}

#[tauri::command]
pub async fn dock_window(app: AppHandle) -> CmdResult<()> {
    if let Some(w) = app.get_webview_window(window::MAIN) {
        window::dock(&w);
    }
    Ok(())
}

#[tauri::command]
pub async fn quit_app(app: AppHandle) {
    if let Some(w) = app.get_webview_window(window::MAIN).filter(|w| w.is_visible().unwrap_or(false)) {
        window::remember_placement(w.outer_position(), w.outer_size(), w.scale_factor(), w.available_monitors());
    }
    app.exit(0);
}
