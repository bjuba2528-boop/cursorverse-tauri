use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use winapi::um::winuser::*;
use winapi::um::shellapi::{APPBARDATA, SHAppBarMessage, ABM_SETSTATE, ABS_AUTOHIDE, ABS_ALWAYSONTOP};
use winapi::shared::windef::HWND;
use winapi::shared::minwindef::{LPARAM, WPARAM};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub exe_path: String,
    pub icon_base64: String,
    pub is_visible: bool,
    pub is_minimized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedApp {
    pub name: String,
    pub exe_path: String,
    pub icon_base64: String,
    pub args: Option<String>,
}

#[allow(dead_code)]
pub struct TaskbarManager {
    windows: Arc<Mutex<HashMap<isize, WindowInfo>>>,
    pinned_apps: Arc<Mutex<Vec<PinnedApp>>>,
    is_hidden: bool,
}

#[allow(dead_code)]
impl TaskbarManager {
    pub fn new() -> Self {
        Self {
            windows: Arc::new(Mutex::new(HashMap::new())),
            pinned_apps: Arc::new(Mutex::new(Vec::new())),
            is_hidden: false,
        }
    }

    pub fn add_window(&self, window: WindowInfo) {
        let mut windows = self.windows.lock().unwrap();
        windows.insert(window.hwnd, window);
    }

    pub fn remove_window(&self, hwnd: isize) {
        let mut windows = self.windows.lock().unwrap();
        windows.remove(&hwnd);
    }

    pub fn get_all_windows(&self) -> Vec<WindowInfo> {
        let windows = self.windows.lock().unwrap();
        windows.values().cloned().collect()
    }

    pub fn add_pinned_app(&self, app: PinnedApp) {
        let mut pinned = self.pinned_apps.lock().unwrap();
        pinned.push(app);
    }

    pub fn get_pinned_apps(&self) -> Vec<PinnedApp> {
        let pinned = self.pinned_apps.lock().unwrap();
        pinned.clone()
    }
}

// Скрытие стандартной панели задач Windows
#[cfg(target_os = "windows")]
pub fn hide_windows_taskbar() -> Result<(), String> {
    unsafe {
        // Ищем окна панели задач
        let taskbar_classes = vec!["Shell_TrayWnd", "Shell_SecondaryTrayWnd"];
        
        for class_name in taskbar_classes {
            let class_wide: Vec<u16> = class_name.encode_utf16().chain(std::iter::once(0)).collect();
            let hwnd = FindWindowW(class_wide.as_ptr(), std::ptr::null());
            
            if !hwnd.is_null() {
                // Скрываем панель задач
                ShowWindow(hwnd, SW_HIDE);
                
                // Устанавливаем auto-hide через AppBarData
                let mut abd: APPBARDATA = std::mem::zeroed();
                abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
                abd.hWnd = hwnd;
                abd.lParam = ABS_AUTOHIDE as LPARAM;
                
                SHAppBarMessage(ABM_SETSTATE, &mut abd);
            }
        }
    }
    
    Ok(())
}

// Показ стандартной панели задач Windows
#[cfg(target_os = "windows")]
pub fn show_windows_taskbar() -> Result<(), String> {
    unsafe {
        let taskbar_classes = vec!["Shell_TrayWnd", "Shell_SecondaryTrayWnd"];
        
        for class_name in taskbar_classes {
            let class_wide: Vec<u16> = class_name.encode_utf16().chain(std::iter::once(0)).collect();
            let hwnd = FindWindowW(class_wide.as_ptr(), std::ptr::null());
            
            if !hwnd.is_null() {
                ShowWindow(hwnd, SW_SHOW);
                
                // Убираем auto-hide
                let mut abd: APPBARDATA = std::mem::zeroed();
                abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
                abd.hWnd = hwnd;
                abd.lParam = ABS_ALWAYSONTOP as LPARAM;
                
                SHAppBarMessage(ABM_SETSTATE, &mut abd);
            }
        }
    }
    
    Ok(())
}

