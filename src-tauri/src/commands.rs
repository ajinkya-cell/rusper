use crate::audio::AudioRecorder;
use crate::groq::transcribe_audio;
use crate::injector::copy_and_inject_text;
use crate::state::AppState;
use std::sync::{atomic::Ordering, Mutex};
use tauri::{AppHandle, State, Window};

static ACTIVE_RECORDER: Mutex<Option<AudioRecorder>> = Mutex::new(None);

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

    // Read API key from environment variable
    let api_key = std::env::var("GROQ_API_KEY")
        .map_err(|_| "GROQ_API_KEY environment variable not set".to_string())?;

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
