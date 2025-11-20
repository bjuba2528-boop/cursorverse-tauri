use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Cursor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivelyInfo {
    #[serde(rename = "AppVersion")]
    pub app_version: Option<String>,
    #[serde(rename = "Title")]
    pub title: String,
    #[serde(rename = "Thumbnail")]
    pub thumbnail: String,
    #[serde(rename = "Preview")]
    pub preview: String,
    #[serde(rename = "Desc")]
    pub description: Option<String>,
    #[serde(rename = "Author")]
    pub author: Option<String>,
    #[serde(rename = "License")]
    pub license: Option<String>,
    #[serde(rename = "Contact")]
    pub contact: Option<String>,
    #[serde(rename = "Type")]
    pub wallpaper_type: u32,
    #[serde(rename = "FileName")]
    pub file_name: String,
    #[serde(rename = "Arguments")]
    pub arguments: Option<String>,
    #[serde(rename = "IsAbsolutePath")]
    pub is_absolute_path: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WallpaperItem {
    pub id: String,
    pub title: String,
    pub thumbnail_path: String,
    pub preview_path: String,
    pub wallpaper_type: u32,
    pub folder_path: String,
    pub file_path: String,
}

// Получает путь к библиотеке Lively
pub fn get_library_path() -> Result<PathBuf, String> {
    let local_appdata = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Не удалось получить LOCALAPPDATA")?;
    
    let library_path = Path::new(&local_appdata)
        .join("Lively Wallpaper")
        .join("Library")
        .join("wallpapers");
    
    if !library_path.exists() {
        return Err("Библиотека Lively не найдена. Убедитесь что Lively Wallpaper установлен.".to_string());
    }
    
    Ok(library_path)
}

// Читает все обои из библиотеки Lively (НЕ блокирует основной поток)
#[tauri::command]
pub async fn get_lively_wallpapers() -> Result<Vec<WallpaperItem>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let library_path = get_library_path()?;
        println!("Путь к библиотеке Lively: {:?}", library_path);
        let mut wallpapers = Vec::new();
        let entries = fs::read_dir(&library_path)
            .map_err(|e| format!("Ошибка чтения библиотеки: {}", e))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Ошибка чтения папки: {}", e))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            // Читаем LivelyInfo.json
            let info_path = path.join("LivelyInfo.json");
            if !info_path.exists() {
                continue;
            }
            match fs::read_to_string(&info_path) {
                Ok(json_str) => {
                    match serde_json::from_str::<LivelyInfo>(&json_str) {
                        Ok(info) => {
                            let folder_name = path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            let thumbnail_path = if info.thumbnail.is_empty() {
                                String::new()
                            } else {
                                path.join(&info.thumbnail).to_string_lossy().to_string()
                            };
                            let preview_path = if info.preview.is_empty() {
                                String::new()
                            } else {
                                path.join(&info.preview).to_string_lossy().to_string()
                            };
                            wallpapers.push(WallpaperItem {
                                id: folder_name.clone(),
                                title: info.title,
                                thumbnail_path,
                                preview_path,
                                wallpaper_type: info.wallpaper_type,
                                folder_path: path.to_string_lossy().to_string(),
                                file_path: path.join(&info.file_name).to_string_lossy().to_string(),
                            });
                        }
                        Err(e) => {
                            eprintln!("Ошибка парсинга LivelyInfo.json в {:?}: {}", path, e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Ошибка чтения LivelyInfo.json в {:?}: {}", path, e);
                }
            }
        }
        Ok(wallpapers)
    }).await.unwrap_or_else(|e| Err(format!("Ошибка потока: {:?}", e)))
}

