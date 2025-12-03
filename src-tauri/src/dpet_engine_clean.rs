use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, Mutex}
};
use tauri::{AppHandle, Manager, WebviewUrl};
use uuid::Uuid;
use lazy_static::lazy_static;
use base64::{Engine as _, engine::general_purpose};

// ================= Configuration Structures =================

// Shimeji animation definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShimejiAnimPos {
    pub line: u32,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ShimejiAnimePos {
    #[serde(default, alias = "stand")] pub stand: Option<ShimejiAnimPos>,
    #[serde(default, alias = "walk")] pub walk: Option<ShimejiAnimPos>,
    #[serde(default, alias = "sit")] pub sit: Option<ShimejiAnimPos>,
    #[serde(default, alias = "greet")] pub greet: Option<ShimejiAnimPos>,
    #[serde(default, alias = "crawl")] pub crawl: Option<ShimejiAnimPos>,
    #[serde(default, alias = "climb")] pub climb: Option<ShimejiAnimPos>,
    #[serde(default, alias = "jump")] pub jump: Option<ShimejiAnimPos>,
    #[serde(default, alias = "fall")] pub fall: Option<ShimejiAnimPos>,
    #[serde(default, alias = "drag")] pub drag: Option<ShimejiAnimPos>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsConfig {
    pub max_velocity: f32,
    pub friction: f32,
    pub gravity: f32,
}
impl Default for PhysicsConfig {
    fn default() -> Self { Self { max_velocity: 40.0, friction: 0.9, gravity: 2.0 } }
}

// Shimeji format config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetConfig {
    pub name: String,
    #[serde(default)] pub img: String,
    #[serde(default = "default_width")] pub width: u32,
    #[serde(default = "default_height")] pub height: u32,
    #[serde(default = "default_bouncing")] pub bouncing: u32,
    // Support both animePos (camelCase) and anime_pos (snake_case)
    #[serde(rename = "animePos", alias = "anime_pos", default)] pub anime_pos: ShimejiAnimePos,
    #[serde(default)] pub resources: Option<String>,
    #[serde(default)] pub link: Option<String>,
    #[serde(default = "default_fps")] pub fps: u32,
    #[serde(default = "default_scale")] pub scale: f32,
    #[serde(default = "default_true")] pub can_move: bool,
    #[serde(default = "default_true")] pub can_drag: bool,
    #[serde(default = "default_true")] pub can_click: bool,
    #[serde(default = "default_true")] pub can_fall: bool,
    #[serde(default)] pub physics: PhysicsConfig,
}
fn default_fps() -> u32 { 12 }
fn default_scale() -> f32 { 1.0 }
fn default_true() -> bool { true }
fn default_width() -> u32 { 128 }
fn default_height() -> u32 { 128 }
fn default_bouncing() -> u32 { 2 }

