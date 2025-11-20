use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use winreg::enums::*;
use winreg::RegKey;
use std::io::Read;
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize, Clone)]
pub struct CursorScheme {
    pub name: String,
    pub cursors: HashMap<String, String>,
    pub preview: Option<String>,
    pub category: Option<String>,
}

const CURSOR_TYPES: [&str; 15] = [
    "Arrow", "Help", "AppStarting", "Wait", "Crosshair",
    "IBeam", "NWPen", "No", "SizeNS", "SizeWE",
    "SizeNWSE", "SizeNESW", "SizeAll", "UpArrow", "Hand"
];

// Алиасы для распознавания файлов по альтернативным именам
fn cursor_aliases() -> Vec<(&'static str, &'static str)> {
    vec![
        // Пользовательские алиасы → каноническое имя из CURSOR_TYPES
        ("pointer", "Arrow"),
        ("normal", "Arrow"),
        ("arrow", "Arrow"),

        ("help", "Help"),

        ("link", "AppStarting"),
        ("work", "AppStarting"), // WorkingInBackground
        ("working", "AppStarting"),
        ("workinginbackground", "AppStarting"),

        ("busy", "Wait"),
        ("wait", "Wait"),

        ("cross", "Crosshair"),
        ("precision", "Crosshair"),

        ("text", "IBeam"),
        ("beam", "IBeam"),
        ("ibeam", "IBeam"),

        ("move", "SizeAll"),
        ("sizeall", "SizeAll"),

        ("dgn1", "SizeNESW"),
        ("diagonal1", "SizeNESW"),
        ("sizenesw", "SizeNESW"),

        ("dgn2", "SizeNWSE"),
        ("diagonal2", "SizeNWSE"),
        ("sizenwse", "SizeNWSE"),

        ("horz", "SizeWE"),
        ("horizontal", "SizeWE"),
        ("sizewe", "SizeWE"),

        ("vert", "SizeNS"),
        ("vertical", "SizeNS"),
        ("sizens", "SizeNS"),

        ("alternate", "Hand"),
        ("alternate2", "Hand"),
        ("hand", "Hand"),

        ("unavailable", "No"),
        ("no", "No"),

        ("nwpen", "NWPen"),
        ("uparrow", "UpArrow"),

        // Прочие популярные названия → наиболее близкие канонические
        ("person", "Hand"),
        ("pin", "Hand"),
    ]
}

fn types_set() -> std::collections::HashSet<String> {
    CURSOR_TYPES.iter().map(|s| s.to_string()).collect()
}

fn map_files_to_types(files: &[(String, String)]) -> HashMap<String, String> {
    let mut result: HashMap<String, String> = HashMap::new();
    let allowed = types_set();
    let aliases = cursor_aliases();

    for (name_lc, full) in files.iter() {
        let fname = name_lc.as_str();
        // Сначала прямые совпадения по каноническим типам
        for t in CURSOR_TYPES.iter() {
            let needle = t.to_lowercase();
            if fname.contains(&needle) {
                if !result.contains_key(*t) {
                    result.insert((*t).to_string(), full.clone());
                }
            }
        }
        // Затем алиасы
        for (alias, canon) in aliases.iter() {
            if fname.contains(alias) {
                if allowed.contains(&canon.to_string()) && !result.contains_key(*canon) {
                    result.insert((*canon).to_string(), full.clone());
                }
            }
        }
    }
    result
}

