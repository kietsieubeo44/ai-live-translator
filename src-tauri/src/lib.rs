// AI Live Translator — Tauri Backend Library
// Main application library with Tauri setup and state management

use tauri::Manager;

pub mod audio;
pub mod stt;
pub mod translation;
pub mod answer;
pub mod storage;
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::audio::AudioState::default())
        .manage(commands::storage::StorageState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if std::env::var("TAURI_DEVTOOLS").is_ok() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.open_devtools();
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::audio::list_audio_devices,
            commands::audio::start_capture,
            commands::audio::stop_capture,
            commands::audio::get_capture_status,
            commands::stt::get_available_models,
            commands::stt::load_model,
            commands::translation::translate_text,
            commands::answer::detect_and_answer,
            commands::answer::generate_answer_manual,
            commands::storage::save_session,
            commands::storage::get_sessions,
            commands::storage::delete_session,
            commands::storage::clear_all_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
