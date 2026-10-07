pub mod audio;
pub mod commands;
pub mod context;
pub mod groq;
pub mod injector;
pub mod state;
pub mod vocabulary;

use commands::*;
use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::Instant;
use crate::injector::copy_and_inject_text;

static RECORDING_START_INSTANT: Mutex<Option<Instant>> = Mutex::new(None);

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
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" | "digit0" => Code::Digit0,
        "1" | "digit1" => Code::Digit1,
        "2" | "digit2" => Code::Digit2,
        "3" | "digit3" => Code::Digit3,
        "4" | "digit4" => Code::Digit4,
        "5" | "digit5" => Code::Digit5,
        "6" | "digit6" => Code::Digit6,
        "7" | "digit7" => Code::Digit7,
        "8" | "digit8" => Code::Digit8,
        "9" | "digit9" => Code::Digit9,
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
        "delete" => Code::Delete,
        "home" => Code::Home,
        "end" => Code::End,
        "pageup" | "page_up" => Code::PageUp,
        "pagedown" | "page_down" => Code::PageDown,
        "capslock" | "caps_lock" => Code::CapsLock,
        "numlock" | "num_lock" => Code::NumLock,
        "printscreen" | "print_screen" => Code::PrintScreen,
        "backquote" | "grave" | "`" | "~" => Code::Backquote,
        _ => Code::KeyD,
    };

    Some(Shortcut::new(if mods.is_empty() { None } else { Some(mods) }, code))
}