// ================= Runtime Pet =================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPet {
    pub id: String,
    pub package_id: String,
    pub name: String,
    pub state: String,
    pub position: (f64, f64),
    pub velocity: (f64, f64),
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vec2 { pub x: f64, pub y: f64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetDto {
    pub id: String,
    pub package_id: String,
    pub name: String,
    pub state: String,
    pub position: Vec2,
    pub velocity: Vec2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetPackageInfo {
    pub id: String,
    pub name: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub states: Vec<String>,
    pub preview_path: Option<String>,
}

// ================= Manager =================

pub struct DPetManager {
    pets: HashMap<String, DPet>,
    packages: HashMap<String, DPetConfig>,
    custom_dir: PathBuf,
    state_file: PathBuf,
}

lazy_static! {
    pub static ref DPET_MANAGER: Arc<Mutex<DPetManager>> = Arc::new(Mutex::new(DPetManager::new()));
}

impl DPetManager {
    pub fn new() -> Self {
        let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        let custom_dir = base.join("CursorVerse").join("CustomPets");
        let state_dir = base.join("com.cursorverse.dev").join("dpets");
        let state_file = state_dir.join("state.json");
        fs::create_dir_all(&custom_dir).ok();
        fs::create_dir_all(&state_dir).ok();
        Self { pets: HashMap::new(), packages: HashMap::new(), custom_dir, state_file }
    }

    // -------- Package Loading --------
    pub fn load_packages(&mut self) -> Result<(), String> {
        self.packages.clear();
        if !self.custom_dir.exists() { fs::create_dir_all(&self.custom_dir).map_err(|e| e.to_string())?; }
        for entry in fs::read_dir(&self.custom_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                // Try dpet.json first, then any .json file (Shimeji format)
                let mut config_loaded = false;
                let cfg_path = path.join("dpet.json");
                if cfg_path.exists() {
                    if let Ok(cfg) = self.load_package_config(&cfg_path) {
                        let id = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
                        self.packages.insert(id, cfg);
                        config_loaded = true;
                    }
                }
                // If no dpet.json, look for Shimeji .json files
                if !config_loaded {
                    if let Ok(entries) = fs::read_dir(&path) {
                        for entry in entries.flatten() {
                            let file_path = entry.path();
                            if let Some(ext) = file_path.extension() {
                                if ext == "json" && file_path.file_name().unwrap_or_default() != "dpet.json" {
                                    if let Ok(cfg) = self.load_package_config(&file_path) {
                                        let id = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
                                        self.packages.insert(id, cfg);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext == "zip" || ext == "dpet" { // archive package
                    if let Ok(cfg) = self.load_package_from_zip(&path) {
                        let id = path.file_stem().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
                        self.packages.insert(id, cfg);
                    }
                }
            }
        }
        Ok(())
    }

    fn load_package_config(&self, path: &Path) -> Result<DPetConfig, String> {
        let txt = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&txt).map_err(|e| e.to_string())
    }

    fn load_package_from_zip(&self, zip_path: &Path) -> Result<DPetConfig, String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        let mut s = String::new();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
            let name = f.name().to_string();
            if name == "dpet.json" || name == "config.json" {
                f.read_to_string(&mut s).map_err(|e| e.to_string())?;
                break;
            }
        }
        if s.is_empty() { return Err("Config file not found in archive".into()); }
        serde_json::from_str(&s).map_err(|e| e.to_string())
    }

    pub fn import_package(&mut self, source: PathBuf) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let target = self.custom_dir.join(&id);
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        if source.is_dir() {
            copy_dir(&source, &target)?;
        } else if let Some(ext) = source.extension().and_then(|e| e.to_str()) {
            if ext == "zip" || ext == "dpet" { self.extract_zip(&source, &target)?; } else { return Err("Unsupported format".into()); }
        } else { return Err("Unknown format".into()); }
        let cfg = self.load_package_config(&target.join("dpet.json"))?;
        self.packages.insert(id.clone(), cfg);
        Ok(id)
    }

    fn extract_zip(&self, zip_path: &Path, target: &Path) -> Result<(), String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
            let out_path = target.join(f.name());
            if f.is_dir() { fs::create_dir_all(&out_path).map_err(|e| e.to_string())?; } else {
                if let Some(parent) = out_path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
                let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
                std::io::copy(&mut f, &mut out_file).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    // -------- Pet Lifecycle --------
    pub fn create_pet(&mut self, package_id: String, app: &AppHandle) -> Result<String, String> {
        // Ограничение: максимум 2 питомца
        if self.pets.len() >= 2 {
            return Err("Достигнут лимит питомцев (максимум 2). Удалите существующего питомца перед добавлением нового.".into());
        }
        
        let cfg = self.packages.get(&package_id).ok_or("Package not found")?.clone();
        let pet_id = Uuid::new_v4().to_string();
        let pet = DPet {
            id: pet_id.clone(),
            package_id: package_id.clone(),
            name: cfg.name.clone(),
            state: "idle".into(),
            position: (100.0, 100.0),
            velocity: (0.0, 0.0),
            width: 200,
            height: 200,
        };
        self.spawn_window(&pet, app)?;
        self.pets.insert(pet_id.clone(), pet);
        self.save_state()?;
        Ok(pet_id)
    }

    fn spawn_window(&self, pet: &DPet, app: &AppHandle) -> Result<(), String> {
        let win = tauri::WebviewWindowBuilder::new(app, &format!("dpet-{}", pet.id), WebviewUrl::App(format!("dpet.html?id={}", pet.id).into()))
            .title(&pet.name)
            .inner_size(pet.width as f64, pet.height as f64)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .resizable(false)
            .visible(true)
            .skip_taskbar(true)
            .build()
            .map_err(|e| e.to_string())?;
        // Disable OS-level window shadow to avoid any visible square outline
        let _ = win.set_shadow(false);
        // Initial position; JS can refine based on monitor metrics
        let _ = win.set_position(tauri::LogicalPosition { x: 100.0, y: 100.0 });
        Ok(())
    }

    pub fn remove_pet(&mut self, pet_id: String, app: &AppHandle) -> Result<(), String> {
        if self.pets.remove(&pet_id).is_some() {
            if let Some(w) = app.get_webview_window(&format!("dpet-{}", pet_id)) { let _ = w.close(); }
            self.save_state()?;
            Ok(())
        } else { Err("Pet not found".into()) }
    }

    pub fn update_position(&mut self, pet_id: String, x: f64, y: f64) -> Result<(), String> {
        // Обновляем позицию в памяти без немедленного сохранения на диск —
        // это сильно снижает нагрузку при большом количестве питомцев
        if let Some(p) = self.pets.get_mut(&pet_id) { p.position = (x, y); Ok(()) } else { Err("Pet not found".into()) }
    }
    pub fn update_state(&mut self, pet_id: String, state: String) -> Result<(), String> {
        if let Some(p) = self.pets.get_mut(&pet_id) { p.state = state; self.save_state()?; Ok(()) } else { Err("Pet not found".into()) }
    }

    pub fn restore_pets(&mut self, app: &AppHandle) -> Result<(), String> {
        if !self.state_file.exists() { return Ok(()); }
        let txt = fs::read_to_string(&self.state_file).map_err(|e| e.to_string())?;
        let saved: HashMap<String, DPet> = serde_json::from_str(&txt).map_err(|e| e.to_string())?;
        for (_id, pet) in saved.iter() {
            if self.packages.contains_key(&pet.package_id) { self.spawn_window(pet, app)?; }
        }
        self.pets = saved;
        Ok(())
    }

    pub fn get_packages_info(&self) -> Vec<DPetPackageInfo> {
        self.packages.iter().map(|(id, cfg)| {
            let mut states = Vec::new();
            if cfg.anime_pos.stand.is_some() { states.push("stand".into()); }
            if cfg.anime_pos.walk.is_some() { states.push("walk".into()); }
            if cfg.anime_pos.fall.is_some() { states.push("fall".into()); }
            if cfg.anime_pos.drag.is_some() { states.push("drag".into()); }
            if cfg.anime_pos.sit.is_some() { states.push("sit".into()); }
            if cfg.anime_pos.greet.is_some() { states.push("greet".into()); }
            if cfg.anime_pos.jump.is_some() { states.push("jump".into()); }
            if cfg.anime_pos.crawl.is_some() { states.push("crawl".into()); }
            if cfg.anime_pos.climb.is_some() { states.push("climb".into()); }
            let author = cfg.resources.clone();
            let description = cfg.link.clone();
            
            // Get preview path (sprite sheet image)
            let preview_path = if !cfg.img.is_empty() {
                let pkg_path = self.custom_dir.join(id);
                Some(pkg_path.join(&cfg.img).to_string_lossy().to_string())
            } else {
                None
            };
            
            DPetPackageInfo { id: id.clone(), name: cfg.name.clone(), author, description, states, preview_path }
        }).collect()
    }

    pub fn get_pets(&self) -> Vec<DPet> { self.pets.values().cloned().collect() }
    pub fn get_pet(&self, pet_id: &str) -> Option<DPet> { self.pets.get(pet_id).cloned() }

    fn save_state(&self) -> Result<(), String> {
        let txt = serde_json::to_string(&self.pets).map_err(|e| e.to_string())?;
        if let Some(parent) = self.state_file.parent() { fs::create_dir_all(parent).ok(); }
        fs::write(&self.state_file, txt).map_err(|e| e.to_string())
    }
}

// ================= Helpers =================
fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() { copy_dir(&path, &target)?; } else { fs::copy(&path, &target).map_err(|e| e.to_string())?; }
    }
    Ok(())
}

// ================= Tauri Commands =================

#[tauri::command]
pub async fn dpet_load_packages() -> Result<Vec<DPetPackageInfo>, String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.load_packages()?;
    Ok(m.get_packages_info())
}

#[tauri::command]
pub async fn dpet_get_all_packages() -> Result<Vec<DPetPackageInfo>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(m.get_packages_info())
}

