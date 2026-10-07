use arboard::Clipboard;
use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetForegroundWindow, SetForegroundWindow,
};

use std::sync::atomic::{AtomicIsize, Ordering};

static LAST_TARGET_HWND: AtomicIsize = AtomicIsize::new(0);

pub fn save_active_foreground_window() {
    #[cfg(target_os = "windows")]
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd != 0 {
            LAST_TARGET_HWND.store(hwnd, Ordering::SeqCst);
        }
    }
}

pub fn restore_active_foreground_window() {
    #[cfg(target_os = "windows")]
    unsafe {
        let hwnd = LAST_TARGET_HWND.load(Ordering::SeqCst);
        if hwnd != 0 {
            let hwnd_val = hwnd as HWND;
            let _ = BringWindowToTop(hwnd_val);
            let _ = SetForegroundWindow(hwnd_val);
        }
    }
}

#[cfg(target_os = "windows")]
fn create_keyup_input(vk: u16) -> INPUT {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{MapVirtualKeyW, KEYEVENTF_KEYUP};
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: unsafe { MapVirtualKeyW(vk as u32, 0) as u16 },
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
pub fn simulate_paste() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, MapVirtualKeyW, KEYEVENTF_KEYUP, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_SPACE,
    };

    unsafe {
        let mut inputs: Vec<INPUT> = Vec::with_capacity(32);

        // 1. Release any physically held keys that could interfere with Ctrl+V
        let is_space_down = (GetAsyncKeyState(VK_SPACE as i32) as u16 & 0x8000) != 0;
        let is_shift_down = (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0;
        let is_alt_down = (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0;
        let is_win_down = ((GetAsyncKeyState(VK_LWIN as i32) as u16 & 0x8000) != 0) || ((GetAsyncKeyState(VK_RWIN as i32) as u16 & 0x8000) != 0);

        if is_space_down {
            inputs.push(create_keyup_input(VK_SPACE));
        }
        if is_shift_down {
            inputs.push(create_keyup_input(VK_SHIFT));
        }
        if is_alt_down {
            inputs.push(create_keyup_input(VK_MENU));
        }
        if is_win_down {
            inputs.push(create_keyup_input(VK_LWIN));
            inputs.push(create_keyup_input(VK_RWIN));
        }
        for vk in (b'A' as u16)..=(b'Z' as u16) {
            if (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 {
                inputs.push(create_keyup_input(vk));
            }
        }

        if !inputs.is_empty() {
            SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
            inputs.clear();
            thread::sleep(Duration::from_millis(5));
        }

        let v_vk = b'V' as u16;
        let v_scan = MapVirtualKeyW(v_vk as u32, 0) as u16;
        let ctrl_scan = MapVirtualKeyW(VK_CONTROL as u32, 0) as u16;

        // 1. Ctrl Down
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL,
                    wScan: ctrl_scan,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        // 2. V Down
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: v_vk,
                    wScan: v_scan,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        // 3. V Up
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: v_vk,
                    wScan: v_scan,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        // 4. Ctrl Up
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL,
                    wScan: ctrl_scan,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });

        let sent = SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );

        if sent != inputs.len() as u32 {
            return Err("Failed to send paste keystrokes via SendInput".to_string());
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn simulate_undo() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, KEYEVENTF_KEYUP, VK_CONTROL,
    };

    unsafe {
        let z_vk = b'Z' as u16;
        let z_scan = MapVirtualKeyW(z_vk as u32, 0) as u16;
        let ctrl_scan = MapVirtualKeyW(VK_CONTROL as u32, 0) as u16;

        let mut inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: ctrl_scan,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: z_vk,
                        wScan: z_scan,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: z_vk,
                        wScan: z_scan,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: ctrl_scan,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];

        let sent = SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );

        if sent != inputs.len() as u32 {
            return Err("Failed to send undo keystrokes via SendInput".to_string());
        }
    }
    Ok(())
}

pub fn copy_and_inject_text(text: &str) -> Result<(), String> {
    // 1. Copy to OS Clipboard
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    clipboard.set_text(text).map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // 2. Restore active window focus
    restore_active_foreground_window();

    // 3. Short sleep to allow OS window focus transition
    thread::sleep(Duration::from_millis(60));

    // 4. Native Paste keystroke
    #[cfg(target_os = "windows")]
    {
        simulate_paste()?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init error: {:?}", e))?;
        #[cfg(target_os = "macos")]
        let modifier = Key::Meta;
        #[cfg(not(target_os = "macos"))]
        let modifier = Key::Control;

        let _ = enigo.key(modifier, Direction::Press);
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        let _ = enigo.key(modifier, Direction::Release);
    }

    Ok(())
}