// Получить путь к Lively.exe
fn get_lively_exe_path() -> Result<PathBuf, String> {
    // Проверяем реестр
    #[cfg(target_os = "windows")]
    {
        use winreg::RegKey;
        use winreg::enums::*;
        
        if let Ok(reg) = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall") 
        {
            for key_name in reg.enum_keys().filter_map(|k| k.ok()) {
                if key_name.to_lowercase().contains("lively") {
                    if let Ok(subkey) = reg.open_subkey(&key_name) {
                        if let Ok(install_location) = subkey.get_value::<String, _>("InstallLocation") {
                            let exe_path = Path::new(&install_location).join("Lively.exe");
                            if exe_path.exists() {
                                return Ok(exe_path);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Fallback пути
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let possible_paths = vec![
        format!("{}\\Programs\\Lively Wallpaper\\Lively.exe", localappdata),
    ];
    
    for path_str in possible_paths {
        let path = Path::new(&path_str);
        if path.exists() {
            return Ok(path.to_path_buf());
        }
    }
    
    Err("Lively.exe не найден".to_string())
}

// Установить обои через командную строку Lively
#[tauri::command]
pub fn set_lively_wallpaper(wallpaper_id: String, monitor: Option<u32>) -> Result<String, String> {
    let library_path = get_library_path()?;
    let wallpaper_path = library_path.join(&wallpaper_id);
    
    if !wallpaper_path.exists() {
        return Err(format!("Обои не найдены: {}", wallpaper_id));
    }
    
    let lively_exe = get_lively_exe_path()?;
    
    let mut cmd = std::process::Command::new(&lively_exe);
    cmd.arg("setwp")
        .arg("--file")
        .arg(wallpaper_path.to_string_lossy().to_string());
    
    if let Some(mon) = monitor {
        cmd.arg("--monitor").arg(mon.to_string());
    }
    
    cmd.spawn()
        .map_err(|e| format!("Не удалось запустить Lively: {}", e))?;
    
    Ok(format!("Обои установлены: {}", wallpaper_id))
}

// Закрыть все обои
#[tauri::command]
pub fn close_all_lively_wallpapers() -> Result<String, String> {
    let lively_exe = get_lively_exe_path()?;
    
    std::process::Command::new(&lively_exe)
        .arg("closewp")
        .spawn()
        .map_err(|e| format!("Не удалось запустить Lively: {}", e))?;
    
    Ok("Все обои закрыты".to_string())
}

// Добавить файл в библиотеку Lively
#[tauri::command]
pub fn add_wallpaper_to_library(file_path: String) -> Result<String, String> {
    let source_path = Path::new(&file_path);
    
    if !source_path.exists() {
        return Err("Файл не найден".to_string());
    }
    
    let library_path = get_library_path()?;
    
    // Создаём уникальную папку для обоев
    let folder_name = format!("wp_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("unknown"));
    let wallpaper_dir = library_path.join(&folder_name);
    
    fs::create_dir_all(&wallpaper_dir)
        .map_err(|e| format!("Не удалось создать папку: {}", e))?;
    
    // Получаем имя и расширение файла
    let file_name = source_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Некорректное имя файла")?;
    
    let file_stem = source_path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("wallpaper");
    
    let extension = source_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // Копируем файл
    let dest_path = wallpaper_dir.join(file_name);
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Не удалось скопировать файл: {}", e))?;
    
    // Определяем тип обоев
    let wallpaper_type = match extension.as_str() {
        "mp4" | "webm" | "avi" | "mov" | "mkv" => 1, // Video
        "gif" => 2, // GIF
        "jpg" | "jpeg" | "png" | "bmp" | "webp" => 5, // Picture
        _ => 5,
    };
    
    // Попробуем сгенерировать статичное превью (thumbnail.png) для изображений и GIF
    let mut thumbnail_field: String = String::new();
    if matches!(wallpaper_type, 2 | 5) {
        // 2 = GIF, 5 = Picture
        let src = &dest_path;
        let thumb_path = wallpaper_dir.join("thumbnail.png");
        match generate_thumbnail(src, &thumb_path) {
            Ok(_) => {
                thumbnail_field = "thumbnail.png".to_string();
            }
            Err(e) => {
                eprintln!("Не удалось создать превью: {}", e);
            }
        }
    }

    // Создаём LivelyInfo.json
    let info = LivelyInfo {
        app_version: Some("2.2.0.0".to_string()),
        title: file_stem.to_string(),
        thumbnail: thumbnail_field.clone(),
        preview: String::new(),
        description: Some(format!("Imported from {}", file_name)),
        author: Some("User".to_string()),
        license: None,
        contact: None,
        wallpaper_type,
        file_name: file_name.to_string(),
        arguments: None,
        is_absolute_path: Some(false),
    };
    
    let info_json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("Ошибка создания JSON: {}", e))?;
    
    let info_path = wallpaper_dir.join("LivelyInfo.json");
    fs::write(&info_path, info_json)
        .map_err(|e| format!("Не удалось записать LivelyInfo.json: {}", e))?;
    
    Ok(format!("Обои добавлены: {}", folder_name))
}

// Генерация PNG-thumbnail шириной до 320px (поддержка: картинки и первый кадр GIF)
fn generate_thumbnail(src_path: &Path, dest_path: &Path) -> Result<(), String> {
    use image::{DynamicImage, GenericImageView, ImageFormat};
    use image::AnimationDecoder;
    use std::fs::File;
    use std::io::BufWriter;

    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut dyn_img: Option<DynamicImage> = None;

    if ext == "gif" {
        // Извлекаем первый кадр GIF
        if let Ok(file) = File::open(src_path) {
            use std::io::BufReader;
            let reader = BufReader::new(file);
            if let Ok(decoder) = image::codecs::gif::GifDecoder::new(reader) {
                if let Ok(frames) = decoder.into_frames().collect_frames() {
                    if let Some(frame) = frames.first() {
                        let img = DynamicImage::ImageRgba8(frame.buffer().clone());
                        dyn_img = Some(img);
                    }
                }
            }
        }
    }

    if dyn_img.is_none() {
        // Пытаемся открыть как обычное изображение
        if let Ok(img) = image::open(src_path) {
            dyn_img = Some(img);
        }
    }

    let img = dyn_img.ok_or_else(|| "Неподдерживаемый формат изображения для превью".to_string())?;
    let (w, h) = img.dimensions();
    let target_w: u32 = 320;
    let scale = (target_w as f32 / w as f32).min(1.0);
    let new_w = (w as f32 * scale).round().max(1.0) as u32;
    let new_h = (h as f32 * scale).round().max(1.0) as u32;
    let resized = img.resize_exact(new_w, new_h, image::imageops::FilterType::Triangle);

    let file = File::create(dest_path).map_err(|e| format!("Ошибка записи превью: {}", e))?;
    let mut writer = BufWriter::new(file);
    resized
        .write_to(&mut writer, ImageFormat::Png)
        .map_err(|e| format!("Ошибка кодирования превью: {}", e))?;
    Ok(())
}

// Получить превью в base64 (в фоновом потоке, чтобы не блокировать UI)
#[tauri::command]
pub async fn get_wallpaper_thumbnail(thumbnail_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&thumbnail_path);
        
        if !path.exists() {
            return Err("Превью не найдено".to_string());
        }
        // Если файл большой (>600KB) или GIF, уменьшаем и кодируем в PNG
        let metadata = fs::metadata(path).map_err(|e| format!("Meta error: {}", e))?;
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let is_gif = ext == "gif";
        let is_large = metadata.len() > 600_000; // ~600KB

        if is_gif || is_large {
            // Пытаемся декодировать и уменьшить до ширины 320px
            use image::{DynamicImage, GenericImageView, ImageFormat};
            use image::AnimationDecoder;
            let mut dyn_img: Option<DynamicImage> = None;

            if is_gif {
                // Читаем первый кадр GIF
                if let Ok(file) = fs::File::open(path) {
                    use std::io::BufReader;
                    let reader = BufReader::new(file);
                    if let Ok(decoder) = image::codecs::gif::GifDecoder::new(reader) {
                        if let Ok(frames) = decoder.into_frames().collect_frames() {
                            if let Some(frame) = frames.first() {
                                let img = DynamicImage::ImageRgba8(frame.buffer().clone());
                                dyn_img = Some(img);
                            }
                        }
                    }
                }
            }

            if dyn_img.is_none() {
                // Пытаемся открыть как обычное изображение
                if let Ok(img) = image::open(path) {
                    dyn_img = Some(img);
                }
            }

            if let Some(img) = dyn_img {
                let (w, h) = img.dimensions();
                let target_w: u32 = 320;
                let scale = (target_w as f32 / w as f32).min(1.0);
                let new_w = (w as f32 * scale).round().max(1.0) as u32;
                let new_h = (h as f32 * scale).round().max(1.0) as u32;
                let resized = img.resize_exact(new_w, new_h, image::imageops::FilterType::Triangle);

                let mut buf: Vec<u8> = Vec::new();
                let mut cursor = Cursor::new(&mut buf);
                if let Err(e) = resized.write_to(&mut cursor, ImageFormat::Png) {
                    return Err(format!("Ошибка кодирования PNG: {}", e));
                }
                let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);
                return Ok(format!("data:image/png;base64,{}", base64_str));
            }
            // Фолбэк: если не удалось декодировать
        }

        // Маленькие файлы — отдаём как есть
        let bytes = fs::read(path).map_err(|e| format!("Ошибка чтения файла: {}", e))?;
        let mime_type = match ext.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/jpeg",
        };
        let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
        Ok(format!("data:{};base64,{}", mime_type, base64_str))
    })
    .await
    .unwrap_or_else(|e| Err(format!("Ошибка потока: {:?}", e)))
}

// Удалить обои из библиотеки
#[tauri::command]
pub fn delete_wallpaper(wallpaper_id: String) -> Result<String, String> {
    let library_path = get_library_path()?;
    let wallpaper_path = library_path.join(&wallpaper_id);
    
    if !wallpaper_path.exists() {
        return Err(format!("Обои не найдены: {}", wallpaper_id));
    }
    
    fs::remove_dir_all(&wallpaper_path)
        .map_err(|e| format!("Не удалось удалить папку: {}", e))?;
    
    Ok(format!("Обои удалены: {}", wallpaper_id))
}
