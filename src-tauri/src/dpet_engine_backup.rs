// Desktop Pet Engine (DPET) - Полнофункциональный движок для анимированных питомцев на рабочем столе
// Вдохновлено проектом Deppo от SpikeHD

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, WebviewUrl};
use uuid::Uuid;

lazy_static::lazy_static! {
    static ref DPET_MANAGER: Arc<Mutex<DPetManager>> = Arc::new(Mutex::new(DPetManager::new()));
}

/// Состояния движения питомца
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MovementState {
    Idle,        // Покой
    Walk,        // Ходьба
    Drag,        // Перетаскивание
    Falling,     // Падение
    Click,       // Клик
}

/// Конфигурация физики
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsConfig {
    #[serde(default = "default_max_velocity")]
    pub max_velocity: f32,
    #[serde(default = "default_friction")]
    pub friction: f32,
    #[serde(default = "default_gravity")]
    pub gravity: f32,
}

fn default_max_velocity() -> f32 { 40.0 }
fn default_friction() -> f32 { 0.9 }
fn default_gravity() -> f32 { 2.0 }

impl Default for PhysicsConfig {
    fn default() -> Self {
        Self {
            max_velocity: default_max_velocity(),
            friction: default_friction(),
            gravity: default_gravity(),
        }
    }
}

/// Список анимаций для разных состояний
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationList {
    pub idle: Option<Vec<String>>,
    pub walk: Option<Vec<String>>,
    pub drag: Option<Vec<String>>,
    pub fall: Option<Vec<String>>,
    pub click: Option<Vec<String>>,
}

/// Конфигурация DPET пакета (deppo.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetConfig {
    pub name: String,
    pub author: Option<String>,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_scale")]
    pub scale: f32,
    #[serde(default = "default_behavior_change_rarity")]
    pub behavior_change_rarity: f32,
    
    // Возможности
    #[serde(default = "default_true")]
    pub can_move: bool,
    #[serde(default = "default_true")]
    pub can_drag: bool,
    #[serde(default = "default_true")]
    pub can_click: bool,
    #[serde(default = "default_true")]
    pub can_fall: bool,
    
    #[serde(default = "default_move_speed")]
    pub move_speed: f32,
    
    #[serde(default)]
    pub physics: PhysicsConfig,
    
    pub animations: AnimationList,
}

fn default_fps() -> u32 { 30 }
fn default_scale() -> f32 { 1.0 }
fn default_behavior_change_rarity() -> f32 { 40.0 }
fn default_true() -> bool { true }
fn default_move_speed() -> f32 { 2.0 }

/// Данные активного питомца
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPet {
    pub id: String,
    pub config: DPetConfig,
    pub package_path: PathBuf,
    
    // Текущее состояние
    pub state: MovementState,
    pub position: (f32, f32),
    pub velocity: (f32, f32),
    pub current_frame: u32,
    pub flip_x: bool,
    pub flip_y: bool,
    
    // Размер окна
    pub width: i32,
    pub height: i32,
}

/// Информация о DPET пакете для отображения в UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPetPackageInfo {
    pub id: String,
    pub name: String,
    pub author: Option<String>,
    pub path: String,
    pub preview_image: Option<String>, // Base64 encoded preview
}

/// Менеджер всех DPET питомцев
pub struct DPetManager {
    pets: HashMap<String, DPet>,
    packages: HashMap<String, DPetConfig>,
    data_dir: PathBuf,
}

impl DPetManager {
    pub fn new() -> Self {
        // Основная директория для CustomPets (для библиотеки)
        let custom_pets_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("CursorVerse")
            .join("CustomPets");
        
        // Директория для состояния активных питомцев
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("com.cursorverse.dev")
            .join("dpets");
        
        fs::create_dir_all(&custom_pets_dir).ok();
        fs::create_dir_all(&data_dir).ok();
        
        Self {
            pets: HashMap::new(),
            packages: HashMap::new(),
            data_dir,
        }
    }
    
    pub fn load_packages(&mut self) -> Result<(), String> {
        // Загружаем из CustomPets (библиотека)
        let custom_pets_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("CursorVerse")
            .join("CustomPets");
        
        fs::create_dir_all(&custom_pets_dir).map_err(|e| e.to_string())?;
        
        // Также проверяем старую директорию для совместимости
        let old_packages_dir = self.data_dir.join("packages");
        
        // Загружаем из обеих директорий
        self.load_from_directory(&custom_pets_dir)?;
        if old_packages_dir.exists() {
            self.load_from_directory(&old_packages_dir)?;
        }
        
        Ok(())
    }
    
