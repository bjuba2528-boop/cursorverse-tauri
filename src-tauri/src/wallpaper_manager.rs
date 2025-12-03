use std::fs;
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};
#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

static ORIGINAL_WALLPAPER_PATH: Lazy<Arc<Mutex<Option<String>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WallpaperInfo {
    pub path: String,
    pub title: Option<String>,
    pub copyright: Option<String>,
    pub source: String, // "spotlight", "theme", "user"
}

/// Получает путь к папке Windows Spotlight
fn get_spotlight_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let local_appdata = std::env::var("LOCALAPPDATA").ok()?;
        let spotlight_path = PathBuf::from(local_appdata)
            .join("Packages")
            .join("Microsoft.Windows.ContentDeliveryManager_cw5n1h2txyewy")
            .join("LocalState")
            .join("Assets");
        
        if spotlight_path.exists() {
            Some(spotlight_path)
        } else {
            None
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Получает путь к папке с темами Windows
fn get_themes_wallpapers_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let windows_path = PathBuf::from("C:\\Windows\\Web\\Wallpaper");
        if windows_path.exists() {
            Some(windows_path)
        } else {
            None
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Сканирует папку Windows Spotlight и возвращает список обоев
#[tauri::command]
pub fn get_spotlight_wallpapers() -> Result<Vec<WallpaperInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let spotlight_path = get_spotlight_path()
            .ok_or("Windows Spotlight не найден")?;
        
        let mut wallpapers = Vec::new();
        
        if let Ok(entries) = fs::read_dir(&spotlight_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                
                // Пропускаем не-файлы
                if !path.is_file() {
                    continue;
                }
                
                // Проверяем размер файла (Spotlight обои обычно > 100KB)
                if let Ok(metadata) = fs::metadata(&path) {
                    if metadata.len() < 100_000 {
                        continue;
                    }
                }
                
                // Пытаемся определить, это изображение или нет
                // Spotlight файлы не имеют расширений, проверяем по сигнатуре
                if let Ok(mut file) = fs::File::open(&path) {
                    use std::io::Read;
                    let mut buffer = [0u8; 12];
                    if file.read(&mut buffer).is_ok() {
                        // JPEG сигнатура: FF D8 FF
                        // PNG сигнатура: 89 50 4E 47
                        if (buffer[0] == 0xFF && buffer[1] == 0xD8 && buffer[2] == 0xFF) ||
                           (buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4E && buffer[3] == 0x47) {
                            wallpapers.push(WallpaperInfo {
                                path: path.to_string_lossy().to_string(),
                                title: None,
                                copyright: Some("Windows Spotlight".to_string()),
                                source: "spotlight".to_string(),
                            });
                        }
                    }
                }
            }
        }
        
        Ok(wallpapers)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Windows Spotlight доступен только на Windows".to_string())
    }
}

/// Сканирует папку с темами Windows и возвращает список обоев
#[tauri::command]
pub fn get_windows_theme_wallpapers() -> Result<Vec<WallpaperInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let themes_path = get_themes_wallpapers_path()
            .ok_or("Папка с темами Windows не найдена")?;
        
        let mut wallpapers = Vec::new();
        
        // Рекурсивно ищем все изображения в папке
        fn scan_dir(dir: &Path, wallpapers: &mut Vec<WallpaperInfo>) -> std::io::Result<()> {
            if dir.is_dir() {
                for entry in fs::read_dir(dir)? {
                    let entry = entry?;
                    let path = entry.path();
                    
                    if path.is_dir() {
                        scan_dir(&path, wallpapers)?;
                    } else if let Some(ext) = path.extension() {
                        let ext_str = ext.to_string_lossy().to_lowercase();
                        if ["jpg", "jpeg", "png", "bmp"].contains(&ext_str.as_str()) {
                            let theme_name = path.parent()
                                .and_then(|p| p.file_name())
                                .and_then(|n| n.to_str())
                                .unwrap_or("Windows");
                            
                            wallpapers.push(WallpaperInfo {
                                path: path.to_string_lossy().to_string(),
                                title: Some(format!("{} - {}", theme_name, 
                                    path.file_stem().unwrap_or_default().to_string_lossy())),
                                copyright: Some("Microsoft Corporation".to_string()),
                                source: "theme".to_string(),
                            });
                        }
                    }
                }
            }
            Ok(())
        }
        
        scan_dir(&themes_path, &mut wallpapers)
            .map_err(|e| format!("Ошибка сканирования папки тем: {}", e))?;
        
        Ok(wallpapers)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Темы Windows доступны только на Windows".to_string())
    }
}

#[tauri::command]
pub fn get_file_base64(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("Файл не найден".to_string());
    }

    let bytes = fs::read(file_path)
        .map_err(|e| format!("Ошибка чтения файла: {}", e))?;
    
    let ext = file_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mime_type = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream"
    };
    
    let base64_str = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime_type, base64_str))
}

/// Устанавливает статические обои (изображение)
#[tauri::command]
pub fn set_wallpaper(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("Файл не найден".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{SystemParametersInfoW, SPIF_UPDATEINIFILE, SPIF_SENDCHANGE, SPI_SETDESKWALLPAPER};

        // Сохраняем оригинальные обои один раз
        {
            let mut orig = ORIGINAL_WALLPAPER_PATH.lock().unwrap();
            if orig.is_none() {
                if let Ok(reg) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
                    .open_subkey("Control Panel\\Desktop") 
                {
                    if let Ok(val) = reg.get_value::<String, _>("Wallpaper") {
                        if !val.trim().is_empty() {
                            *orig = Some(val);
                        }
                    }
                }
            }
        }

        let wide_path: Vec<u16> = OsStr::new(&path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            let result = SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                wide_path.as_ptr() as *mut _,
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            );

            if result == 0 {
                return Err("Не удалось установить обои".to_string());
            }
        }
        
        Ok("Обои успешно установлены".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Функция доступна только на Windows".to_string())
    }
}

/// Сброс обоев на стандартные Windows
#[tauri::command]
pub fn reset_wallpaper() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{SystemParametersInfoW, SPIF_UPDATEINIFILE, SPIF_SENDCHANGE, SPI_SETDESKWALLPAPER};

        // Восстанавливаем оригинальные обои
        let original = ORIGINAL_WALLPAPER_PATH.lock().unwrap().clone();
        let target = original.unwrap_or_else(|| "C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg".to_string());

        let wide_path: Vec<u16> = OsStr::new(&target).encode_wide().chain(std::iter::once(0)).collect();

        unsafe {
            let result = SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                wide_path.as_ptr() as *mut _,
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            );
            if result == 0 {
                return Err("Не удалось восстановить стандартные обои".to_string());
            }
        }

        Ok("Обои сброшены".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Функция доступна только на Windows".to_string())
    }
}

/// Получает текущие установленные обои
#[tauri::command]
pub fn get_current_wallpaper() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(reg) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
            .open_subkey("Control Panel\\Desktop") 
        {
            if let Ok(val) = reg.get_value::<String, _>("Wallpaper") {
                return Ok(val);
            }
        }
        Err("Не удалось получить путь к текущим обоям".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Функция доступна только на Windows".to_string())
    }
}
