# Скрипт проверки и установки зависимостей для CursorVerse Tauri

Write-Host "=== Проверка зависимостей для CursorVerse Tauri ===" -ForegroundColor Cyan
Write-Host ""

# Проверка Node.js
Write-Host "Проверка Node.js..." -ForegroundColor Yellow
$nodeInstalled = $false
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✓ Node.js установлен: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {
    Write-Host "✗ Node.js НЕ установлен" -ForegroundColor Red
    Write-Host "  Скачайте с https://nodejs.org/ (LTS версия)" -ForegroundColor Yellow
}

# Проверка npm
if ($nodeInstalled) {
    Write-Host "Проверка npm..." -ForegroundColor Yellow
    try {
        $npmVersion = & npm --version 2>$null
        if ($npmVersion) {
            Write-Host "✓ npm установлен: v$npmVersion" -ForegroundColor Green
        }
    } catch {
        Write-Host "✗ npm не найден" -ForegroundColor Red
    }
}

# Проверка Rust
Write-Host ""
Write-Host "Проверка Rust..." -ForegroundColor Yellow
$rustInstalled = $false
try {
    $rustcVersion = & rustc --version 2>$null
    if ($rustcVersion) {
        Write-Host "✓ Rust установлен: $rustcVersion" -ForegroundColor Green
        $rustInstalled = $true
    }
} catch {
    Write-Host "✗ Rust НЕ установлен" -ForegroundColor Red
    Write-Host "  Установите через rustup: https://rustup.rs/" -ForegroundColor Yellow
    Write-Host "  Команда: winget install Rustlang.Rustup" -ForegroundColor Yellow
}

# Проверка cargo
if ($rustInstalled) {
    Write-Host "Проверка Cargo..." -ForegroundColor Yellow
    try {
        $cargoVersion = & cargo --version 2>$null
        if ($cargoVersion) {
            Write-Host "✓ Cargo установлен: $cargoVersion" -ForegroundColor Green
        }
    } catch {
        Write-Host "✗ Cargo не найден" -ForegroundColor Red
    }
}

# Проверка Build Tools
Write-Host ""
Write-Host "Проверка Visual Studio Build Tools..." -ForegroundColor Yellow
$buildToolsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
if (Test-Path $buildToolsPath) {
    Write-Host "✓ Visual Studio Build Tools обнаружены" -ForegroundColor Green
} else {
    $vsPath = "C:\Program Files\Microsoft Visual Studio\2022"
    if (Test-Path $vsPath) {
        Write-Host "✓ Visual Studio обнаружена" -ForegroundColor Green
    } else {
        Write-Host "⚠ Visual Studio Build Tools не найдены" -ForegroundColor Yellow
        Write-Host "  Установите VS Build Tools для компиляции Rust:" -ForegroundColor Yellow
        Write-Host "  https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Итоговая проверка ===" -ForegroundColor Cyan

if ($nodeInstalled -and $rustInstalled) {
    Write-Host "✓ Все основные зависимости установлены!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Следующие шаги:" -ForegroundColor Cyan
    Write-Host "1. npm install          - Установить JavaScript зависимости" -ForegroundColor White
    Write-Host "2. npm run tauri:dev    - Запустить в режиме разработки" -ForegroundColor White
    Write-Host "3. npm run tauri:build  - Собрать production версию" -ForegroundColor White
} else {
    Write-Host "✗ Не все зависимости установлены" -ForegroundColor Red
    Write-Host ""
    Write-Host "Установите недостающие компоненты:" -ForegroundColor Yellow
    
    if (-not $nodeInstalled) {
        Write-Host "• Node.js: https://nodejs.org/" -ForegroundColor White
    }
    
    if (-not $rustInstalled) {
        Write-Host "• Rust: https://rustup.rs/" -ForegroundColor White
        Write-Host "  или: winget install Rustlang.Rustup" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Для получения помощи читайте README.md" -ForegroundColor Cyan
