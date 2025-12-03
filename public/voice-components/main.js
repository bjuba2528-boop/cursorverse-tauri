// Main Integration Module for Voice Lucy Assistant
// Инициализирует и координирует все голосовые компоненты

(function() {
    'use strict';

    console.log('🚀 Voice Lucy Assistant - Main Integration Loading...');

    // Глобальное состояние системы
    window.voiceLucySystem = {
        initialized: false,
        components: {
            audioProcessor: null,
            voiceRecognition: null,
            clapDetection: null,
            chatInterface: null
        },
        settings: {
            autoStart: true,
            clapEnabled: true,
            voiceEnabled: true,
            chatEnabled: true,
            language: 'ru-RU'
        },
        status: 'initializing'
    };

    // Ожидаем загрузки DOM и всех компонентов
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📦 DOM loaded, initializing Voice Lucy system...');
        
        // Даем время на загрузку всех модулей
        setTimeout(initializeSystem, 1000);
    });

    async function initializeSystem() {
        try {
            console.log('🔧 Starting Voice Lucy System initialization...');

            // 1. Проверяем доступность всех компонентов
            const componentsReady = await checkComponents();
            if (!componentsReady) {
                console.error('❌ Not all components are loaded');
                return false;
            }

            // 2. Инициализируем интеграцию компонентов
            setupComponentIntegration();

            // 3. Настраиваем обработчики событий
            setupEventHandlers();

            // 4. Настраиваем клавиатурные сокращения
            setupKeyboardShortcuts();

            // 5. Автозапуск компонентов если нужно
            if (window.voiceLucySystem.settings.autoStart) {
                await autoStartComponents();
            }

            // Система готова
            window.voiceLucySystem.initialized = true;
            window.voiceLucySystem.status = 'ready';
            
            console.log('✅ Voice Lucy System initialized successfully!');
            console.log('📊 System Status:', window.voiceLucySystem);
            
            // Показываем уведомление
            showSystemNotification('Voice Lucy Assistant готов к работе! 🎤', 'success');
            
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Voice Lucy System:', error);
            window.voiceLucySystem.status = 'error';
            showSystemNotification('Ошибка инициализации Voice Lucy: ' + error.message, 'error');
            return false;
        }
    }

    async function checkComponents() {
        console.log('🔍 Checking components availability...');

        const components = {
            audioProcessor: typeof window.AudioProcessor !== 'undefined' && window.audioProcessor,
            voiceRecognition: typeof window.VoiceRecognition !== 'undefined' && window.voiceRecognition,
            clapDetection: typeof window.clapDetection !== 'undefined',
            chatInterface: typeof window.ChatInterface !== 'undefined' && window.chatInterface
        };

        console.log('Component status:', components);

        // Сохраняем ссылки на компоненты
        window.voiceLucySystem.components = {
            audioProcessor: window.audioProcessor || null,
            voiceRecognition: window.voiceRecognition || null,
            clapDetection: window.clapDetection || null,
            chatInterface: window.chatInterface || null
        };

        // Проверяем критические компоненты
        const critical = components.voiceRecognition && components.audioProcessor;
        
        if (!critical) {
            console.warn('⚠️ Some critical components are missing');
            console.log('Voice Recognition:', components.voiceRecognition ? '✅' : '❌');
            console.log('Audio Processor:', components.audioProcessor ? '✅' : '❌');
        }

        return critical;
    }

    function setupComponentIntegration() {
        console.log('🔗 Setting up component integration...');

        const { audioProcessor, voiceRecognition, clapDetection, chatInterface } = window.voiceLucySystem.components;

        // Интеграция Audio Processor с Voice Recognition
        if (audioProcessor && voiceRecognition) {
            // Слушаем события аудио процессора
            window.addEventListener('voice-activity-start', () => {
                console.log('🗣️ Voice activity detected');
            });

            window.addEventListener('voice-activity-end', () => {
                console.log('🔇 Voice activity ended');
            });

            console.log('✅ Audio Processor <-> Voice Recognition integrated');
        }

        // Интеграция Clap Detection с Voice Recognition
        if (clapDetection && voiceRecognition) {
            window.addEventListener('clap-detected', () => {
                console.log('👏 Clap detected, triggering voice recognition...');
                if (!voiceRecognition.isActive()) {
                    voiceRecognition.start();
                }
            });

            console.log('✅ Clap Detection <-> Voice Recognition integrated');
        }

        // Интеграция Voice Recognition с Chat Interface
        if (voiceRecognition && chatInterface) {
            // Перехватываем отправку в Lucy для интеграции с чатом
            const originalSendToLucy = voiceRecognition.sendToLucy.bind(voiceRecognition);
            
            voiceRecognition.sendToLucy = async function(text) {
                console.log('📨 Voice -> Chat:', text);
                
                // Отправляем в чат интерфейс
                if (chatInterface && chatInterface.sendMessage) {
                    await chatInterface.sendMessage(text, 'user', {
                        confidence: voiceRecognition.getConfidence(),
                        type: 'voice'
                    });
                }
                
                // Вызываем оригинальный метод
                return originalSendToLucy(text);
            };

            console.log('✅ Voice Recognition <-> Chat Interface integrated');
        }

        // Интеграция с Lucy Assistant (React компонент)
        if (voiceRecognition) {
            // Делаем voice recognition доступным для React
            window.addEventListener('lucy-request-voice', () => {
                console.log('🎤 Lucy requesting voice input...');
                voiceRecognition.toggle();
            });

            console.log('✅ Voice Recognition <-> Lucy Assistant integrated');
        }
    }

    function setupEventHandlers() {
        console.log('📡 Setting up global event handlers...');

        // Слушаем все важные события
        const events = [
            'voice-start',
            'voice-end',
            'voice-error',
            'clap-detected',
            'audio-processing-started',
            'audio-processing-stopped',
            'speech-start',
            'speech-end'
        ];

        events.forEach(eventName => {
            window.addEventListener(eventName, (event) => {
                console.log(`📢 Event: ${eventName}`, event.detail);
                
                // Обновляем статус системы
                updateSystemStatus(eventName, event.detail);
            });
        });

        // Обработка ошибок
        window.addEventListener('error', (event) => {
            if (event.message.includes('voice') || event.message.includes('audio')) {
                console.error('🚨 Voice/Audio Error:', event.message);
                showSystemNotification('Ошибка голосовой системы: ' + event.message, 'error');
            }
        });

        console.log('✅ Event handlers configured');
    }

    function setupKeyboardShortcuts() {
        console.log('⌨️ Setting up keyboard shortcuts...');

        document.addEventListener('keydown', (event) => {
            const { voiceRecognition, clapDetection } = window.voiceLucySystem.components;

            // Ctrl+K - Toggle Voice Recognition
            if (event.ctrlKey && event.key === 'k') {
                event.preventDefault();
                if (voiceRecognition) {
                    voiceRecognition.toggle();
                    showSystemNotification('Voice Recognition ' + (voiceRecognition.isActive() ? 'включено' : 'выключено'), 'info');
                }
            }

            // Ctrl+Shift+C - Toggle Clap Detection
            if (event.ctrlKey && event.shiftKey && event.key === 'C') {
                event.preventDefault();
                if (clapDetection) {
                    clapDetection.toggle();
                    showSystemNotification('Clap Detection ' + (clapDetection.isEnabled() ? 'включено' : 'выключено'), 'info');
                }
            }

            // F1 - Show Help
            if (event.key === 'F1') {
                event.preventDefault();
                showHelp();
            }

            // F11 - Toggle System Info
            if (event.key === 'F11') {
                event.preventDefault();
                showSystemInfo();
            }
        });

        console.log('✅ Keyboard shortcuts configured');
        console.log('   Ctrl+K - Toggle Voice Recognition');
        console.log('   Ctrl+Shift+C - Toggle Clap Detection');
        console.log('   F1 - Show Help');
        console.log('   F11 - System Info');
    }

    async function autoStartComponents() {
        console.log('🚀 Auto-starting components...');

        const { audioProcessor, voiceRecognition, clapDetection } = window.voiceLucySystem.components;
        const { clapEnabled, voiceEnabled } = window.voiceLucySystem.settings;

        // Запускаем clap detection если включено
        if (clapEnabled && clapDetection) {
            try {
                clapDetection.start();
                console.log('✅ Clap detection auto-started');
            } catch (error) {
                console.error('❌ Failed to auto-start clap detection:', error);
            }
        }

        // Voice recognition не запускаем автоматически (требует действия пользователя)
        console.log('ℹ️ Voice recognition ready (manual start required)');
    }

    function updateSystemStatus(eventName, detail) {
        const statusMap = {
            'voice-start': 'listening',
            'voice-end': 'ready',
            'voice-error': 'error',
            'clap-detected': 'clap-triggered',
            'audio-processing-started': 'processing',
            'audio-processing-stopped': 'ready'
        };

        const newStatus = statusMap[eventName];
        if (newStatus) {
            window.voiceLucySystem.status = newStatus;
        }
    }

    function showSystemNotification(message, type = 'info') {
        console.log(`🔔 [${type.toUpperCase()}] ${message}`);

        // Используем систему уведомлений voice recognition если доступна
        if (window.voiceRecognition && window.voiceRecognition.showNotification) {
            window.voiceRecognition.showNotification(message, type);
        }

        // Dispatch event для React компонентов
        const event = new CustomEvent('voice-lucy-notification', {
            detail: { message, type }
        });
        window.dispatchEvent(event);
    }

    function showHelp() {
        const helpText = `
🎤 Voice Lucy Assistant - Справка

⌨️ КЛАВИАТУРНЫЕ СОКРАЩЕНИЯ:
• Ctrl+K - Включить/выключить распознавание речи
• Ctrl+Shift+C - Включить/выключить детекцию хлопков
• Space - Toggle voice (в некоторых режимах)
• Escape - Остановить распознавание
• F1 - Показать эту справку
• F11 - Показать информацию о системе

🎙️ ГОЛОСОВОЕ УПРАВЛЕНИЕ:
• Нажмите на кнопку микрофона для начала записи
• Говорите четко и не слишком быстро
• Система автоматически остановится после распознавания

👏 ДЕТЕКЦИЯ ХЛОПКОВ:
• Хлопните один раз для запуска распознавания речи
• Регулируйте чувствительность в настройках
• Работает в фоновом режиме

💬 ЧАТ С ЛЮСИ:
• Отправляйте текстовые или голосовые сообщения
• Люси может выполнять команды
• История сохраняется автоматически

📊 СТАТУС СИСТЕМЫ:
${JSON.stringify(window.voiceLucySystem.status, null, 2)}
        `;

        console.log(helpText);
        alert(helpText);
    }

    function showSystemInfo() {
        const info = {
            status: window.voiceLucySystem.status,
            initialized: window.voiceLucySystem.initialized,
            components: Object.keys(window.voiceLucySystem.components).reduce((acc, key) => {
                acc[key] = !!window.voiceLucySystem.components[key];
                return acc;
            }, {}),
            settings: window.voiceLucySystem.settings,
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                microphone: navigator.mediaDevices ? '✅ Supported' : '❌ Not supported',
                speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? '✅ Supported' : '❌ Not supported'
            }
        };

        console.log('📊 Voice Lucy System Info:', info);
        
        const infoText = `
🖥️ Voice Lucy System Information

📊 STATUS: ${info.status}
✅ INITIALIZED: ${info.initialized ? 'Yes' : 'No'}

📦 COMPONENTS:
• Audio Processor: ${info.components.audioProcessor ? '✅' : '❌'}
• Voice Recognition: ${info.components.voiceRecognition ? '✅' : '❌'}
• Clap Detection: ${info.components.clapDetection ? '✅' : '❌'}
• Chat Interface: ${info.components.chatInterface ? '✅' : '❌'}

⚙️ SETTINGS:
• Auto Start: ${info.settings.autoStart ? 'Yes' : 'No'}
• Clap Enabled: ${info.settings.clapEnabled ? 'Yes' : 'No'}
• Voice Enabled: ${info.settings.voiceEnabled ? 'Yes' : 'No'}
• Language: ${info.settings.language}

🌐 BROWSER:
• Microphone Support: ${info.browser.microphone}
• Speech Recognition: ${info.browser.speechRecognition}
• Language: ${info.browser.language}
        `;

        console.log(infoText);
        alert(infoText);
    }

    // Публичное API для управления системой
    window.voiceLucy = {
        // Информация о системе
        getStatus: () => window.voiceLucySystem.status,
        isReady: () => window.voiceLucySystem.initialized,
        getComponents: () => window.voiceLucySystem.components,
        getSettings: () => window.voiceLucySystem.settings,

        // Управление компонентами
        startVoice: () => window.voiceLucySystem.components.voiceRecognition?.start(),
        stopVoice: () => window.voiceLucySystem.components.voiceRecognition?.stop(),
        toggleVoice: () => window.voiceLucySystem.components.voiceRecognition?.toggle(),
        
        startClap: () => window.voiceLucySystem.components.clapDetection?.start(),
        stopClap: () => window.voiceLucySystem.components.clapDetection?.stop(),
        toggleClap: () => window.voiceLucySystem.components.clapDetection?.toggle(),

        // Утилиты
        showHelp: () => showHelp(),
        showInfo: () => showSystemInfo(),
        notify: (message, type) => showSystemNotification(message, type),

        // Настройки
        updateSettings: (newSettings) => {
            window.voiceLucySystem.settings = { 
                ...window.voiceLucySystem.settings, 
                ...newSettings 
            };
            console.log('⚙️ Settings updated:', window.voiceLucySystem.settings);
        }
    };

    console.log('✅ Voice Lucy Main Integration Module loaded');
    console.log('📖 Use window.voiceLucy for API access');
    console.log('📖 Press F1 for help');

})();
