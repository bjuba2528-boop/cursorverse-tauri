// Автономный агент с полным доступом к системе
use std::process::Command;
use sysinfo::System;
use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use serde::Serialize;
use open;
use scraper::{Html, Selector};

#[derive(Serialize)]
pub struct InstalledApp {
    name: String,
    path: String,
}

#[command]
pub async fn get_installed_apps() -> Result<String, String> {
    println!("🔍 Поиск установленных приложений...");

    let mut apps = Vec::new();
    let mut visited_paths = std::collections::HashSet::new();

    let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
    let user_start_menu = format!("{}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs", user_profile);

    let start_menu_folders = vec![
        "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
        &user_start_menu,
    ];

    for folder in start_menu_folders {
        let path = Path::new(folder);
        if path.exists() {
            match scan_directory_for_apps(path, &mut visited_paths) {
                Ok(mut found_apps) => apps.append(&mut found_apps),
                Err(e) => eprintln!("⚠️ Не удалось сканировать {}: {}", folder, e),
            }
        }
    }

    let json_output = serde_json::to_string(&apps).map_err(|e| e.to_string())?;
    Ok(json_output)
}

fn scan_directory_for_apps(path: &Path, visited: &mut std::collections::HashSet<PathBuf>) -> Result<Vec<InstalledApp>, std::io::Error> {
    let mut apps = Vec::new();
    
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if visited.contains(&path) {
            continue;
        }
        visited.insert(path.clone());

        if path.is_dir() {
            if let Ok(mut sub_apps) = scan_directory_for_apps(&path, visited) {
                apps.append(&mut sub_apps);
            }
        } else if let Some(ext) = path.extension() {
            if ext == "lnk" || ext == "exe" {
                if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                    apps.push(InstalledApp {
                        name: name.to_string(),
                        path: path.to_str().unwrap_or("").to_string(),
                    });
                }
            }
        }
    }

    Ok(apps)
}

#[command]
pub async fn search_web(query: String) -> Result<String, String> {
    println!("🌐 Поиск в вебе: {}", query);
    
    let url = format!("https://html.duckduckgo.com/html/?q={}", urlencoding::encode(&query));
    
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let body = response.text().await.map_err(|e| e.to_string())?;
    
    let document = Html::parse_document(&body);
    let selector = Selector::parse("div.result__body").map_err(|_| "Failed to parse selector".to_string())?;
    
    let mut results = Vec::new();
    for element in document.select(&selector).take(5) {
        let text = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
        results.push(text);
    }
    
    if results.is_empty() {
        Ok("По вашему запросу ничего не найдено.".to_string())
    } else {
        Ok(results.join("\n---\n"))
    }
}

#[command]
pub async fn execute_shell_command(command: String, args: Vec<String>) -> Result<String, String> {
    println!("🚀 Выполнение команды: {} {:?}", command, args);

    let full_command = format!("{} {}", command, args.join(" "));
    
    let output = Command::new("powershell")
        .arg("-Command")
        .arg(&full_command)
        .output()
        .map_err(|e| format!("Ошибка запуска команды: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Ошибка выполнения: {}", stderr))
    }
}

#[command]
pub async fn open_application(app_name: String) -> Result<String, String> {
    println!("📱 Открытие приложения: {}", app_name);

    let app_lower = app_name.to_lowercase();

    // Специальная обработка для популярных приложений
    let command_result = if app_lower.contains("discord") {
        // Discord - используем команду start для поиска
        Command::new("cmd")
            .args(&["/C", "start", "discord://"])
            .spawn()
    } else if app_lower.contains("chrome") || app_lower.contains("хром") {
        Command::new("cmd")
            .args(&["/C", "start", "chrome"])
            .spawn()
    } else if app_lower.contains("firefox") {
        Command::new("cmd")
            .args(&["/C", "start", "firefox"])
            .spawn()
    } else if app_lower.contains("edge") {
        Command::new("cmd")
            .args(&["/C", "start", "msedge"])
            .spawn()
    } else if app_lower.contains("notepad") || app_lower.contains("блокнот") {
        Command::new("notepad.exe")
            .spawn()
    } else if app_lower.contains("calculator") || app_lower.contains("калькулятор") {
        Command::new("calc.exe")
            .spawn()
    } else if app_lower.contains("explorer") || app_lower.contains("проводник") {
        Command::new("explorer.exe")
            .spawn()
    } else {
        // Для остальных приложений - пробуем через open или cmd
        match open::that(&app_name) {
            Ok(_) => return Ok(format!("✅ Приложение {} запущено", app_name)),
            Err(_) => {
                // Пробуем через cmd с start
                Command::new("cmd")
                    .args(&["/C", "start", "", &app_name])
                    .spawn()
            }
        }
    };

    match command_result {
        Ok(_) => Ok(format!("✅ Приложение {} запущено", app_name)),
        Err(e) => Err(format!("❌ Не удалось запустить {}: {}", app_name, e)),
    }
}