pub fn run() {
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    let state = app.state::<AppState>();
                    let mode = {
                        state.dictation_mode.lock().map(|g| g.clone()).unwrap_or_else(|_| "interactive".to_string())
                    };

                    if event.state() == ShortcutState::Pressed {
                        // Check if API key is configured
                        let has_api_key = {
                            let guard = state.custom_api_key.lock().ok().and_then(|g| g.clone());
                            guard.or_else(commands::get_saved_api_key).is_some()
                        };

                        if !has_api_key {
                            if let Some(dashboard_window) = app.get_webview_window("dashboard") {
                                let _ = dashboard_window.show();
                                let _ = dashboard_window.set_focus();
                            }
                            return;
                        }

                        let is_currently_recording = state.is_recording.load(Ordering::SeqCst);

                        if mode == "push_to_talk" {
                            if is_currently_recording {
                                // Ignore Windows keyboard auto-repeat while key is held down
                                return;
                            }

                            // Mark recording active immediately to prevent key repeat bursts
                            state.is_recording.store(true, Ordering::SeqCst);
                            if let Ok(mut guard) = RECORDING_START_INSTANT.lock() {
                                *guard = Some(Instant::now());
                            }

                            // Save target window before showing overlay
                            crate::injector::save_active_foreground_window();

                            // Capture active app context if enabled
                            if state.context_aware_enabled.load(Ordering::SeqCst) {
                                let ctx = crate::context::get_active_app_context();
                                if let Ok(mut guard) = state.active_app_context.lock() {
                                    *guard = Some(ctx);
                                }
                            }

                            if let Some(window) = app.get_webview_window("main") {
                                commands::apply_pure_window_attributes(&window);
                                let handle_sz = app.clone();
                                let mode_sz = mode.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = commands::sync_window_size(handle_sz, mode_sz).await;
                                });
                                let _ = window.show();
                                commands::apply_pure_window_attributes(&window);
                                let _ = app.emit("ui-state", "recording");
                                let handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let state = handle.state::<AppState>();
                                    if let Err(e) = start_recording(handle.clone(), state.clone()).await {
                                        eprintln!("Start recording error: {}", e);
                                        state.is_recording.store(false, Ordering::SeqCst);
                                    }
                                });
                            }
                        } else {
                            // Interactive Mode (Toggle-To-Start / Toggle-To-Stop)
                            if is_currently_recording {
                                // Ignore auto-repeat key burst when pressing hotkey (debounce threshold 400ms)
                                if let Ok(guard) = RECORDING_START_INSTANT.lock() {
                                    if let Some(start_time) = *guard {
                                        if start_time.elapsed() < std::time::Duration::from_millis(400) {
                                            return;
                                        }
                                    }
                                }

                                let _ = app.emit("ui-state", "processing");
                                let handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let state = handle.state::<AppState>();
                                    match stop_recording_and_process(state).await {
                                        Ok(transcript) => {
                                            let _ = handle.emit("transcription-result", transcript);
                                        }
                                        Err(e) => {
                                            let _ = handle.emit("transcription-error", e);
                                        }
                                    }
                                });
                                return;
                            }

                            state.is_recording.store(true, Ordering::SeqCst);
                            if let Ok(mut guard) = RECORDING_START_INSTANT.lock() {
                                *guard = Some(Instant::now());
                            }
                            crate::injector::save_active_foreground_window();

                            if state.context_aware_enabled.load(Ordering::SeqCst) {
                                let ctx = crate::context::get_active_app_context();
                                if let Ok(mut guard) = state.active_app_context.lock() {
                                    *guard = Some(ctx);
                                }
                            }

                            if let Some(window) = app.get_webview_window("main") {
                                commands::apply_pure_window_attributes(&window);
                                let handle_sz = app.clone();
                                let mode_sz = mode.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = commands::sync_window_size(handle_sz, mode_sz).await;
                                });
                                let _ = window.show();
                                commands::apply_pure_window_attributes(&window);
                                let _ = app.emit("ui-state", "recording");
                                let handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let state = handle.state::<AppState>();
                                    if let Err(e) = start_recording(handle.clone(), state.clone()).await {
                                        eprintln!("Start recording error: {}", e);
                                        state.is_recording.store(false, Ordering::SeqCst);
                                    }
                                });
                            }
                        }
                    } else if event.state() == ShortcutState::Released {
                        if mode == "push_to_talk" {
                            if state.is_recording.load(Ordering::SeqCst) {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = app.emit("ui-state", "processing");
                                    let handle = app.clone();
                                    tauri::async_runtime::spawn(async move {
                                        let state = handle.state::<AppState>();
                                        
                                        // Wait briefly if recording stream is still initializing
                                        let mut attempts = 0;
                                        while attempts < 15 {
                                            if crate::commands::has_active_recorder() {
                                                break;
                                            }
                                            tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
                                            attempts += 1;
                                        }

                                        match stop_recording_and_process(state).await {
                                            Ok(transcript) => {
                                                let text = transcript.trim().to_string();
                                                if commands::is_meaningful_speech(&text) {
                                                    let _ = tokio::task::spawn_blocking(move || {
                                                        let _ = copy_and_inject_text(&text);
                                                    }).await;
                                                }
                                            }
                                            Err(err) => {
                                                eprintln!("Processing error on shortcut release: {}", err);
                                            }
                                        }
                                        // Smooth transition delay before hiding capsule
                                        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                                        let _ = window.hide();
                                    });
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Load Saved API Key
            if let Some(key) = commands::get_saved_api_key() {
                if let Ok(mut guard) = app.state::<AppState>().custom_api_key.lock() {
                    *guard = Some(key);
                }
            }

            // Load Saved Dictation Mode
            let saved_mode = commands::get_saved_mode_str();
            if let Ok(mut guard) = app.state::<AppState>().dictation_mode.lock() {
                *guard = saved_mode.clone();
            }

            // Dynamic Window Size & Position based on dictation mode and saved overlay position
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
                commands::apply_pure_window_attributes(&window);
                let handle = app.handle().clone();
                let mode_clone = saved_mode.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = commands::sync_window_size(handle, mode_clone).await;
                });
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

            // Load Context Awareness Setting
            let context_file = commands::get_config_dir().join("flow_dictate_context_aware.txt");
            if let Ok(c) = std::fs::read_to_string(&context_file) {
                if c.trim() == "false" {
                    app.state::<AppState>().context_aware_enabled.store(false, Ordering::SeqCst);
                }
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

            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
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
            get_overlay_position,
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
            stop_mic_test,
            sync_window_size,
            open_external_url,
            test_prompt_expansion,
            get_custom_vocabulary,
            save_custom_vocabulary,
            add_vocabulary_entry,
            delete_vocabulary_entry,
            import_vocabulary_preset,
            get_active_context_preview,
            set_context_aware_enabled,
            get_context_aware_enabled
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
