# 🔧 Desktop Pets - Technical Documentation

## Architecture Overview

This application follows a **Client-Server** architecture where:
- **Backend (Rust/Tauri)**: Manages windows, file system, and system integration
- **Frontend (React/TypeScript)**: Provides UI for pet management
- **Pet Windows (Vanilla JS)**: Individual floating windows for each pet

```
┌─────────────────────────────────────────────┐
│         Main Application Window             │
│  ┌───────────────────────────────────────┐  │
│  │   React Frontend (PetsManager)        │  │
│  │   - File Upload                       │  │
│  │   - Pet List                          │  │
│  │   - Remove Buttons                    │  │
│  └───────────────────────────────────────┘  │
│               ↕ Tauri IPC                   │
│  ┌───────────────────────────────────────┐  │
│  │   Rust Backend (PetManager)           │  │
│  │   - Window Creation                   │  │
│  │   - Data Persistence                  │  │
│  │   - State Management                  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    ↕
    ┌───────────────────────────────────┐
    │     Pet Windows (Frameless)       │
    │  ┌─────────────────────────────┐  │
    │  │  HTML + Vanilla JS          │  │
    │  │  - GIF Display              │  │
    │  │  - Drag Handler             │  │
    │  │  - Resize Handler           │  │
    │  └─────────────────────────────┘  │
    └───────────────────────────────────┘
```

## Backend Implementation

### 1. Pet Data Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pet {
    pub id: String,           // UUID
    pub file_path: String,    // Absolute path to GIF
    pub x: i32,              // Window X position
    pub y: i32,              // Window Y position
    pub width: u32,          // Window width
    pub height: u32,         // Window height
}
```

### 2. PetManager State

```rust
pub struct PetManager {
    pets: Mutex<HashMap<String, Pet>>,           // Pet data by ID
    windows: Mutex<HashMap<String, String>>,     // pet_id -> window_label
    save_path: PathBuf,                          // Path to pets.json
}
```

**Thread Safety**: Uses `Mutex` for concurrent access from multiple Tauri commands.

### 3. Window Creation Process

```rust
fn create_pet_window(pet: &Pet) -> Result<(), String> {
    // 1. Generate HTML with embedded GIF
    let html = format!("...<img src='{}'>...", pet.file_path);
    
    // 2. Save HTML to temp file
    let temp_path = temp_dir().join("pet_{id}.html");
    fs::write(&temp_path, html)?;
    
    // 3. Create Tauri window
    WindowBuilder::new(app, label, WindowUrl::App(...))
        .decorations(false)      // No title bar/borders
        .transparent(true)       // See-through background
        .always_on_top(true)     // Stays on top
        .skip_taskbar(true)      // Hidden from taskbar
        .resizable(false)        // Disabled native resize
        .position(pet.x, pet.y)
        .inner_size(pet.width, pet.height)
        .build()?;
    
    Ok(())
}
```

### 4. Persistence System

**Save Location**: `%APPDATA%/com.cursorverse.dev/pets.json`

**Save Trigger**: Automatically saves after:
- Adding a pet
- Removing a pet
- Updating position
- Updating size

**Restore Process**:
```rust
fn restore_all_pets() {
    // 1. Read JSON file
    let content = fs::read_to_string(save_path)?;
    
    // 2. Parse into Vec<Pet>
    let pets_data = serde_json::from_str(&content)?;
    
    // 3. Create window for each pet
    for pet in pets_data.pets {
        create_pet_window(&pet)?;
    }
}
```

### 5. Tauri Commands

All commands are async and return `Result<T, String>`:

```rust
#[tauri::command]
fn add_pet(
    app_handle: tauri::AppHandle,
    pet_manager: tauri::State<PetManager>,
    file_path: String,
) -> Result<Pet, String>

#[tauri::command]
fn remove_pet(
    app_handle: tauri::AppHandle,
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
) -> Result<(), String>

#[tauri::command]
fn get_all_pets(
    pet_manager: tauri::State<PetManager>
) -> Result<Vec<Pet>, String>

#[tauri::command]
fn update_pet_position(
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
    x: i32,
    y: i32,
) -> Result<(), String>

#[tauri::command]
fn update_pet_size(
    pet_manager: tauri::State<PetManager>,
    pet_id: String,
    width: u32,
    height: u32,
) -> Result<(), String>
```

## Frontend Implementation

### 1. PetsManager Component

```tsx
interface Pet {
  id: string;
  file_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PetsManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  
  // Load pets on mount
  useEffect(() => {
    loadPets();
  }, []);
  
