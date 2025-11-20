use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use std::io::{Write, Cursor};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconResource {
    pub id: u32,
    pub width: u32,
    pub height: u32,
    pub bits_per_pixel: u16,
    pub data_base64: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceInfo {
    pub resource_type: String,
    pub resource_id: u32,
    pub resource_name: String,
    pub size: usize,
}

// Извлечение всех иконок из EXE/DLL файла
#[tauri::command]
pub async fn extract_icons_from_file(file_path: String) -> Result<Vec<IconResource>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_icons_sync(&file_path)
    })
    .await
    .unwrap_or_else(|e| Err(format!("Ошибка потока: {:?}", e)))
}

fn extract_icons_sync(file_path: &str) -> Result<Vec<IconResource>, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err("Файл не найден".to_string());
    }

    // Используем Windows API для извлечения иконок
    #[cfg(target_os = "windows")]
    {
        use winapi::um::shellapi::ExtractIconExW;
        use winapi::um::winuser::{GetIconInfo, ICONINFO, DestroyIcon};
        use winapi::shared::windef::HICON;
        use std::ptr;

        let wide_path: Vec<u16> = file_path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut icons = Vec::new();
        
        // Сначала проверяем сколько иконок в файле
        let icon_count = unsafe {
            ExtractIconExW(
                wide_path.as_ptr(),
                -1, // -1 = get count
                ptr::null_mut(),
                ptr::null_mut(),
                0,
            )
        };

        if icon_count == 0 {
            return Err("В файле нет иконок".to_string());
        }

        // Извлекаем иконки (максимум 10)
        let extract_count = icon_count.min(10);
        let mut large_icons: Vec<HICON> = vec![ptr::null_mut(); extract_count as usize];
        let mut small_icons: Vec<HICON> = vec![ptr::null_mut(); extract_count as usize];
        
        unsafe {
            ExtractIconExW(
                wide_path.as_ptr(),
                0,
                large_icons.as_mut_ptr(),
                small_icons.as_mut_ptr(),
                extract_count,
            );

            // Обрабатываем большие иконки
            for (i, &hicon) in large_icons.iter().enumerate() {
                if hicon.is_null() {
                    continue;
                }

                // Пробуем определить размер иконки
                let mut icon_info: ICONINFO = std::mem::zeroed();
                if GetIconInfo(hicon, &mut icon_info) != 0 {
                    // Предполагаем стандартные размеры
                    let size = match i {
                        0 => 256,
                        1 => 128,
                        2 => 64,
                        3 => 48,
                        4 => 32,
                        _ => 32,
                    };

                    if let Ok(icon_data) = icon_to_png(hicon, size) {
                        icons.push(IconResource {
                            id: i as u32,
                            width: size,
                            height: size,
                            bits_per_pixel: 32,
                            data_base64: icon_data,
                        });
                    }

                    // Освобождаем ресурсы
                    winapi::um::wingdi::DeleteObject(icon_info.hbmColor as *mut _);
                    winapi::um::wingdi::DeleteObject(icon_info.hbmMask as *mut _);
                }
                
                DestroyIcon(hicon);
            }

            // Очищаем малые иконки
            for &hicon in small_icons.iter() {
                if !hicon.is_null() {
                    DestroyIcon(hicon);
                }
            }
        }
        
        if icons.is_empty() {
            return Err("Не удалось извлечь иконки из файла".to_string());
        }
        
        Ok(icons)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Работа с ресурсами доступна только на Windows".to_string())
    }
}

// Конвертация HICON в PNG base64
#[cfg(target_os = "windows")]
unsafe fn icon_to_png(hicon: winapi::shared::windef::HICON, size: u32) -> Result<String, String> {
    use winapi::um::winuser::{GetIconInfo, ICONINFO};
    use winapi::um::wingdi::{GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteObject};
    use winapi::um::winuser::GetDC;
    use std::ptr;
    use std::mem;
    
    let mut icon_info: ICONINFO = mem::zeroed();
    if GetIconInfo(hicon, &mut icon_info) == 0 {
        return Err("GetIconInfo failed".to_string());
    }
    
    let hdc = GetDC(ptr::null_mut());
    if hdc.is_null() {
        DeleteObject(icon_info.hbmColor as *mut _);
        DeleteObject(icon_info.hbmMask as *mut _);
        return Err("GetDC failed".to_string());
    }
    
    let mut bmi: BITMAPINFO = mem::zeroed();
    bmi.bmiHeader.biSize = mem::size_of::<BITMAPINFOHEADER>() as u32;
    bmi.bmiHeader.biWidth = size as i32;
    bmi.bmiHeader.biHeight = -(size as i32); // top-down
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
    let img = image::RgbaImage::from_raw(size, size, buffer)
        .ok_or_else(|| "Failed to create image".to_string())?;
    
    let mut png_data = Vec::new();
    let mut cursor = Cursor::new(&mut png_data);
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encoding failed: {}", e))?;
    
    let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_data);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

