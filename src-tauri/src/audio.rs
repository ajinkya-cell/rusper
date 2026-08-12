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
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn new(app_handle: AppHandle) -> Result<(Self, Arc<Mutex<Vec<f32>>>), String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default audio input device found".to_string())?;

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

fn emit_volume(samples: &[f32], app_handle: &AppHandle, buffer: &Arc<Mutex<Vec<f32>>>) {
    if samples.is_empty() { return; }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_sq / samples.len() as f32).sqrt();

    let _ = app_handle.emit("audio-volume", rms);

    if let Ok(mut buf) = buffer.lock() {
        buf.extend_from_slice(samples);
    }
}