#[tauri::command]
pub async fn dpet_import_package(path: String) -> Result<String, String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.import_package(PathBuf::from(path))
}

#[tauri::command]
pub async fn dpet_create_pet(app: AppHandle, package_id: String) -> Result<String, String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.create_pet(package_id, &app)
}

#[tauri::command]
pub async fn dpet_remove_pet(app: AppHandle, pet_id: String) -> Result<(), String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.remove_pet(pet_id, &app)
}

#[tauri::command]
pub async fn dpet_get_all_pets() -> Result<Vec<DPet>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(m.get_pets())
}

// Alias for frontend expecting 'active' wording
#[tauri::command]
pub async fn dpet_get_active_pets() -> Result<Vec<DPetDto>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    let list = m.get_pets().into_iter().map(|p| DPetDto{
        id: p.id,
        package_id: p.package_id,
        name: p.name,
        state: p.state,
        position: Vec2{ x: p.position.0, y: p.position.1 },
        velocity: Vec2{ x: p.velocity.0, y: p.velocity.1 },
    }).collect();
    Ok(list)
}

#[tauri::command]
pub async fn dpet_update_position(pet_id: String, x: f64, y: f64) -> Result<(), String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.update_position(pet_id, x, y)
}

#[tauri::command]
pub async fn dpet_update_state(pet_id: String, state: String) -> Result<(), String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.update_state(pet_id, state)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetWithConfig {
    pub id: String,
    pub package_id: String,
    pub name: String,
    pub state: String,
    pub position: Vec2,
    pub velocity: Vec2,
    pub config: DPetConfig,
    pub package_path: String,
}