    fn load_from_directory(&mut self, packages_dir: &PathBuf) -> Result<(), String> {
        if !packages_dir.exists() {
            return Ok(());
        }
                }
            } else if path.extension().and_then(|e| e.to_str()) == Some("dpet") 
                   || path.extension().and_then(|e| e.to_str()) == Some("zip") {
                // Поддержка .dpet и .zip архивов
                let id = path.file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                match self.load_package_from_zip(&path) {
                    Ok(config) => {
                        self.packages.insert(id, config);
                    }
                    Err(e) => eprintln!("Failed to load archive {}: {}", path.display(), e),
                }
            }
        }
        
        Ok(())
    }
    
    fn load_package_from_zip(&self, zip_path: &PathBuf) -> Result<DPetConfig, String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        
        // Ищем dpet.json в архиве
        let mut config_file = archive.by_name("dpet.json")
            .or_else(|_| archive.by_name("config.json"))
            .map_err(|e| e.to_string())?;
        
        let mut content = String::new();
        std::io::Read::read_to_string(&mut config_file, &mut content).map_err(|e| e.to_string())?;
        
    pub fn import_package(&mut self, source_path: PathBuf) -> Result<String, String> {
        let package_id = Uuid::new_v4().to_string();
        
        // Импортируем в CustomPets
        let custom_pets_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("CursorVerse")
            .join("CustomPets");
        
        let target_dir = custom_pets_dir.join(&package_id);
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
                            let id = path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            self.packages.insert(id, config);
                        }
                        Err(e) => eprintln!("Failed to load package {}: {}", path.display(), e),
                    }
                }
            } else if path.extension().and_then(|e| e.to_str()) == Some("dpet") {
                // TODO: Support .dpet (zip) packages
            }
        }
        
        Ok(())
    }
    
    fn load_package_config(&self, path: &PathBuf) -> Result<DPetConfig, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }
    
    pub fn import_package(&mut self, source_path: PathBuf) -> Result<String, String> {
        let package_id = Uuid::new_v4().to_string();
        let target_dir = self.data_dir.join("packages").join(&package_id);
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        
        if source_path.is_dir() {
            // Копирование директории
            copy_dir_recursive(&source_path, &target_dir)?;
        } else if source_path.extension().and_then(|e| e.to_str()) == Some("dpet") 
               || source_path.extension().and_then(|e| e.to_str()) == Some("zip") {
            // Распаковка архива
            self.extract_zip(&source_path, &target_dir)?;
        } else {
            return Err("Unsupported package format".to_string());
        }
        
        // Загрузка конфигурации
        let config_path = target_dir.join("dpet.json");
        let config = self.load_package_config(&config_path)?;
        self.packages.insert(package_id.clone(), config);
        
        Ok(package_id)
    }
    
    fn extract_zip(&self, zip_path: &PathBuf, target_dir: &PathBuf) -> Result<(), String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = target_dir.join(file.name());
            
            if file.is_dir() {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
        
        Ok(())
    }
    
    pub fn create_pet(&mut self, package_id: String, app_handle: &AppHandle) -> Result<String, String> {
        let config = self.packages.get(&package_id)
            .ok_or("Package not found")?
            .clone();
        
        let pet_id = Uuid::new_v4().to_string();
        let package_path = self.data_dir.join("packages").join(&package_id);
        
        let pet = DPet {
            id: pet_id.clone(),
            config: config.clone(),
            package_path: package_path.clone(),
            state: MovementState::Idle,
            position: (100.0, 100.0),
            velocity: (0.0, 0.0),
            current_frame: 0,
            flip_x: false,
            flip_y: false,
            width: 200,
            height: 200,
        };
        
        // Создание окна питомца
        self.create_pet_window(&pet, app_handle)?;
        
        self.pets.insert(pet_id.clone(), pet);
        self.save_state()?;
        
        Ok(pet_id)
    }
    
    fn create_pet_window(&self, pet: &DPet, app_handle: &AppHandle) -> Result<(), String> {
        let window_label = format!("dpet-{}", pet.id);
        
        let _window = tauri::WebviewWindowBuilder::new(
            app_handle,
            &window_label,
            WebviewUrl::App(format!("dpet.html?id={}", pet.id).into()),
        )
        .title(&pet.config.name)
        .inner_size(pet.width as f64, pet.height as f64)
        .position(pet.position.0 as f64, pet.position.1 as f64)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    pub fn remove_pet(&mut self, pet_id: String, app_handle: &AppHandle) -> Result<(), String> {
        self.pets.remove(&pet_id);
        
        let window_label = format!("dpet-{}", pet_id);
        if let Some(window) = app_handle.get_webview_window(&window_label) {
            window.close().map_err(|e| e.to_string())?;
        }
        
        self.save_state()?;
        Ok(())
    }
    
    pub fn get_all_pets(&self) -> Vec<DPet> {
        self.pets.values().cloned().collect()
    }
    
    pub fn get_all_packages(&self) -> Vec<DPetPackageInfo> {
        self.packages.iter().map(|(id, config)| {
            DPetPackageInfo {
                id: id.clone(),
                name: config.name.clone(),
                author: config.author.clone(),
                path: self.data_dir.join("packages").join(id).to_string_lossy().to_string(),
                preview_image: None, // TODO: Load preview image
            }
        }).collect()
    }
    
    pub fn update_pet_position(&mut self, pet_id: String, x: f32, y: f32) -> Result<(), String> {
        if let Some(pet) = self.pets.get_mut(&pet_id) {
            pet.position = (x, y);
            self.save_state()?;
            Ok(())
        } else {
            Err("Pet not found".to_string())
        }
    }
    
    pub fn update_pet_state(&mut self, pet_id: String, state: MovementState) -> Result<(), String> {
        if let Some(pet) = self.pets.get_mut(&pet_id) {
            pet.state = state;
            Ok(())
        } else {
            Err("Pet not found".to_string())
        }
    }
    
    pub fn get_pet(&self, pet_id: &str) -> Option<&DPet> {
        self.pets.get(pet_id)
    }
    
    fn save_state(&self) -> Result<(), String> {
        let state_path = self.data_dir.join("pets_state.json");
        let pets_vec: Vec<&DPet> = self.pets.values().collect();
        let json = serde_json::to_string_pretty(&pets_vec).map_err(|e| e.to_string())?;
        fs::write(state_path, json).map_err(|e| e.to_string())?;
        Ok(())
    }
    
    pub fn load_state(&mut self) -> Result<(), String> {
        let state_path = self.data_dir.join("pets_state.json");
        if !state_path.exists() {
            return Ok(());
        }
        
        let json = fs::read_to_string(state_path).map_err(|e| e.to_string())?;
        let pets: Vec<DPet> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
        
        for pet in pets {
            self.pets.insert(pet.id.clone(), pet);
        }
        
        Ok(())
    }
    
    pub fn restore_pets(&self, app_handle: &AppHandle) -> Result<(), String> {
        for pet in self.pets.values() {
            self.create_pet_window(pet, app_handle)?;
        }
        Ok(())
    }
}

