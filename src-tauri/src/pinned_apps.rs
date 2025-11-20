use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedAppConfig {
    pub apps: Vec<PinnedAppData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedAppData {
    pub name: String,
    pub exe_path: String,
    pub icon_path: Option<String>,
    pub args: Option<String>,
}

// Получить путь к конфиг файлу
fn get_config_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    PathBuf::from(appdata)
        .join("CursorVerse")
        .join("pinned_apps.json")
}

// Загрузить закреплённые приложения из JSON
pub fn load_pinned_apps() -> Result<Vec<PinnedAppData>, String> {
    let config_path = get_config_path();
    
    if !config_path.exists() {
        // Возвращаем дефолтные приложения
        return Ok(get_default_pinned_apps());
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    
    let config: PinnedAppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;
    
    Ok(config.apps)
}

// Сохранить закреплённые приложения в JSON
pub fn save_pinned_apps(apps: Vec<PinnedAppData>) -> Result<(), String> {
    let config_path = get_config_path();
    
    // Создаём папку если не существует
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    
    let config = PinnedAppConfig { apps };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

// Дефолтные закреплённые приложения
fn get_default_pinned_apps() -> Vec<PinnedAppData> {
    vec![
        PinnedAppData {
            name: "File Explorer".to_string(),
            exe_path: "explorer.exe".to_string(),
            icon_path: None,
            args: None,
        },
        PinnedAppData {
            name: "Microsoft Edge".to_string(),
            exe_path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe".to_string(),
            icon_path: None,
            args: None,
        },
        PinnedAppData {
            name: "Google Chrome".to_string(),
            exe_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe".to_string(),
            icon_path: None,
            args: None,
        },
    ]
}

// Tauri команды
#[tauri::command]
pub fn get_pinned_apps() -> Result<Vec<PinnedAppData>, String> {
    load_pinned_apps()
}

#[tauri::command]
pub fn add_pinned_app(app: PinnedAppData) -> Result<(), String> {
    let mut apps = load_pinned_apps()?;
    apps.push(app);
    save_pinned_apps(apps)
}

#[tauri::command]
pub fn remove_pinned_app(exe_path: String) -> Result<(), String> {
    let mut apps = load_pinned_apps()?;
    apps.retain(|app| app.exe_path != exe_path);
    save_pinned_apps(apps)
}

#[tauri::command]
pub fn reorder_pinned_apps(new_order: Vec<PinnedAppData>) -> Result<(), String> {
    save_pinned_apps(new_order)
}