// Получить список системных файлов с иконками
#[tauri::command]
pub fn get_system_icon_files() -> Result<Vec<String>, String> {
    let system32 = std::env::var("SystemRoot")
        .map(|root| format!("{}\\System32", root))
        .unwrap_or_else(|_| "C:\\Windows\\System32".to_string());
    
    let icon_files = vec![
        format!("{}\\shell32.dll", system32),
        format!("{}\\imageres.dll", system32),
        format!("{}\\ddores.dll", system32),
        format!("{}\\ieframe.dll", system32),
        format!("{}\\explorer.exe", system32),
        format!("{}\\actioncenter.dll", system32),
        format!("{}\\compstui.dll", system32),
        format!("{}\\mmcndmgr.dll", system32),
        format!("{}\\moricons.dll", system32),
        format!("{}\\netshell.dll", system32),
        format!("{}\\pifmgr.dll", system32),
        format!("{}\\setupapi.dll", system32),
        format!("{}\\wmploc.dll", system32),
    ];
    
    // Фильтруем только существующие файлы
    let existing: Vec<String> = icon_files
        .into_iter()
        .filter(|path| Path::new(path).exists())
        .collect();
    
    Ok(existing)
}

// Изменить иконку системного объекта (Мой компьютер, Корзина и т.д.)
#[tauri::command]
pub fn set_system_icon(icon_type: String, icon_path: String, icon_index: i32) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::RegKey;
        use winreg::enums::*;
        
        let registry_path = match icon_type.as_str() {
            "my_computer" => "CLSID\\{20D04FE0-3AEA-1069-A2D8-08002B30309D}\\DefaultIcon",
            "recycle_bin_empty" => "CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\DefaultIcon",
            "recycle_bin_full" => "CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\DefaultIcon\\Full",
            "network" => "CLSID\\{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}\\DefaultIcon",
            "user_folder" => "CLSID\\{59031a47-3f72-44a7-89c5-5595fe6b30ee}\\DefaultIcon",
            "control_panel" => "CLSID\\{21EC2020-3AEA-1069-A2DD-08002B30309D}\\DefaultIcon",
            _ => return Err("Неизвестный тип иконки".to_string()),
        };
        
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu
            .create_subkey(format!("Software\\Classes\\{}", registry_path))
            .map_err(|e| format!("Не удалось создать ключ реестра: {}", e))?;
        
        let icon_string = if icon_index == 0 {
            icon_path
        } else {
            format!("{},{}", icon_path, icon_index)
        };
        
        key.set_value("", &icon_string)
            .map_err(|e| format!("Не удалось установить значение: {}", e))?;
        
        // Обновляем иконки без перезагрузки Explorer
        refresh_icon_cache()?;
        
        Ok(format!("Иконка {} изменена на {}", icon_type, icon_string))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Работа с системными иконками доступна только на Windows".to_string())
    }
}

// Обновить кэш иконок Windows
#[cfg(target_os = "windows")]
fn refresh_icon_cache() -> Result<(), String> {
    use winapi::um::winuser::{SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG};
    use std::ptr;
    
    unsafe {
        let msg = "Environment\0".encode_utf16().collect::<Vec<u16>>();
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            msg.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            ptr::null_mut(),
        );
    }
    
    // Также можем убить и перезапустить explorer.exe
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(100));
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/IM", "explorer.exe"])
            .output();
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = std::process::Command::new("explorer.exe").spawn();
    });
    
    Ok(())
}

// Заменить иконку в EXE файле
#[tauri::command]
pub async fn replace_icon_in_exe(
    exe_path: String,
    icon_path: String,
    backup: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        replace_icon_sync(&exe_path, &icon_path, backup)
    })
    .await
    .unwrap_or_else(|e| Err(format!("Ошибка потока: {:?}", e)))
}

fn replace_icon_sync(exe_path: &str, icon_path: &str, backup: bool) -> Result<String, String> {
    // Создаём бэкап если требуется
    if backup {
        let backup_path = format!("{}.backup", exe_path);
        fs::copy(exe_path, &backup_path)
            .map_err(|e| format!("Не удалось создать бэкап: {}", e))?;
    }
    
    // Загружаем новую иконку
    let icon_data = load_icon_file(icon_path)?;
    
    #[cfg(target_os = "windows")]
    {
        // Используем BeginUpdateResourceW / UpdateResourceW / EndUpdateResourceW
        use winapi::um::winbase::{BeginUpdateResourceW, UpdateResourceW, EndUpdateResourceW};
        use winapi::shared::minwindef::{FALSE, TRUE};
        use winapi::shared::ntdef::LPWSTR;
        
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        
        unsafe {
            let handle = BeginUpdateResourceW(wide_path.as_ptr(), FALSE);
            if handle.is_null() {
                return Err("BeginUpdateResource failed".to_string());
            }
            
            // RT_ICON = 3, RT_GROUP_ICON = 14
            const RT_GROUP_ICON: LPWSTR = 14 as LPWSTR;
            
            // Обновляем группу иконок (обычно ID 1)
            let result = UpdateResourceW(
                handle,
                RT_GROUP_ICON,
                1 as LPWSTR,
                0, // LANG_NEUTRAL
                icon_data.as_ptr() as *mut _,
                icon_data.len() as u32,
            );
            
            if result == 0 {
                EndUpdateResourceW(handle, TRUE); // Откатываем изменения
                return Err("UpdateResource failed".to_string());
            }
            
            if EndUpdateResourceW(handle, FALSE) == 0 {
                return Err("EndUpdateResource failed".to_string());
            }
        }
        
        Ok(format!("Иконка успешно заменена в {}", exe_path))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Замена иконок доступна только на Windows".to_string())
    }
}

