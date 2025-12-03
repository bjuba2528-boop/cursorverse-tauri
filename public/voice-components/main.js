// Main Application Controller for Voice Lucy Assistant
class VoiceLucyApp {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.settings = {
            language: 'ru-RU',
            theme: 'light',
            autoStart: false,
            clapDetection: true,
            voiceActivation: true
        };
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            console.log('Initializing Voice Lucy Assistant...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupApp());
            } else {
                this.setupApp();
            }
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Не удалось инициализировать приложение');
        }
    }

    setupApp() {
        try {
            // Initialize components
            this.initializeComponents();
            
            // Load settings
            this.loadSettings();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize Tauri if available
            this.initializeTauri();
            
            // Start auto-features
            this.startAutoFeatures();
            
            // Update UI
            this.updateUI();
            
            this.isInitialized = true;
            console.log('Voice Lucy Assistant initialized successfully');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Error setting up app:', error);
            this.showError('Ошибка при настройке приложения');
        }
    }

    initializeComponents() {
        // Component references are already created by their respective scripts
        // We just need to verify they're loaded and set up connections
        
        this.components = {
            voiceRecognition: window.voiceRecognition,
            clapDetection: window.clapDetection,
            chatInterface: window.chatInterface,
            audioProcessor: window.audioProcessor
        };

        // Verify all components are loaded
        Object.keys(this.components).forEach(key => {
            if (!this.components[key]) {
                console.warn(`Component ${key} not loaded`);
            }
        });
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + K to toggle voice recognition
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                this.toggleVoiceRecognition();
            }
            
            // Ctrl/Cmd + D to toggle clap detection
            if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
                event.preventDefault();
                this.toggleClapDetection();
            }
            
            // F1 for help
            if (event.key === 'F1') {
                event.preventDefault();
                this.showHelp();
            }
            
            // F11 for fullscreen
            if (event.key === 'F11') {
                event.preventDefault();
                this.toggleFullscreen();
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Online/offline detection
        window.addEventListener('online', () => {
            this.onConnectionChange(true);
        });

        window.addEventListener('offline', () => {
            this.onConnectionChange(false);
        });

        // Before unload - cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Custom event listeners for component communication
        document.addEventListener('voiceStart', () => {
            this.onVoiceStart();
        });

        document.addEventListener('voiceEnd', () => {
            this.onVoiceEnd();
        });

        document.addEventListener('audioDataUpdate', (event) => {
            this.onAudioDataUpdate(event.detail);
        });
    }

    async initializeTauri() {
        if (window.__TAURI__) {
            try {
                console.log('Initializing Tauri integration...');
                
                // Get Tauri API
                const { invoke } = window.__TAURI__.tauri;
                
                // Test connection to backend
                const listeningState = await invoke('get_listening_state');
                console.log('Backend listening state:', listeningState);
                
                // Set up periodic sync with backend
                this.setupBackendSync();
                
                // Initialize Tauri-specific features
                await this.initializeTauriFeatures();
                
                console.log('Tauri integration initialized');
                
            } catch (error) {
                console.error('Error initializing Tauri:', error);
                // Continue without Tauri (web mode)
            }
        } else {
            console.log('Running in web mode (no Tauri)');
        }
    }

    setupBackendSync() {
        // Sync chat history every 30 seconds
        setInterval(async () => {
            if (window.__TAURI__ && this.components.chatInterface) {
                try {
                    const backendHistory = await window.__TAURI__.invoke('get_chat_history');
                    // Could sync local and backend histories here
                } catch (error) {
                    console.error('Error syncing with backend:', error);
                }
            }
        }, 30000);
    }

    async initializeTauriFeatures() {
        if (!window.__TAURI__) return;

        const { appWindow } = window.__TAURI__.window;
        
        // Set up window controls
        try {
            // Minimize to tray option
            // Window shake detection
            // System tray integration
            // etc.
        } catch (error) {
            console.error('Error initializing Tauri features:', error);
        }
    }

    startAutoFeatures() {
        // Auto-start clap detection if enabled
        if (this.settings.clapDetection && this.components.clapDetection) {
            setTimeout(() => {
                this.components.clapDetection.start();
            }, 2000);
        }

        // Auto-start voice recognition if enabled
        if (this.settings.autoStart && this.components.voiceRecognition) {
            setTimeout(() => {
                this.components.voiceRecognition.start();
            }, 3000);
        }
    }

    updateUI() {
        // Update status indicators
        this.updateConnectionStatus();
        this.updateComponentStatus();
        
        // Apply theme
        this.applyTheme();
        
        // Update language settings
        this.updateLanguageSettings();
    }

    updateConnectionStatus() {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (!statusText || !statusDot) return;

        const isOnline = navigator.onLine;
        const hasTauri = !!window.__TAURI__;
        
        if (hasTauri) {
            if (isOnline) {
                statusText.textContent = 'Подключено к Люси';
                statusDot.classList.add('active');
                statusDot.classList.remove('inactive', 'listening');
            } else {
                statusText.textContent = 'Оффлайн режим';
                statusDot.classList.remove('active', 'listening');
                statusDot.classList.add('inactive');
            }
        } else {
            statusText.textContent = 'Тестовый режим';
            statusDot.classList.remove('active', 'listening');
            statusDot.classList.add('inactive');
        }
    }

    updateComponentStatus() {
        // Update clap detection status
        const clapStatus = document.getElementById('clap-status');
        if (clapStatus && this.components.clapDetection) {
            clapStatus.textContent = this.components.clapDetection.isEnabled() ? 'ВКЛ' : 'ВЫКЛ';
        }
    }

    applyTheme() {
        document.body.className = `theme-${this.settings.theme}`;
    }

    updateLanguageSettings() {
        // Update speech recognition language
        if (this.components.voiceRecognition && this.components.voiceRecognition.recognition) {
            this.components.voiceRecognition.recognition.lang = this.settings.language;
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('voice-lucy-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('voice-lucy-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    // Event handlers
    toggleVoiceRecognition() {
        if (this.components.voiceRecognition) {
            this.components.voiceRecognition.toggle();
        }
    }

    toggleClapDetection() {
        if (this.components.clapDetection) {
            this.components.clapDetection.toggle();
            this.settings.clapDetection = this.components.clapDetection.isEnabled();
            this.saveSettings();
        }
    }

    onVoiceStart() {
        console.log('Voice started');
        this.updateConnectionStatus();
    }

    onVoiceEnd() {
        console.log('Voice ended');
        this.updateConnectionStatus();
    }

    onAudioDataUpdate(metrics) {
        // Could update visualizations here
        if (metrics.hasActivity) {
            // Visual feedback for voice activity
        }
    }

    onConnectionChange(isOnline) {
        console.log('Connection changed:', isOnline ? 'online' : 'offline');
        this.updateConnectionStatus();
        
        if (!isOnline) {
            this.showNotification('Соединение потеряно. Работаем в оффлайн режиме.', 'warning');
        } else {
            this.showNotification('Соединение восстановлено.', 'success');
        }
    }

    handleResize() {
        // Responsive adjustments
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Adjust layout for mobile/desktop
        if (width < 768) {
            document.body.classList.add('mobile-layout');
        } else {
            document.body.classList.remove('mobile-layout');
        }
    }

    // UI methods
    showWelcomeMessage() {
        const welcomeText = `
            👋 Добро пожаловать в Voice Lucy Assistant!
            
            🎤 **Голосовое управление:**
            • Нажмите на кнопку или хлопните в ладоши
            • Говорите четко, после паузы распознавание остановится
            • Распознанный текст автоматически отправится Люси
            
            ⌨️ **Горячие клавиши:**
            • Пробел - включить/выключить распознавание
            • Ctrl+K - переключить распознавание
            • Ctrl+D - переключить детектор хлопков
            • Ctrl+L - очистить чат
            • F1 - показать справку
            • F11 - полноэкранный режим
            
            💡 Начните с простого приветствия!
        `;

        if (this.components.chatInterface) {
            this.components.chatInterface.sendMessage(welcomeText, 'lucy', { type: 'welcome' });
        }
    }

    showHelp() {
        const helpText = `
            📖 **Справка Voice Lucy Assistant**
            
            **Основные функции:**
            🎤 Голосовое распознавание речи
            👏 Детекция хлопков для активации
            💬 Чат с AI-ассистентом Люси
            🔄 Сохранение истории сообщений
            
            **Управление голосом:**
            • Говорите после активации распознавания
            • Делайте паузы между фразами
            • Распознавание автоматически остановится
            
            **Детекция хлопков:**
            • Четкий хлопок запускает распознавание
            • Настройте чувствительность при необходимости
            • Можно отключить в настройках
            
            **Нужна помощь?** Попробуйте сказать: "Помоги мне" или "Что ты умеешь?"
        `;

        if (this.components.chatInterface) {
            this.components.chatInterface.sendMessage(helpText, 'lucy', { type: 'help' });
        }
    }

    async toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                this.showNotification('Полноэкранный режим включен', 'info');
            } else {
                await document.exitFullscreen();
                this.showNotification('Полноэкранный режим выключен', 'info');
            }
        } catch (error) {
            console.error('Error toggling fullscreen:', error);
        }
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }

    showError(message) {
        console.error('App Error:', message);
        this.showNotification(message, 'error');
    }

    // Settings methods
    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        this.updateUI();
    }

    resetSettings() {
        this.settings = {
            language: 'ru-RU',
            theme: 'light',
            autoStart: false,
            clapDetection: true,
            voiceActivation: true
        };
        this.saveSettings();
        this.updateUI();
        this.showNotification('Настройки сброшены', 'info');
    }

    // Cleanup
    cleanup() {
        console.log('Cleaning up Voice Lucy Assistant...');
        
        // Stop all components
        Object.values(this.components).forEach(component => {
            if (component && component.cleanup) {
                component.cleanup();
            }
        });
        
        // Save final state
        this.saveSettings();
        
        console.log('Cleanup completed');
    }

    // Public API
    getAppInfo() {
        return {
            name: 'Voice Lucy Assistant',
            version: '1.0.0',
            isInitialized: this.isInitialized,
            components: Object.keys(this.components).filter(key => this.components[key]),
            settings: this.settings,
            isTauri: !!window.__TAURI__,
            isOnline: navigator.onLine
        };
    }
}

// Initialize the app
window.voiceLucyApp = new VoiceLucyApp();

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceLucyApp;
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.showNotification) {
        window.showNotification('Произошла ошибка в приложении', 'error');
    }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.showNotification) {
        window.showNotification('Произошла ошибка при выполнении операции', 'error');
    }
});

console.log('Voice Lucy Assistant main script loaded');