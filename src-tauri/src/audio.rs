use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub type SharedWriter = Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>;

pub struct AudioRecorder {
    stream: Option<Stream>,
    writer: SharedWriter,
    output_path: PathBuf,
}

unsafe impl Send for AudioRecorder {}
pub fn get_available_devices() -> Vec<String> {
    let host = cpal::default_host();
    let mut names = Vec::new();
    if let Ok(devices) = host.input_devices() {
        for dev in devices {
            if let Ok(name) = dev.name() {
                names.push(name);
            }
        }
    }
    names
}

pub struct MicTestStream {
    _stream: Stream,
}

unsafe impl Send for MicTestStream {}
unsafe impl Sync for MicTestStream {}

static ACTIVE_MIC_TEST: Mutex<Option<MicTestStream>> = Mutex::new(None);

fn calculate_db_normalized_volume(raw_rms: f32) -> f32 {
    if raw_rms <= 0.00001 {
        return 0.0;
    }
    let db = 20.0 * raw_rms.log10();
    let norm = (db + 50.0) / 48.0;
    norm.clamp(0.0, 1.0)
}

pub fn start_mic_test_stream(app_handle: AppHandle, device_name: Option<String>) -> Result<(), String> {
    stop_mic_test_stream();

    let host = cpal::default_host();
    let device = if let Some(ref target) = device_name {
        if target != "default" && !target.trim().is_empty() {
            host.input_devices()
                .ok()
                .and_then(|mut devs| devs.find(|d| d.name().ok().as_ref() == Some(target)))
                .or_else(|| host.default_input_device())
        } else {
            host.default_input_device()
        }
    } else {
        host.default_input_device()
    }.ok_or_else(|| "No audio input device found on your system".to_string())?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config for device: {}", e))?;

    let sample_format = config.sample_format();
    let stream_config: cpal::StreamConfig = config.into();

    let err_fn = |err| eprintln!("Mic test stream error: {:?}", err);
    let last_emit = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let start_instant = std::time::Instant::now();

    let stream = match sample_format {
        SampleFormat::F32 => {
            let le = Arc::clone(&last_emit);
            let handle = app_handle.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    if start_instant.elapsed().as_secs() >= 60 {
                        return;
                    }
                    if !data.is_empty() {
                        let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                        let raw_rms = (sum_sq / data.len() as f32).sqrt();
                        let scaled_rms = calculate_db_normalized_volume(raw_rms);
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        let prev = le.load(std::sync::atomic::Ordering::Relaxed);
                        if now.saturating_sub(prev) >= 28 {
                            le.store(now, std::sync::atomic::Ordering::Relaxed);
                            let _ = handle.emit("test-audio-volume", scaled_rms);
                        }
                    }
                },
                err_fn,
                None,
            )
        },
        SampleFormat::I16 => {
            let le = Arc::clone(&last_emit);
            let handle = app_handle.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    if start_instant.elapsed().as_secs() >= 60 {
                        return;
                    }
                    if !data.is_empty() {
                        let sum_sq: f32 = data.iter().map(|&s| {
                            let f = s as f32 / i16::MAX as f32;
                            f * f
                        }).sum();
                        let raw_rms = (sum_sq / data.len() as f32).sqrt();
                        let scaled_rms = calculate_db_normalized_volume(raw_rms);
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        let prev = le.load(std::sync::atomic::Ordering::Relaxed);
                        if now.saturating_sub(prev) >= 28 {
                            le.store(now, std::sync::atomic::Ordering::Relaxed);
                            let _ = handle.emit("test-audio-volume", scaled_rms);
                        }
                    }
                },
                err_fn,
                None,
            )
        },
        SampleFormat::U16 => {
            let le = Arc::clone(&last_emit);
            let handle = app_handle.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    if start_instant.elapsed().as_secs() >= 60 {
                        return;
                    }
                    if !data.is_empty() {
                        let sum_sq: f32 = data.iter().map(|&s| {
                            let f = (s as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0);
                            f * f
                        }).sum();
                        let raw_rms = (sum_sq / data.len() as f32).sqrt();
                        let scaled_rms = calculate_db_normalized_volume(raw_rms);
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        let prev = le.load(std::sync::atomic::Ordering::Relaxed);
                        if now.saturating_sub(prev) >= 28 {
                            le.store(now, std::sync::atomic::Ordering::Relaxed);
                            let _ = handle.emit("test-audio-volume", scaled_rms);
                        }
                    }
                },
                err_fn,
                None,
            )
        },
        _ => {
            let le = Arc::clone(&last_emit);
            let handle = app_handle.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    if start_instant.elapsed().as_secs() >= 60 {
                        return;
                    }
                    if !data.is_empty() {
                        let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                        let raw_rms = (sum_sq / data.len() as f32).sqrt();
                        let scaled_rms = calculate_db_normalized_volume(raw_rms);
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        let prev = le.load(std::sync::atomic::Ordering::Relaxed);
                        if now.saturating_sub(prev) >= 28 {
                            le.store(now, std::sync::atomic::Ordering::Relaxed);
                            let _ = handle.emit("test-audio-volume", scaled_rms);
                        }
                    }
                },
                err_fn,
                None,
            )
        }
    }.map_err(|e| format!("Failed to build mic test stream: {}", e))?;

    stream.play().map_err(|e| format!("Failed to start mic test stream: {}", e))?;

    if let Ok(mut guard) = ACTIVE_MIC_TEST.lock() {
        *guard = Some(MicTestStream { _stream: stream });
    }

    Ok(())
}

pub fn stop_mic_test_stream() {
    if let Ok(mut guard) = ACTIVE_MIC_TEST.lock() {
        *guard = None;
    }
}

