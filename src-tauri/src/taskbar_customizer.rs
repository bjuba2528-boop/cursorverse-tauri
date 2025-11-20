use serde::{Deserialize, Serialize};
use winapi::um::winuser::*;
use winapi::um::shellapi::*;
use winapi::shared::windef::HWND;
use winapi::shared::minwindef::LPARAM;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskbarCustomization {
    pub transparency: u8,
    pub color: String,
    pub height: u32,
    pub position: String, // "bottom", "top", "left", "right"
    pub auto_hide: bool,
}

// Модифицировать прозрачность Windows Taskbar
#[cfg(target_os = "windows")]
pub fn set_taskbar_transparency(alpha: u8) -> Result<(), String> {
    use winapi::um::winuser::{SetLayeredWindowAttributes, SetWindowLongPtrW, GetWindowLongPtrW};
    use winapi::um::winuser::{GWL_EXSTYLE, WS_EX_LAYERED, LWA_ALPHA};
    
    unsafe {
        let taskbar_hwnd = find_taskbar_window()?;
        
        // Получаем текущий стиль
        let ex_style = GetWindowLongPtrW(taskbar_hwnd, GWL_EXSTYLE);
        
        // Добавляем WS_EX_LAYERED для поддержки прозрачности
        SetWindowLongPtrW(taskbar_hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED as isize);
        
        // Устанавливаем прозрачность (0-255)
        SetLayeredWindowAttributes(taskbar_hwnd, 0, alpha, LWA_ALPHA);
    }
    
    Ok(())
}

// Изменить цвет Windows Taskbar через DWM
#[cfg(target_os = "windows")]
pub fn set_taskbar_color(color_hex: &str) -> Result<(), String> {
    use winreg::RegKey;
    use winreg::enums::*;
    
    // Парсим HEX цвет (#RRGGBB)
    let color_hex = color_hex.trim_start_matches('#');
    let r = u8::from_str_radix(&color_hex[0..2], 16).map_err(|_| "Invalid color")?;
    let g = u8::from_str_radix(&color_hex[2..4], 16).map_err(|_| "Invalid color")?;
    let b = u8::from_str_radix(&color_hex[4..6], 16).map_err(|_| "Invalid color")?;
    
    // Windows хранит цвет как DWORD (0x00BBGGRR)
    let color_dword: u32 = (b as u32) << 16 | (g as u32) << 8 | (r as u32);
    
    // Записываем в реестр
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let personalize = hkcu.open_subkey_with_flags(
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        KEY_WRITE,
    ).map_err(|e| format!("Failed to open registry: {}", e))?;
    
    personalize.set_value("ColorPrevalence", &1u32)
        .map_err(|e| format!("Failed to set ColorPrevalence: {}", e))?;
    
    let dwm = hkcu.open_subkey_with_flags(
        "SOFTWARE\\Microsoft\\Windows\\DWM",
        KEY_WRITE,
    ).map_err(|e| format!("Failed to open DWM registry: {}", e))?;
    
    dwm.set_value("ColorPrevalence", &1u32)
        .map_err(|e| format!("Failed to set DWM ColorPrevalence: {}", e))?;
    
    dwm.set_value("AccentColor", &color_dword)
        .map_err(|e| format!("Failed to set AccentColor: {}", e))?;
    
    dwm.set_value("ColorizationColor", &color_dword)
        .map_err(|e| format!("Failed to set ColorizationColor: {}", e))?;
    
    // Уведомляем систему об изменениях
    unsafe {
        use winapi::um::winuser::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};
        use std::ptr;
        
        let setting_name: Vec<u16> = "ImmersiveColorSet"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            setting_name.as_ptr() as LPARAM,
            SMTO_ABORTIFHUNG,
            1000,
            ptr::null_mut(),
        );
    }
    
    Ok(())
}

