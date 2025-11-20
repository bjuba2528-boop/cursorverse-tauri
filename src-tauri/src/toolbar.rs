use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolbarPin {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolbarConfig {
    pub pins: Vec<ToolbarPin>,
    pub autostart: bool,
    pub weather_api_key: Option<String>,
    pub weather_city: Option<String>,
}

impl Default for ToolbarConfig {
    fn default() -> Self {
        ToolbarConfig {
            pins: Vec::new(),
            autostart: false,
            weather_api_key: None,
            weather_city: None,
        }
    }
}

#[tauri::command]
pub fn get_toolbar_config() -> Result<ToolbarConfig, String> {
    let config_path = get_config_path()?;
    let config_file = config_path.join("toolbar_config.json");
    
    if config_file.exists() {
        let content = fs::read_to_string(&config_file).map_err(|e| e.to_string())?;
        let config: ToolbarConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(config)
    } else {
        Ok(ToolbarConfig::default())
    }
}

#[tauri::command]
pub fn save_toolbar_config(config: ToolbarConfig) -> Result<String, String> {
    let config_path = get_config_path()?;
    fs::create_dir_all(&config_path).map_err(|e| e.to_string())?;
    
    let config_file = config_path.join("toolbar_config.json");
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_file, json).map_err(|e| e.to_string())?;
    
    Ok("Конфигурация сохранена".to_string())
}

#[tauri::command]
pub fn launch_app(path: String) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err("Файл не найден".to_string());
    }
    
    // Определяем тип файла и запускаем соответствующе
    let extension = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("");
    
    match extension {
        "lnk" => {
            // Для ярлыков используем cmd /c start
            Command::new("cmd")
                .args(&["/C", "start", "", &path])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "exe" => {
            // Для exe запускаем напрямую
            Command::new(&path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "url" => {
            // Для URL-файлов читаем содержимое и открываем браузер
            let content = fs::read_to_string(&path_buf).map_err(|e| e.to_string())?;
            if let Some(url) = content.lines()
                .find(|line| line.starts_with("URL="))
                .and_then(|line| line.strip_prefix("URL=")) {
                
                Command::new("cmd")
                    .args(&["/C", "start", "", url])
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            } else {
                return Err("Не удалось прочитать URL".to_string());
            }
        }
        _ => {
            // Для остальных типов используем shell execute
            Command::new("cmd")
                .args(&["/C", "start", "", &path])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(format!("Запущено: {}", path))
}

fn get_config_path() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
    Ok(PathBuf::from(appdata).join("CursorVerse"))
}