// Получение списка всех окон
#[cfg(target_os = "windows")]
pub fn get_open_windows() -> Result<Vec<WindowInfo>, String> {
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::K32GetModuleFileNameExW;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let mut windows = Vec::new();

    unsafe {
        extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
            unsafe {
                let windows = &mut *(lparam as *mut Vec<WindowInfo>);
                
                // Проверяем видимость окна
                if IsWindowVisible(hwnd) == 0 {
                    return 1;
                }

                // Получаем длину заголовка
                let title_len = GetWindowTextLengthW(hwnd);
                if title_len == 0 {
                    return 1;
                }

                // Читаем заголовок
                let mut title_buf: Vec<u16> = vec![0; (title_len + 1) as usize];
                GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
                let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

                // Получаем PID процесса
                let mut process_id: u32 = 0;
                GetWindowThreadProcessId(hwnd, &mut process_id);

                // Открываем процесс для получения пути к exe
                let h_process = OpenProcess(PROCESS_QUERY_INFORMATION, 0, process_id);
                let mut exe_path = String::new();

                if !h_process.is_null() {
                    let mut exe_buf: Vec<u16> = vec![0; 260];
                    let len = K32GetModuleFileNameExW(h_process, std::ptr::null_mut(), exe_buf.as_mut_ptr(), exe_buf.len() as u32);
                    
                    if len > 0 {
                        exe_path = OsString::from_wide(&exe_buf[..len as usize])
                            .to_string_lossy()
                            .to_string();
                    }
                }

                // Извлекаем иконку окна
                let icon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL as WPARAM, 0) as isize;
                let icon_base64 = if icon != 0 {
                    match crate::system_tray::extract_icon_to_base64(icon as *mut _) {
                        Ok(base64) => base64,
                        Err(_) => String::new(),
                    }
                } else {
                    String::new()
                };

                windows.push(WindowInfo {
                    hwnd: hwnd as isize,
                    title,
                    exe_path,
                    icon_base64,
                    is_visible: true,
                    is_minimized: IsIconic(hwnd) != 0,
                });

                1 // Продолжить перечисление
            }
        }

        EnumWindows(Some(enum_windows_proc), &mut windows as *mut _ as LPARAM);
    }

    Ok(windows)
}

// Активация окна
#[cfg(target_os = "windows")]
pub fn activate_window(hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd = hwnd as HWND;
        
        // Если окно свёрнуто, разворачиваем
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
        }
        
        // Активируем окно
        SetForegroundWindow(hwnd);
    }
    
    Ok(())
}

// Закрытие окна
#[cfg(target_os = "windows")]
pub fn close_window(hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd = hwnd as HWND;
        PostMessageW(hwnd, WM_CLOSE, 0, 0);
    }
    
    Ok(())
}

// Сворачивание окна
#[cfg(target_os = "windows")]
pub fn minimize_window(hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd = hwnd as HWND;
        ShowWindow(hwnd, SW_MINIMIZE);
    }
    
    Ok(())
}

// Разворачивание окна
#[cfg(target_os = "windows")]
pub fn maximize_window(hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd = hwnd as HWND;
        ShowWindow(hwnd, SW_MAXIMIZE);
    }
    
    Ok(())
}

// Команды Tauri
#[tauri::command]
pub fn get_taskbar_windows() -> Result<Vec<WindowInfo>, String> {
    get_open_windows()
}

#[allow(dead_code)]
#[tauri::command]
pub fn taskbar_activate_window(hwnd: isize) -> Result<(), String> {
    activate_window(hwnd)
}

#[tauri::command]
pub fn taskbar_close_window(hwnd: isize) -> Result<(), String> {
    close_window(hwnd)
}

#[tauri::command]
pub fn taskbar_minimize_window(hwnd: isize) -> Result<(), String> {
    minimize_window(hwnd)
}

#[tauri::command]
pub fn taskbar_maximize_window(hwnd: isize) -> Result<(), String> {
    maximize_window(hwnd)
}

#[tauri::command]
pub fn taskbar_hide_windows_taskbar() -> Result<(), String> {
    hide_windows_taskbar()
}

#[tauri::command]
pub fn taskbar_show_windows_taskbar() -> Result<(), String> {
    show_windows_taskbar()
}

#[tauri::command]
pub fn get_pinned_apps_list() -> Result<Vec<PinnedApp>, String> {
    // TODO: Читать из реестра или файла
    Ok(vec![
        PinnedApp {
            name: "File Explorer".to_string(),
            exe_path: "explorer.exe".to_string(),
            icon_base64: String::new(),
            args: None,
        },
        PinnedApp {
            name: "Google Chrome".to_string(),
            exe_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe".to_string(),
            icon_base64: String::new(),
            args: None,
        },
    ])
}

#[tauri::command]
pub fn launch_pinned_app(exe_path: String, args: Option<String>) -> Result<(), String> {
    use std::process::Command;
    
    let mut cmd = Command::new(&exe_path);
    
    if let Some(args_str) = args {
        cmd.arg(args_str);
    }
    
    cmd.spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;
    
    Ok(())
}
