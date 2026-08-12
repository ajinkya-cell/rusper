use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub fn copy_and_inject_text(text: &str) -> Result<(), String> {
    // 1. Copy to OS Clipboard
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    clipboard.set_text(text).map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // 2. Short sleep to allow UI focus shift back to targeted window
    thread::sleep(Duration::from_millis(100));

    // 3. Simulate Ctrl+V Keystroke
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init error: {:?}", e))?;
    
    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    let _ = enigo.key(modifier, Direction::Press);
    let _ = enigo.key(Key::Unicode('v'), Direction::Click);
    let _ = enigo.key(modifier, Direction::Release);

    Ok(())
}
