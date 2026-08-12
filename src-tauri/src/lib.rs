pub mod audio;
pub mod commands;
pub mod groq;
pub mod injector;
pub mod state;

use commands::*;
use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = app.emit("ui-state", "recording");
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let state = handle.state::<AppState>();
                                let _ = start_recording(handle.clone(), state).await;
                            });
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Position main window at bottom-center of primary monitor
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let monitor_size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    let window_width = (360.0 * scale_factor) as u32;
                    let window_height = (200.0 * scale_factor) as u32;
                    let x = (monitor_size.width as i32 - window_width as i32) / 2;
                    let y = monitor_size.height as i32 - window_height as i32 - (85.0 * scale_factor) as i32;
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                    let _ = window.set_size(tauri::PhysicalSize::new(window_width, window_height));
                }
            }

            // Register Global Hotkey: Ctrl + Alt + D
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyD);
            let _ = app.global_shortcut().register(shortcut);

            // Configure Tray Menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit FlowDictate", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording_and_process,
            accept_text,
            cancel_popover,
            get_api_key,
            save_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