#[command]
pub async fn create_file(path: String, content: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    println!("📝 Создание файла: {}", path);

    // Создаём директорию если нужно
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Ошибка создания директории: {}", e))?;
    }

    fs::write(&path, content)
        .map_err(|e| format!("Ошибка записи файла: {}", e))?;

    Ok(format!("✅ Файл создан: {}", path))
}

#[command]
pub async fn read_file(path: String) -> Result<String, String> {
    use std::fs;

    println!("📖 Чтение файла: {}", path);

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Ошибка чтения файла: {}", e))?;

    Ok(content)
}

#[command]
pub async fn get_process_list() -> Result<String, String> {
    println!("📋 Получение списка процессов...");

    let mut sys = System::new_all();
    sys.refresh_all();

    let mut processes = Vec::new();
    for (pid, process) in sys.processes() {
        processes.push(format!(
            "PID: {} | {} | CPU: {:.1}% | Memory: {} MB",
            pid,
            process.name(),
            process.cpu_usage(),
            process.memory() / 1024 / 1024
        ));
    }

    // Ограничиваем вывод первыми 50 процессами
    processes.sort();
    let output = processes.iter().take(50).cloned().collect::<Vec<_>>().join("\n");

    Ok(format!("📋 Процессы (топ 50):\n{}", output))
}

#[command]
pub async fn get_system_info() -> Result<String, String> {
    println!("ℹ️ Получение информации о системе...");

    let mut sys = System::new_all();
    sys.refresh_all();

    let info = format!(
        r#"🖥️ СИСТЕМА:
OS: {} {}
Ядро: {}
Имя хоста: {}

💾 ПАМЯТЬ:
Всего: {} GB
Использовано: {} GB
Свободно: {} GB

🔌 ПРОЦЕССОР:
Процессоров: {}
"#,
        System::name().unwrap_or_else(|| "Unknown".to_string()),
        System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        sys.total_memory() / 1024 / 1024 / 1024,
        sys.used_memory() / 1024 / 1024 / 1024,
        (sys.total_memory() - sys.used_memory()) / 1024 / 1024 / 1024,
        sys.cpus().len()
    );

    Ok(info)
}

#[command]
pub async fn kill_process(process_name: String) -> Result<String, String> {
    println!("🔪 Завершение процесса: {}", process_name);

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("taskkill")
            .args(&["/F", "/IM", &process_name])
            .output()
            .map_err(|e| format!("Ошибка: {}", e))?;

        if output.status.success() {
            Ok(format!("✅ Процесс {} завершён", process_name))
        } else {
            Err(format!("❌ Не удалось завершить процесс {}", process_name))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("pkill")
            .arg(&process_name)
            .output()
            .map_err(|e| format!("Ошибка: {}", e))?;

        if output.status.success() {
            Ok(format!("✅ Процесс {} завершён", process_name))
        } else {
            Err(format!("❌ Не удалось завершить процесс {}", process_name))
        }
    }
}

#[command]
pub async fn execute_powershell(script: String) -> Result<String, String> {
    println!("⚡ Выполнение PowerShell скрипта");

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(&["-Command", &script])
            .output()
            .map_err(|e| format!("Ошибка: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            Ok(stdout.to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Ошибка: {}", stderr))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("PowerShell доступен только на Windows".to_string())
    }
}

#[command]
pub async fn get_directory_contents(path: String) -> Result<String, String> {
    use std::fs;

    println!("📁 Чтение директории: {}", path);

    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Ошибка чтения директории: {}", e))?;

    let mut contents = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                let is_dir = metadata.is_dir();
                let size = metadata.len();
                
                contents.push(format!(
                    "{} {} {}",
                    if is_dir { "📁" } else { "📄" },
                    entry.file_name().to_string_lossy(),
                    if is_dir { "DIR".to_string() } else { format!("{} bytes", size) }
                ));
            }
        }
    }

    Ok(contents.join("\n"))
}