impl AudioRecorder {
    pub fn new(app_handle: AppHandle, device_name: Option<String>) -> Result<(Self, Arc<Mutex<Vec<f32>>>), String> {
        let host = cpal::default_host();
        let device = if let Some(ref target) = device_name {
            host.input_devices()
                .ok()
                .and_then(|mut devs| devs.find(|d| d.name().ok().as_ref() == Some(target)))
                .or_else(|| host.default_input_device())
        } else {
            host.default_input_device()
        }.ok_or_else(|| "No default audio input device found".to_string())?;

        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default input config: {}", e))?;

        let temp_dir = std::env::temp_dir();
        let output_path = temp_dir.join("flow_dictate_recording.wav");

        let spec = WavSpec {
            channels: config.channels(),
            sample_rate: config.sample_rate().0,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let writer = WavWriter::create(&output_path, spec)
            .map_err(|e| format!("Failed to create WAV writer: {}", e))?;
        let writer = Arc::new(Mutex::new(Some(writer)));
        let writer_clone = Arc::clone(&writer);

        let audio_buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
        let buffer_clone = Arc::clone(&audio_buffer);

        let sample_format = config.sample_format();
        let stream_config = config.into();

        let err_fn = |err| log::error!("An error occurred on audio stream: {}", err);

        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    write_input_data_f32(data, &writer_clone);
                    emit_volume(data, &app_handle, &buffer_clone);
                },
                err_fn,
                None,
            ),
            SampleFormat::I16 => device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    write_input_data_i16(data, &writer_clone);
                    let f32_samples: Vec<f32> = data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                    emit_volume(&f32_samples, &app_handle, &buffer_clone);
                },
                err_fn,
                None,
            ),
            SampleFormat::U16 => device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    let f32_samples: Vec<f32> = data.iter().map(|&s| (s as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0)).collect();
                    emit_volume(&f32_samples, &app_handle, &buffer_clone);
                },
                err_fn,
                None,
            ),
            _ => return Err("Unsupported sample format".to_string()),
        }.map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;

        Ok((
            Self {
                stream: Some(stream),
                writer,
                output_path,
            },
            audio_buffer,
        ))
    }

    pub fn stop(mut self) -> PathBuf {
        if let Ok(mut guard) = RECORDING_START.lock() {
            *guard = None;
        }
        if let Ok(mut silence_guard) = SILENCE_START.lock() {
            *silence_guard = None;
        }
        if let Some(stream) = self.stream.take() {
            drop(stream);
        }
        if let Ok(mut guard) = self.writer.lock() {
            if let Some(w) = guard.take() {
                let _ = w.finalize();
            }
        }
        self.output_path
    }
}

fn write_input_data_f32(input: &[f32], writer: &SharedWriter) {
    if let Ok(mut guard) = writer.lock() {
        if let Some(ref mut w) = *guard {
            for &sample in input {
                let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                let _ = w.write_sample(sample_i16);
            }
        }
    }
}

fn write_input_data_i16(input: &[i16], writer: &SharedWriter) {
    if let Ok(mut guard) = writer.lock() {
        if let Some(ref mut w) = *guard {
            for &sample in input {
                let _ = w.write_sample(sample);
            }
        }
    }
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

static SILENCE_START: Mutex<Option<Instant>> = Mutex::new(None);
static RECORDING_START: Mutex<Option<Instant>> = Mutex::new(None);
static SILENCE_EMITTED: AtomicBool = AtomicBool::new(false);
static MAX_DURATION_EMITTED: AtomicBool = AtomicBool::new(false);
static LAST_RECORDING_EMIT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn emit_volume(samples: &[f32], app_handle: &AppHandle, buffer: &Arc<Mutex<Vec<f32>>>) {
    if samples.is_empty() { return; }

    let now = Instant::now();

    // Initialize recording start time if not set
    let rec_start = {
        let mut guard = RECORDING_START.lock().unwrap();
        if guard.is_none() {
            *guard = Some(now);
            SILENCE_EMITTED.store(false, Ordering::SeqCst);
            MAX_DURATION_EMITTED.store(false, Ordering::SeqCst);
            LAST_RECORDING_EMIT.store(0, Ordering::SeqCst);
            let mut silence_guard = SILENCE_START.lock().unwrap();
            *silence_guard = None;
        }
        guard.unwrap()
    };

    // 1. Check 90-Second Max Recording Hard Limit
    if now.duration_since(rec_start).as_secs() >= 90 {
        if !MAX_DURATION_EMITTED.swap(true, Ordering::SeqCst) {
            let _ = app_handle.emit("max-duration-reached", true);
        }
    }

    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_sq / samples.len() as f32).sqrt();
    let scaled_rms = calculate_db_normalized_volume(rms);

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let prev = LAST_RECORDING_EMIT.load(Ordering::Relaxed);
    if now_ms.saturating_sub(prev) >= 25 {
        LAST_RECORDING_EMIT.store(now_ms, Ordering::Relaxed);
        let _ = app_handle.emit("audio-volume", scaled_rms);
    }

    // 2. Check 15-Second Silence Detection Limit
    if rms < 0.008 {
        let mut silence_guard = SILENCE_START.lock().unwrap();
        if silence_guard.is_none() {
            *silence_guard = Some(now);
        } else if let Some(start_time) = *silence_guard {
            if now.duration_since(start_time).as_secs() >= 15 {
                if !SILENCE_EMITTED.swap(true, Ordering::SeqCst) {
                    let _ = app_handle.emit("silence-timeout", true);
                }
            }
        }
    } else {
        // Reset silence timer when speech is detected
        let mut silence_guard = SILENCE_START.lock().unwrap();
        *silence_guard = None;
    }

    if let Ok(mut buf) = buffer.lock() {
        buf.extend_from_slice(samples);
    }
}
