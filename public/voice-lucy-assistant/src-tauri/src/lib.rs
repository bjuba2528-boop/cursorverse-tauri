// Library module for Voice Lucy Assistant
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

pub mod audio;
pub mod speech;
pub mod chat;

// Re-export commonly used types
pub use audio::AudioProcessor;
pub use speech::SpeechRecognizer;
pub use chat::ChatManager;

// Application configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub language: String,
    pub confidence_threshold: f32,
    pub clap_sensitivity: f32,
    pub auto_timeout: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            language: "ru-RU".to_string(),
            confidence_threshold: 0.7,
            clap_sensitivity: 0.8,
            auto_timeout: 5000,
        }
    }
}

// Error types
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Audio error: {0}")]
    Audio(String),
    #[error("Speech recognition error: {0}")]
    Speech(String),
    #[error("Chat error: {0}")]
    Chat(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

// Result type alias
pub type AppResult<T> = Result<T, AppError>;

// Utility functions
pub fn get_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn format_duration(milliseconds: u64) -> String {
    let seconds = milliseconds / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    
    if hours > 0 {
        format!("{}ч {}м {}с", hours, minutes % 60, seconds % 60)
    } else if minutes > 0 {
        format!("{}м {}с", minutes, seconds % 60)
    } else {
        format!("{}с", seconds)
    }
}

// Validation utilities
pub mod validation {
    pub fn validate_text(text: &str) -> bool {
        !text.trim().is_empty() && text.len() <= 1000
    }
    
    pub fn validate_confidence(confidence: f32) -> bool {
        confidence >= 0.0 && confidence <= 1.0
    }
    
    pub fn sanitize_text(text: &str) -> String {
        text.chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace() || ".,!?;:-_".contains(*c))
            .collect::<String>()
            .trim()
            .to_string()
    }
}

// Event types for communication
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AppEvent {
    VoiceStart,
    VoiceEnd,
    ClapDetected,
    MessageReceived(String),
    Error(String),
}

// Tauri event emitter
pub fn emit_event(app_handle: &tauri::AppHandle, event: AppEvent) {
    if let Err(e) = app_handle.emit_all("app-event", &event) {
        eprintln!("Failed to emit event: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation() {
        assert!(validation::validate_text("Hello world"));
        assert!(!validation::validate_text(""));
        assert!(!validation::validate_text("   "));
        
        assert!(validation::validate_confidence(0.5));
        assert!(validation::validate_confidence(1.0));
        assert!(!validation::validate_confidence(1.5));
        
        let sanitized = validation::sanitize_text("Hello, world! @#$%");
        assert_eq!(sanitized, "Hello, world!");
    }
    
    #[test]
    fn test_duration_formatting() {
        assert_eq!(format_duration(5000), "5с");
        assert_eq!(format_duration(65000), "1м 5с");
        assert_eq!(format_duration(3665000), "1ч 1м 5с");
    }
}