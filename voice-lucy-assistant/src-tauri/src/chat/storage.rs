// Chat storage implementation
use super::{EnhancedChatMessage, ChatConfig};
use crate::lib::{AppError, AppResult};
use serde_json;
use std::fs;
use std::path::Path;

pub struct ChatStorage {
    storage_path: String,
}

impl ChatStorage {
    pub fn new(storage_path: String) -> Self {
        Self { storage_path }
    }
    
    pub async fn save_message(&self, message: &EnhancedChatMessage) -> AppResult<()> {
        let mut messages = self.load_all_messages().await?;
        messages.push(message.clone());
        self.save_all_messages(&messages).await
    }
    
    pub async fn update_message(&self, message: &EnhancedChatMessage) -> AppResult<()> {
        let mut messages = self.load_all_messages().await?;
        
        for msg in messages.iter_mut() {
            if msg.base.timestamp == message.base.timestamp {
                *msg = message.clone();
                return self.save_all_messages(&messages).await;
            }
        }
        
        Err(AppError::Chat("Message not found for update".to_string()))
    }
    
    pub async fn delete_message(&self, message_id: &str) -> AppResult<()> {
        let mut messages = self.load_all_messages().await?;
        let original_len = messages.len();
        
        messages.retain(|msg| msg.base.timestamp != message_id);
        
        if messages.len() < original_len {
            self.save_all_messages(&messages).await
        } else {
            Err(AppError::Chat("Message not found for deletion".to_string()))
        }
    }
    
    pub async fn load_all_messages(&self) -> AppResult<Vec<EnhancedChatMessage>> {
        if !Path::new(&self.storage_path).exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.storage_path)?;
        let messages: Vec<EnhancedChatMessage> = serde_json::from_str(&content)?;
        
        Ok(messages)
    }
    
    async fn save_all_messages(&self, messages: &[EnhancedChatMessage]) -> AppResult<()> {
        let content = serde_json::to_string_pretty(messages)?;
        fs::write(&self.storage_path, content)?;
        Ok(())
    }
    
    pub fn clear_all(&self) -> AppResult<()> {
        if Path::new(&self.storage_path).exists() {
            fs::remove_file(&self.storage_path)?;
        }
        Ok(())
    }
    
    pub fn export_to_file(&self, export_path: &str) -> AppResult<()> {
        let messages = self.load_all_messages()?;
        let content = serde_json::to_string_pretty(&messages)?;
        fs::write(export_path, content)?;
        Ok(())
    }
    
    pub fn import_from_file(&self, import_path: &str) -> AppResult<()> {
        let content = fs::read_to_string(import_path)?;
        let messages: Vec<EnhancedChatMessage> = serde_json::from_str(&content)?;
        
        // Validate imported messages
        for message in &messages {
            if message.base.message.is_empty() {
                return Err(AppError::Chat("Invalid message: empty content".to_string()));
            }
        }
        
        // Save imported messages
        let content = serde_json::to_string_pretty(&messages)?;
        fs::write(&self.storage_path, content)?;
        
        Ok(())
    }
    
    pub fn get_storage_info(&self) -> StorageInfo {
        let path = Path::new(&self.storage_path);
        
        if path.exists() {
            if let Ok(metadata) = fs::metadata(&self.storage_path) {
                StorageInfo {
                    exists: true,
                    size_bytes: metadata.len(),
                    modified: metadata.modified().ok().map(|time| {
                        time.duration_since(std::time::UNIX_EPOCH)
                            .map(|duration| duration.as_secs())
                            .unwrap_or(0)
                    }),
                }
            } else {
                StorageInfo {
                    exists: true,
                    size_bytes: 0,
                    modified: None,
                }
            }
        } else {
            StorageInfo {
                exists: false,
                size_bytes: 0,
                modified: None,
            }
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct StorageInfo {
    pub exists: bool,
    pub size_bytes: u64,
    pub modified: Option<u64>,
}

impl ChatStorage {
    pub async fn load_all_messages(&self) -> AppResult<Vec<EnhancedChatMessage>> {
        if !Path::new(&self.storage_path).exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.storage_path)
            .map_err(|e| AppError::Chat(format!("Failed to read storage: {}", e)))?;
        
        let messages: Vec<EnhancedChatMessage> = serde_json::from_str(&content)
            .map_err(|e| AppError::Chat(format!("Failed to parse storage: {}", e)))?;
        
        Ok(messages)
    }
}