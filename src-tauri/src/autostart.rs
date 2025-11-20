use winreg::enums::*;
use winreg::RegKey;

const STARTUP_KEY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_NAME: &str = "CursorVersePets";

#[tauri::command]
pub fn enable_autostart() -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_path_str = exe_path
        .to_str()
        .ok_or_else(|| "Invalid executable path".to_string())?;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(STARTUP_KEY_PATH)
        .map_err(|e| format!("Failed to open registry key: {}", e))?;

    key.set_value(APP_NAME, &exe_path_str)
        .map_err(|e| format!("Failed to set registry value: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn disable_autostart() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey_with_flags(STARTUP_KEY_PATH, KEY_WRITE)
        .map_err(|e| format!("Failed to open registry key: {}", e))?;

    // Ignore error if key doesn't exist
    key.delete_value(APP_NAME).ok();

    Ok(())
}

#[tauri::command]
pub fn is_autostart_enabled() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey(STARTUP_KEY_PATH)
        .map_err(|e| format!("Failed to open registry key: {}", e))?;

    match key.get_value::<String, _>(APP_NAME) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
