use base64::{engine::general_purpose, Engine as _};
use dirs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;
use urlencoding;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pet {
    pub id: String,
    pub file_path: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetsData {
    pub pets: Vec<Pet>,
}

pub struct PetManager {
    pets: Mutex<HashMap<String, Pet>>,
    windows: Mutex<HashMap<String, String>>, // pet_id -> window_label
    save_path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
pub struct CatalogPet {
    pub id: String,
    pub name: String,
    pub category: String,
    pub preview: String,
}

impl PetManager {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");
        
        fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
        
        let save_path = app_dir.join("pets.json");
        
        PetManager {
            pets: Mutex::new(HashMap::new()),
            windows: Mutex::new(HashMap::new()),
            save_path,
        }
    }

    pub fn load_pets(&self) -> Result<Vec<Pet>, String> {
        if !self.save_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.save_path)
            .map_err(|e| format!("Failed to read pets file: {}", e))?;

        let pets_data: PetsData = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse pets data: {}", e))?;

        let mut pets = self.pets.lock().unwrap();
        for pet in &pets_data.pets {
            pets.insert(pet.id.clone(), pet.clone());
        }

        Ok(pets_data.pets)
    }

    pub fn save_pets(&self) -> Result<(), String> {
        let pets = self.pets.lock().unwrap();
        let pets_vec: Vec<Pet> = pets.values().cloned().collect();

        let pets_data = PetsData { pets: pets_vec };

        let json = serde_json::to_string_pretty(&pets_data)
            .map_err(|e| format!("Failed to serialize pets: {}", e))?;

        fs::write(&self.save_path, json)
            .map_err(|e| format!("Failed to write pets file: {}", e))?;

        Ok(())
    }

    fn custom_pets_dir() -> Result<PathBuf, String> {
        let base_dir = dirs::data_local_dir()
            .ok_or_else(|| "Failed to resolve local data directory".to_string())?
            .join("CursorVerse")
            .join("CustomPets");
        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to access CustomPets directory: {}", e))?;
        Ok(base_dir)
    }

    fn resolve_catalog_asset(pet_id: &str) -> Result<PathBuf, String> {
        let base_dir = Self::custom_pets_dir()?;
        let relative_path = PathBuf::from(
            pet_id.replace('/', &std::path::MAIN_SEPARATOR.to_string()),
        );
        let candidate = base_dir.join(relative_path);
        if !candidate.exists() {
            return Err("Файл питомца не найден в библиотеке".into());
        }

        let canonical_base = base_dir
            .canonicalize()
            .unwrap_or(base_dir.clone());
        let canonical_candidate = candidate
            .canonicalize()
            .map_err(|e| format!("Не удалось открыть файл питомца: {}", e))?;

        if !canonical_candidate.starts_with(&canonical_base) {
            return Err("Недопустимый идентификатор питомца".into());
        }

        Ok(canonical_candidate)
    }

    fn mime_from_path(path: &Path) -> &'static str {
        match path.extension().map(|ext| ext.to_string_lossy().to_lowercase()) {
            Some(ext) if ext == "gif" => "image/gif",
            Some(ext) if ext == "png" => "image/png",
            Some(ext) if ext == "jpg" || ext == "jpeg" => "image/jpeg",
            Some(ext) if ext == "svg" => "image/svg+xml",
            _ => "application/octet-stream",
        }
    }

    fn encode_pet_image(path: &Path) -> Result<String, String> {
        let image_data = fs::read(path)
            .map_err(|e| format!("Failed to read image file: {}", e))?;
        let base64_image = general_purpose::STANDARD.encode(image_data);
        Ok(format!("data:{};base64,{}", Self::mime_from_path(path), base64_image))
    }

    fn prettify_name(raw: &str) -> String {
        if raw.is_empty() {
            return "Pet".into();
        }
        raw.replace(['_', '-'], " ")
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn is_supported_asset(path: &Path) -> bool {
        matches!(
            path.extension()
                .map(|ext| ext.to_string_lossy().to_lowercase())
                .as_deref(),
            Some("gif" | "png" | "jpg" | "jpeg" | "svg")
        )
    }

    fn collect_catalog_entries(base: &Path, dir: &Path, pets: &mut Vec<CatalogPet>) -> Result<(), String> {
        for entry in fs::read_dir(dir)
            .map_err(|e| format!("Failed to read CustomPets directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to iterate directory: {}", e))?;
            let path = entry.path();

            if path.is_dir() {
                Self::collect_catalog_entries(base, &path, pets)?;
                continue;
            }

            if !Self::is_supported_asset(&path) {
                continue;
            }

            let preview = Self::encode_pet_image(&path)?;
            let display_name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(Self::prettify_name)
                .unwrap_or_else(|| "Pet".to_string());

            let relative_id = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            // Extract category from path (first folder in relative path)
            let category = relative_id
                .split('/')
                .next()
                .map(|s| Self::prettify_name(s))
                .unwrap_or_else(|| "Другие".to_string());

            pets.push(CatalogPet {
                id: relative_id,
                name: display_name,
                category,
                preview,
            });
        }

        Ok(())
    }

    pub fn get_available_pets(&self) -> Result<Vec<CatalogPet>, String> {
        let dir = Self::custom_pets_dir()?;
        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut pets = Vec::new();
        Self::collect_catalog_entries(&dir, &dir, &mut pets)?;
        pets.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(pets)
    }

    pub fn add_pet(
        &self,
        app_handle: &tauri::AppHandle,
        file_path: String,
    ) -> Result<Pet, String> {
        let pet_id = Uuid::new_v4().to_string();
        
        // Default position and size
        let pet = Pet {
            id: pet_id.clone(),
            file_path: file_path.clone(),
            x: 100,
            y: 100,
            width: 200,
            height: 200,
        };

        // Store pet
        {
            let mut pets = self.pets.lock().unwrap();
            pets.insert(pet_id.clone(), pet.clone());
        }

        // Create window for pet
        self.create_pet_window(app_handle, &pet)?;

        // Save to file
        self.save_pets()?;

        Ok(pet)
    }

    pub fn create_pet_window(
        &self,
        app_handle: &tauri::AppHandle,
        pet: &Pet,
    ) -> Result<(), String> {
        let window_label = format!("pet_{}", pet.id);

        // Read file content and convert to base64
        let path = PathBuf::from(&pet.file_path);
        let image_src = Self::encode_pet_image(&path)?;

        // Create HTML content with the GIF embedded as data URL
        let html_content = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
    <style>
        * {{
            margin: 0;
            padding: 0;
            overflow: hidden;
        }}
        body {{
            width: 100vw;
            height: 100vh;
            background: transparent;
            cursor: move;
            position: relative;
        }}
        img {{
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
        }}
        .delete-button {{
            position: absolute;
            top: 5px;
            right: 5px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: rgba(255, 59, 48, 0.9);
            border: 2px solid white;
            color: white;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1000;
        }}
        body:hover .delete-button {{
            opacity: 1;
        }}
        .delete-button:hover {{
            background: rgba(255, 59, 48, 1);
            transform: scale(1.1);
        }}
    </style>
</head>
<body>
    <button class="delete-button" id="deleteBtn" title="Удалить питомца">×</button>
    <img src="{}" alt="Pet" draggable="false">
    <script>
        const {{ invoke }} = window.__TAURI__.tauri;
        const {{ appWindow }} = window.__TAURI__.window;
        
        const petId = '{}';
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        // Delete button handler
        document.getElementById('deleteBtn').addEventListener('click', async (e) => {{
            e.stopPropagation();
            try {{
                await invoke('remove_pet', {{ petId }});
                await appWindow.close();
            }} catch (err) {{
                console.error('Failed to delete pet:', err);
            }}
        }});

        // Left mouse button drag
        document.addEventListener('mousedown', async (e) => {{
            if (e.button === 0 && e.target.tagName !== 'BUTTON') {{
                isDragging = true;
                const position = await appWindow.outerPosition();
                offsetX = e.screenX - position.x;
                offsetY = e.screenY - position.y;
            }}
        }});

        document.addEventListener('mousemove', async (e) => {{
            if (isDragging) {{
                const newX = e.screenX - offsetX;
                const newY = e.screenY - offsetY;
                await appWindow.setPosition({{ x: newX, y: newY }});
                
                try {{
                    await invoke('update_pet_position', {{
                        petId,
                        x: newX,
                        y: newY
                    }});
                }} catch (err) {{
                    console.error('Failed to update position:', err);
                }}
            }}
        }});

        document.addEventListener('mouseup', (e) => {{
            if (e.button === 0) {{
                isDragging = false;
            }}
        }});

        // Mouse wheel resize
        document.addEventListener('wheel', async (e) => {{
            e.preventDefault();
            const size = await appWindow.outerSize();
            const delta = e.deltaY > 0 ? -10 : 10;
            const newWidth = Math.max(50, size.width + delta);
            const newHeight = Math.max(50, size.height + delta);
            
            await appWindow.setSize({{ width: newWidth, height: newHeight }});
            
            try {{
                await invoke('update_pet_size', {{
                    petId,
                    width: newWidth,
                    height: newHeight
                }});
            }} catch (err) {{
                console.error('Failed to update size:', err);
            }}
        }});

        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    </script>
</body>
</html>"#,
            image_src,
            pet.id
        );

        // Create blank window first, then inject HTML via data URL navigation
        let window = tauri::WebviewWindowBuilder::new(
            app_handle,
            &window_label,
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Pet")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .position(pet.x as f64, pet.y as f64)
        .inner_size(pet.width as f64, pet.height as f64)
        .visible(false)  // Hide initially
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

        // Navigate to data URL with HTML content
        let data_url = format!("data:text/html;charset=utf-8,{}", 
            urlencoding::encode(&html_content));
        
        window.navigate(data_url.parse().map_err(|e| format!("Failed to parse data URL: {:?}", e))?)
            .map_err(|e| format!("Failed to navigate to HTML: {}", e))?;

        // Show window after content is loaded
        window.show().map_err(|e| format!("Failed to show window: {}", e))?;

        // Store window label
        {
            let mut windows = self.windows.lock().unwrap();
            windows.insert(pet.id.clone(), window_label);
        }

        Ok(())
    }

    pub fn remove_pet(&self, app_handle: &tauri::AppHandle, pet_id: String) -> Result<(), String> {
        // Close window
        {
            let windows = self.windows.lock().unwrap();
            if let Some(window_label) = windows.get(&pet_id) {
                if let Some(window) = app_handle.get_webview_window(window_label) {
                    let _ = window.close();
                }
            }
        }

        // Remove from storage
        {
            let mut pets = self.pets.lock().unwrap();
            pets.remove(&pet_id);
        }

        {
            let mut windows = self.windows.lock().unwrap();
            windows.remove(&pet_id);
        }

        // Save to file
        self.save_pets()?;

        Ok(())
    }

    pub fn get_all_pets(&self) -> Vec<Pet> {
        let pets = self.pets.lock().unwrap();
        pets.values().cloned().collect()
    }

    pub fn update_pet_position(&self, pet_id: String, x: i32, y: i32) -> Result<(), String> {
        let mut pets = self.pets.lock().unwrap();
        if let Some(pet) = pets.get_mut(&pet_id) {
            pet.x = x;
            pet.y = y;
        }
        drop(pets);
        self.save_pets()
    }

    pub fn update_pet_size(&self, pet_id: String, width: u32, height: u32) -> Result<(), String> {
        let mut pets = self.pets.lock().unwrap();
        if let Some(pet) = pets.get_mut(&pet_id) {
            pet.width = width;
            pet.height = height;
        }
        drop(pets);
        self.save_pets()
    }

    pub fn restore_all_pets(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        let pets = self.load_pets()?;
        
        for pet in pets {
            self.create_pet_window(app_handle, &pet)?;
        }

        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub fn add_pet(
    app_handle: tauri::AppHandle,
    pet_manager: tauri::State<PetManager>,
    file_path: String,
) -> Result<Pet, String> {
    pet_manager.add_pet(&app_handle, file_path)
}

#[tauri::command]
pub fn add_pet_from_catalog(
    app_handle: tauri::AppHandle,
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
) -> Result<Pet, String> {
    let path = PetManager::resolve_catalog_asset(&pet_id)?;
    pet_manager.add_pet(&app_handle, path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn remove_pet(
    app_handle: tauri::AppHandle,
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
) -> Result<(), String> {
    pet_manager.remove_pet(&app_handle, pet_id)
}

#[tauri::command]
pub fn get_all_pets(pet_manager: tauri::State<PetManager>) -> Result<Vec<Pet>, String> {
    Ok(pet_manager.get_all_pets())
}

#[tauri::command]
pub fn get_available_pets(
    pet_manager: tauri::State<PetManager>,
) -> Result<Vec<CatalogPet>, String> {
    pet_manager.get_available_pets()
}

#[tauri::command]
pub fn update_pet_position(
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
    x: i32,
    y: i32,
) -> Result<(), String> {
    pet_manager.update_pet_position(pet_id, x, y)
}

#[tauri::command]
pub fn update_pet_size(
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    pet_manager.update_pet_size(pet_id, width, height)
}
