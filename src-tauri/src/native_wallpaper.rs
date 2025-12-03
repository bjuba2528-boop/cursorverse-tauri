// ============= НАТИВНЫЙ ДВИЖОК ОБОЕВ БЕЗ LIVELY WALLPAPER =============
// Поддержка всех форматов: статические изображения, GIF, видео, HTML5

#![allow(dead_code)]
#![allow(unused_variables)]

use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::{Manager, AppHandle};
use winapi::um::winuser::{FindWindowW, SetParent, GetDesktopWindow, SetWindowPos};
use winapi::shared::windef::HWND;
use std::os::windows::ffi::OsStrExt;
use std::ffi::OsStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeWallpaper {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub wallpaper_type: WallpaperType,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WallpaperType {
    Image,      // jpg, png, bmp, webp
    Gif,        // gif
    Video,      // mp4, webm, avi, mov, mkv
    Html,       // html с анимациями
}

impl WallpaperType {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" | "png" | "bmp" | "webp" => WallpaperType::Image,
            "gif" => WallpaperType::Gif,
            "mp4" | "webm" | "avi" | "mov" | "mkv" => WallpaperType::Video,
            "html" | "htm" => WallpaperType::Html,
            _ => WallpaperType::Image,
        }
    }
}

// Получить список всех обоев из локальной библиотеки CursorVerse
#[tauri::command]
pub fn get_native_wallpapers() -> Result<Vec<NativeWallpaper>, String> {
    let library_path = get_native_library_path()?;
    
    // Создаём папку если не существует
    fs::create_dir_all(&library_path)
        .map_err(|e| format!("Не удалось создать библиотеку: {}", e))?;
    
    let mut wallpapers = Vec::new();
    
    let entries = fs::read_dir(&library_path)
        .map_err(|e| format!("Ошибка чтения библиотеки: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Ошибка чтения файла: {}", e))?;
        let path = entry.path();
        
        if path.is_dir() {
            // Ищем info.json внутри папки (Lively-совместимый формат)
            let info_path = path.join("info.json");
            if info_path.exists() {
                if let Ok(json_str) = fs::read_to_string(&info_path) {
                    if let Ok(wallpaper) = serde_json::from_str::<NativeWallpaper>(&json_str) {
                        wallpapers.push(wallpaper);
                    }
                }
            }
        } else if let Some(ext) = path.extension() {
            // Отдельные файлы обоев
            let ext_str = ext.to_str().unwrap_or("");
            let wallpaper_type = WallpaperType::from_extension(ext_str);
            
            let file_name = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("wallpaper");
            
            wallpapers.push(NativeWallpaper {
                id: file_name.to_string(),
                title: file_name.to_string(),
                file_path: path.to_string_lossy().to_string(),
                wallpaper_type,
                thumbnail: None,
            });
        }
    }
    
    Ok(wallpapers)
}

// Получить путь к библиотеке обоев CursorVerse
fn get_native_library_path() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "Не удалось получить APPDATA")?;
    
    let library_path = Path::new(&appdata)
        .join("CursorVerse")
        .join("Wallpapers");
    
    Ok(library_path)
}

// Установить обои (создаёт окно на уровне рабочего стола)
#[tauri::command]
pub async fn set_native_wallpaper(
    app: AppHandle,
    wallpaper_id: String,
) -> Result<String, String> {
    let wallpapers = get_native_wallpapers()?;
    let wallpaper = wallpapers.iter()
        .find(|w| w.id == wallpaper_id)
        .ok_or("Обои не найдены")?;
    
    // Закрываем предыдущее окно обоев если есть
    if let Some(window) = app.get_webview_window("wallpaper") {
        let _ = window.close();
    }
    
    // Создаём новое окно для обоев
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "wallpaper",
        tauri::WebviewUrl::App(format!("wallpaper.html?file={}", urlencoding::encode(&wallpaper.file_path)).into()),
    )
    .title("CursorVerse Wallpaper")
    .fullscreen(true)
    .decorations(false)
    .transparent(true)
    .skip_taskbar(true)
    .always_on_bottom(true)
    .build()
    .map_err(|e| format!("Не удалось создать окно обоев: {}", e))?;
    
    // Размещаем окно за рабочим столом
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            place_window_behind_desktop(hwnd.0 as *mut _);
        }
    }
    
    Ok(format!("Обои установлены: {}", wallpaper.title))
}

