use serde::{Serialize, Deserialize};
use winreg::enums::*;
use winreg::RegKey;

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
pub struct ThemeConfig {
    pub dark_mode: bool,
    pub accent_color: String,
    pub transparency: bool,
    pub taskbar_autohide: bool,
}

#[tauri::command]
pub fn set_dark_mode(enable: bool) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    
    match hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
        Ok(key) => {
            let value: u32 = if enable { 0 } else { 1 };
            key.set_value("AppsUseLightTheme", &value).map_err(|e| e.to_string())?;
            key.set_value("SystemUsesLightTheme", &value).map_err(|e| e.to_string())?;
            
            unsafe {
                winapi::um::winuser::PostMessageW(
                    winapi::um::winuser::HWND_BROADCAST,
                    0x001A, // WM_SETTINGCHANGE
                    0,
                    0
                );
            }
            
            Ok(if enable { "Тёмный режим включен".to_string() } else { "Светлый режим включен".to_string() })
        }
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub fn get_dark_mode() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    
    match hkcu.open_subkey(path) {
        Ok(key) => {
            let value: u32 = key.get_value("AppsUseLightTheme").unwrap_or(1);
            Ok(value == 0)
        }
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub fn set_accent_color(color: String) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let dwm_path = r"Software\Microsoft\Windows\DWM";
    let personalize_path = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    
    // Преобразуем #RRGGBB в ABGR DWORD
    let color_hex = color.trim_start_matches('#');
    if color_hex.len() != 6 {
        return Err("Неверный формат цвета".to_string());
    }
    
    let r = u8::from_str_radix(&color_hex[0..2], 16).map_err(|e| e.to_string())?;
    let g = u8::from_str_radix(&color_hex[2..4], 16).map_err(|e| e.to_string())?;
    let b = u8::from_str_radix(&color_hex[4..6], 16).map_err(|e| e.to_string())?;
    
    let abgr: u32 = 0xFF000000 | ((b as u32) << 16) | ((g as u32) << 8) | (r as u32);
    
    // Устанавливаем в DWM
    if let Ok(key) = hkcu.open_subkey_with_flags(dwm_path, KEY_SET_VALUE) {
        key.set_value("ColorizationColor", &abgr).ok();
        key.set_value("AccentColor", &abgr).ok();
        key.set_value("ColorizationColorBalance", &80u32).ok();
        key.set_value("ColorPrevalence", &1u32).ok();
    }
    
    // Устанавливаем в Personalize для панели задач и окон
    if let Ok(key) = hkcu.open_subkey_with_flags(personalize_path, KEY_SET_VALUE) {
        key.set_value("ColorPrevalence", &1u32).ok();
    }
    
    // Перезапускаем DWM для применения изменений
    unsafe {
        use std::process::Command;
        // Отправляем сообщение всем окнам об изменении настроек
        winapi::um::winuser::PostMessageW(
            winapi::um::winuser::HWND_BROADCAST,
            0x001A, // WM_SETTINGCHANGE
            0,
            b"ImmersiveColorSet\0".as_ptr() as isize
        );
        
        // Пытаемся перезапустить explorer.exe для полного применения
        Command::new("taskkill").args(&["/F", "/IM", "explorer.exe"]).output().ok();
        Command::new("explorer.exe").spawn().ok();
    }
    
    Ok(format!("Акцентный цвет установлен: {}. Перезапустите Проводник для полного применения.", color))
}

#[tauri::command]
pub fn set_transparency(enable: bool) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    
    match hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
        Ok(key) => {
            let value: u32 = if enable { 1 } else { 0 };
            key.set_value("EnableTransparency", &value).map_err(|e| e.to_string())?;
            
            unsafe {
                winapi::um::winuser::PostMessageW(
                    winapi::um::winuser::HWND_BROADCAST,
                    0x001A,
                    0,
                    0
                );
            }
            
            Ok(if enable { "Прозрачность включена".to_string() } else { "Прозрачность выключена".to_string() })
        }
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub fn set_taskbar_autohide(enable: bool) -> Result<String, String> {
    use std::io;
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3";
    
    match hkcu.open_subkey_with_flags(path, KEY_READ | KEY_SET_VALUE) {
        Ok(key) => {
            // Читаємо поточні налаштування як бінарні дані
            let settings_result: Result<Vec<u8>, io::Error> = key.get_raw_value("Settings")
                .map(|v| v.bytes)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()));
            
            let mut settings = settings_result.unwrap_or_else(|_| vec![0; 44]);
            
            // Байт 8 відповідає за автоскритття (бітмаска)
            if settings.len() >= 9 {
                if enable {
                    settings[8] |= 0x01; // Встановлюємо біт автоскриття
                } else {
                    settings[8] &= !0x01; // Знімаємо біт автоскриття
                }
                
                key.set_raw_value("Settings", &winreg::RegValue {
                    bytes: settings,
                    vtype: winreg::enums::RegType::REG_BINARY,
                }).map_err(|e| e.to_string())?;
            }
            
            // Перезапускаємо explorer.exe швидко
            use std::process::Command;
            std::thread::spawn(|| {
                Command::new("taskkill").args(&["/F", "/IM", "explorer.exe"]).output().ok();
                std::thread::sleep(std::time::Duration::from_millis(100));
                Command::new("explorer.exe").spawn().ok();
            });
            
            Ok(if enable { "Автоскрытие включено".to_string() } else { "Автоскрытие выключено".to_string() })
        }
        Err(e) => Err(format!("Ошибка доступа к реестру: {}", e))
    }
}

