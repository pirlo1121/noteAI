// noteAI — chat de IA residente con una sola ventana.
//
// El proceso vive en segundo plano: cerrar la ventana solo la oculta, así
// Super+I la muestra al instante sin volver a arrancar WebKit.

mod commands;
mod config;
mod llm;
mod usage;
mod window;
#[cfg(target_os = "linux")]
mod x11;

use std::sync::{atomic::AtomicU64, Mutex};

use tauri::{Emitter, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

pub struct AppState {
    pub config: Mutex<Option<config::Config>>,
    pub http: reqwest::Client,
    /// Generación de la respuesta en curso: cambiarla la cancela.
    pub generation: AtomicU64,
}

fn main() {
    let _ = std::fs::create_dir_all(config::root());
    let args: Vec<String> = std::env::args().collect();

    tauri::Builder::default()
        // Debe ser el primer plugin: una segunda instancia reenvía sus
        // argumentos a esta y termina.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            window::handle_cli(app, &args);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(window::shortcut_plugin())
        .manage(AppState {
            config: Mutex::new(config::load()),
            http: llm::client(),
            generation: AtomicU64::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::list_models,
            commands::send_chat,
            commands::cancel_chat,
            commands::usage_records,
            commands::clear_usage,
            commands::data_dir,
            commands::get_autostart,
            commands::set_autostart,
            commands::shortcut_status,
            commands::hide_window,
            commands::dock_window,
            commands::quit_app,
        ])
        .setup(move |app| {
            if args.iter().any(|a| a == "--quit") {
                app.handle().exit(0);
                return Ok(());
            }
            window::register_summon_shortcut(app.handle());
            window::load_placement();
            if !args.iter().any(|a| a == "--hidden") {
                window::summon(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Moved(_) | WindowEvent::Resized(_) = event {
                window::on_geometry_changed(window);
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window::remember_placement(
                    window.outer_position(),
                    window.outer_size(),
                    window.scale_factor(),
                    window.available_monitors(),
                );
                let _ = window.emit(window::EVENT_HIDING, ());
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar noteAI");
}