// Добавить файл обоев в библиотеку
#[tauri::command]
pub fn add_native_wallpaper(file_path: String) -> Result<String, String> {
    let source_path = Path::new(&file_path);
    
    if !source_path.exists() {
        return Err("Файл не найден".to_string());
    }
    
    let library_path = get_native_library_path()?;
    fs::create_dir_all(&library_path)
        .map_err(|e| format!("Не удалось создать библиотеку: {}", e))?;
    
    let file_name = source_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Некорректное имя файла")?;
    
    let dest_path = library_path.join(file_name);
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Не удалось скопировать файл: {}", e))?;
    
    Ok(format!("Обои добавлены: {}", file_name))
}

// Удалить обои из библиотеки
#[tauri::command]
pub fn delete_native_wallpaper(wallpaper_id: String) -> Result<String, String> {
    let wallpapers = get_native_wallpapers()?;
    let wallpaper = wallpapers.iter()
        .find(|w| w.id == wallpaper_id)
        .ok_or("Обои не найдены")?;
    
    let path = Path::new(&wallpaper.file_path);
    if path.exists() {
        if path.is_dir() {
            fs::remove_dir_all(path)
                .map_err(|e| format!("Не удалось удалить папку: {}", e))?;
        } else {
            fs::remove_file(path)
                .map_err(|e| format!("Не удалось удалить файл: {}", e))?;
        }
    }
    
    Ok(format!("Обои удалены: {}", wallpaper_id))
}

// Остановить текущие обои
#[tauri::command]
pub fn stop_native_wallpaper(app: AppHandle) -> Result<String, String> {
    if let Some(window) = app.get_webview_window("wallpaper") {
        window.close()
            .map_err(|e| format!("Не удалось закрыть окно: {}", e))?;
    }
    
    Ok("Обои остановлены".to_string())
}

// Импортировать все обои из Lively Wallpaper
#[tauri::command]
pub async fn import_from_lively() -> Result<String, String> {
    // Используем существующий код из lively_integration
    let lively_wallpapers = crate::lively_integration::get_lively_wallpapers().await?;
    
    let library_path = get_native_library_path()?;
    fs::create_dir_all(&library_path)
        .map_err(|e| format!("Не удалось создать библиотеку: {}", e))?;
    
    let mut imported_count = 0;
    
    for wallpaper in lively_wallpapers {
        // Копируем папку целиком или только основной файл
        let source_path = Path::new(&wallpaper.folder_path);
        let dest_name = format!("lively_{}", wallpaper.id);
        let dest_path = library_path.join(&dest_name);
        
        if source_path.is_dir() {
            // Копируем всю папку
            copy_dir_all(source_path, &dest_path)
                .map_err(|e| format!("Ошибка копирования: {}", e))?;
            
            // Создаём info.json для совместимости
            let native_info = NativeWallpaper {
                id: dest_name.clone(),
                title: wallpaper.title,
                file_path: dest_path.join(Path::new(&wallpaper.file_path).file_name().unwrap()).to_string_lossy().to_string(),
                wallpaper_type: match wallpaper.wallpaper_type {
                    1 => WallpaperType::Video,
                    2 => WallpaperType::Gif,
                    5 => WallpaperType::Image,
                    _ => WallpaperType::Html,
                },
                thumbnail: if wallpaper.thumbnail_path.is_empty() {
                    None
                } else {
                    Some(wallpaper.thumbnail_path)
                },
            };
            
            let info_json = serde_json::to_string_pretty(&native_info)
                .map_err(|e| format!("Ошибка создания JSON: {}", e))?;
            
            fs::write(dest_path.join("info.json"), info_json)
                .map_err(|e| format!("Ошибка записи info.json: {}", e))?;
            
            imported_count += 1;
        }
    }
    
    Ok(format!("Импортировано {} обоев из Lively Wallpaper", imported_count))
}

// Вспомогательная функция копирования директорий
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// Windows API: размещение окна за рабочим столом
#[cfg(target_os = "windows")]
fn place_window_behind_desktop(hwnd: HWND) {
    unsafe {
        // Находим окно "Progman" (главное окно рабочего стола)
        let progman_class: Vec<u16> = OsStr::new("Progman")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
        
        if !progman.is_null() {
            // Устанавливаем родителя окна обоев как Progman
            SetParent(hwnd, progman);
            
            // Позиционируем окно
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                0,
                0,
                0,
                0,
                0x0001 | 0x0002 | 0x0004, // SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER
            );
        } else {
            // Fallback: используем GetDesktopWindow
            let desktop = GetDesktopWindow();
            SetParent(hwnd, desktop);
        }
    }
}