#[tauri::command]
pub async fn dpet_get_pet_data(pet_id: String) -> Result<Option<DPetWithConfig>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(pet) = m.get_pet(&pet_id) {
        if let Some(cfg) = m.packages.get(&pet.package_id) {
            let package_path = m.custom_dir.join(&pet.package_id);
            return Ok(Some(DPetWithConfig {
                id: pet.id,
                package_id: pet.package_id,
                name: pet.name,
                state: pet.state,
                position: Vec2 { x: pet.position.0, y: pet.position.1 },
                velocity: Vec2 { x: pet.velocity.0, y: pet.velocity.1 },
                config: cfg.clone(),
                package_path: package_path.to_string_lossy().to_string(),
            }));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn dpet_restore_pets(app: AppHandle) -> Result<(), String> {
    let mut m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    m.load_packages()?; // ensure packages are present
    m.restore_pets(&app)
}

#[tauri::command]
pub async fn dpet_get_sprite_sheet(package_id: String) -> Result<String, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(cfg) = m.packages.get(&package_id) {
        if !cfg.img.is_empty() {
            let img_path = m.custom_dir.join(&package_id).join(&cfg.img);
            let bytes = fs::read(&img_path).map_err(|e| format!("Failed to read image: {}", e))?;
            let b64 = general_purpose::STANDARD.encode(&bytes);
            return Ok(b64);
        }
    }
    Err("Package or image not found".into())
}

// === ОБЁРТКИ ДЛЯ LUCY AI ===

#[tauri::command]
pub async fn add_pet_from_catalog(pet_id: String, app: tauri::AppHandle) -> Result<String, String> {
    dpet_create_pet(app, pet_id.clone()).await?;
    Ok(format!("Питомец {} добавлен!", pet_id))
}

#[tauri::command]
pub async fn get_available_pets() -> Result<Vec<serde_json::Value>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    let pets: Vec<serde_json::Value> = m.packages.iter().map(|(id, cfg)| {
        serde_json::json!({
            "id": id,
            "name": &cfg.name,
            "description": "Desktop pet"
        })
    }).collect();
    Ok(pets)
}

#[tauri::command]
pub async fn get_all_pets() -> Result<Vec<serde_json::Value>, String> {
    let m = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    let pets: Vec<serde_json::Value> = m.pets.iter().map(|(id, pet)| {
        serde_json::json!({
            "id": id,
            "package_id": &pet.package_id,
            "x": pet.position.0,
            "y": pet.position.1
        })
    }).collect();
    Ok(pets)
}

#[tauri::command]
pub async fn remove_pet(pet_id: String, app: tauri::AppHandle) -> Result<String, String> {
    dpet_remove_pet(app, pet_id.clone()).await?;
    Ok(format!("Питомец {} удалён!", pet_id))
}
