use std::sync::{atomic::AtomicBool, Arc, Mutex};
use crate::context::AppContextInfo;

#[derive(Clone)]
pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub current_audio_path: Arc<Mutex<Option<String>>>,
    pub last_transcription: Arc<Mutex<String>>,
    pub custom_api_key: Arc<Mutex<Option<String>>>,
    pub dictation_mode: Arc<Mutex<String>>,
    pub system_prompt: Arc<Mutex<String>>,
    pub selected_audio_device: Arc<Mutex<Option<String>>>,
    pub active_app_context: Arc<Mutex<Option<AppContextInfo>>>,
    pub context_aware_enabled: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            current_audio_path: Arc::new(Mutex::new(None)),
            last_transcription: Arc::new(Mutex::new(String::new())),
            custom_api_key: Arc::new(Mutex::new(None)),
            dictation_mode: Arc::new(Mutex::new("interactive".to_string())),
            system_prompt: Arc::new(Mutex::new(String::new())),
            selected_audio_device: Arc::new(Mutex::new(None)),
            active_app_context: Arc::new(Mutex::new(None)),
            context_aware_enabled: Arc::new(AtomicBool::new(true)),
        }
    }
}

