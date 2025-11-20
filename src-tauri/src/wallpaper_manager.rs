use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

static ORIGINAL_WALLPAPER_PATH: Lazy<Arc<Mutex<Option<String>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

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

#[tauri::command]
pub fn set_wallpaper(path: String, wallpaper_type: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("Файл не найден".to_string());
    }

    match wallpaper_type.as_str() {
        "image" => {
            #[cfg(target_os = "windows")]
            {
                use winapi::um::winuser::{SystemParametersInfoW, SPIF_UPDATEINIFILE, SPIF_SENDCHANGE, SPI_SETDESKWALLPAPER};

                // Сохраняем оригинальные обои один раз
                {
                    let mut orig = ORIGINAL_WALLPAPER_PATH.lock().unwrap();
                    if orig.is_none() {
                        if let Ok(reg) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER).open_subkey("Control Panel\\Desktop") {
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
        },
        "gif" | "video" => {
            Err("Для видео обоев используйте команду set_animated_wallpaper".to_string())
        },
        _ => Err("Неизвестный тип обоев".to_string())
    }
}

// Проверяет, установлен ли Lively Wallpaper (встроенный или системный)
fn check_lively_installed() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Сначала проверяем встроенную версию
        let embedded_path = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.join("lively").join("lively.exe")))
            .filter(|p| p.exists());

        if let Some(path) = embedded_path {
            return Ok(path.to_string_lossy().to_string());
        }

        // Проверяем реестр Windows
        if let Ok(reg) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
            .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall") 
        {
            for key_name in reg.enum_keys().filter_map(|k| k.ok()) {
                if key_name.to_lowercase().contains("lively") {
                    if let Ok(subkey) = reg.open_subkey(&key_name) {
                        if let Ok(install_location) = subkey.get_value::<String, _>("InstallLocation") {
                            let exe_path = Path::new(&install_location).join("Lively.exe");
                            if exe_path.exists() {
                                return Ok(exe_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }

        // Если нет встроенной - ищем системную
        let appdata = std::env::var("APPDATA").unwrap_or_default();
        let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
        
        let possible_paths = vec![
            format!("{}\\Programs\\Lively Wallpaper\\Lively.exe", localappdata),
            format!("{}\\Lively Wallpaper\\lively.exe", localappdata),
            format!("{}\\lively\\lively.exe", localappdata),
            "C:\\Program Files\\Lively Wallpaper\\lively.exe".to_string(),
            "C:\\Program Files (x86)\\Lively Wallpaper\\lively.exe".to_string(),
            format!("{}\\..\\Local\\lively\\lively.exe", appdata),
            format!("{}\\..\\Local\\Lively Wallpaper\\lively.exe", appdata),
        ];

        for path in possible_paths {
            if Path::new(&path).exists() {
                return Ok(path.to_string());
            }
        }

        Err("Не удалось найти Lively Wallpaper. Установите его и перезапустите приложение.".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Lively Wallpaper доступен только на Windows".to_string())
    }
}

// Запускает Lively Wallpaper с видео
fn launch_lively_with_video(lively_path: &str, video_path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // Запускаем Lively с параметрами командной строки
        Command::new(lively_path)
            .arg("--wallpaper")
            .arg(video_path)
            .spawn()
            .map_err(|e| format!("Не удалось запустить Lively Wallpaper: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Lively Wallpaper доступен только на Windows".to_string())
    }
}

#[tauri::command]
pub fn set_animated_wallpaper(_app: tauri::AppHandle, path: String, _wallpaper_type: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if !Path::new(&path).exists() {
            return Err("Файл не найден".to_string());
        }

        // Проверяем, установлен ли Lively Wallpaper
        let lively_path = check_lively_installed()?;
        
        // Запускаем Lively с видео
        launch_lively_with_video(&lively_path, &path)?;
        
        Ok(format!("Видео обои установлены через Lively Wallpaper: {}", path))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Анимированные обои поддерживаются только на Windows".to_string())
    }
}

// Скачивает и устанавливает Lively Wallpaper во встроенную папку
#[tauri::command]
pub fn install_lively_wallpaper() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;

        // Получаем путь к папке приложения
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Не удалось получить путь к exe: {}", e))?;
        let app_dir = exe_path.parent()
            .ok_or("Не удалось получить директорию приложения")?;
        let lively_dir = app_dir.join("lively");

        // Создаём папку если её нет
        std::fs::create_dir_all(&lively_dir)
            .map_err(|e| format!("Не удалось создать папку: {}", e))?;

        // URL последней версии Lively (setup installer)
        let download_url = "https://github.com/rocksdanister/lively/releases/latest/download/lively_setup_x86_full_v2210.exe";
        
        // Скачиваем архив
        let response = reqwest::blocking::get(download_url)
            .map_err(|e| format!("Ошибка скачивания: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Ошибка HTTP: {}", response.status()));
        }

        let bytes = response.bytes()
            .map_err(|e| format!("Ошибка чтения данных: {}", e))?;

        // Сохраняем во временный файл
        let temp_installer = lively_dir.join("lively_setup.exe");
        let mut file = std::fs::File::create(&temp_installer)
            .map_err(|e| format!("Не удалось создать файл: {}", e))?;
        file.write_all(&bytes)
            .map_err(|e| format!("Не удалось записать файл: {}", e))?;
        
        // Закрываем файл перед запуском
        drop(file);
        
        // Автоматически запускаем установщик
        use std::process::Command;
        Command::new(&temp_installer)
            .spawn()
            .map_err(|e| format!("Не удалось запустить установщик: {}", e))?;
        
        Ok(format!("Установщик Lively запущен!\n\nСледуйте инструкциям на экране для установки.\nПосле установки перезапустите Cursorverse."))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Доступно только на Windows".to_string())
    }
}

#[tauri::command]
pub fn check_lively_status() -> serde_json::Value {
    match check_lively_installed() {
        Ok(path) => serde_json::json!({
            "installed": true,
            "path": path,
            "message": "Lively Wallpaper установлен"
        }),
        Err(msg) => serde_json::json!({
            "installed": false,
            "path": "",
            "message": msg
        })
    }
}

#[tauri::command]
pub fn get_animated_wallpaper_status() -> serde_json::Value {
    serde_json::json!({ 
        "active": false, 
        "message": "Видео обои управляются через Lively Wallpaper" 
    })
}

#[tauri::command]
pub fn stop_animated_wallpaper() -> Result<String, String> {
    Ok("Остановите видео обои через настройки Lively Wallpaper".to_string())
}

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