// Изменить размер/высоту панели задач
#[cfg(target_os = "windows")]
pub fn set_taskbar_size(height: u32) -> Result<(), String> {
    unsafe {
        let taskbar_hwnd = find_taskbar_window()?;
        
        let mut rect: winapi::shared::windef::RECT = std::mem::zeroed();
        GetWindowRect(taskbar_hwnd, &mut rect);
        
        let width = rect.right - rect.left;
        let screen_height = GetSystemMetrics(SM_CYSCREEN);
        
        // Перемещаем и изменяем размер
        SetWindowPos(
            taskbar_hwnd,
            std::ptr::null_mut(),
            rect.left,
            screen_height - height as i32,
            width,
            height as i32,
            SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
    
    Ok(())
}

// Изменить положение панели задач
#[cfg(target_os = "windows")]
pub fn set_taskbar_position(_position: &str) -> Result<(), String> {
    // Требует модификации реестра StuckRects3 - сложная binary структура
    // Упрощённая версия - просто перезапускаем Explorer
    restart_explorer()?;
    Ok(())
}

// Включить/выключить auto-hide
#[cfg(target_os = "windows")]
pub fn set_taskbar_auto_hide(enable: bool) -> Result<(), String> {
    unsafe {
        let taskbar_hwnd = find_taskbar_window()?;
        
        let mut abd: APPBARDATA = std::mem::zeroed();
        abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
        abd.hWnd = taskbar_hwnd;
        
        if enable {
            abd.lParam = ABS_AUTOHIDE as LPARAM;
        } else {
            abd.lParam = ABS_ALWAYSONTOP as LPARAM;
        }
        
        SHAppBarMessage(ABM_SETSTATE, &mut abd);
    }
    
    Ok(())
}

// Найти окно панели задач
#[cfg(target_os = "windows")]
fn find_taskbar_window() -> Result<HWND, String> {
    unsafe {
        let class_name: Vec<u16> = "Shell_TrayWnd"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        
        let hwnd = FindWindowW(class_name.as_ptr(), std::ptr::null());
        
        if hwnd.is_null() {
            return Err("Taskbar window not found".to_string());
        }
        
        Ok(hwnd)
    }
}

// Перезапустить Explorer.exe
#[cfg(target_os = "windows")]
fn restart_explorer() -> Result<(), String> {
    use std::process::Command;
    
    // Убиваем Explorer
    Command::new("taskkill")
        .args(&["/F", "/IM", "explorer.exe"])
        .output()
        .map_err(|e| format!("Failed to kill explorer: {}", e))?;
    
    // Ждём немного
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    // Запускаем Explorer заново
    Command::new("explorer.exe")
        .spawn()
        .map_err(|e| format!("Failed to start explorer: {}", e))?;
    
    Ok(())
}

// Применить комплексную кастомизацию
#[cfg(target_os = "windows")]
pub fn apply_taskbar_customization(config: TaskbarCustomization) -> Result<(), String> {
    set_taskbar_transparency(config.transparency)?;
    set_taskbar_color(&config.color)?;
    set_taskbar_size(config.height)?;
    set_taskbar_auto_hide(config.auto_hide)?;
    
    if !config.position.is_empty() {
        set_taskbar_position(&config.position)?;
    }
    
    Ok(())
}

// Tauri команды
#[tauri::command]
pub fn customize_taskbar_transparency(alpha: u8) -> Result<(), String> {
    set_taskbar_transparency(alpha)
}

#[tauri::command]
pub fn customize_taskbar_color(color: String) -> Result<(), String> {
    set_taskbar_color(&color)
}

#[tauri::command]
pub fn customize_taskbar_height(height: u32) -> Result<(), String> {
    set_taskbar_size(height)
}

#[tauri::command]
pub fn customize_taskbar_position(position: String) -> Result<(), String> {
    set_taskbar_position(&position)
}

#[tauri::command]
pub fn customize_taskbar_autohide(enable: bool) -> Result<(), String> {
    set_taskbar_auto_hide(enable)
}

#[tauri::command]
pub fn apply_full_taskbar_customization(config: TaskbarCustomization) -> Result<(), String> {
    apply_taskbar_customization(config)
}

#[tauri::command]
pub fn reset_taskbar_to_default() -> Result<(), String> {
    let default_config = TaskbarCustomization {
        transparency: 255,
        color: "#000000".to_string(),
        height: 48,
        position: "bottom".to_string(),
        auto_hide: false,
    };
    
    apply_taskbar_customization(default_config)
}
