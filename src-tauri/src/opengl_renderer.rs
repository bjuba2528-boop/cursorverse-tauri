use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use winapi::um::winuser::{
    FindWindowW, SendMessageTimeoutW, EnumWindows, GetClassNameW, SetParent, SetWindowPos,
    GetWindowLongW, SetWindowLongW, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    SMTO_NORMAL, GWL_EXSTYLE, WS_POPUP, WS_VISIBLE, CreateWindowExW,
    DefWindowProcW, RegisterClassW, CS_HREDRAW, CS_VREDRAW,
    GetDC, ReleaseDC, BeginPaint, EndPaint, PAINTSTRUCT, WM_PAINT, WM_DESTROY, PostQuitMessage,
    TranslateMessage, DispatchMessageW, MSG, WNDCLASSW,
};
use winapi::um::wingdi::{StretchDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY};
use winapi::shared::windef::HWND;
use winapi::shared::minwindef::{LPARAM, BOOL, TRUE, FALSE, WPARAM, LRESULT, UINT};
use std::ptr;

const WS_EX_TOOLWINDOW_CONST: i32 = 0x00000080;
const WS_EX_APPWINDOW_CONST: i32 = 0x00040000;

pub struct OpenGLRenderer {
    should_stop: Arc<Mutex<bool>>,
    _thread_handle: Option<thread::JoinHandle<()>>,
}

impl OpenGLRenderer {
    pub fn new(video_path: String) -> Result<Self, String> {
        let should_stop = Arc::new(Mutex::new(false));
        let should_stop_clone = should_stop.clone();

        let handle = thread::spawn(move || {
            if let Err(e) = Self::render_loop(video_path, should_stop_clone) {
                eprintln!("Renderer error: {}", e);
            }
        });

        Ok(Self {
            should_stop,
            _thread_handle: Some(handle),
        })
    }

    pub fn stop(&self) {
        *self.should_stop.lock().unwrap() = true;
    }

    fn render_loop(
        video_path: String,
        should_stop: Arc<Mutex<bool>>,
    ) -> Result<(), String> {
        Self::render_video_wmf(video_path, should_stop)
    }

    #[allow(dead_code)]
    fn render_gif(_path: String, _should_stop: Arc<Mutex<bool>>) -> Result<(), String> {
        Err("GIF rendering not implemented in realtime mode".to_string())
    }

    fn render_video_wmf(path: String, should_stop: Arc<Mutex<bool>>) -> Result<(), String> {
        use windows::Win32::Media::MediaFoundation::*;
        use windows::Win32::System::Com::*;
        use windows::core::*;

        println!("Starting WMF renderer for: {}", path);

        unsafe {
            // Инициализация COM
            CoInitializeEx(Some(std::ptr::null_mut()), COINIT_MULTITHREADED)
                .map_err(|e| format!("COM init failed: {}", e))?;

            // Инициализация Media Foundation
            MFStartup(MF_VERSION, 0)
                .map_err(|e| format!("MF startup failed: {}", e))?;

            // Создаём атрибуты для source reader
            let mut attributes: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attributes, 1)
                .map_err(|e| format!("Failed to create attributes: {}", e))?;
            
            let attributes = attributes.ok_or("Attributes is None")?;
            attributes.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1).ok();

            let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();

            let reader = MFCreateSourceReaderFromURL(
                PCWSTR(path_wide.as_ptr()),
                &attributes,
            ).map_err(|e| format!("Failed to create source reader: {}", e))?;

