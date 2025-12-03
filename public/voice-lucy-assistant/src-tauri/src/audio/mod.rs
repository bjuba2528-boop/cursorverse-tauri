// Audio processing module for Voice Lucy Assistant
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, StreamConfig, SampleFormat, Stream};
use fundsp::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

use crate::lib::{AppError, AppResult};

pub mod processor;
pub mod analyzer;
pub mod recorder;

pub use processor::AudioProcessor;
pub use analyzer::AudioAnalyzer;
pub use recorder::AudioRecorder;

// Audio configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: u32,
    pub format: SampleFormat,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 44100,
            channels: 1,
            buffer_size: 4096,
            format: SampleFormat::F32,
        }
    }
}

// Audio data structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioData {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub timestamp: String,
}

impl AudioData {
    pub fn new(samples: Vec<f32>, config: &AudioConfig) -> Self {
        Self {
            samples,
            sample_rate: config.sample_rate,
            channels: config.channels,
            timestamp: crate::lib::get_timestamp(),
        }
    }
    
    pub fn duration_ms(&self) -> f64 {
        (self.samples.len() as f64 / self.sample_rate as f64) * 1000.0
    }
    
    pub fn rms(&self) -> f32 {
        let sum: f32 = self.samples.iter().map(|&s| s * s).sum();
        (sum / self.samples.len() as f32).sqrt()
    }
    
    pub fn peak(&self) -> f32 {
        self.samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max)
    }
}

// Audio event types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AudioEvent {
    DataAvailable(AudioData),
    ClapDetected(f32),
    VoiceActivity(bool),
    LevelChanged(f32),
    Error(String),
}

// Audio device manager
pub struct AudioManager {
    host: Host,
    input_device: Option<Device>,
    output_device: Option<Device>,
    config: AudioConfig,
}

impl AudioManager {
    pub fn new() -> AppResult<Self> {
        let host = cpal::default_host();
        
        Ok(Self {
            host,
            input_device: None,
            output_device: None,
            config: AudioConfig::default(),
        })
    }
    
    pub fn list_input_devices(&self) -> AppResult<Vec<String>> {
        let mut devices = Vec::new();
        
        for device in self.host.input_devices()? {
            if let Ok(name) = device.name() {
                devices.push(name);
            }
        }
        
        Ok(devices)
    }
    
    pub fn set_input_device(&mut self, device_name: &str) -> AppResult<()> {
        for device in self.host.input_devices()? {
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.input_device = Some(device);
                    return Ok(());
                }
            }
        }
        
        Err(AppError::Audio(format!("Device '{}' not found", device_name)))
    }
    
    pub fn get_default_input_device(&mut self) -> AppResult<()> {
        self.input_device = self.host.default_input_device();
        Ok(())
    }
    
    pub fn create_input_stream(&self) -> AppResult<Stream> {
        let device = self.input_device.as_ref()
            .ok_or_else(|| AppError::Audio("No input device selected".to_string()))?;
        
        let config = self.get_stream_config()?;
        let format = device.default_input_format()
            .map_err(|e| AppError::Audio(format!("Failed to get input format: {}", e)))?;
        
        match format {
            SampleFormat::F32 => self.create_stream::<f32>(device, &config),
            SampleFormat::I16 => self.create_stream::<i16>(device, &config),
            SampleFormat::U16 => self.create_stream::<u16>(device, &config),
            _ => Err(AppError::Audio("Unsupported sample format".to_string())),
        }
    }
    
    fn create_stream<T>(&self, device: &Device, config: &StreamConfig) -> AppResult<Stream>
    where
        T: cpal::Sample + cpal::SizedSample + Send + 'static,
    {
        let (tx, mut rx) = mpsc::channel::<AudioData>(100);
        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;
        
        let stream = device.build_input_stream(
            config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                let samples: Vec<f32> = data.iter()
                    .map(|&sample| cpal::Sample::from::<f32>(sample))
                    .collect();
                
                let audio_data = AudioData {
                    samples,
                    sample_rate,
                    channels: channels as u16,
                    timestamp: crate::lib::get_timestamp(),
                };
                
                if let Err(e) = tx.blocking_send(audio_data) {
                    eprintln!("Failed to send audio data: {}", e);
                }
            },
            |err| {
                eprintln!("Input stream error: {}", err);
            },
            None,
        )?;
        
        Ok(stream)
    }
    
    fn get_stream_config(&self) -> AppResult<StreamConfig> {
        Ok(StreamConfig {
            channels: self.config.channels,
            sample_rate: cpal::SampleRate(self.config.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size),
        })
    }
}

// Audio analysis utilities
pub struct AudioAnalyzer {
    clap_threshold: f32,
    voice_threshold: f32,
}

impl AudioAnalyzer {
    pub fn new() -> Self {
        Self {
            clap_threshold: 0.8,
            voice_threshold: 0.1,
        }
    }
    
    pub fn detect_clap(&self, audio_data: &AudioData) -> Option<f32> {
        let rms = audio_data.rms();
        let peak = audio_data.peak();
        
        // Simple clap detection: high RMS and sharp peak
        if rms > self.clap_threshold && peak > 0.9 {
            Some(rms)
        } else {
            None
        }
    }
    
    pub fn detect_voice_activity(&self, audio_data: &AudioData) -> bool {
        let rms = audio_data.rms();
        
        // Voice activity detection based on RMS level
        rms > self.voice_threshold
    }
    
    pub fn analyze_spectrum(&self, audio_data: &AudioData) -> Vec<f32> {
        // Simple FFT using fundsp
        let mut analyzer = fundsp::analyzer::Analyzer::new(1024);
        
        for &sample in &audio_data.samples {
            analyzer.feed(sample);
        }
        
        analyzer.frequency_spectrum()
    }
    
    pub fn set_clap_threshold(&mut self, threshold: f32) {
        self.clap_threshold = threshold.clamp(0.0, 1.0);
    }
    
    pub fn set_voice_threshold(&mut self, threshold: f32) {
        self.voice_threshold = threshold.clamp(0.0, 1.0);
    }
}

impl Default for AudioManager {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_data() {
        let samples = vec![0.1, 0.2, 0.3, 0.4, 0.5];
        let config = AudioConfig::default();
        let audio_data = AudioData::new(samples, &config);
        
        assert_eq!(audio_data.samples.len(), 5);
        assert_eq!(audio_data.sample_rate, 44100);
        assert_eq!(audio_data.channels, 1);
        
        let rms = audio_data.rms();
        assert!(rms > 0.0);
        
        let peak = audio_data.peak();
        assert_eq!(peak, 0.5);
    }
    
    #[test]
    fn test_audio_analyzer() {
        let analyzer = AudioAnalyzer::new();
        
        // Test with silence
        let silence = AudioData::new(vec![0.0; 1000], &AudioConfig::default());
        assert!(!analyzer.detect_voice_activity(&silence));
        assert!(analyzer.detect_clap(&silence).is_none());
        
        // Test with loud noise
        let loud = AudioData::new(vec![1.0; 100], &AudioConfig::default());
        assert!(analyzer.detect_voice_activity(&loud));
        // Might detect as clap depending on threshold
    }
}