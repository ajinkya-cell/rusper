use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Default)]
pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub current_audio_path: Arc<Mutex<Option<String>>>,
    pub last_transcription: Arc<Mutex<String>>,
}
