use serde::{Deserialize, Serialize};
use winapi::um::winuser::*;
use winapi::shared::windef::HWND;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowThumbnail {
    pub hwnd: isize,
    pub title: String,
    pub thumbnail_base64: String,
    pub width: u32,
    pub height: u32,
}

// Получить превью окна через DWM (Desktop Window Manager)
#[cfg(target_os = "windows")]
pub fn capture_window_thumbnail(hwnd: isize, max_width: u32, max_height: u32) -> Result<String, String> {
    use winapi::um::dwmapi::DwmGetWindowAttribute;
    use winapi::um::dwmapi::DWMWA_CLOAKED;
    use winapi::um::wingdi::*;
    use winapi::shared::windef::RECT;
    use std::ptr;
    
    unsafe {
        let hwnd = hwnd as HWND;
        
        // Проверяем, не скрыто ли окно через DWM
        let mut cloaked: u32 = 0;
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut _ as *mut _,
            std::mem::size_of::<u32>() as u32,
        );
        
        if cloaked != 0 {
            return Err("Window is cloaked".to_string());
        }
        
        // Получаем размер окна
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return Err("GetWindowRect failed".to_string());
        }
        
        let width = (rect.right - rect.left) as u32;
        let height = (rect.bottom - rect.top) as u32;
        
        if width == 0 || height == 0 {
            return Err("Window has zero dimensions".to_string());
        }
        
        // Вычисляем масштаб для thumbnail
        let scale_w = max_width as f32 / width as f32;
        let scale_h = max_height as f32 / height as f32;
        let scale = scale_w.min(scale_h).min(1.0);
        
        let thumb_w = (width as f32 * scale) as u32;
        let thumb_h = (height as f32 * scale) as u32;
        
        // Создаём контекст устройства
        let hdc_screen = GetDC(ptr::null_mut());
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
        let old_bm = SelectObject(hdc_mem, hbm as *mut _);
        
        // Печатаем окно в bitmap
        PrintWindow(hwnd, hdc_mem, 0);
        
        // Создаём DIB для конвертации в PNG
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width as i32;
        bmi.bmiHeader.biHeight = -(height as i32);
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;
        
        let mut buffer: Vec<u8> = vec![0u8; (width * height * 4) as usize];
        
        GetDIBits(
            hdc_mem,
            hbm,
            0,
            height,
            buffer.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );
        
        // Cleanup GDI
        SelectObject(hdc_mem, old_bm);
        DeleteObject(hbm as *mut _);
        DeleteDC(hdc_mem);
        ReleaseDC(ptr::null_mut(), hdc_screen);
        
        // Конвертируем BGRA в RGBA
        for i in (0..buffer.len()).step_by(4) {
            buffer.swap(i, i + 2);
        }
        
        // Создаём PNG через image crate
        use image::{RgbaImage, DynamicImage};
        use std::io::Cursor;
        
        let img = RgbaImage::from_raw(width, height, buffer)
            .ok_or_else(|| "Failed to create image".to_string())?;
        
        // Resize если нужно
        let final_img = if scale < 1.0 {
            DynamicImage::ImageRgba8(img).resize_exact(
                thumb_w,
                thumb_h,
                image::imageops::FilterType::Lanczos3,
            )
        } else {
            DynamicImage::ImageRgba8(img)
        };
        
        // Кодируем в PNG base64
        let mut png_data = Vec::new();
        let mut cursor = Cursor::new(&mut png_data);
        final_img
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG encoding failed: {}", e))?;
        
        let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_data);
        Ok(format!("data:image/png;base64,{}", base64_str))
    }
}

// Tauri команда
#[tauri::command]
pub fn get_window_thumbnail(hwnd: isize) -> Result<String, String> {
    capture_window_thumbnail(hwnd, 320, 240)
}

#[tauri::command]
pub fn get_all_window_thumbnails() -> Result<Vec<WindowThumbnail>, String> {
    let windows = crate::taskbar::get_open_windows()?;
    
    let mut thumbnails = Vec::new();
    
    for win in windows {
        if let Ok(thumb_base64) = capture_window_thumbnail(win.hwnd, 320, 240) {
            thumbnails.push(WindowThumbnail {
                hwnd: win.hwnd,
                title: win.title,
                thumbnail_base64: thumb_base64,
                width: 320,
                height: 240,
            });
        }
    }
    
    Ok(thumbnails)
}
