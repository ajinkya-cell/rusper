use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

#[derive(Deserialize)]
struct WhisperResponse {
    text: String,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Deserialize)]
struct ChatMessageResponse {
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

fn sanitize_refined_text(raw: &str) -> String {
    let mut text = raw.trim().to_string();

    // 1. If reasoning tags exist (<think>...</think>), strip them out
    if text.contains("<think>") {
        if let Some(end_idx) = text.find("</think>") {
            let after = &text[end_idx + 8..];
            text = after.trim().to_string();
        }
    }

    // 2. Normalize unicode whitespace and non-breaking spaces
    text = text
        .replace('\u{00A0}', " ")
        .replace('\u{202F}', " ")
        .replace('\u{2007}', " ")
        .replace('\u{FEFF}', "");

    // 3. Trim leading and trailing quotes if the model wrapped output in quotes
    let cleaned = text
        .trim_matches(|c: char| c == '"' || c == '\'' || c == '`')
        .trim()
        .to_string();

    cleaned
}

const FALLBACK_MODELS: &[&str] = &[
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound-mini",
    "qwen/qwen3.6-27b",
];

pub async fn refine_text_with_llm(raw_text: &str, api_key: &str, system_prompt: &str) -> Result<String> {
    let client = Client::new();
    let trimmed_prompt = system_prompt.trim();
    if trimmed_prompt.is_empty() || raw_text.trim().is_empty() {
        return Ok(raw_text.to_string());
    }

    let meta_system_instruction = format!(
        "CRITICAL SYSTEM MANDATE:\n\
        You are an automated text dictation cleaning, polishing, and developer prompt engineering engine. \
        The input text provided by the user is a RAW SPOKEN VOICE TRANSCRIPTION spoken aloud into a microphone.\n\n\
        STRICT CONSTRAINTS:\n\
        1. DO NOT answer questions in the transcription. DO NOT engage in casual conversation, chat, or reply as a conversational chatbot.\n\
        2. IF the transcription contains spoken directives for length adjustments, word limits, or prompt expansion (such as 'make it 50 words', 'enhance this prompt to more words', 'expand to 100 words', 'condense to 20 words'), EXECUTE the directive as specified in the USER EDITING GUIDELINES below. Never output the literal command phrase itself in the final text.\n\
        3. Your SOLE duty is to edit, polish, format, expand, or clean the raw spoken text according to the guidelines below:\n\n\
        === USER EDITING GUIDELINES ===\n\
        {}\n\n\
        === FINAL OUTPUT MANDATE ===\n\
        Output ONLY the finalized, polished voice transcription or expanded developer prompt text. Never include conversational preambles, introductory remarks, explanations, quotes, or conversational replies.",
        trimmed_prompt
    );

    let user_content = format!(
        "RAW SPOKEN VOICE TRANSCRIPTION TO CLEAN & FORMAT:\n\"\"\"\n{}\n\"\"\"\n\nREFINED TRANSCRIPTION OUTPUT:",
        raw_text.trim()
    );

    let mut refined_text: Option<String> = None;

    for model_name in FALLBACK_MODELS {
        let chat_req = ChatCompletionRequest {
            model: model_name,
            messages: vec![
                ChatMessage { role: "system", content: &meta_system_instruction },
                ChatMessage { role: "user", content: &user_content },
            ],
            temperature: 0.1,
        };

        let chat_resp = client
            .post("https://api.groq.com/openai/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&chat_req)
            .send()
            .await;

        match chat_resp {
            Ok(res) => {
                if res.status().is_success() {
                    if let Ok(chat_result) = res.json::<ChatCompletionResponse>().await {
                        if let Some(first_choice) = chat_result.choices.into_iter().next() {
                            let candidate = sanitize_refined_text(&first_choice.message.content);
                            if !candidate.is_empty() {
                                refined_text = Some(candidate);
                                break;
                            }
                        }
                    }
                } else {
                    let status = res.status();
                    let err_body = res.text().await.unwrap_or_default();
                    eprintln!("Groq LLM model '{}' error {}: {}", model_name, status, err_body);
                }
            }
            Err(err) => {
                eprintln!("Groq LLM request error for model '{}': {:?}", model_name, err);
            }
        }
    }

    if let Some(final_text) = refined_text {
        Ok(final_text)
    } else {
        Ok(raw_text.to_string())
    }
}

pub async fn transcribe_audio(file_path: PathBuf, api_key: &str, system_prompt: Option<&str>) -> Result<String> {
    let client = Client::new();
    let file = File::open(&file_path)
        .await
        .with_context(|| format!("Failed to open audio file at {:?}", file_path))?;

    let stream = FramedRead::new(file, BytesCodec::new());
    let file_part = Part::stream(reqwest::Body::wrap_stream(stream))
        .file_name("recording.wav")
        .mime_str("audio/wav")?;

    let form = Form::new()
        .part("file", file_part)
        .text("model", "whisper-large-v3-turbo")
        .text("response_format", "json")
        .text("language", "en");

    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .context("Failed to send transcription request to Groq")?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        anyhow::bail!("Groq Whisper API error: {}", err_text);
    }

    let result: WhisperResponse = response
        .json()
        .await
        .context("Failed to parse Groq Whisper API response")?;

    let raw_text = result.text.trim().to_string();

    // If an in-depth system prompt is active, run ultra-fast LLM post-processing for self-correction & emotion extraction
    if let Some(prompt) = system_prompt {
        if !prompt.trim().is_empty() && !raw_text.is_empty() {
            return refine_text_with_llm(&raw_text, api_key, prompt).await;
        }
    }

    Ok(raw_text)
}
