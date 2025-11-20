# 🐾 Desktop Pets Application - Build & Usage Instructions

## 📋 Overview

This is a full-featured Tauri application that allows users to add animated GIF pets to their desktop. Each pet appears as a floating, always-on-top window that can be dragged and resized.

## ✨ Features

- **📂 GIF Upload**: Upload any GIF file to add as a desktop pet
- **🎯 Draggable Pets**: Hold Left Mouse Button (LMB) to drag pets around the screen
- **📏 Resizable Pets**: Use Mouse Wheel to increase/decrease pet size
- **💾 Persistent Storage**: All pets are saved with their position and size
- **🔄 Auto-restore**: Pets automatically reappear on app restart
- **🗑️ Easy Removal**: Delete pets through the management interface
- **🌐 System Tray**: Background mode with tray icon and menu
- **🚀 Autostart**: Register app to start automatically with Windows

## 🛠️ Prerequisites

Before building, ensure you have:

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/

2. **Rust** (latest stable)
   - Download: https://rustup.rs/
   - Run: `rustup default stable`

3. **Visual Studio Build Tools** (Windows)
   - Download: https://visualstudio.microsoft.com/downloads/
   - Select "Desktop development with C++"

4. **Tauri CLI**
   ```powershell
   npm install -g @tauri-apps/cli
   ```

## 📦 Installation & Build

### 1. Install Dependencies

```powershell
# Navigate to project directory
cd c:\Users\shust\Desktop\cursorverse-tauri

# Install Node.js dependencies
npm install

# Or if using yarn
yarn install
```

### 2. Development Mode

Run the application in development mode with hot-reload:

```powershell
npm run tauri:dev
```

This will:
- Start the Vite development server
- Compile the Rust backend
- Launch the application window
- Enable hot-reload for frontend changes

### 3. Build Production Version

Create an optimized production build:

```powershell
npm run tauri:build
```

The executable will be created in:
```
src-tauri/target/release/cursorverse.exe
```

The installer will be in:
```
src-tauri/target/release/bundle/
```

## 🎮 How to Use

### Adding Pets

1. Launch the application
2. Click the **"🐾 Pets"** button in the sidebar
3. Click **"+ Add New Pet (GIF)"**
4. Select any GIF file from your computer
5. The pet will appear on your desktop!

### Interacting with Pets

- **Move Pet**: Hold Left Mouse Button (LMB) and drag
- **Resize Pet**: Scroll mouse wheel up (increase) or down (decrease)
- **Remove Pet**: Open Pets Manager and click "Remove" button

### System Tray

The app runs in the background with a system tray icon. Right-click the tray icon to:
- Show Main Window
- Manage Pets
- Quit Application

### Autostart (Optional)

To make the app start automatically with Windows, you can add code to call the Rust command:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Enable autostart
await invoke('enable_autostart');

// Disable autostart
await invoke('disable_autostart');

// Check if autostart is enabled
const isEnabled = await invoke('is_autostart_enabled');
```

## 📁 File Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Main entry point, app setup
│   ├── pet_manager.rs       # Pet window management & persistence
│   └── autostart.rs         # Windows autostart functionality
│
src/
├── components/
│   └── Pets/
│       ├── PetsManager.tsx  # React component for pet management
│       ├── PetsManager.css  # Styling
│       └── index.ts         # Export
└── App.tsx                  # Main app with "Pets" button

Data Storage:
%APPDATA%/com.cursorverse.dev/pets.json
```

## 🔧 How It Works

### Backend (Rust)

#### Pet Manager (`pet_manager.rs`)
- Creates frameless, transparent, always-on-top windows
- Generates HTML content with embedded GIF
- Handles position and size updates
- Persists data to JSON file

#### Commands Available:
```rust
add_pet(file_path: String) -> Result<Pet, String>
remove_pet(pet_id: String) -> Result<(), String>
get_all_pets() -> Result<Vec<Pet>, String>
update_pet_position(pet_id: String, x: i32, y: i32) -> Result<(), String>
update_pet_size(pet_id: String, width: u32, height: u32) -> Result<(), String>
```

#### Autostart (`autostart.rs`)
- Uses Windows Registry (`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`)
- Adds/removes app from startup programs

### Frontend (TypeScript/React)

#### PetsManager Component
- File picker dialog for GIF selection
- Displays list of active pets
- Remove button for each pet
- Instructions for user interaction

#### Pet Windows
Each pet window contains JavaScript that handles:
- **Drag**: Tracks mouse movement during LMB hold
- **Resize**: Listens to wheel events and updates window size
- **Position/Size Updates**: Sends data back to Rust backend

### Data Persistence

Pets are saved in JSON format:
```json
{
  "pets": [
    {
      "id": "uuid-here",
      "file_path": "C:\\Users\\...\\mypet.gif",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 200
    }
  ]
}
```

On app startup, `restore_all_pets()` reads this file and recreates all pet windows.

## 🐛 Troubleshooting

### Pet windows don't appear
- Check if GIF file path is valid
- Check console for errors: `npm run tauri:dev`
- Ensure GIF file is accessible

### Pets disappear after restart
- Check if `pets.json` exists in app data directory
- Verify write permissions to app data folder

### Drag/Resize not working
- Ensure JavaScript is enabled in pet windows
- Check browser console in pet windows (enable debug mode)

### Build errors
```powershell
# Clean and rebuild
cargo clean
npm run tauri:build
```

## 🎨 Customization Ideas

1. **Add More Interactions**
   - Right-click menu for pet-specific actions
   - Double-click to play sound
   - Idle animations

2. **Pet Behaviors**
   - Random movement patterns
   - Reactions to mouse cursor
   - Sleep mode after inactivity

3. **UI Enhancements**
   - Pet categories/tags
   - Search functionality
   - Import/export pet collections

4. **Advanced Features**
   - Multi-monitor support
   - Pet-to-pet interactions
   - Custom animations (not just GIF)

## 📝 Technical Notes

### Window Creation
- Uses Tauri's `WindowBuilder` with:
  - `decorations(false)` - No title bar
  - `transparent(true)` - Transparent background
  - `always_on_top(true)` - Stays above other windows
  - `skip_taskbar(true)` - Doesn't appear in taskbar

### GIF Display
- GIFs are displayed using standard HTML `<img>` tag
- Browser handles GIF animation automatically
- File path is converted to `file://` URL

### Performance
- Each pet is a separate window process
- Minimal CPU usage when idle
- Memory usage depends on GIF file size

## 🚀 Deployment

### Creating Installer

The build command automatically creates:
- **MSI Installer**: `cursorverse_1.5.0_x64_en-US.msi`
- **NSIS Installer**: `cursorverse_1.5.0_x64-setup.exe`

Both are located in:
```
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

### Distribution

Users can install the app and their pets will:
1. Persist across app restarts
2. Survive Windows restarts (if autostart is enabled)
3. Be stored in their user profile

## 📄 License

This is part of the CursorVerse application. See main README for license details.

## 🤝 Contributing

Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Share your pet collections!

## 💡 Tips

- **GIF Size**: Use compressed GIFs for better performance
- **Multiple Pets**: Add 5-10 pets for a lively desktop
- **Organization**: Name your GIF files descriptively
- **Backup**: Export `pets.json` to save your collection

## 🎉 Enjoy Your Desktop Pets!

Have fun customizing your desktop with adorable animated companions! 🐱🐶🐰🐹🦜
