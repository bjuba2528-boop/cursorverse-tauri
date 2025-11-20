use serde::{Serialize, Deserialize};
use winapi::um::winuser::*;
use winapi::shared::windef::HWND;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub visible: bool,
}

#[tauri::command]
pub fn get_window_list() -> Result<Vec<WindowInfo>, String> {
    let mut windows = Vec::new();
    
    unsafe {
        EnumWindows(Some(enum_windows_callback), &mut windows as *mut _ as isize);
    }
    
    Ok(windows)
}

unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: isize) -> i32 {
    let windows = &mut *(lparam as *mut Vec<WindowInfo>);
    
    // Проверяем, видимо ли окно
    let is_visible = IsWindowVisible(hwnd) != 0;
    
    // Получаем заголовок окна
    let mut buffer: [u16; 512] = [0; 512];
    let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
    
    if len > 0 {
        let title = OsString::from_wide(&buffer[..len as usize])
            .to_string_lossy()
            .to_string();
        
        // Фильтруем системные окна без заголовка и невидимые
        if !title.is_empty() && is_visible {
            // Проверяем, что это не окно без кнопки на панели задач
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
            let is_tool_window = (ex_style & WS_EX_TOOLWINDOW as i32) != 0;
            let is_app_window = (ex_style & WS_EX_APPWINDOW as i32) != 0;
            
            // Проверяем родителя
            let parent = GetWindow(hwnd, GW_OWNER);
            
            // Добавляем только окна приложений (не tool windows и без родителя, или с флагом APPWINDOW)
            if (!is_tool_window && parent.is_null()) || is_app_window {
                windows.push(WindowInfo {
                    hwnd: hwnd as isize,
                    title,
                    visible: is_visible,
                });
            }
        }
    }
    
    1 // Продолжить перебор
}

#[tauri::command]
pub fn activate_window(hwnd: isize) -> Result<String, String> {
    unsafe {
        let hwnd_ptr = hwnd as HWND;
        
        // Проверяем, существует ли окно
        if IsWindow(hwnd_ptr) == 0 {
            return Err("Окно не найдено".to_string());
        }
        
        // Если окно свернуто, разворачиваем
        if IsIconic(hwnd_ptr) != 0 {
            ShowWindow(hwnd_ptr, SW_RESTORE);
        }
        
        // Выводим окно на передний план
        SetForegroundWindow(hwnd_ptr);
        
        // Даем фокус
        SetFocus(hwnd_ptr);
        
        Ok("Окно активировано".to_string())
    }
}
