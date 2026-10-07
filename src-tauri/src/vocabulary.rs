use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabularyEntry {
    pub id: String,
    pub word: String,
    pub category: Option<String>,
    pub sounds_like: Option<String>,
    pub enabled: bool,
}

pub fn get_vocabulary_file_path() -> PathBuf {
    crate::commands::get_config_dir().join("flow_dictate_vocabulary.json")
}

pub fn get_default_entries() -> Vec<VocabularyEntry> {
    vec![
        VocabularyEntry {
            id: "rusper".to_string(),
            word: "Rusper".to_string(),
            category: Some("Brand".to_string()),
            sounds_like: Some("Raspur, Raspar, Rosper, Rasper".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "fastapi".to_string(),
            word: "FastAPI".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("fast api".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "typescript".to_string(),
            word: "TypeScript".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("type script".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "postgresql".to_string(),
            word: "PostgreSQL".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("postgres, post gres".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "kubernetes".to_string(),
            word: "Kubernetes".to_string(),
            category: Some("DevOps".to_string()),
            sounds_like: Some("k8s, kube".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "kubectl".to_string(),
            word: "kubectl".to_string(),
            category: Some("DevOps".to_string()),
            sounds_like: Some("kube ctl, kube control, kube cuddle".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "tailwind".to_string(),
            word: "TailwindCSS".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("tailwind, tailwind css".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "oauth2".to_string(),
            word: "OAuth2".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("o auth, oauth 2".to_string()),
            enabled: true,
        },
        VocabularyEntry {
            id: "docker".to_string(),
            word: "Docker".to_string(),
            category: Some("DevOps".to_string()),
            sounds_like: None,
            enabled: true,
        },
        VocabularyEntry {
            id: "github".to_string(),
            word: "GitHub".to_string(),
            category: Some("Tech".to_string()),
            sounds_like: Some("git hub".to_string()),
            enabled: true,
        },
    ]
}

pub fn get_saved_vocabulary() -> Vec<VocabularyEntry> {
    let path = get_vocabulary_file_path();
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(entries) = serde_json::from_str::<Vec<VocabularyEntry>>(&data) {
            if !entries.is_empty() {
                return entries;
            }
        }
    }
    let defaults = get_default_entries();
    let _ = save_vocabulary_to_disk(&defaults);
    defaults
}

pub fn save_vocabulary_to_disk(entries: &[VocabularyEntry]) -> Result<(), String> {
    let path = get_vocabulary_file_path();
    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Failed to serialize vocabulary: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write vocabulary file: {}", e))?;
    Ok(())
}

pub fn get_vocabulary_prompt_keywords() -> String {
    let entries = get_saved_vocabulary();
    let enabled_words: Vec<String> = entries
        .into_iter()
        .filter(|e| e.enabled)
        .map(|e| e.word)
        .collect();

    if enabled_words.is_empty() {
        return "Rusper, Whisper, Groq, AI, Windows OS.".to_string();
    }

    // Limit keywords for Whisper prompt (max ~200 chars)
    let joined = enabled_words.join(", ");
    if joined.len() > 220 {
        format!("{}, Rusper, Whisper, Groq", &joined[..200])
    } else {
        format!("{}, Rusper, Whisper, Groq", joined)
    }
}

pub fn apply_vocabulary_replacements(text: &str) -> String {
    let mut result = text.to_string();
    let entries = get_saved_vocabulary();

    for entry in entries {
        if !entry.enabled {
            continue;
        }

        // 1. Match phonetic aliases and sound-alikes if present
        if let Some(ref sounds_like) = entry.sounds_like {
            let aliases: Vec<&str> = sounds_like.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            for alias in aliases {
                let pattern = format!(r"(?i)\b{}\b", regex::escape(alias));
                if let Ok(re) = regex::Regex::new(&pattern) {
                    result = re.replace_all(&result, entry.word.as_str()).to_string();
                }
            }
        }

        // 2. Enforce exact casing for the target word
        let pattern = format!(r"(?i)\b{}\b", regex::escape(&entry.word));
        if let Ok(re) = regex::Regex::new(&pattern) {
            result = re.replace_all(&result, entry.word.as_str()).to_string();
        }
    }

    result
}
