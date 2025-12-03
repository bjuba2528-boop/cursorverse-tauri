// Chat manager implementation
use super::{EnhancedChatMessage, ChatConfig, ChatEvent, ChatStats, MessageFilter};
use crate::lib::{AppError, AppResult};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

pub struct ChatManager {
    messages: Arc<Mutex<VecDeque<EnhancedChatMessage>>>,
    config: ChatConfig,
    event_sender: mpsc::UnboundedSender<ChatEvent>,
    event_receiver: Option<mpsc::UnboundedReceiver<ChatEvent>>,
    storage: Option<super::ChatStorage>,
}

impl ChatManager {
    pub fn new(config: ChatConfig) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        
        Self {
            messages: Arc::new(Mutex::new(VecDeque::new())),
            config,
            event_sender: tx,
            event_receiver: Some(rx),
            storage: None,
        }
    }
    
    pub fn with_storage(mut self, storage: super::ChatStorage) -> Self {
        self.storage = Some(storage);
        self
    }
    
    pub async fn add_message(&mut self, message: EnhancedChatMessage) -> AppResult<()> {
        let mut messages = self.messages.lock().unwrap();
        
        // Add message to deque
        messages.push_back(message.clone());
        
        // Maintain max message limit
        while messages.len() > self.config.max_messages {
            messages.pop_front();
        }
        
        // Send event
        let _ = self.event_sender.send(ChatEvent::MessageAdded(message.clone()));
        
        // Auto-save if enabled
        if self.config.auto_save {
            if let Some(ref storage) = self.storage {
                storage.save_message(&message).await?;
            }
        }
        
        Ok(())
    }
    
    pub async fn edit_message(&mut self, message_id: &str, new_content: &str) -> AppResult<()> {
        let mut messages = self.messages.lock().unwrap();
        
        for message in messages.iter_mut() {
            if message.base.timestamp == message_id {
                message.edit_message(new_content.to_string());
                
                // Send event
                let _ = self.event_sender.send(ChatEvent::MessageUpdated(message.clone()));
                
                // Auto-save if enabled
                if self.config.auto_save {
                    if let Some(ref storage) = self.storage {
                        storage.update_message(message).await?;
                    }
                }
                
                return Ok(());
            }
        }
        
        Err(AppError::Chat("Message not found".to_string()))
    }
    
    pub async fn delete_message(&mut self, message_id: &str) -> AppResult<()> {
        let mut messages = self.messages.lock().unwrap();
        let original_len = messages.len();
        
        messages.retain(|msg| msg.base.timestamp != message_id);
        
        if messages.len() < original_len {
            // Send event
            let _ = self.event_sender.send(ChatEvent::MessageDeleted(message_id.to_string()));
            
            // Auto-save if enabled
            if self.config.auto_save {
                if let Some(ref storage) = self.storage {
                    storage.delete_message(message_id).await?;
                }
            }
            
            Ok(())
        } else {
            Err(AppError::Chat("Message not found".to_string()))
        }
    }
    
    pub fn clear_history(&mut self) -> AppResult<()> {
        let mut messages = self.messages.lock().unwrap();
        messages.clear();
        
        // Send event
        let _ = self.event_sender.send(ChatEvent::HistoryCleared);
        
        // Clear storage if available
        if let Some(ref storage) = self.storage {
            storage.clear_all()?;
        }
        
        Ok(())
    }
    
    pub fn get_messages(&self, filter: Option<MessageFilter>) -> Vec<EnhancedChatMessage> {
        let messages = self.messages.lock().unwrap();
        
        if let Some(filter) = filter {
            messages.iter()
                .filter(|msg| filter.matches(msg))
                .cloned()
                .collect()
        } else {
            messages.iter().cloned().collect()
        }
    }
    
    pub fn get_messages_by_sender(&self, sender: &str) -> Vec<EnhancedChatMessage> {
        let filter = MessageFilter::new().with_sender(sender.to_string());
        self.get_messages(Some(filter))
    }
    
    pub fn get_recent_messages(&self, count: usize) -> Vec<EnhancedChatMessage> {
        let messages = self.messages.lock().unwrap();
        messages.iter()
            .rev()
            .take(count)
            .rev()
            .cloned()
            .collect()
    }
    
    pub fn search_messages(&self, keyword: &str) -> Vec<EnhancedChatMessage> {
        let filter = MessageFilter::new().with_keyword(keyword.to_string());
        self.get_messages(Some(filter))
    }
    
    pub async fn get_events(&mut self) -> Option<ChatEvent> {
        if let Some(ref mut receiver) = self.event_receiver {
            receiver.recv().await
        } else {
            None
        }
    }
    
    pub fn get_stats(&self) -> ChatStats {
        let messages = self.messages.lock().unwrap();
        let mut stats = ChatStats::new();
        stats.update_from_messages(&messages);
        stats
    }
    
    pub async fn load_history(&mut self) -> AppResult<()> {
        if let Some(ref storage) = self.storage {
            let messages = storage.load_all_messages().await?;
            
            let mut msg_queue = self.messages.lock().unwrap();
            msg_queue.clear();
            msg_queue.extend(messages);
            
            println!("Loaded {} messages from storage", msg_queue.len());
        }
        
        Ok(())
    }
    
    pub fn update_config(&mut self, config: ChatConfig) {
        self.config = config;
    }
    
    pub fn get_config(&self) -> &ChatConfig {
        &self.config
    }
    
    pub fn message_count(&self) -> usize {
        self.messages.lock().unwrap().len()
    }
    
    pub fn is_empty(&self) -> bool {
        self.messages.lock().unwrap().is_empty()
    }
}

impl Drop for ChatManager {
    fn drop(&mut self) {
        // Save any unsaved changes
        if self.config.auto_save {
            if let Some(ref storage) = self.storage {
                let messages = self.messages.lock().unwrap();
                for message in messages.iter() {
                    let _ = storage.save_message(message);
                }
            }
        }
    }
}