// Вспомогательная функция для рекурсивного копирования директорий
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

// === Tauri Commands ===

#[tauri::command]
pub async fn dpet_load_packages() -> Result<Vec<DPetPackageInfo>, String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.load_packages()?;
    Ok(manager.get_all_packages())
}

#[tauri::command]
pub async fn dpet_import_package(path: String) -> Result<String, String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.import_package(PathBuf::from(path))
}

#[tauri::command]
pub async fn dpet_create_pet(package_id: String, app_handle: AppHandle) -> Result<String, String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.create_pet(package_id, &app_handle)
}

#[tauri::command]
pub async fn dpet_remove_pet(pet_id: String, app_handle: AppHandle) -> Result<(), String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.remove_pet(pet_id, &app_handle)
}

#[tauri::command]
pub async fn dpet_get_all_pets() -> Result<Vec<DPet>, String> {
    let manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_all_pets())
}

#[tauri::command]
pub async fn dpet_get_all_packages() -> Result<Vec<DPetPackageInfo>, String> {
    let manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_all_packages())
}

#[tauri::command]
pub async fn dpet_update_position(pet_id: String, x: f32, y: f32) -> Result<(), String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.update_pet_position(pet_id, x, y)
}

#[tauri::command]
pub async fn dpet_update_state(pet_id: String, state: MovementState) -> Result<(), String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.update_pet_state(pet_id, state)
}

#[tauri::command]
pub async fn dpet_get_pet_data(pet_id: String) -> Result<Option<DPet>, String> {
    let manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_pet(&pet_id).cloned())
}

#[tauri::command]
pub async fn dpet_restore_pets(app_handle: AppHandle) -> Result<(), String> {
    let mut manager = DPET_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.load_state()?;
    manager.restore_pets(&app_handle)
}
