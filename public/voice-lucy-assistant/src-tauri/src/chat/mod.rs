// Chat module for Voice Lucy Assistant
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::lib::{AppError, AppResult, ChatMessage};

pub mod manager;
pub mod storage;

pub use manager::ChatManager;
pub use storage::ChatStorage;

// Chat configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatConfig {
    pub max_messages: usize,
    pub auto_save: bool,
    pub storage_path: String,
}

impl Default for ChatConfig {
    fn default() -> Self {
        Self {
            max_messages: 1000,
            auto_save: true,
            storage_path: "chat_history.json".to_string(),
        }
    }
}

// Chat events
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ChatEvent {
    MessageAdded(ChatMessage),
    MessageUpdated(ChatMessage),
    MessageDeleted(String),
    HistoryCleared,
    Error(String),
}

// Message priority
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    System = 3,
}

impl Default for MessagePriority {
    fn default() -> Self {
        Self::Normal
    }
}

// Enhanced message with priority
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnhancedChatMessage {
    #[serde(flatten)]
    pub base: ChatMessage,
    pub priority: MessagePriority,
    pub edited: bool,
    pub edit_timestamp: Option<String>,
    pub metadata: std::collections::HashMap<String, String>,
}

impl From<ChatMessage> for EnhancedChatMessage {
    fn from(base: ChatMessage) -> Self {
        Self {
            priority: MessagePriority::Normal,
            edited: false,
            edit_timestamp: None,
            metadata: std::collections::HashMap::new(),
            base,
        }
    }
}

impl EnhancedChatMessage {
    pub fn new(message: String, sender: String) -> Self {
        Self {
            base: ChatMessage {
                message,
                sender,
                timestamp: crate::lib::get_timestamp(),
            },
            priority: MessagePriority::Normal,
            edited: false,
            edit_timestamp: None,
            metadata: std::collections::HashMap::new(),
        }
    }
    
    pub fn with_priority(mut self, priority: MessagePriority) -> Self {
        self.priority = priority;
        self
    }
    
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
    
    pub fn edit_message(&mut self, new_message: String) {
        self.base.message = new_message;
        self.edited = true;
        self.edit_timestamp = Some(crate::lib::get_timestamp());
    }
}

// Chat statistics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatStats {
    pub total_messages: usize,
    pub user_messages: usize,
    pub lucy_messages: usize,
    pub system_messages: usize,
    pub average_message_length: f64,
    pub first_message_time: Option<String>,
    pub last_message_time: Option<String>,
}

impl ChatStats {
    pub fn new() -> Self {
        Self {
            total_messages: 0,
            user_messages: 0,
            lucy_messages: 0,
            system_messages: 0,
            average_message_length: 0.0,
            first_message_time: None,
            last_message_time: None,
        }
    }
    
    pub fn update_from_messages(&mut self, messages: &[EnhancedChatMessage]) {
        self.total_messages = messages.len();
        
        let mut total_length = 0;
        let mut first_time = None;
        let mut last_time = None;
        
        self.user_messages = 0;
        self.lucy_messages = 0;
        self.system_messages = 0;
        
        for message in messages {
            total_length += message.base.message.len();
            
            match message.base.sender.to_lowercase().as_str() {
                "user" | "пользователь" | "вы" => self.user_messages += 1,
                "lucy" | "люси" | "ai" => self.lucy_messages += 1,
                _ => self.system_messages += 1,
            }
            
            let msg_time = &message.base.timestamp;
            
            if first_time.is_none() || msg_time < first_time.as_ref().unwrap() {
                first_time = Some(msg_time.clone());
            }
            
            if last_time.is_none() || msg_time > last_time.as_ref().unwrap() {
                last_time = Some(msg_time.clone());
            }
        }
        
        self.average_message_length = if self.total_messages > 0 {
            total_length as f64 / self.total_messages as f64
        } else {
            0.0
        };
        
        self.first_message_time = first_time;
        self.last_message_time = last_time;
    }
}

// Message filter
pub struct MessageFilter {
    pub sender_filter: Option<String>,
    pub date_range: Option<(String, String)>,
    pub keyword_filter: Option<String>,
    pub priority_filter: Option<MessagePriority>,
}

impl MessageFilter {
    pub fn new() -> Self {
        Self {
            sender_filter: None,
            date_range: None,
            keyword_filter: None,
            priority_filter: None,
        }
    }
    
    pub fn with_sender(mut self, sender: String) -> Self {
        self.sender_filter = Some(sender);
        self
    }
    
    pub fn with_date_range(mut self, start: String, end: String) -> Self {
        self.date_range = Some((start, end));
        self
    }
    
    pub fn with_keyword(mut self, keyword: String) -> Self {
        self.keyword_filter = Some(keyword);
        self
    }
    
    pub fn with_priority(mut self, priority: MessagePriority) -> Self {
        self.priority_filter = Some(priority);
        self
    }
    
    pub fn matches(&self, message: &EnhancedChatMessage) -> bool {
        // Check sender
        if let Some(ref sender) = self.sender_filter {
            if message.base.sender.to_lowercase() != sender.to_lowercase() {
                return false;
            }
        }
        
        // Check date range
        if let Some((ref start, ref end)) = self.date_range {
            let msg_time = &message.base.timestamp;
            if msg_time < start || msg_time > end {
                return false;
            }
        }
        
        // Check keyword
        if let Some(ref keyword) = self.keyword_filter {
            if !message.base.message.to_lowercase().contains(&keyword.to_lowercase()) {
                return false;
            }
        }
        
        // Check priority
        if let Some(ref priority) = self.priority_filter {
            if message.priority != *priority {
                return false;
            }
        }
        
        true
    }
}

impl Default for MessageFilter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enhanced_message() {
        let message = EnhancedChatMessage::new(
            "Hello".to_string(),
            "User".to_string()
        ).with_priority(MessagePriority::High);
        
        assert_eq!(message.base.message, "Hello");
        assert_eq!(message.base.sender, "User");
        assert_eq!(message.priority, MessagePriority::High);
        assert!(!message.edited);
    }
    
    #[test]
    fn test_message_filter() {
        let filter = MessageFilter::new()
            .with_sender("User".to_string())
            .with_keyword("hello".to_string());
        
        let message = EnhancedChatMessage::new(
            "Hello world".to_string(),
            "User".to_string()
        );
        
        assert!(filter.matches(&message));
        
        let wrong_sender = EnhancedChatMessage::new(
            "Hello world".to_string(),
            "Lucy".to_string()
        );
        
        assert!(!filter.matches(&wrong_sender));
        
        let wrong_keyword = EnhancedChatMessage::new(
            "Goodbye world".to_string(),
            "User".to_string()
        );
        
        assert!(!filter.matches(&wrong_keyword));
    }
    
    #[test]
    fn test_chat_stats() {
        let mut stats = ChatStats::new();
        
        let messages = vec![
            EnhancedChatMessage::new("Hi".to_string(), "User".to_string()),
            EnhancedChatMessage::new("Hello".to_string(), "Lucy".to_string()),
            EnhancedChatMessage::new("How are you?".to_string(), "User".to_string()),
        ];
        
        stats.update_from_messages(&messages);
        
        assert_eq!(stats.total_messages, 3);
        assert_eq!(stats.user_messages, 2);
        assert_eq!(stats.lucy_messages, 1);
        assert_eq!(stats.average_message_length, 4.0); // (2 + 5 + 11) / 3
    }
}