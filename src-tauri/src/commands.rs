use crate::audio::AudioRecorder;
use crate::groq::transcribe_audio;
use crate::injector::copy_and_inject_text;
use crate::state::AppState;
use std::sync::{atomic::Ordering, Mutex};
use tauri::{AppHandle, State, Window};

static ACTIVE_RECORDER: Mutex<Option<AudioRecorder>> = Mutex::new(None);

fn get_saved_api_key() -> Option<String> {
    let key_file = std::env::temp_dir().join("flow_dictate_key.txt");
    if let Ok(content) = std::fs::read_to_string(&key_file) {
        let trimmed = content.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    std::env::var("GROQ_API_KEY").ok().filter(|k| !k.trim().is_empty())
}

fn save_api_key_to_disk(key: &str) -> Result<(), String> {
    let key_file = std::env::temp_dir().join("flow_dictate_key.txt");
    std::fs::write(&key_file, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Ok(guard) = state.custom_api_key.lock() {
        if let Some(ref key) = *guard {
            return Ok(Some(key.clone()));
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
    let trimmed = key.trim().to_string();
    save_api_key_to_disk(&trimmed)?;
    if let Ok(mut guard) = state.custom_api_key.lock() {
        *guard = Some(trimmed);
    }
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
        let memory_key = state.custom_api_key.lock().ok().and_then(|g| g.clone());
        memory_key.or_else(get_saved_api_key).ok_or_else(|| {
            "Groq API key not found. Please click Settings to configure your API key.".to_string()
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