fn load_icon_file(icon_path: &str) -> Result<Vec<u8>, String> {
    let path = Path::new(icon_path);
    if !path.exists() {
        return Err("Файл иконки не найден".to_string());
    }
    
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    match ext.as_str() {
        "ico" => {
            // Загружаем .ico файл как есть
            fs::read(icon_path).map_err(|e| format!("Ошибка чтения .ico: {}", e))
        }
        "png" | "jpg" | "jpeg" | "bmp" => {
            // Конвертируем изображение в .ico формат
            convert_image_to_ico(icon_path)
        }
        _ => Err("Неподдерживаемый формат иконки. Используйте .ico, .png, .jpg или .bmp".to_string())
    }
}

fn convert_image_to_ico(image_path: &str) -> Result<Vec<u8>, String> {
    use image::imageops::FilterType;
    
    let img = image::open(image_path)
        .map_err(|e| format!("Не удалось открыть изображение: {}", e))?;
    
    let mut ico_data = Vec::new();
    let mut cursor = Cursor::new(&mut ico_data);
    
    // ICO header
    cursor.write_all(&[0, 0, 1, 0]).unwrap(); // Reserved, Type (1 = icon)
    
    // Генерируем иконки разных размеров
    let sizes = vec![256, 128, 64, 48, 32, 16];
    cursor.write_all(&[sizes.len() as u8, 0]).unwrap(); // Количество изображений
    
    let mut images_data = Vec::new();
    
    for size in &sizes {
        let resized = img.resize_exact(*size, *size, FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        
        let mut png_data = Vec::new();
        let mut png_cursor = Cursor::new(&mut png_data);
        image::DynamicImage::ImageRgba8(rgba)
            .write_to(&mut png_cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG encoding failed: {}", e))?;
        
        images_data.push(png_data);
    }
    
    // Пишем directory entries
    let mut offset = 6 + (16 * sizes.len()) as u32; // Header + directory entries
    for (i, png_data) in images_data.iter().enumerate() {
        let size = sizes[i];
        cursor.write_all(&[
            if size == 256 { 0 } else { size as u8 }, // Width
            if size == 256 { 0 } else { size as u8 }, // Height
            0, // Color palette
            0, // Reserved
        ]).unwrap();
        cursor.write_all(&[1, 0]).unwrap(); // Color planes
        cursor.write_all(&[32, 0]).unwrap(); // Bits per pixel
        cursor.write_all(&(png_data.len() as u32).to_le_bytes()).unwrap(); // Size of image data
        cursor.write_all(&offset.to_le_bytes()).unwrap(); // Offset
        offset += png_data.len() as u32;
    }
    
    // Пишем image data
    for png_data in images_data {
        cursor.write_all(&png_data).unwrap();
    }
    
    Ok(ico_data)
}

// Получить текущие системные иконки
#[tauri::command]
pub fn get_current_system_icons() -> Result<Vec<(String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::RegKey;
        use winreg::enums::*;
        
        let mut icons = Vec::new();
        
        let icon_types = vec![
            ("my_computer", "CLSID\\{20D04FE0-3AEA-1069-A2D8-08002B30309D}\\DefaultIcon"),
            ("recycle_bin_empty", "CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\DefaultIcon"),
            ("network", "CLSID\\{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}\\DefaultIcon"),
            ("user_folder", "CLSID\\{59031a47-3f72-44a7-89c5-5595fe6b30ee}\\DefaultIcon"),
            ("control_panel", "CLSID\\{21EC2020-3AEA-1069-A2DD-08002B30309D}\\DefaultIcon"),
        ];
        
        for (name, path) in icon_types {
            if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey(format!("Software\\Classes\\{}", path))
            {
                if let Ok(icon_path) = hkcu.get_value::<String, _>("") {
                    icons.push((name.to_string(), icon_path));
                }
            } else if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
                .open_subkey(format!("SOFTWARE\\Classes\\{}", path))
            {
                if let Ok(icon_path) = hklm.get_value::<String, _>("") {
                    icons.push((name.to_string(), icon_path));
                }
            }
        }
        
        Ok(icons)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Доступно только на Windows".to_string())
    }
}
