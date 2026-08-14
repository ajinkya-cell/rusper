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

pub use std::sync::atomic::Ordering;
use crate::injector::copy_and_inject_text;

pub fn parse_shortcut_str(s: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    let mut mods = Modifiers::empty();
    let font_key = parts.last()?;

    for m in &parts[..parts.len() - 1] {
        match m.to_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "alt" => mods |= Modifiers::ALT,
            "shift" => mods |= Modifiers::SHIFT,
            "super" | "win" | "cmd" => mods |= Modifiers::SUPER,
            "none" | "" => {},
            _ => {}
        }
    }

    let code = match font_key.to_lowercase().as_str() {
        "d" => Code::KeyD,
        "s" => Code::KeyS,
        "a" => Code::KeyA,
        "v" => Code::KeyV,
        "q" => Code::KeyQ,
        "w" => Code::KeyW,
        "space" | "spacebar" => Code::Space,
        "f1" => Code::F1,
        "f2" => Code::F2,
        "f3" => Code::F3,
        "f4" => Code::F4,
        "f5" => Code::F5,
        "f6" => Code::F6,
        "f7" => Code::F7,
        "f8" => Code::F8,
        "f9" => Code::F9,
        "f10" => Code::F10,
        "f11" => Code::F11,
        "f12" => Code::F12,
        "scrolllock" | "scroll_lock" => Code::ScrollLock,
        "pause" | "pausebreak" => Code::Pause,
        "insert" => Code::Insert,
        "capslock" | "caps_lock" => Code::CapsLock,
        _ => Code::KeyD,
    };

    Some(Shortcut::new(if mods.is_empty() { None } else { Some(mods) }, code))
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    let state = app.state::<AppState>();
                    let mode = {
                        state.dictation_mode.lock().map(|g| g.clone()).unwrap_or_else(|_| "interactive".to_string())
                    };

                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            if mode != "push_to_talk" {
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("ui-state", "recording");
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let state = handle.state::<AppState>();
                                let _ = start_recording(handle.clone(), state).await;
                            });
                        }
                    } else if event.state() == ShortcutState::Released {
                        if mode == "push_to_talk" {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = app.emit("ui-state", "processing");
                                let handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let state = handle.state::<AppState>();
                                    // Wait briefly if recording is still starting
                                    let mut attempts = 0;
                                    while !state.is_recording.load(Ordering::SeqCst) && attempts < 10 {
                                        tokio::time::sleep(tokio::time::Duration::from_millis(30)).await;
                                        attempts += 1;
                                    }

                                    if state.is_recording.load(Ordering::SeqCst) {
                                        if let Ok(transcript) = stop_recording_and_process(state).await {
                                            let text = transcript.trim().to_string();
                                            let _ = window.hide();
                                            if commands::is_meaningful_speech(&text) {
                                                let _ = tokio::task::spawn_blocking(move || {
                                                    let _ = copy_and_inject_text(&text);
                                                }).await;
                                            }
                                        } else {
                                            let _ = window.hide();
                                        }
                                    } else {
                                        let _ = window.hide();
                                    }
                                });
                            }
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

            // Load Saved Audio Device
            let saved_dev = commands::get_saved_device_str();
            if let Ok(mut guard) = app.state::<AppState>().selected_audio_device.lock() {
                *guard = saved_dev;
            }

            // Load Saved System Prompt
            let saved_prompt = commands::get_saved_system_prompt_str();
            if let Ok(mut guard) = app.state::<AppState>().system_prompt.lock() {
                *guard = saved_prompt;
            }

            // Load Saved Dictation Mode
            let saved_mode = commands::get_saved_mode_str();
            if let Ok(mut guard) = app.state::<AppState>().dictation_mode.lock() {
                *guard = saved_mode;
            }

            // Register Saved Global Hotkey (defaults to ScrollLock if not set)
            let saved_hk = commands::get_saved_hotkey_str();
            if let Some(shortcut) = parse_shortcut_str(&saved_hk) {
                let _ = app.global_shortcut().register(shortcut);
            }

            // Configure Tray Menu
            let dashboard_i = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Rusper", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&dashboard_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "dashboard" => {
                        if let Some(window) = app.get_webview_window("dashboard") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
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
            save_api_key,
            get_saved_hotkey,
            register_hotkey,
            set_overlay_position,
            get_dictation_mode,
            set_dictation_mode,
            get_system_prompt,
            save_system_prompt,
            validate_active_text_field,
            undo_last_injection,
            get_audio_devices,
            get_selected_audio_device,
            set_selected_audio_device,
            start_mic_test,
            stop_mic_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
