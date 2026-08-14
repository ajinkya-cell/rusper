use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Default)]
pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub current_audio_path: Arc<Mutex<Option<String>>>,
    pub last_transcription: Arc<Mutex<String>>,
    pub custom_api_key: Arc<Mutex<Option<String>>>,
    pub dictation_mode: Arc<Mutex<String>>,
    pub system_prompt: Arc<Mutex<String>>,
    pub selected_audio_device: Arc<Mutex<Option<String>>>,
}