  const loadPets = async () => {
    const loadedPets = await invoke<Pet[]>('get_all_pets');
    setPets(loadedPets);
  };
  
  const handleAddPet = async () => {
    // Open file dialog
    const selected = await open({
      multiple: false,
      filters: [{ name: 'GIF Images', extensions: ['gif'] }]
    });
    
    if (selected) {
      await invoke('add_pet', { filePath: selected });
      await loadPets(); // Refresh list
    }
  };
  
  const handleRemovePet = async (petId: string) => {
    await invoke('remove_pet', { petId });
    await loadPets(); // Refresh list
  };
  
  return (
    <div className="pets-manager-overlay">
      <button onClick={handleAddPet}>+ Add New Pet</button>
      {pets.map(pet => (
        <div key={pet.id}>
          <span>{pet.file_path.split('\\').pop()}</span>
          <button onClick={() => handleRemovePet(pet.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};
```

### 2. System Tray Integration

In `App.tsx`:

```tsx
useEffect(() => {
  // Listen for tray menu "Manage Pets" click
  const unlisten = listen('show-pets', () => {
    setActiveTab('pets');
    setShowPetsManager(true);
  });
  
  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

In `main.rs` (Rust):

```rust
.setup(|app| {
    // Create tray menu
    let menu = MenuBuilder::new(app)
        .items(&[
            MenuItem::with_id("show", "Show Main Window"),
            MenuItem::with_id("pets", "Manage Pets"),
            MenuItem::with_id("quit", "Quit"),
        ])
        .build()?;
    
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "pets" => {
                    app.get_window("main").unwrap().emit("show-pets", ()).unwrap();
                }
                // ... other cases
            }
        })
        .build(app)?;
})
```

## Pet Window Implementation

Each pet window contains this JavaScript:

```javascript
const { invoke } = window.__TAURI__.tauri;
const { appWindow } = window.__TAURI__.window;

// === DRAG FUNCTIONALITY ===
let isDragging = false;
let offsetX = 0, offsetY = 0;

document.addEventListener('mousedown', async (e) => {
    if (e.button === 0) { // Left button
        isDragging = true;
        const position = await appWindow.outerPosition();
        offsetX = e.screenX - position.x;
        offsetY = e.screenY - position.y;
    }
});

document.addEventListener('mousemove', async (e) => {
    if (isDragging) {
        const newX = e.screenX - offsetX;
        const newY = e.screenY - offsetY;
        
        // Move window
        await appWindow.setPosition({ x: newX, y: newY });
        
        // Update backend
        await invoke('update_pet_position', {
            petId: 'PET_ID_HERE',
            x: newX,
            y: newY
        });
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isDragging = false;
    }
});

// === RESIZE FUNCTIONALITY ===
document.addEventListener('wheel', async (e) => {
    e.preventDefault();
    
    const size = await appWindow.outerSize();
    const delta = e.deltaY > 0 ? -10 : 10;
    const newWidth = Math.max(50, size.width + delta);
    const newHeight = Math.max(50, size.height + delta);
    
    // Resize window
    await appWindow.setSize({ width: newWidth, height: newHeight });
    
    // Update backend
    await invoke('update_pet_size', {
        petId: 'PET_ID_HERE',
        width: newWidth,
        height: newHeight
    });
});
```

## Windows Autostart

### Registry Key Management

```rust
use winreg::enums::*;
use winreg::RegKey;

const STARTUP_KEY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_NAME: &str = "CursorVersePets";

fn enable_autostart() -> Result<(), String> {
    // Get current executable path
    let exe_path = std::env::current_exe()?;
    
    // Open registry key
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(STARTUP_KEY_PATH)?;
    
    // Set value
    key.set_value(APP_NAME, &exe_path.to_str().unwrap())?;
    
    Ok(())
}

fn disable_autostart() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey_with_flags(STARTUP_KEY_PATH, KEY_WRITE)?;
    key.delete_value(APP_NAME).ok(); // Ignore if not exists
    Ok(())
}
```

## Data Flow Diagrams

### Adding a Pet

```
User Clicks "Add Pet"
    ↓
Open File Dialog (Frontend)
    ↓
Select GIF File → file_path
    ↓
invoke('add_pet', { filePath })
    ↓
Rust: PetManager::add_pet()
    ├─ Generate UUID
    ├─ Create Pet struct
    ├─ Store in HashMap
    ├─ Create HTML with GIF
    ├─ Save HTML to temp
    ├─ WindowBuilder::build()
    └─ Save to pets.json
    ↓
Return Pet to Frontend
    ↓
Refresh Pet List
```

### Dragging a Pet

```
User Holds LMB on Pet
    ↓
mousedown event (Pet Window JS)
    ├─ Set isDragging = true
    └─ Calculate offsetX, offsetY
    ↓
User Moves Mouse
    ↓
mousemove event
    ├─ Calculate newX, newY
    ├─ appWindow.setPosition({ x, y })
    └─ invoke('update_pet_position', { petId, x, y })
    ↓
Rust: PetManager::update_pet_position()
    ├─ Update HashMap
    └─ Save to pets.json
    ↓
User Releases LMB
    ↓
mouseup event
    └─ Set isDragging = false
```

### App Startup

```
App Launch
    ↓
main.rs setup()
    ├─ Initialize PetManager
    ├─ Call restore_all_pets()
    │   ├─ Read pets.json
    │   ├─ Parse JSON → Vec<Pet>
    │   └─ For each pet:
    │       └─ create_pet_window()
    ├─ Create System Tray
    └─ app.manage(pet_manager)
    ↓
All pets restored on desktop
```

## Performance Considerations

### Memory Usage
- **Per Pet Window**: ~20-30 MB (Chromium process)
- **Main Window**: ~50-80 MB
- **Total for 5 pets**: ~200-250 MB

### CPU Usage
- **Idle**: <1% (just GIF animation)
- **Dragging**: 5-10% (position updates)
- **Resizing**: 5-10% (size updates)

### Optimization Tips
1. **Limit Pet Count**: Recommend max 10-15 pets
2. **Compress GIFs**: Use tools like gifsicle
3. **Debounce Updates**: Batch position/size updates
4. **Lazy Load**: Only create windows when visible

## Security Considerations

### File Path Validation
```rust
fn validate_file_path(path: &str) -> Result<(), String> {
    // Check if file exists
    if !Path::new(path).exists() {
        return Err("File not found".to_string());
    }
    
    // Check if it's a GIF
    if !path.to_lowercase().ends_with(".gif") {
        return Err("Only GIF files allowed".to_string());
    }
    
    Ok(())
}
```

### Path Sanitization
```rust
// Convert Windows path separators
let safe_path = file_path.replace("\\", "/");

// Escape HTML in file path
let escaped_path = html_escape::encode_text(&safe_path);
```

### Registry Safety
- Only writes to `HKEY_CURRENT_USER` (no admin required)
- Validates registry key paths
- Handles missing keys gracefully

## Error Handling

### Frontend
```typescript
try {
    await invoke('add_pet', { filePath });
    await loadPets();
} catch (error) {
    console.error('Failed to add pet:', error);
    // Show user-friendly error message
    alert('Failed to add pet. Please try again.');
}
```

### Backend
```rust
fn add_pet(&self, file_path: String) -> Result<Pet, String> {
    // Validate file
    if !Path::new(&file_path).exists() {
        return Err("File not found".to_string());
    }
    
    // Create pet
    let pet = Pet { /* ... */ };
    
    // Create window
    self.create_pet_window(&pet)
        .map_err(|e| format!("Failed to create window: {}", e))?;
    
    // Save
    self.save_pets()
        .map_err(|e| format!("Failed to save: {}", e))?;
    
    Ok(pet)
}
```

## Testing

### Manual Testing Checklist

- [ ] Add pet (GIF upload)
- [ ] Drag pet with LMB
- [ ] Resize pet with mouse wheel
- [ ] Remove pet
- [ ] Restart app (pets should restore)
- [ ] System tray menu works
- [ ] Enable/disable autostart
- [ ] Multiple pets at once
- [ ] Pet windows stay on top
- [ ] Pet windows are frameless

### Edge Cases

1. **Invalid GIF path**: Should show error
2. **File deleted after adding**: Window should handle missing file
3. **Corrupted pets.json**: Should create new file
4. **Very large GIF**: May cause memory issues
5. **Negative coordinates**: Should clamp to screen bounds

## Future Enhancements

1. **Multi-Monitor Support**
   - Detect screen boundaries
   - Allow pets to move between monitors
   - Save monitor index with position

2. **Pet Behaviors**
   - Idle animations (walk, sleep, etc.)
   - Follow cursor
   - React to clicks

3. **Import/Export**
   - Share pet collections
   - Cloud backup
   - Preset packs

4. **Advanced Customization**
   - Pet opacity
   - Animation speed
   - Click-through mode

## Conclusion

This implementation provides a solid foundation for a desktop pets application with:
- ✅ Persistent storage
- ✅ Smooth interactions
- ✅ System integration
- ✅ Clean architecture
- ✅ Error handling

The code is modular and can be easily extended with additional features!
