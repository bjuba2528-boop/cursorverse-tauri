#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use std::thread;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceCommand {
    pub text: String,
    pub timestamp: String,
    pub confidence: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub message: String,
    pub sender: String,
    pub timestamp: String,
}

// Global state for application
pub struct AppState {
    pub is_listening: Arc<Mutex<bool>>,
    pub chat_history: Arc<Mutex<Vec<ChatMessage>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_listening: Arc::new(Mutex::new(false)),
            chat_history: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[tauri::command]
fn toggle_listening(state: tauri::State<AppState>) -> Result<bool, String> {
    let mut is_listening = state.is_listening.lock().unwrap();
    *is_listening = !*is_listening;
    
    println!("Listening state changed to: {}", *is_listening);
    
    // Send notification to frontend
    if *is_listening {
        println!("Starting voice recognition...");
    } else {
        println!("Stopping voice recognition...");
    }
    
    Ok(*is_listening)
}

#[tauri::command]
fn get_listening_state(state: tauri::State<AppState>) -> Result<bool, String> {
    let is_listening = state.is_listening.lock().unwrap();
    Ok(*is_listening)
}

#[tauri::command]
fn send_voice_to_lucy(
    command: VoiceCommand,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    println!("Received voice command: {}", command.text);
    
    // Create chat message for Lucy
    let chat_message = ChatMessage {
        message: command.text.clone(),
        sender: "User".to_string(),
        timestamp: command.timestamp.clone(),
    };
    
    // Add to chat history
    let mut chat_history = state.chat_history.lock().unwrap();
    chat_history.push(chat_message);
    
    // Simulate Lucy's response (in real implementation, this would call your AI service)
    let response = format!("Lucy получила ваше сообщение: '{}'", command.text);
    
    // Add Lucy's response to chat history
    let lucy_response = ChatMessage {
        message: response.clone(),
        sender: "Lucy".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    chat_history.push(lucy_response);
    
    Ok(response)
}

#[tauri::command]
fn get_chat_history(state: tauri::State<AppState>) -> Result<Vec<ChatMessage>, String> {
    let chat_history = state.chat_history.lock().unwrap();
    Ok(chat_history.clone())
}

#[tauri::command]
fn clear_chat_history(state: tauri::State<AppState>) -> Result<(), String> {
    let mut chat_history = state.chat_history.lock().unwrap();
    chat_history.clear();
    Ok(())
}

#[tauri::command]
fn show_notification(message: String) -> Result<(), String> {
    println!("Notification: {}", message);
    // In a real implementation, you would use Tauri's notification API
    Ok(())
}

#[tauri::command]
fn process_clap_detection(clap_detected: bool, state: tauri::State<AppState>) -> Result<bool, String> {
    if clap_detected {
        println!("Clap detected! Activating voice recognition...");
        
        // Automatically start listening
        let mut is_listening = state.is_listening.lock().unwrap();
        *is_listening = true;
        
        // Notify frontend
        return Ok(true);
    }
    
    Ok(false)
}

fn main() {
    // Initialize application state
    let app_state = AppState::default();
    
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            toggle_listening,
            get_listening_state,
            send_voice_to_lucy,
            get_chat_history,
            clear_chat_history,
            show_notification,
            process_clap_detection
        ])
        .setup(|app| {
            // Initialize any required services here
            println!("Voice Lucy Assistant started successfully!");
            
            // Set up periodic tasks if needed
            let app_handle = app.handle();
            thread::spawn(move || {
                loop {
                    thread::sleep(Duration::from_secs(10));
                    // Periodic maintenance tasks can go here
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}