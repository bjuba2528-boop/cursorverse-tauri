// Speech recognition module for Voice Lucy Assistant
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

use crate::lib::{AppError, AppResult, VoiceCommand};

pub mod recognizer;
pub mod processor;
pub mod provider;

pub use recognizer::SpeechRecognizer;
pub use processor::SpeechProcessor;
pub use provider::SpeechProvider;

// Speech configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpeechConfig {
    pub language: String,
    pub provider: SpeechProvider,
    pub confidence_threshold: f32,
    pub timeout_ms: u64,
    pub auto_punctuation: bool,
    pub filter_profanity: bool,
}

impl Default for SpeechConfig {
    fn default() -> Self {
        Self {
            language: "ru-RU".to_string(),
            provider: SpeechProvider::Browser,
            confidence_threshold: 0.7,
            timeout_ms: 5000,
            auto_punctuation: true,
            filter_profanity: false,
        }
    }
}

// Speech recognition providers
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SpeechProvider {
    Browser,
    Whisper,
    Google,
    Azure,
    Aws,
}

impl Default for SpeechProvider {
    fn default() -> Self {
        Self::Browser
    }
}

// Speech recognition events
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SpeechEvent {
    RecognitionStarted,
    RecognitionStopped,
    PartialResult(String),
    FinalResult(VoiceCommand),
    Error(String),
    Timeout,
    AudioLevel(f32),
}

// Speech recognition state
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum RecognitionState {
    Idle,
    Starting,
    Listening,
    Processing,
    Stopped,
    Error,
}

impl Default for RecognitionState {
    fn default() -> Self {
        Self::Idle
    }
}

// Alternative recognition result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlternativeResult {
    pub text: String,
    pub confidence: f32,
}

// Complete recognition result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecognitionResult {
    pub text: String,
    pub confidence: f32,
    pub alternatives: Vec<AlternativeResult>,
    pub duration_ms: u64,
    pub language_detected: Option<String>,
    pub timestamp: String,
}

impl RecognitionResult {
    pub fn new(text: String, confidence: f32) -> Self {
        Self {
            text,
            confidence,
            alternatives: Vec::new(),
            duration_ms: 0,
            language_detected: None,
            timestamp: crate::lib::get_timestamp(),
        }
    }
    
    pub fn with_alternative(mut self, text: String, confidence: f32) -> Self {
        self.alternatives.push(AlternativeResult { text, confidence });
        self
    }
    
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
    }
    
    pub fn with_language(mut self, language: String) -> Self {
        self.language_detected = Some(language);
        self
    }
    
    pub fn best_alternative(&self) -> &str {
        if self.alternatives.is_empty() {
            &self.text
        } else {
            &self.alternatives[0].text
        }
    }
    
    pub fn best_confidence(&self) -> f32 {
        if self.alternatives.is_empty() {
            self.confidence
        } else {
            self.alternatives[0].confidence
        }
    }
}

impl From<RecognitionResult> for VoiceCommand {
    fn from(result: RecognitionResult) -> Self {
        Self {
            text: result.text,
            timestamp: result.timestamp,
            confidence: result.confidence,
        }
    }
}

// Voice activity detection
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceActivity {
    pub is_speaking: bool,
    pub level: f32,
    pub timestamp: String,
}

impl VoiceActivity {
    pub fn new(is_speaking: bool, level: f32) -> Self {
        Self {
            is_speaking,
            level,
            timestamp: crate::lib::get_timestamp(),
        }
    }
}

// Speech recognition statistics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpeechStats {
    pub total_recognitions: u64,
    pub successful_recognitions: u64,
    pub failed_recognitions: u64,
    pub average_confidence: f64,
    pub total_duration_ms: u64,
    pub average_recognition_time_ms: f64,
    pub most_common_language: Option<String>,
}

impl SpeechStats {
    pub fn new() -> Self {
        Self {
            total_recognitions: 0,
            successful_recognitions: 0,
            failed_recognitions: 0,
            average_confidence: 0.0,
            total_duration_ms: 0,
            average_recognition_time_ms: 0.0,
            most_common_language: None,
        }
    }
    
    pub fn add_result(&mut self, result: &RecognitionResult) {
        self.total_recognitions += 1;
        
        if result.confidence > 0.5 {
            self.successful_recognitions += 1;
        } else {
            self.failed_recognitions += 1;
        }
        
        // Update average confidence
        let total_confidence = self.average_confidence * (self.total_recognitions - 1) as f64 + result.confidence as f64;
        self.average_confidence = total_confidence / self.total_recognitions as f64;
        
        // Update duration
        self.total_duration_ms += result.duration_ms;
    }
    
