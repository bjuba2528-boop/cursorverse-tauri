use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use winapi::um::winuser::{GetIconInfo, ICONINFO};
use winapi::shared::windef::HICON;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemTrayIcon {
    pub id: String,
    pub window_handle: isize,
    pub uid: u32,
    pub callback_message: u32,
    pub tooltip: String,
    pub icon_base64: String,
    pub is_visible: bool,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct TrayIconManager {
    icons: Arc<Mutex<HashMap<String, SystemTrayIcon>>>,
}

#[allow(dead_code)]
impl TrayIconManager {
    pub fn new() -> Self {
        Self {
            icons: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn add_icon(&self, icon: SystemTrayIcon) {
        let mut icons = self.icons.lock().unwrap();
        icons.insert(icon.id.clone(), icon);
    }

    pub fn remove_icon(&self, id: &str) {
        let mut icons = self.icons.lock().unwrap();
        icons.remove(id);
    }

    pub fn update_icon(&self, id: &str, icon: SystemTrayIcon) {
        let mut icons = self.icons.lock().unwrap();
        icons.insert(id.to_string(), icon);
    }

    pub fn get_all_icons(&self) -> Vec<SystemTrayIcon> {
        let icons = self.icons.lock().unwrap();
        icons.values().cloned().collect()
    }

    pub fn get_icon(&self, id: &str) -> Option<SystemTrayIcon> {
        let icons = self.icons.lock().unwrap();
        icons.get(id).cloned()
    }
}

// Извлечение иконки из HICON в base64 PNG
#[cfg(target_os = "windows")]
pub fn extract_icon_to_base64(hicon: HICON) -> Result<String, String> {
    if hicon.is_null() {
        return Err("HICON is null".to_string());
    }

    unsafe {
        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            return Err("GetIconInfo failed".to_string());
        }

        // Используем код из resource_editor для конвертации
        use winapi::um::wingdi::{GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteObject};
        use winapi::um::winuser::GetDC;
        use std::ptr;

        let hdc = GetDC(ptr::null_mut());
        if hdc.is_null() {
            DeleteObject(icon_info.hbmColor as *mut _);
            DeleteObject(icon_info.hbmMask as *mut _);
            return Err("GetDC failed".to_string());
        }

        // Предполагаем размер 32x32 для трей-иконок
        let size: u32 = 32;
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = size as i32;
        bmi.bmiHeader.biHeight = -(size as i32);
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut buffer: Vec<u8> = vec![0u8; (size * size * 4) as usize];

        let result = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            size,
            buffer.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        DeleteObject(icon_info.hbmColor as *mut _);
        DeleteObject(icon_info.hbmMask as *mut _);

        if result == 0 {
            return Err("GetDIBits failed".to_string());
        }

        // Конвертируем BGRA в RGBA
        for i in (0..buffer.len()).step_by(4) {
            buffer.swap(i, i + 2);
        }

        // Создаём PNG
        use image::RgbaImage;
        use std::io::Cursor;

        let img = RgbaImage::from_raw(size, size, buffer)
            .ok_or_else(|| "Failed to create image".to_string())?;

        let mut png_data = Vec::new();
        let mut cursor = Cursor::new(&mut png_data);
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG encoding failed: {}", e))?;

        let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_data);
        Ok(format!("data:image/png;base64,{}", base64_str))
    }
}

// Команды Tauri для работы с трей-иконками
#[tauri::command]
pub fn get_system_tray_icons() -> Result<Vec<SystemTrayIcon>, String> {
    // Здесь будет логика получения иконок из Windows
    // Пока возвращаем пустой список
    Ok(Vec::new())
}

#[tauri::command]
pub fn send_tray_icon_click(_icon_id: String, _button: String) -> Result<(), String> {
    // Отправка клика по трей-иконке
    // button: "left", "right", "middle"
    Ok(())
}

#[tauri::command]
pub fn show_tray_icon_menu(_icon_id: String, _x: i32, _y: i32) -> Result<(), String> {
    // Показ контекстного меню трей-иконки
    Ok(())
}
