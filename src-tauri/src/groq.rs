use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

#[derive(Deserialize)]
struct WhisperResponse {
    text: String,
}

pub async fn transcribe_audio(file_path: PathBuf, api_key: &str) -> Result<String> {
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
        anyhow::bail!("Groq API error: {}", err_text);
    }

    let result: WhisperResponse = response
        .json()
        .await
        .context("Failed to parse Groq API response")?;

    Ok(result.text.trim().to_string())
}
