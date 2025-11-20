use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartMenuItem {
    pub name: String,
    pub exe_path: String,
    pub icon_base64: String,
    pub category: String,
}

// Получить список всех приложений из Start Menu
#[cfg(target_os = "windows")]
pub fn get_start_menu_apps() -> Result<Vec<StartMenuItem>, String> {
    use std::fs;
    
    let mut apps = Vec::new();
    
    // Папки Start Menu
    let start_menu_paths = vec![
        std::env::var("ProgramData")
            .map(|p| format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", p))
            .unwrap_or_default(),
        std::env::var("APPDATA")
            .map(|p| format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", p))
            .unwrap_or_default(),
    ];
    
    for base_path in start_menu_paths {
        if let Ok(entries) = fs::read_dir(&base_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                
                // Обрабатываем .lnk файлы
                if path.extension().and_then(|e| e.to_str()) == Some("lnk") {
                    if let Some(app) = parse_shortcut(&path) {
                        apps.push(app);
                    }
                }
                
                // Рекурсивно обрабатываем подпапки
                if path.is_dir() {
                    if let Some(category) = path.file_name().and_then(|n| n.to_str()) {
                        if let Ok(sub_entries) = fs::read_dir(&path) {
                            for sub_entry in sub_entries.flatten() {
                                let sub_path = sub_entry.path();
                                if sub_path.extension().and_then(|e| e.to_str()) == Some("lnk") {
                                    if let Some(mut app) = parse_shortcut(&sub_path) {
                                        app.category = category.to_string();
                                        apps.push(app);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Сортировка по имени
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    
    Ok(apps)
}

// Парсинг .lnk файла (ярлыка) - упрощённая версия
#[cfg(target_os = "windows")]
fn parse_shortcut(lnk_path: &PathBuf) -> Option<StartMenuItem> {
    // Получаем имя из имени файла
    let name = lnk_path
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Для упрощения, возвращаем базовую информацию
    // В полной версии нужно парсить .lnk через COM IShellLinkW
    Some(StartMenuItem {
        name,
        exe_path: lnk_path.to_string_lossy().to_string(),
        icon_base64: String::new(),
        category: String::new(),
    })
}

// Извлечение иконки из exe файла
#[allow(dead_code)]
fn extract_exe_icon(_exe_path: &str) -> Option<String> {
    // Упрощённая версия - требует доработки
    None
}

// Tauri команды
#[tauri::command]
pub fn get_start_menu_items() -> Result<Vec<StartMenuItem>, String> {
    get_start_menu_apps()
}

#[tauri::command]
pub fn launch_start_menu_app(exe_path: String) -> Result<(), String> {
    use std::process::Command;
    
    Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;
    
    Ok(())
}