            // Настраиваем декодирование видео
            reader.SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS.0 as u32, false).ok();
            reader.SetStreamSelection(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, true)
                .map_err(|e| format!("Failed to select video stream: {}", e))?;

            // Получаем нативный media type
            let _native_type = reader.GetNativeMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, 0)
                .map_err(|e| format!("Failed to get native type: {}", e))?;

            println!("Got native media type");

            // Конфигурируем вывод - попробуем несколько форматов
            let output = MFCreateMediaType()
                .map_err(|e| format!("Failed to create output type: {}", e))?;
            
            output.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)
                .map_err(|e| format!("Failed to set major type: {}", e))?;
            
            // Пробуем RGB32, если не получится - используем NV12 или YUY2
            let formats = [
                MFVideoFormat_RGB32,
                MFVideoFormat_RGB24,
                MFVideoFormat_NV12,
                MFVideoFormat_YUY2,
            ];
            
            let mut format_set = false;
            for format in &formats {
                output.SetGUID(&MF_MT_SUBTYPE, format).ok();
                if reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, None, &output).is_ok() {
                    println!("Successfully set format: {:?}", format);
                    format_set = true;
                    break;
                }
            }
            
            if !format_set {
                return Err("Failed to set any supported video format".to_string());
            }

            // Получаем актуальный media type после настройки
            let media_type = reader.GetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32)
                .map_err(|e| format!("Failed to get media type: {}", e))?;

            // Получаем разрешение
            let frame_size = media_type.GetUINT64(&MF_MT_FRAME_SIZE)
                .map_err(|_| "Failed to get frame size")?;
            let width = (frame_size & 0xFFFFFFFF) as u32;
            let height = ((frame_size >> 32) & 0xFFFFFFFF) as u32;

            println!("Video resolution: {}x{}", width, height);

            // Получаем FPS
            let frame_rate = media_type.GetUINT64(&MF_MT_FRAME_RATE)
                .unwrap_or((30u64 << 32) | 1u64);
            let numerator = (frame_rate & 0xFFFFFFFF) as f64;
            let denominator = ((frame_rate >> 32) & 0xFFFFFFFF) as f64;
            let fps = numerator / denominator;
            let frame_duration = Duration::from_secs_f64(1.0 / fps);

            println!("FPS: {:.2}, Frame duration: {:?}", fps, frame_duration);

            MFShutdown().ok();
            CoUninitialize();

            // Вместо декодирования всех кадров - создаём окно и декодируем в реальном времени
            Self::create_and_render_window_realtime(path, width, height, frame_duration, should_stop)
        }
    }

    fn create_and_render_window_realtime(
        video_path: String,
        width: u32,
        height: u32,
        frame_duration: Duration,
        should_stop: Arc<Mutex<bool>>,
    ) -> Result<(), String> {
        use windows::Win32::Media::MediaFoundation::*;
        use windows::Win32::System::Com::*;
        use windows::core::*;

        unsafe {
            // Инициализация COM для этого потока
            CoInitializeEx(Some(std::ptr::null_mut()), COINIT_MULTITHREADED).ok();
            MFStartup(MF_VERSION, 0).ok();

            // Создаём reader заново
            let mut attributes: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attributes, 1).ok();
            let path_wide: Vec<u16> = video_path.encode_utf16().chain(std::iter::once(0)).collect();
            let reader = MFCreateSourceReaderFromURL(
                PCWSTR(path_wide.as_ptr()), 
                attributes.as_ref()
            ).map_err(|e| format!("Failed to create reader in render thread: {}", e))?;

            reader.SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS.0 as u32, false).ok();
            reader.SetStreamSelection(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, true).ok();

            // Настраиваем формат (пробуем RGB32 или RGB24)
            let output = MFCreateMediaType().ok();
            if let Some(out) = &output {
                out.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video).ok();
                if reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, None, &{
                    out.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32).ok();
                    out.clone()
                }).is_err() {
                    out.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB24).ok();
                    reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, None, out).ok();
                }
            }

            let class_name = encode_wide("WallpaperClass");
            
            let wc = WNDCLASSW {
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(window_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: ptr::null_mut(),
                hIcon: ptr::null_mut(),
                hCursor: ptr::null_mut(),
                hbrBackground: ptr::null_mut(),
                lpszMenuName: ptr::null(),
                lpszClassName: class_name.as_ptr(),
            };

            RegisterClassW(&wc);

            // Получаем размер экрана
            let screen_width = winapi::um::winuser::GetSystemMetrics(winapi::um::winuser::SM_CXSCREEN);
            let screen_height = winapi::um::winuser::GetSystemMetrics(winapi::um::winuser::SM_CYSCREEN);

            println!("Creating window {}x{}", screen_width, screen_height);

            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                encode_wide("Wallpaper").as_ptr(),
                WS_POPUP | WS_VISIBLE,
                0, 0,
                screen_width,
                screen_height,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            );

            if hwnd.is_null() {
                return Err("Failed to create window".to_string());
            }

            println!("Window created: {:?}", hwnd);

            // Показываем окно явно
            winapi::um::winuser::ShowWindow(hwnd, winapi::um::winuser::SW_SHOW);
            winapi::um::winuser::UpdateWindow(hwnd);

            // Встраиваем под WorkerW
            embed_under_workerw(hwnd as isize)?;

            println!("Embedded under WorkerW");

            // Скрываем из Alt+Tab
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
            let new_ex = (ex_style as u32 & !(WS_EX_APPWINDOW_CONST as u32)) | WS_EX_TOOLWINDOW_CONST as u32;
            SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex as i32);

            let hdc = GetDC(hwnd);
            let mut last_frame_time = Instant::now();
            let mut frame_buffer: Vec<u8> = vec![0; (width * height * 4) as usize];

            // Message loop с декодированием в реальном времени
            let mut msg: MSG = std::mem::zeroed();
            loop {
                if *should_stop.lock().unwrap() {
                    break;
                }

                // Non-blocking message check
                if winapi::um::winuser::PeekMessageW(&mut msg, ptr::null_mut(), 0, 0, winapi::um::winuser::PM_REMOVE) != 0 {
                    if msg.message == winapi::um::winuser::WM_QUIT {
                        break;
                    }
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                let now = Instant::now();
                
                if now.duration_since(last_frame_time) >= frame_duration {
                    last_frame_time = now;

                    // Читаем следующий кадр
                    let mut flags = 0u32;
                    let mut sample: Option<IMFSample> = None;

                    match reader.ReadSample(
                        MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32,
                        0,
                        None,
                        Some(&mut flags),
                        None,
                        Some(&mut sample),
                    ) {
                        Ok(_) => {
                            // Если конец видео - создаём новый reader
                            if flags & MF_SOURCE_READERF_ENDOFSTREAM.0 as u32 != 0 {
                                println!("End of stream reached, looping video");
                                // Просто игнорируем и читаем дальше - reader автоматически зациклится
                                continue;
                            }

                            if let Some(s) = sample {
                                if let Ok(buffer) = s.ConvertToContiguousBuffer() {
                                    let mut data_ptr: *mut u8 = ptr::null_mut();
                                    let mut current_len = 0u32;

                                    if buffer.Lock(&mut data_ptr, None, Some(&mut current_len)).is_ok() {
                                        let src = std::slice::from_raw_parts(data_ptr, current_len as usize);
                                        let copy_len = src.len().min(frame_buffer.len());
                                        frame_buffer[..copy_len].copy_from_slice(&src[..copy_len]);
                                        buffer.Unlock().ok();

                                        // Рисуем кадр через GDI с растяжением на весь экран
                                        let mut bmi: BITMAPINFO = std::mem::zeroed();
                                        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
                                        bmi.bmiHeader.biWidth = width as i32;
                                        bmi.bmiHeader.biHeight = -(height as i32); // Top-down
                                        bmi.bmiHeader.biPlanes = 1;
                                        bmi.bmiHeader.biBitCount = 32;
                                        bmi.bmiHeader.biCompression = BI_RGB;

                                        StretchDIBits(
                                            hdc,
                                            0, 0, screen_width, screen_height,  // Растягиваем на весь экран
                                            0, 0, width as i32, height as i32,
                                            frame_buffer.as_ptr() as *const _,
                                            &bmi,
                                            DIB_RGB_COLORS,
                                            SRCCOPY,
                                        );
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            // Ошибка чтения - продолжаем
                        }
                    }
                }

                thread::sleep(Duration::from_millis(10));
            }

            MFShutdown().ok();
            CoUninitialize();
            ReleaseDC(hwnd, hdc);
            winapi::um::winuser::DestroyWindow(hwnd);
        }

        Ok(())
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: UINT,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        WM_PAINT => {
            let mut ps: PAINTSTRUCT = std::mem::zeroed();
            BeginPaint(hwnd, &mut ps);
            EndPaint(hwnd, &ps);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn embed_under_workerw(hwnd: isize) -> Result<(), String> {
    unsafe {
        let progman = FindWindowW(
            encode_wide("Progman").as_ptr(),
            ptr::null(),
        );

        if progman.is_null() {
            return Err("Progman not found".to_string());
        }

        println!("Progman found: {:?}", progman);

        let mut result: usize = 0;
        SendMessageTimeoutW(
            progman,
            0x052C,
            0,
            0,
            SMTO_NORMAL,
            1000,
            &mut result as *mut usize,
        );

        println!("Sent spawn message to Progman");

        let workerw = find_workerw();
        if workerw.is_null() {
            return Err("WorkerW not found".to_string());
        }

        println!("WorkerW found: {:?}", workerw);

        let raw_hwnd = hwnd as *mut _;
        SetParent(raw_hwnd, workerw);
        SetWindowPos(
            raw_hwnd,
            HWND_BOTTOM,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );

        println!("Window parented to WorkerW");
    }

    Ok(())
}

unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let mut class_name = [0u16; 256];
    GetClassNameW(hwnd, class_name.as_mut_ptr(), 256);
    
    let name = String::from_utf16_lossy(&class_name)
        .trim_end_matches('\0')
        .to_string();

    if name == "WorkerW" {
        let shelldll = FindWindowW(
            encode_wide("SHELLDLL_DefView").as_ptr(),
            ptr::null(),
        );

        if !shelldll.is_null() {
            *(lparam as *mut HWND) = hwnd;
            return FALSE;
        }
    }

    TRUE
}

fn find_workerw() -> HWND {
    unsafe {
        let mut workerw: HWND = ptr::null_mut();
        EnumWindows(
            Some(enum_windows_callback),
            &mut workerw as *mut HWND as LPARAM,
        );
        workerw
    }
}

fn encode_wide(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
