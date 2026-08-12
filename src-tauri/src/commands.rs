use crate::audio::AudioRecorder;
use crate::groq::transcribe_audio;
use crate::injector::copy_and_inject_text;
use crate::parse_shortcut_str;
use crate::state::AppState;
use std::sync::{atomic::Ordering, Mutex};
use tauri::{AppHandle, Manager, State, Window};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

static ACTIVE_RECORDER: Mutex<Option<AudioRecorder>> = Mutex::new(None);

fn sanitize_key(raw: &str) -> Option<String> {
    let cleaned = raw
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if !cleaned.is_empty() && cleaned.starts_with("gsk_") {
        Some(cleaned)
    } else {
        None
    }
}

fn get_saved_api_key() -> Option<String> {
    let key_file = std::env::temp_dir().join("flow_dictate_key.txt");
    if let Ok(content) = std::fs::read_to_string(&key_file) {
        if let Some(valid_key) = sanitize_key(&content) {
            return Some(valid_key);
        }
    }
    std::env::var("GROQ_API_KEY").ok().and_then(|k| sanitize_key(&k))
}

fn save_api_key_to_disk(key: &str) -> Result<(), String> {
    let key_file = std::env::temp_dir().join("flow_dictate_key.txt");
    std::fs::write(&key_file, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Ok(guard) = state.custom_api_key.lock() {
        if let Some(ref key) = *guard {
            if let Some(valid) = sanitize_key(key) {
                return Ok(Some(valid));
            }
        }
    }
    let disk_key = get_saved_api_key();
    if let Some(ref k) = disk_key {
        if let Ok(mut guard) = state.custom_api_key.lock() {
            *guard = Some(k.clone());
        }
    }
    Ok(disk_key)
}

#[tauri::command]
pub async fn save_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let trimmed = key.trim().trim_matches('"').trim_matches('\'').trim().to_string();
    if !trimmed.starts_with("gsk_") {
        return Err("API key must begin with 'gsk_'".to_string());
    }
    save_api_key_to_disk(&trimmed)?;
    if let Ok(mut guard) = state.custom_api_key.lock() {
        *guard = Some(trimmed);
    }
    Ok(())
}

#[tauri::command]
pub async fn register_hotkey(app: AppHandle, hotkey: String) -> Result<(), String> {
    let shortcut = parse_shortcut_str(&hotkey).ok_or_else(|| "Invalid shortcut combination".to_string())?;
    let _ = app.global_shortcut().unregister_all();
    app.global_shortcut().register(shortcut).map_err(|e| format!("Failed to register OS hotkey: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn set_overlay_position(app: AppHandle, position: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or_else(|| "Main window not found".to_string())?;
    let monitor = window.primary_monitor().map_err(|e| e.to_string())?.ok_or_else(|| "Primary monitor not found".to_string())?;

    let monitor_size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let window_width = (360.0 * scale_factor) as u32;
    let window_height = (200.0 * scale_factor) as u32;

    let (x, y) = match position.as_str() {
        "bottom-right" => (
            monitor_size.width as i32 - window_width as i32 - (40.0 * scale_factor) as i32,
            monitor_size.height as i32 - window_height as i32 - (85.0 * scale_factor) as i32,
        ),
        "top-right" => (
            monitor_size.width as i32 - window_width as i32 - (40.0 * scale_factor) as i32,
            (40.0 * scale_factor) as i32,
        ),
        "center" => (
            (monitor_size.width as i32 - window_width as i32) / 2,
            (monitor_size.height as i32 - window_height as i32) / 2,
        ),
        _ => ( // "bottom-center"
            (monitor_size.width as i32 - window_width as i32) / 2,
            monitor_size.height as i32 - window_height as i32 - (85.0 * scale_factor) as i32,
        ),
    };

    window.set_position(tauri::PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_recording(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.is_recording.load(Ordering::SeqCst) {
        return Ok(());
    }

    let (recorder, _) = AudioRecorder::new(app_handle)?;
    let mut guard = ACTIVE_RECORDER
        .lock()
        .map_err(|_| "Failed to lock active recorder mutex".to_string())?;

    *guard = Some(recorder);
    state.is_recording.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn stop_recording_and_process(
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !state.is_recording.load(Ordering::SeqCst) {
        return Err("Not currently recording".to_string());
    }

    let recorder = ACTIVE_RECORDER
        .lock()
        .map_err(|_| "Mutex error")?
        .take()
        .ok_or_else(|| "No active recorder found".to_string())?;

    let audio_path = recorder.stop();
    state.is_recording.store(false, Ordering::SeqCst);

    let api_key = {
        let memory_key = state.custom_api_key.lock().ok().and_then(|g| g.clone()).and_then(|k| sanitize_key(&k));
        memory_key.or_else(get_saved_api_key).ok_or_else(|| {
            "Groq API key not found or invalid. Please check Settings to configure your API key.".to_string()
        })?
    };

    let transcript = transcribe_audio(audio_path, &api_key)
        .await
        .map_err(|e| format!("Transcription failed: {:#}", e))?;

    if let Ok(mut last) = state.last_transcription.lock() {
        *last = transcript.clone();
    }

    Ok(transcript)
}

#[tauri::command]
pub async fn accept_text(window: Window, state: State<'_, AppState>) -> Result<(), String> {
    let text = state
        .last_transcription
        .lock()
        .map_err(|_| "Mutex error")?
        .clone();
    let _ = window.hide();

    tokio::task::spawn_blocking(move || {
        let _ = copy_and_inject_text(&text);
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_popover(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}
