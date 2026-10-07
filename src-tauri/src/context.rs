use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppContextInfo {
    pub process_name: String,
    pub window_title: String,
    pub app_category: String, // "terminal", "code", "email", "chat", "document", "general"
    pub context_summary: String,
}

impl Default for AppContextInfo {
    fn default() -> Self {
        Self {
            process_name: "unknown".to_string(),
            window_title: String::new(),
            app_category: "general".to_string(),
            context_summary: "Standard General Context".to_string(),
        }
    }
}

pub fn get_active_app_context() -> AppContextInfo {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, HWND, MAX_PATH};
        use windows_sys::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd == 0 {
                return AppContextInfo::default();
            }

            // 1. Extract Window Title
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            let window_title = if title_len > 0 {
                String::from_utf16_lossy(&title_buf[..title_len as usize]).trim().to_string()
            } else {
                String::new()
            };

            // 2. Extract Process ID and Executable Name
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);

            let mut process_name = "unknown".to_string();
            if pid != 0 {
                let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                if process_handle != 0 {
                    let mut path_buf = [0u16; MAX_PATH as usize * 2];
                    let mut path_len = path_buf.len() as u32;
                    if QueryFullProcessImageNameW(process_handle, 0, path_buf.as_mut_ptr(), &mut path_len) != 0 {
                        let full_path = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                        if let Some(filename) = Path::new(&full_path).file_name().and_then(|f| f.to_str()) {
                            process_name = filename.to_lowercase();
                        }
                    }
                    CloseHandle(process_handle);
                }
            }

            classify_context(&process_name, &window_title)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        AppContextInfo::default()
    }
}

pub fn classify_context(process_name: &str, window_title: &str) -> AppContextInfo {
    let proc_lower = process_name.to_lowercase();
    let title_lower = window_title.to_lowercase();

    // 1. Terminal / Shell / CLI
    let is_terminal = [
        "windowsterminal.exe", "wt.exe", "powershell.exe", "pwsh.exe", "cmd.exe",
        "alacritty.exe", "wezterm-gui.exe", "wezterm.exe", "mintty.exe", "bash.exe",
        "wsl.exe", "warp.exe", "hyper.exe", "kitty.exe", "git-bash.exe", "tabby.exe",
    ].iter().any(|&t| proc_lower == t)
        || title_lower.contains("powershell")
        || title_lower.contains("command prompt")
        || title_lower.contains("bash")
        || title_lower.contains("terminal");

    if is_terminal {
        return AppContextInfo {
            process_name: proc_lower,
            window_title: window_title.to_string(),
            app_category: "terminal".to_string(),
            context_summary: "Terminal / Command-Line Interface (Preserve flags, shell commands, and syntax)".to_string(),
        };
    }

    // 2. Code Editor / IDE
    let is_code = [
        "code.exe", "cursor.exe", "devenv.exe", "idea64.exe", "pycharm64.exe",
        "webstorm64.exe", "clion64.exe", "goland64.exe", "rustrover64.exe",
        "sublime_text.exe", "notepad++.exe", "atom.exe", "zed.exe", "neovide.exe",
    ].iter().any(|&c| proc_lower == c)
        || title_lower.contains("visual studio code")
        || title_lower.contains("cursor")
        || title_lower.contains(".rs")
        || title_lower.contains(".ts")
        || title_lower.contains(".tsx")
        || title_lower.contains(".py")
        || title_lower.contains(".js");

    if is_code {
        return AppContextInfo {
            process_name: proc_lower,
            window_title: window_title.to_string(),
            app_category: "code".to_string(),
            context_summary: "Code Editor / IDE (Preserve camelCase, snake_case, identifiers, and backticks)".to_string(),
        };
    }

    // 3. Email & Workplace Messaging
    let is_email = [
        "outlook.exe", "thunderbird.exe", "mailspring.exe", "superhuman.exe",
    ].iter().any(|&e| proc_lower == e)
        || title_lower.contains("gmail")
        || title_lower.contains("outlook")
        || title_lower.contains("inbox")
        || title_lower.contains("compose")
        || title_lower.contains("draft");

    if is_email {
        return AppContextInfo {
            process_name: proc_lower,
            window_title: window_title.to_string(),
            app_category: "email".to_string(),
            context_summary: "Email Client / Formal Communication (Structure into clear professional paragraphs)".to_string(),
        };
    }

    // 4. Chat & Quick Collaboration
    let is_chat = [
        "slack.exe", "discord.exe", "teams.exe", "telegram.exe", "whatsapp.exe",
        "signal.exe", "mattermost.exe", "element.exe", "skype.exe",
    ].iter().any(|&c| proc_lower == c)
        || title_lower.contains("slack")
        || title_lower.contains("discord")
        || title_lower.contains("teams")
        || title_lower.contains("chat");

    if is_chat {
        return AppContextInfo {
            process_name: proc_lower,
            window_title: window_title.to_string(),
            app_category: "chat".to_string(),
            context_summary: "Chat & Quick Messaging (Conversational, concise, punchy sentences)".to_string(),
        };
    }

    // 5. Rich Document / Notes / Wiki
    let is_doc = [
        "winword.exe", "wordpad.exe", "notion.exe", "obsidian.exe", "onenote.exe",
        "evernote.exe", "logseq.exe", "typora.exe", "acrobat.exe",
    ].iter().any(|&d| proc_lower == d)
        || title_lower.contains("google docs")
        || title_lower.contains("notion")
        || title_lower.contains("obsidian")
        || title_lower.contains("confluence")
        || title_lower.contains("document")
        || title_lower.contains("notes");

    if is_doc {
        return AppContextInfo {
            process_name: proc_lower,
            window_title: window_title.to_string(),
            app_category: "document".to_string(),
            context_summary: "Document & Notes (Publication prose, rich formatting, clear paragraphs)".to_string(),
        };
    }

    // Default General
    AppContextInfo {
        process_name: proc_lower,
        window_title: window_title.to_string(),
        app_category: "general".to_string(),
        context_summary: "General Application".to_string(),
    }
}
