// Voice Recognition Component for Voice Lucy Assistant
class VoiceRecognition {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.confidence = 0;
        
        this.initializeRecognition();
        this.bindEvents();
    }

    initializeRecognition() {
        // Check for browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            this.showError('Распознавание речи не поддерживается в вашем браузере');
            return;
        }

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ru-RU'; // Russian language
        this.recognition.maxAlternatives = 1;

        // Event handlers
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.onStart();
        };

        this.recognition.onresult = (event) => {
            console.log('Speech recognition result:', event);
            this.handleResult(event);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.onError(event.error);
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.onEnd();
        };

        this.recognition.onspeechstart = () => {
            console.log('Speech detected');
            this.onSpeechStart();
        };

        this.recognition.onspeechend = () => {
            console.log('Speech ended');
            this.onSpeechEnd();
        };

        this.recognition.onnomatch = () => {
            console.log('No speech match');
            this.onNoMatch();
        };
    }

    bindEvents() {
        // Bind to voice button
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton) {
            voiceButton.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Space bar to toggle
            if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                this.toggle();
            }
            
            // Escape to stop
            if (event.code === 'Escape') {
                this.stop();
            }
        });
    }

    start() {
        if (!this.recognition) {
            this.showError('Распознавание речи недоступно');
            return false;
        }

        if (this.isListening) {
            console.log('Already listening');
            return true;
        }

        try {
            // Небольшая задержка для стабильной инициализации
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (e) {
                    if (!e.message.includes('already started')) {
                        console.error('Failed to start recognition:', e);
                        this.showError('Не удалось запустить распознавание речи');
                        this.isListening = false;
                    }
                }
            }, 100);
            
            this.isListening = true;
            this.updateUI();
            return true;
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.showError('Не удалось запустить распознавание речи');
            this.isListening = false;
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
            console.error('Failed to stop speech recognition:', error);
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

        // Update interim text display
        this.updateInterimText();

        // If we have final results, process them
        if (this.finalTranscript.trim()) {
            this.processFinalResult();
        }
    }

    processFinalResult() {
        const text = this.finalTranscript.trim();
        console.log('Final transcript:', text);
        console.log('Confidence:', this.confidence);

        // Update UI with recognized text
        this.updateRecognizedText(text);

        // Send to Lucy if confidence is good enough
        if (this.confidence > 0.5) {
            this.sendToLucy(text);
        } else {
            this.showError('Низкая уверенность в распознавании. Попробуйте еще раз.');
        }

        // Auto-stop after successful recognition
        setTimeout(() => {
            if (this.isListening) {
                this.stop();
            }
        }, 1000);
    }

    async sendToLucy(text) {
        try {
            // Show typing indicator
            this.showTypingIndicator(true);

            // Create command object
            const command = {
                text: text,
                timestamp: new Date().toISOString(),
                confidence: this.confidence
            };

            // Send to backend via Tauri
            if (window.__TAURI__) {
                const response = await window.__TAURI__.invoke('send_voice_to_lucy', command);
                console.log('Lucy response:', response);
                
                // Add messages to chat
                this.addMessageToChat(text, 'user');
                this.addMessageToChat(response, 'lucy');
            } else {
                // Fallback for web testing
                const response = `Люси получила: "${text}"`;
                this.addMessageToChat(text, 'user');
                this.addMessageToChat(response, 'lucy');
            }

        } catch (error) {
            console.error('Error sending to Lucy:', error);
            this.showError('Ошибка отправки сообщения Люси');
            this.addMessageToChat('Ошибка: Не удалось отправить сообщение', 'lucy');
        } finally {
            this.showTypingIndicator(false);
        }
    }

    addMessageToChat(text, sender) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Remove welcome message if it exists
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const timestamp = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span>${sender === 'user' ? 'Вы' : 'Люси'}</span>
                <span>${timestamp}</span>
            </div>
            <div class="message-content">${text}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Update last action time
        this.updateLastAction();
    }

    showTypingIndicator(show) {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
    }

    updateRecognizedText(text) {
        const element = document.getElementById('recognized-text');
        if (element) {
            element.textContent = text;
        }
    }

    updateInterimText() {
        if (this.interimTranscript) {
            const element = document.getElementById('recognized-text');
            if (element) {
                element.textContent = this.interimTranscript + '...';
            }
        }
    }

    updateLastAction() {
        const element = document.getElementById('last-action');
        if (element) {
            const now = new Date();
            element.textContent = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
    }

    updateUI() {
        const voiceButton = document.getElementById('voice-button');
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const buttonText = document.querySelector('.button-text');

        if (this.isListening) {
            // Listening state
            voiceButton?.classList.add('listening');
            voiceButton?.classList.remove('active');
            statusDot?.classList.add('listening');
            statusDot?.classList.remove('inactive', 'active');
            if (statusText) statusText.textContent = 'Слушаю...';
            if (buttonText) buttonText.textContent = 'Говорите';
        } else {
            // Not listening state
            voiceButton?.classList.remove('listening', 'active');
            statusDot?.classList.remove('listening', 'active');
            statusDot?.classList.add('inactive');
            if (statusText) statusText.textContent = 'Готов к работе';
            if (buttonText) buttonText.textContent = 'Нажмите или хлопните';
        }
    }

    onStart() {
        console.log('Voice recognition started');
        this.isListening = true;
        this.updateUI();
    }

    onEnd() {
        console.log('Voice recognition ended');
        this.isListening = false;
        this.updateUI();
    }

    onSpeechStart() {
        console.log('Speech detected');
        // Could add visual feedback here
    }

    onSpeechEnd() {
        console.log('Speech ended');
    }

    onNoMatch() {
        console.log('No speech match found');
        this.showError('Речь не распознана. Попробуйте еще раз.');
    }

    onError(error) {
        console.error('Voice recognition error:', error);
        
        // Игнорируем ошибку aborted - это нормальное поведение при остановке
        if (error === 'aborted') {
            console.log('Recognition aborted normally');
            return;
        }
        
        let errorMessage = 'Ошибка распознавания речи';
        
        switch (error) {
            case 'no-speech':
                errorMessage = 'Речь не обнаружена';
                break;
            case 'audio-capture':
                errorMessage = 'Ошибка захвата аудио. Проверьте микрофон.';
                break;
            case 'not-allowed':
                errorMessage = 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
                break;
            case 'network':
                errorMessage = 'Сетевая ошибка';
                break;
            default:
                errorMessage = `Ошибка: ${error}`;
        }
        
        this.showError(errorMessage);
    }

    showError(message) {
        console.error('Voice Recognition Error:', message);
        
        // Show in UI (you could implement a toast notification)
        if (window.showNotification) {
            window.showNotification(message, 'error');
        }
        
        // Also add as Lucy message
        this.addMessageToChat(`❌ ${message}`, 'lucy');
    }

    // Public methods
    isActive() {
        return this.isListening;
    }

    getConfidence() {
        return this.confidence;
    }

    getLastTranscript() {
        return this.finalTranscript;
    }
}

// Initialize voice recognition when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.voiceRecognition = new VoiceRecognition();
    console.log('Voice Recognition initialized');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceRecognition;
}