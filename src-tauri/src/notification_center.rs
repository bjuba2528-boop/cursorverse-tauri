use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowsNotification {
    pub id: String,
    pub app_name: String,
    pub title: String,
    pub message: String,
    pub icon_base64: String,
    pub timestamp: u64,
}

lazy_static::lazy_static! {
    static ref NOTIFICATIONS: Arc<Mutex<HashMap<String, WindowsNotification>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

// Модифицировать Windows Taskbar для показа custom notification center
#[allow(dead_code)]
#[cfg(target_os = "windows")]
pub fn inject_notification_center() -> Result<(), String> {
    // Требует hook injection - упрощённая версия
    Ok(())
}

// Добавить уведомление в центр
pub fn add_notification(notification: WindowsNotification) -> Result<(), String> {
    let mut notifications = NOTIFICATIONS.lock()
        .map_err(|e| format!("Failed to lock notifications: {}", e))?;
    
    notifications.insert(notification.id.clone(), notification);
    Ok(())
}

// Получить все уведомления
pub fn get_all_notifications() -> Result<Vec<WindowsNotification>, String> {
    let notifications = NOTIFICATIONS.lock()
        .map_err(|e| format!("Failed to lock notifications: {}", e))?;
    
    let mut list: Vec<WindowsNotification> = notifications.values().cloned().collect();
    list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    Ok(list)
}

// Удалить уведомление
pub fn remove_notification(id: &str) -> Result<(), String> {
    let mut notifications = NOTIFICATIONS.lock()
        .map_err(|e| format!("Failed to lock notifications: {}", e))?;
    
    notifications.remove(id);
    Ok(())
}

// Очистить все уведомления
pub fn clear_all_notifications() -> Result<(), String> {
    let mut notifications = NOTIFICATIONS.lock()
        .map_err(|e| format!("Failed to lock notifications: {}", e))?;
    
    notifications.clear();
    Ok(())
}

// Tauri команды
#[tauri::command]
pub fn get_notifications() -> Result<Vec<WindowsNotification>, String> {
    get_all_notifications()
}

#[tauri::command]
pub fn dismiss_notification(id: String) -> Result<(), String> {
    remove_notification(&id)
}

#[tauri::command]
pub fn clear_notifications() -> Result<(), String> {
    clear_all_notifications()
}

#[tauri::command]
pub fn send_test_notification() -> Result<(), String> {
    let notification = WindowsNotification {
        id: uuid::Uuid::new_v4().to_string(),
        app_name: "Test App".to_string(),
        title: "Test Notification".to_string(),
        message: "This is a test notification from CursorVerse".to_string(),
        icon_base64: String::new(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    add_notification(notification)
}