    pub fn success_rate(&self) -> f64 {
        if self.total_recognitions == 0 {
            0.0
        } else {
            self.successful_recognitions as f64 / self.total_recognitions as f64
        }
    }
}

impl Default for SpeechStats {
    fn default() -> Self {
        Self::new()
    }
}

// Audio quality metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioQuality {
    pub signal_to_noise_ratio: f32,
    pub peak_amplitude: f32,
    pub average_amplitude: f32,
    pub clipping_detected: bool,
    pub silence_percentage: f32,
}

impl AudioQuality {
    pub fn new() -> Self {
        Self {
            signal_to_noise_ratio: 0.0,
            peak_amplitude: 0.0,
            average_amplitude: 0.0,
            clipping_detected: false,
            silence_percentage: 0.0,
        }
    }
    
    pub fn calculate_from_samples(samples: &[f32]) -> Self {
        if samples.is_empty() {
            return Self::new();
        }
        
        let sum: f32 = samples.iter().sum();
        let average = sum / samples.len() as f32;
        
        let peak = samples.iter().fold(0.0f32, |a, &b| a.max(b.abs()));
        
        // Calculate RMS
        let rms = (samples.iter().map(|&x| x * x).sum::<f32>() / samples.len() as f32).sqrt();
        
        // Simple SNR calculation (this is simplified)
        let silence_threshold = 0.01;
        let silence_samples = samples.iter().filter(|&&x| x.abs() < silence_threshold).count();
        let silence_percentage = silence_samples as f32 / samples.len() as f32;
        
        let clipping_detected = peak >= 0.95;
        
        // Simple SNR estimate
        let signal_to_noise_ratio = if silence_percentage < 0.8 {
            (rms / (silence_threshold + 0.001)).log10() * 20.0
        } else {
            0.0
        };
        
        Self {
            signal_to_noise_ratio,
            peak_amplitude: peak,
            average_amplitude: average,
            clipping_detected,
            silence_percentage,
        }
    }
}

impl Default for AudioQuality {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recognition_result() {
        let result = RecognitionResult::new("Hello world".to_string(), 0.85)
            .with_alternative("Hello".to_string(), 0.7)
            .with_duration(1500)
            .with_language("en-US".to_string());
        
        assert_eq!(result.text, "Hello world");
        assert_eq!(result.confidence, 0.85);
        assert_eq!(result.alternatives.len(), 1);
        assert_eq!(result.duration_ms, 1500);
        assert_eq!(result.language_detected, Some("en-US".to_string()));
        assert_eq!(result.best_alternative(), "Hello");
        assert_eq!(result.best_confidence(), 0.7);
    }
    
    #[test]
    fn test_speech_stats() {
        let mut stats = SpeechStats::new();
        
        let result1 = RecognitionResult::new("Hello".to_string(), 0.8);
        let result2 = RecognitionResult::new("World".to_string(), 0.6);
        let result3 = RecognitionResult::new("Test".to_string(), 0.9);
        
        stats.add_result(&result1);
        stats.add_result(&result2);
        stats.add_result(&result3);
        
        assert_eq!(stats.total_recognitions, 3);
        assert_eq!(stats.successful_recognitions, 3);
        assert_eq!(stats.failed_recognitions, 0);
        assert!((stats.average_confidence - 0.7666667).abs() < 0.001);
        assert_eq!(stats.success_rate(), 1.0);
    }
    
    #[test]
    fn test_audio_quality() {
        // Test with normal audio
        let normal_samples = vec![0.1, 0.2, 0.3, 0.2, 0.1];
        let quality = AudioQuality::calculate_from_samples(&normal_samples);
        
        assert!(!quality.clipping_detected);
        assert!(quality.average_amplitude > 0.0);
        assert!(quality.peak_amplitude > 0.0);
        
        // Test with clipped audio
        let clipped_samples = vec![1.0, 1.0, 0.9, 1.0, 1.0];
        let clipped_quality = AudioQuality::calculate_from_samples(&clipped_samples);
        
        assert!(clipped_quality.clipping_detected);
        assert!(clipped_quality.peak_amplitude >= 0.95);
    }
}