#[tauri::command]
pub fn reset_to_defaults() -> Result<String, String> {
    set_dark_mode(false)?;
    set_transparency(true)?;
    set_taskbar_autohide(false)?;
    set_accent_color("#0078D4".to_string())?;
    
    Ok("Настройки сброшены к стандартным".to_string())
}

// Переключить отображение значков на рабочем столе
#[tauri::command]
pub fn toggle_desktop_icons(show: bool) -> Result<String, String> {
    unsafe {
        use winapi::um::winuser::{FindWindowW, SendMessageW};
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        
        let progman: Vec<u16> = OsStr::new("Progman").encode_wide().chain(std::iter::once(0)).collect();
        let hwnd = FindWindowW(progman.as_ptr(), std::ptr::null());
        
        if hwnd.is_null() {
            return Err("Не удалось найти окно рабочего стола".to_string());
        }
        
        let msg = if show { 0x0111 } else { 0x0111 }; // WM_COMMAND
        let wparam = 0x7402; // Toggle Desktop
        SendMessageW(hwnd, msg, wparam, 0);
    }
    
    Ok(if show { "Значки рабочего стола показаны".to_string() } else { "Значки рабочего стола скрыты".to_string() })
}

// Переключить анимацию окон
#[tauri::command]
pub fn toggle_window_animations(enable: bool) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Control Panel\Desktop\WindowMetrics";
    
    match hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
        Ok(key) => {
            let value = if enable { "1" } else { "0" };
            key.set_value("MinAnimate", &value).map_err(|e| e.to_string())?;
            
            unsafe {
                winapi::um::winuser::PostMessageW(
                    winapi::um::winuser::HWND_BROADCAST,
                    0x001A,
                    0,
                    0
                );
            }
            
            Ok(if enable { "Анимация окон включена".to_string() } else { "Анимация окон выключена".to_string() })
        }
        Err(e) => Err(e.to_string())
    }
}

// Переключить кнопку "Представление задач" на панели
#[tauri::command]
pub fn toggle_taskview_button(show: bool) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
    
    match hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
        Ok(key) => {
            let value: u32 = if show { 1 } else { 0 };
            key.set_value("ShowTaskViewButton", &value).map_err(|e| e.to_string())?;
            
            unsafe {
                winapi::um::winuser::PostMessageW(
                    winapi::um::winuser::HWND_BROADCAST,
                    0x001A,
                    0,
                    0
                );
            }
            
            Ok(if show { "Кнопка 'Представление задач' показана".to_string() } else { "Кнопка 'Представление задач' скрыта".to_string() })
        }
        Err(e) => Err(e.to_string())
    }
}

// Змінити стиль меню Пуск (Windows 11 центр / Windows 10 зліва)
#[tauri::command]
pub fn set_start_menu_style(style: String) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
    
    match hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
        Ok(key) => {
            // 0 = центр (Win11), 1 = зліва (Win10)
            let value: u32 = if style == "win11" { 0 } else { 1 };
            key.set_value("TaskbarAl", &value).map_err(|e| e.to_string())?;
            
            // Перезапускаємо explorer для застосування
            use std::process::Command;
            std::thread::spawn(|| {
                Command::new("taskkill").args(&["/F", "/IM", "explorer.exe"]).output().ok();
                std::thread::sleep(std::time::Duration::from_millis(100));
                Command::new("explorer.exe").spawn().ok();
            });
            
            Ok(if style == "win10" { 
                "Меню Пуск перемещено влево (Windows 10)".to_string() 
            } else { 
                "Меню Пуск по центру (Windows 11)".to_string() 
            })
        }
        Err(e) => Err(e.to_string())
    }
}

// Змінити іконку Windows на панелі задач
#[tauri::command]
pub fn change_windows_icon(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    
    // Відкриваємо діалог вибору файлу
    // Note: В Tauri 2.x нужно использовать DialogExt trait и app.dialog()
    let file_path = app.dialog()
        .file()
        .add_filter("Іконки", &["ico", "png"])
        .blocking_pick_file();
    
    if let Some(file_path_enum) = file_path {
        // FilePath - это enum, нужно преобразовать в PathBuf
        let path: std::path::PathBuf = match file_path_enum {
            FilePath::Url(url) => std::path::PathBuf::from(url.path()),
            FilePath::Path(p) => p,
        };
        
        let path_str = path.to_string_lossy().to_string();
        
        // Копіюємо іконку в системну папку
        let app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let target_dir = std::path::Path::new(&app_data).join("CursorVerse").join("icons");
        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        
        let icon_name = path.file_name().unwrap_or_default();
        let target_path = target_dir.join(icon_name);
        std::fs::copy(&path, &target_path).map_err(|e| e.to_string())?;
        
        // Записуємо шлях в реєстр (це не стандартна функція Windows, потрібні сторонні утиліти)
        // Але збережемо налаштування для можливого використання
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let reg_path = r"Software\CursorVerse\Settings";
        
        match hkcu.create_subkey(reg_path) {
            Ok((key, _)) => {
                key.set_value("StartButtonIcon", &target_path.to_string_lossy().to_string())
                    .map_err(|e| e.to_string())?;
                
                Ok(format!("Іконка збережена: {}. Примітка: для зміни іконки Windows потрібні додаткові утиліти типу StartIsBack або ResourceHacker.", path_str))
            }
            Err(e) => Err(e.to_string())
        }
    } else {
        Err("Файл не вибрано".to_string())
    }
}
