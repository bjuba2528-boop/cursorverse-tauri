// Voice Recognition Component for CursorVerse Tauri
// Исправленная версия с обработкой ошибок и поддержкой разных браузеров

class VoiceRecognition {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.confidence = 0;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.initializeRecognition();
        this.bindEvents();
        console.log('🎤 Voice Recognition initialized');
    }

    initializeRecognition() {
        try {
            // Проверяем поддержку Speech Recognition API
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                console.error('❌ Speech recognition not supported in this browser');
                this.showError('Распознавание речи не поддерживается в вашем браузере. Используйте Chrome, Edge или Safari.');
                return false;
            }

            // Создаем экземпляр распознавания
            this.recognition = new SpeechRecognition();
            
            // Настраиваем параметры
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ru-RU';
            this.recognition.maxAlternatives = 1;
            
            // Обработчики событий
            this.setupEventHandlers();
            
            console.log('✅ Speech recognition initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize speech recognition:', error);
            this.showError('Не удалось инициализировать распознавание речи: ' + error.message);
            return false;
        }
    }

    setupEventHandlers() {
        if (!this.recognition) return;

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.onStart();
        };

        this.recognition.onresult = (event) => {
            console.log('📝 Speech recognition result:', event);
            this.handleResult(event);
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);
            this.onError(event.error);
        };

        this.recognition.onend = () => {
            console.log('⏹️ Speech recognition ended');
            this.onEnd();
        };

        this.recognition.onspeechstart = () => {
            console.log('🗣️ Speech detected');
            this.onSpeechStart();
        };

        this.recognition.onspeechend = () => {
            console.log('🔇 Speech ended');
            this.onSpeechEnd();
        };

        this.recognition.onnomatch = () => {
            console.log('❓ No speech match');
            this.onNoMatch();
        };
    }

    bindEvents() {
        // Глобальные события для интеграции с LucyAssistant
        window.addEventListener('voice-recognized', (event) => {
            this.onVoiceRecognized(event.detail);
        });

        // Клавиатурные сокращения
        document.addEventListener('keydown', (event) => {
            // Пробел для toggle
            if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                this.toggle();
            }
            
            // Escape для остановки
            if (event.code === 'Escape') {
                this.stop();
            }
        });
    }

    start() {
        if (!this.recognition) {
            if (this.retryCount < this.maxRetries) {
                console.log(`🔄 Retrying initialization (${this.retryCount + 1}/${this.maxRetries})`);
                this.retryCount++;
                if (this.initializeRecognition()) {
                    return this.start();
                }
            } else {
                this.showError('Распознавание речи недоступно после нескольких попыток');
                return false;
            }
        }

        if (this.isListening) {
            console.log('⚠️ Already listening');
            return true;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            this.updateUI();
            console.log('🎙️ Starting voice recognition...');
            return true;
        } catch (error) {
            console.error('❌ Failed to start speech recognition:', error);
            
            // Обрабатываем конкретные ошибки
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к микрофону запрещен. Пожалуйста, разрешите доступ в настройках браузера.');
            } else if (error.name === 'NotFoundError') {
                this.showError('Микрофон не найден. Проверьте подключение микрофона.');
            } else if (error.name === 'NotReadableError') {
                this.showError('Микрофон уже используется другим приложением.');
            } else {
                this.showError('Не удалось запустить распознавание речи: ' + error.message);
            }
            
            return false;
        }
    }

    stop() {
        if (!this.recognition || !this.isListening) {
            return;
        }

        try {
            this.recognition.stop();
        } catch (error) {
            console.error('❌ Failed to stop speech recognition:', error);
        }
    }

    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }

    handleResult(event) {
        this.interimTranscript = '';
        this.finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                this.finalTranscript += transcript + ' ';
                this.confidence = event.results[i][0].confidence;
            } else {
                this.interimTranscript += transcript;
            }
        }

        // Обновляем interim текст
        this.updateInterimText();

        // Если есть финальный результат, обрабатываем его
        if (this.finalTranscript.trim()) {
            this.processFinalResult();
        }
    }

    processFinalResult() {
        const text = this.finalTranscript.trim();
        console.log('✅ Final transcript:', text);
        console.log('🎯 Confidence:', this.confidence);

        // Обновляем UI с распознанным текстом
        this.updateRecognizedText(text);

        // Отправляем в Lucy если уверенность достаточно высокая
        if (this.confidence > 0.5) {
            this.sendToLucy(text);
        } else {
            this.showWarning('Низкая уверенность в распознавании. Попробуйте говорить четче.');
            this.sendToLucy(text); // Все равно отправляем, но с предупреждением
        }

        // Автоматическая остановка после успешного распознавания
        setTimeout(() => {
            if (this.isListening) {
                this.stop();
            }
        }, 1000);
    }

    async sendToLucy(text) {
        try {
            console.log('📤 Sending to Lucy:', text);
            
            // Показываем индикатор печати
            this.showTypingIndicator(true);

            // Создаем команду для Lucy
            const command = {
                text: text,
                timestamp: new Date().toISOString(),
                confidence: this.confidence
            };

            // Проверяем доступность LucyAssistant
            if (window.voiceRecognition && window.voiceRecognition.sendToLucy) {
                // Используем интеграцию с LucyAssistant
                const response = await window.voiceRecognition.sendToLucy(text);
                console.log('📥 Lucy response:', response);
                this.addMessageToChat(text, 'user');
                this.addMessageToChat(response, 'lucy');
            } else {
                // Fallback - напрямую через Tauri
                if (window.__TAURI__) {
                    const response = await window.__TAURI__.invoke('send_voice_to_lucy', command);
                    console.log('📥 Backend response:', response);
                    this.addMessageToChat(text, 'user');
                    this.addMessageToChat(response, 'lucy');
                } else {
                    // Тестовый режим
                    const response = `Люси получила: "${text}" (уверенность: ${Math.round(this.confidence * 100)}%)`;
                    this.addMessageToChat(text, 'user');
                    this.addMessageToChat(response, 'lucy');
                }
            }

        } catch (error) {
            console.error('❌ Error sending to Lucy:', error);
            this.showError('Ошибка отправки сообщения Люси: ' + error.message);
            this.addMessageToChat('❌ Ошибка: Не удалось отправить сообщение', 'lucy');
        } finally {
            this.showTypingIndicator(false);
        }
    }

    addMessageToChat(text, sender) {
        // Ищем элементы чата в LucyAssistant
        const chatMessages = document.querySelector('.lucy-messages');
        if (!chatMessages) {
            console.warn('⚠️ Chat messages container not found');
            return;
        }

        // Удаляем welcome сообщение если оно есть
        const welcomeMessage = chatMessages.querySelector('.lucy-welcome');
        if (welcomeMessage) {
            welcomeMessage.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => welcomeMessage.remove(), 300);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.setAttribute('data-message-id', Date.now().toString());

        const time = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let contentHtml = `
            <div class="message-avatar">
                ${sender === 'user' ? '👤' : '🤖'}
            </div>
            <div class="message-bubble">
                <div class="message-content">${this.escapeHtml(text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        // Добавляем индикатор уверенности для голосовых сообщений
        if (sender === 'user' && this.confidence < 1.0) {
            const confidenceColor = this.confidence > 0.7 ? '#10b981' : this.confidence > 0.5 ? '#f59e0b' : '#ef4444';
            contentHtml += `
                <div class="confidence-indicator" style="color: ${confidenceColor}; font-size: 12px; margin-top: 4px;">
                    Уверенность: ${Math.round(this.confidence * 100)}%
                </div>
            `;
        }

        messageDiv.innerHTML = contentHtml;

        // Добавляем анимацию
        messageDiv.style.animation = 'messageSlideIn 0.3s ease';
        chatMessages.appendChild(messageDiv);

        // Прокручиваем вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Обновляем время последнего действия
        this.updateLastAction();
    }

    showTypingIndicator(show) {
        const existingIndicator = document.querySelector('.typing-indicator');
        
        if (show) {
            if (!existingIndicator) {
                const chatMessages = document.querySelector('.lucy-messages');
                if (chatMessages) {
                    const indicator = document.createElement('div');
                    indicator.className = 'message lucy typing-indicator';
                    indicator.innerHTML = `
                        <div class="message-avatar">🤖</div>
                        <div class="message-bubble processing">
                            <div class="thinking-animation">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </div>
                            <span>Люси печатает...</span>
                        </div>
                    `;
                    chatMessages.appendChild(indicator);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
        }
    }

    // UI методы
    updateRecognizedText(text) {
        const recognizedText = document.getElementById('recognized-text');
        if (recognizedText) {
            recognizedText.textContent = text;
        }
    }

    updateInterimText() {
        if (this.interimTranscript) {
            const recognizedText = document.getElementById('recognized-text');
            if (recognizedText) {
                recognizedText.textContent = this.interimTranscript + '...';
            }
        }
    }

    updateLastAction() {
        const lastAction = document.getElementById('last-action');
        if (lastAction) {
            const now = new Date();
            lastAction.textContent = now.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    updateUI() {
        const voiceButton = document.querySelector('.btn-voice');
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        if (this.isListening) {
            voiceButton?.classList.add('listening');
            voiceButton?.classList.remove('active');
            statusDot?.classList.add('listening');
            statusDot?.classList.remove('inactive', 'active');
            if (statusText) statusText.textContent = 'Слушаю...';
        } else {
            voiceButton?.classList.remove('listening', 'active');
            statusDot?.classList.remove('listening', 'active');
            statusDot?.classList.add('inactive');
            if (statusText) statusText.textContent = 'Готов к работе';
        }
    }

    // Event handlers
    onStart() {
        console.log('🎤 Voice recognition started');
        this.isListening = true;
        this.updateUI();
        this.emitEvent('voice-start');
    }

    onEnd() {
        console.log('⏹️ Voice recognition ended');
        this.isListening = false;
        this.updateUI();
        this.emitEvent('voice-end');
    }

    onSpeechStart() {
        console.log('🗣️ Speech detected');
        this.emitEvent('speech-start');
    }

    onSpeechEnd() {
        console.log('🔇 Speech ended');
        this.emitEvent('speech-end');
    }

    onNoMatch() {
        console.warn('❓ No speech match found');
        this.showWarning('Речь не распознана. Попробуйте еще раз.');
        this.emitEvent('no-match');
    }

    onError(error) {
        console.error('❌ Voice recognition error:', error);
        
        let errorMessage = 'Ошибка распознавания речи';
        
        switch (error) {
            case 'no-speech':
                errorMessage = 'Речь не обнаружена';
                break;
            case 'audio-capture':
                errorMessage = 'Ошибка захвата аудио';
                break;
            case 'not-allowed':
                errorMessage = 'Доступ к микрофону запрещен';
                break;
            case 'network':
                errorMessage = 'Сетевая ошибка';
                break;
            case 'aborted':
                errorMessage = 'Распознавание прервано';
                break;
            default:
                errorMessage = `Ошибка: ${error}`;
        }
        
        this.showError(errorMessage);
        this.emitEvent('voice-error', { error: errorMessage });
    }

    onVoiceRecognized(detail) {
        console.log('🎯 Voice recognized event:', detail);
    }

    // Utility methods
    showError(message) {
        console.error('❌ Voice Recognition Error:', message);
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        console.warn('⚠️ Voice Recognition Warning:', message);
        this.showNotification(message, 'warning');
    }

    showNotification(message, type = 'info') {
        // Создаем toast уведомление
        const toast = document.createElement('div');
        toast.className = `voice-notification toast-${type}`;
        
        const colors = {
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#10b981'
        };
        
        const icons = {
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };
        
        toast.innerHTML = `
            <span style="margin-right: 8px;">${icons[type]}</span>
            <span>${message}</span>
        `;
        
        // Стили
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            font-size: 14px;
            font-family: system-ui, -apple-system, sans-serif;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(toast);
        
        // Автоматическое удаление
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    emitEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public getters
    isActive() {
        return this.isListening;
    }

    getConfidence() {
        return this.confidence;
    }

    getLastTranscript() {
        return this.finalTranscript;
    }

    // Cleanup
    destroy() {
        this.stop();
        this.recognition = null;
        console.log('🧹 Voice recognition destroyed');
    }
}

// Добавляем CSS анимации
const voiceRecognitionStyles = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}

@keyframes messageSlideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.btn-voice {
    position: relative;
    transition: all 0.3s ease;
}

.btn-voice.listening {
    background: linear-gradient(135deg, #ef4444, #f59e0b) !important;
    animation: listeningPulse 1.5s infinite;
}

@keyframes listeningPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.thinking-animation {
    display: inline-flex;
    gap: 4px;
}

.thinking-animation span {
    width: 4px;
    height: 4px;
    background: currentColor;
    border-radius: 50%;
    animation: thinkingDot 1.5s infinite;
}

.thinking-animation span:nth-child(2) {
    animation-delay: 0.2s;
}

.thinking-animation span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes thinkingDot {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
}

.confidence-indicator {
    font-size: 12px !important;
    opacity: 0.8;
    margin-top: 4px;
}
`;

// Инжектируем стили
const styleSheet = document.createElement('style');
styleSheet.textContent = voiceRecognitionStyles;
document.head.appendChild(styleSheet);

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎤 Initializing Voice Recognition system...');
    window.voiceRecognition = new VoiceRecognition();
    
    // Делаем доступным глобально для LucyAssistant
    window.VoiceRecognition = VoiceRecognition;
    
    console.log('✅ Voice Recognition system ready');
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceRecognition;
}

console.log('🎤 Voice Recognition module loaded');