#[tauri::command]
pub async fn get_cursor_library() -> Result<Vec<CursorScheme>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let user_library_path = if !local_appdata.is_empty() {
            PathBuf::from(local_appdata).join("CursorVerse")
        } else {
            PathBuf::from(".")
        };
        let mut schemes = Vec::new();

        fn collect_cursors(dir: &Path, out: &mut Vec<(String, String)>) {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        collect_cursors(&path, out);
                    } else if let Some(ext) = path.extension() {
                        let ext_lc = ext.to_string_lossy().to_lowercase();
                        if ext_lc == "cur" || ext_lc == "ani" {
                            let fname_lc = path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_lowercase())
                                .unwrap_or_default();
                            out.push((fname_lc, path.to_string_lossy().to_string()));
                        }
                    }
                }
            }
        }

        fn find_preview(folder: &Path) -> Option<String> {
            let names = [
                "preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.gif",
                "Preview.png", "Preview.jpg", "Preview.jpeg", "Preview.webp", "Preview.gif",
            ];
            for n in names.iter() {
                let p = folder.join(n);
                if p.exists() { return Some(p.to_string_lossy().to_string()); }
            }
            if let Ok(entries) = fs::read_dir(folder) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            let e = ext.to_string_lossy().to_lowercase();
                            if ["png","jpg","jpeg","webp","gif"].contains(&e.as_str()) {
                                return Some(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
            None
        }

        fn build_scheme_for_folder(folder: &Path) -> Option<CursorScheme> {
            let mut files: Vec<(String, String)> = Vec::new();
            collect_cursors(folder, &mut files);
            if files.is_empty() { return None; }
            let map = map_files_to_types(&files);
            if map.is_empty() { return None; }
            let name = folder.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| folder.to_string_lossy().to_string());
            let preview = find_preview(folder);
            println!("DEBUG: Folder={}, Preview={:?}", name, preview);
            Some(CursorScheme { name, cursors: map, preview, category: None })
        }

        let mut add_dir_schemes = |root: &Path| {
            if !root.is_dir() { return; }
            if let Ok(level1) = fs::read_dir(root) {
                for cat in level1.flatten() {
                    let cat_path = cat.path();
                    if !cat_path.is_dir() { continue; }
                    if let Ok(level2) = fs::read_dir(&cat_path) {
                        for pack in level2.flatten() {
                            let pack_path = pack.path();
                            if pack_path.is_dir() {
                                if let Some(mut scheme) = build_scheme_for_folder(&pack_path) {
                                    let cat_name = cat_path.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "".into());
                                    let pack_name = scheme.name.clone();
                                    scheme.category = Some(cat_name.clone());
                                    scheme.name = pack_name;
                                    schemes.push(scheme);
                                }
                            }
                        }
                    }
                }
            }
        };

        if user_library_path.is_dir() { add_dir_schemes(&user_library_path); }

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(r"Control Panel\Cursors\Schemes") {
            for scheme_name in key.enum_values().flatten() {
                let (name, _value) = scheme_name;
                if let Ok(cursor_data) = key.get_value::<String, _>(&name) {
                    let cursors_vec: Vec<&str> = cursor_data.split(',').collect();
                    let mut cursors_map = HashMap::new();
                    for (i, cursor_type) in CURSOR_TYPES.iter().enumerate() {
                        if i < cursors_vec.len() && !cursors_vec[i].is_empty() {
                            cursors_map.insert(cursor_type.to_string(), cursors_vec[i].to_string());
                        }
                    }
                    schemes.push(CursorScheme {
                        name,
                        cursors: cursors_map,
                        preview: None,
                        category: None,
                    });
                }
            }
        }
        Ok(schemes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn apply_cursor(scheme: CursorScheme) -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cursors_path = r"Control Panel\Cursors";
    
    match hkcu.open_subkey_with_flags(cursors_path, KEY_SET_VALUE) {
        Ok(key) => {
            for (cursor_type, file_path) in scheme.cursors.iter() {
                key.set_value(cursor_type, file_path).map_err(|e| e.to_string())?;
            }
            
            unsafe {
                winapi::um::winuser::SystemParametersInfoW(
                    winapi::um::winuser::SPI_SETCURSORS,
                    0,
                    std::ptr::null_mut(),
                    winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE
                );
            }
            
            Ok(format!("Схема курсоров '{}' применена", scheme.name))
        }
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub fn reset_cursor() -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cursors_path = r"Control Panel\Cursors";
    // Пытаемся применить схему "Windows Default" из реестра
    if let Ok(schemes_key) = hkcu.open_subkey(r"Control Panel\Cursors\Schemes") {
        let res: Result<String, _> = schemes_key.get_value("Windows Default");
        if let Ok(cursor_data) = res {
            if !cursor_data.is_empty() {
                let cursors_vec: Vec<&str> = cursor_data.split(',').collect();
                if let Ok(key) = hkcu.open_subkey_with_flags(cursors_path, KEY_SET_VALUE) {
                    for (i, cursor_type) in CURSOR_TYPES.iter().enumerate() {
                        if i < cursors_vec.len() {
                            let val = cursors_vec[i];
                            let _ = key.set_value::<&str, _>(cursor_type, &val);
                        }
                    }
                }
                unsafe {
                    winapi::um::winuser::SystemParametersInfoW(
                        winapi::um::winuser::SPI_SETCURSORS,
                        0,
                        std::ptr::null_mut(),
                        winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE
                    );
                }
                return Ok("Курсоры сброшены к Windows Default".to_string());
            }
        }
    }

    // Фолбэк: очищаем и просим систему перезагрузить курсоры
    match hkcu.open_subkey_with_flags(cursors_path, KEY_SET_VALUE) {
        Ok(key) => {
            for cursor_type in CURSOR_TYPES.iter() {
                let _ = key.set_value(cursor_type, &"");
            }
            unsafe {
                winapi::um::winuser::SystemParametersInfoW(
                    winapi::um::winuser::SPI_SETCURSORS,
                    0,
                    std::ptr::null_mut(),
                    winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE
                );
            }
            Ok("Курсоры сброшены".to_string())
        }
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
pub fn get_favorites() -> Result<Vec<String>, String> {
    let config_path = get_config_path()?;
    let favorites_file = config_path.join("favorites_cursors.json");
    
    if favorites_file.exists() {
        let content = fs::read_to_string(&favorites_file).map_err(|e| e.to_string())?;
        let favorites: Vec<String> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(favorites)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn add_favorite(scheme_name: String) -> Result<String, String> {
    let config_path = get_config_path()?;
    fs::create_dir_all(&config_path).map_err(|e| e.to_string())?;
    
    let favorites_file = config_path.join("favorites_cursors.json");
    let mut favorites = get_favorites()?;
    
    if !favorites.contains(&scheme_name) {
        favorites.push(scheme_name.clone());
        let json = serde_json::to_string_pretty(&favorites).map_err(|e| e.to_string())?;
        fs::write(&favorites_file, json).map_err(|e| e.to_string())?;
        Ok(format!("'{}' добавлено в избранное", scheme_name))
    } else {
        Ok("Уже в избранном".to_string())
    }
}

#[tauri::command]
pub fn remove_favorite(scheme_name: String) -> Result<String, String> {
    let config_path = get_config_path()?;
    let favorites_file = config_path.join("favorites_cursors.json");
    
    let mut favorites = get_favorites()?;
    favorites.retain(|s| s != &scheme_name);
    
    let json = serde_json::to_string_pretty(&favorites).map_err(|e| e.to_string())?;
    fs::write(&favorites_file, json).map_err(|e| e.to_string())?;
    
    Ok(format!("'{}' удалено из избранного", scheme_name))
}

fn get_config_path() -> Result<PathBuf, String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
    Ok(PathBuf::from(local).join("CursorVerse"))
}

#[tauri::command]
pub fn check_cursorlib() -> Result<String, String> {
    let base = get_config_path()?;
    let anime = base.join("Anime");
    let classic = base.join("Classic");
    if anime.exists() && classic.exists() { 
        Ok(base.to_string_lossy().to_string()) 
    } else { 
        Ok(String::new()) 
    }
}

use tauri::Emitter;

#[tauri::command]
pub async fn download_cursorlib(window: tauri::Window) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let url = "https://github.com/ShustovCarleone/Cursorlib/releases/download/v1.4.0/CursorLib.zip";
        let base_path = get_config_path()?;
        std::fs::create_dir_all(&base_path).map_err(|e| e.to_string())?;

        let resp = reqwest::blocking::get(url).map_err(|e| e.to_string())?;
        let total = resp.content_length().unwrap_or(0);
        let mut reader = resp;
        let mut data: Vec<u8> = Vec::new();
        let mut buf = [0u8; 8192];
        let mut downloaded: u64 = 0;
        loop {
            let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            data.extend_from_slice(&buf[..n]);
            downloaded += n as u64;
            if total > 0 {
                let mut pct = ((downloaded as f64 / total as f64) * 100.0) as u8;
                if pct > 100 { pct = 100; }
                let _ = window.emit("cursorlib-progress", pct);
            }
        }
        let _ = window.emit("cursorlib-progress", 100u8);

        let mut cursor = std::io::Cursor::new(data);
        let mut archive = zip::ZipArchive::new(&mut cursor).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let file_path = file.mangled_name();
            let stripped = file_path.components().skip(1).collect::<PathBuf>();
            if stripped.as_os_str().is_empty() { continue; }
            let outpath = base_path.join(&stripped);
            if (*file.name()).ends_with('/') {
                std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
                }
                let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
        Ok(base_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_preview_base64(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("File not found: {}", path));
        }
        let mut file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        let ext = file_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("gif")
            .to_lowercase();
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/gif",
        };
        let base64_data = general_purpose::STANDARD.encode(&buffer);
        Ok(format!("data:{};base64,{}", mime, base64_data))
    })
    .await
    .map_err(|e| e.to_string())?
}
