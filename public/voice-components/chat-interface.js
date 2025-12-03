// Chat Interface Component for Voice Lucy Assistant
class ChatInterface {
    constructor() {
        this.messages = [];
        this.isConnected = false;
        this.typingTimeout = null;
        
        this.initializeInterface();
        this.bindEvents();
        this.loadChatHistory();
    }

    initializeInterface() {
        // Initialize chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.clearChatBtn = document.getElementById('clear-chat');
        
        // Set up initial state
        this.updateConnectionStatus();
    }

    bindEvents() {
        // Clear chat button
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => {
                this.clearChat();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl+L to clear chat
            if (event.ctrlKey && event.key === 'l') {
                event.preventDefault();
                this.clearChat();
            }
            
            // Ctrl+H to show history
            if (event.ctrlKey && event.key === 'h') {
                event.preventDefault();
                this.showHistoryInfo();
            }
        });

        // Listen for voice recognition events
        if (window.voiceRecognition) {
            // Override the sendToLucy method to use chat interface
            const originalSendToLucy = window.voiceRecognition.sendToLucy.bind(window.voiceRecognition);
            window.voiceRecognition.sendToLucy = async (text) => {
                await this.sendMessage(text, 'user');
                return originalSendToLucy(text);
            };
        }
    }

    async sendMessage(text, sender = 'user', options = {}) {
        if (!text || !text.trim()) {
            console.warn('Empty message, not sending');
            return null;
        }

        const message = {
            id: this.generateMessageId(),
            text: text.trim(),
            sender: sender,
            timestamp: new Date().toISOString(),
            confidence: options.confidence || 1.0,
            type: options.type || 'text'
        };

        // Add to local messages array
        this.messages.push(message);

        // Add to UI
        this.addMessageToUI(message);

        // If it's a user message, process it
        if (sender === 'user') {
            await this.processUserMessage(message);
        }

        // Save to history
        this.saveChatHistory();

        return message;
    }

    async processUserMessage(message) {
        try {
            // Show typing indicator
            this.showTyping(true);

            // Send to backend for processing
            let response;
            if (window.__TAURI__) {
                response = await window.__TAURI__.invoke('send_voice_to_lucy', {
                    text: message.text,
                    timestamp: message.timestamp,
                    confidence: message.confidence
                });
            } else {
                // Fallback for web testing
                response = await this.generateMockResponse(message.text);
            }

            // Add Lucy's response
            await this.sendMessage(response, 'lucy', {
                type: 'response'
            });

        } catch (error) {
            console.error('Error processing user message:', error);
            
            // Add error message
            await this.sendMessage(
                '❌ Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.',
                'lucy',
                { type: 'error' }
            );
        } finally {
            this.showTyping(false);
        }
    }

    async generateMockResponse(userMessage) {
        // Simple mock responses for testing
        const responses = [
            `Я поняла ваше сообщение: "${userMessage}". Чем могу помочь?`,
            `Вы сказали: "${userMessage}". Давайте обсудим это подробнее.`,
            `Получила ваше сообщение: "${userMessage}". Это интересно!`,
            `${userMessage} - понятное сообщение. Как я могу вам ассистировать?`
        ];

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Return random response
        return responses[Math.floor(Math.random() * responses.length)];
    }

    addMessageToUI(message) {
        if (!this.chatMessages) return;

        // Remove welcome message if it exists and this is the first real message
        if (this.messages.length === 1) {
            const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => welcomeMessage.remove(), 300);
            }
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}`;
        messageDiv.setAttribute('data-message-id', message.id);

        const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let contentHtml = `
            <div class="message-header">
                <span class="message-sender">
                    <i class="fas fa-${message.sender === 'user' ? 'user' : 'robot'}"></i>
                    ${message.sender === 'user' ? 'Вы' : 'Люси'}
                </span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.text)}</div>
        `;

        // Add confidence indicator for voice messages
        if (message.confidence < 1.0 && message.sender === 'user') {
            contentHtml += `
                <div class="confidence-indicator">
                    <span>Уверенность: ${Math.round(message.confidence * 100)}%</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${message.confidence * 100}%"></div>
                    </div>
                </div>
            `;
        }

        // Add type indicator if needed
        if (message.type === 'error') {
            messageDiv.classList.add('error-message');
        }

        messageDiv.innerHTML = contentHtml;

        // Add to chat with animation
        messageDiv.style.animation = 'messageSlideIn 0.3s ease';
        this.chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        this.scrollToBottom();

        // Update last action time
        this.updateLastAction();
    }

    showTyping(show) {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (show) {
            this.typingIndicator.style.display = 'flex';
            
            // Auto-hide after 10 seconds (prevent stuck indicator)
            this.typingTimeout = setTimeout(() => {
                this.showTyping(false);
            }, 10000);
        } else {
            this.typingIndicator.style.display = 'none';
        }
    }

    async clearChat() {
        // Confirm before clearing
        if (this.messages.length > 0) {
            const confirmed = await this.confirmAction(
                'Вы уверены, что хотите очистить весь чат?',
                'Очистить чат'
            );
            
            if (!confirmed) return;
        }

        // Clear messages array
        this.messages = [];

        // Clear UI
        if (this.chatMessages) {
            this.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-sparkles"></i>
                    <p>Чат очищен. Нажмите на кнопку или хлопните, чтобы начать новое общение с Люси.</p>
                </div>
            `;
        }

        // Clear backend history if Tauri is available
        if (window.__TAURI__) {
            try {
                await window.__TAURI__.invoke('clear_chat_history');
            } catch (error) {
                console.error('Error clearing backend chat history:', error);
            }
        }

        // Clear local storage
        localStorage.removeItem('voice-lucy-chat-history');

        console.log('Chat cleared');
    }

    async loadChatHistory() {
        try {
            // Try to load from backend first
            if (window.__TAURI__) {
                const backendHistory = await window.__TAURI__.invoke('get_chat_history');
                if (backendHistory && backendHistory.length > 0) {
                    this.messages = backendHistory.map(msg => ({
                        id: msg.timestamp,
                        text: msg.message,
                        sender: msg.sender.toLowerCase(),
                        timestamp: msg.timestamp,
                        confidence: 1.0,
                        type: 'text'
                    }));
                    
                    // Render loaded messages
                    this.renderAllMessages();
                    return;
                }
            }

            // Fallback to local storage
            const savedHistory = localStorage.getItem('voice-lucy-chat-history');
            if (savedHistory) {
                this.messages = JSON.parse(savedHistory);
                this.renderAllMessages();
            }

        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    saveChatHistory() {
        try {
            // Save to local storage
            localStorage.setItem('voice-lucy-chat-history', JSON.stringify(this.messages));

            // Also save to backend if available
            if (window.__TAURI__ && this.messages.length > 0) {
                // Backend should already have the history, but we can sync if needed
            }

        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    renderAllMessages() {
        if (!this.chatMessages) return;

        // Clear existing messages
        this.chatMessages.innerHTML = '';

        if (this.messages.length === 0) {
            // Show welcome message
            this.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-sparkles"></i>
                    <p>Добро пожаловать! Нажмите на кнопку или хлопните, чтобы отправить сообщение Люси.</p>
                </div>
            `;
        } else {
            // Render all saved messages
            this.messages.forEach(message => {
                this.addMessageToUI(message);
            });
        }
    }

    async confirmAction(message, title = 'Подтверждение') {
        // Create custom confirmation dialog
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.innerHTML = `
                <div class="confirm-content">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="confirm-buttons">
                        <button class="confirm-btn cancel">Отмена</button>
                        <button class="confirm-btn confirm">Подтвердить</button>
                    </div>
                </div>
            `;

            // Style the dialog
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease;
            `;

            document.body.appendChild(dialog);

            // Handle buttons
            const confirmBtn = dialog.querySelector('.confirm');
            const cancelBtn = dialog.querySelector('.cancel');

            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(false);
            });

            // Close on outside click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    document.body.removeChild(dialog);
                    resolve(false);
                }
            });
        });
    }

    showHistoryInfo() {
        const totalMessages = this.messages.length;
        const userMessages = this.messages.filter(m => m.sender === 'user').length;
        const lucyMessages = this.messages.filter(m => m.sender === 'lucy').length;

        const info = `
            📊 Статистика чата:
            • Всего сообщений: ${totalMessages}
            • От вас: ${userMessages}
            • От Люси: ${lucyMessages}
            • Последнее сообщение: ${this.messages.length > 0 ? 
                new Date(this.messages[this.messages.length - 1].timestamp).toLocaleString('ru-RU') : 
                'Нет сообщений'}
        `;

        // Show as Lucy message
        this.sendMessage(info, 'lucy', { type: 'info' });
    }

    updateConnectionStatus() {
        // This could be expanded to show actual connection status
        this.isConnected = window.__TAURI__ ? true : false;
        
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (this.isConnected) {
            statusDot?.classList.add('active');
            statusDot?.classList.remove('inactive');
            statusText.textContent = 'Подключено к Люси';
        } else {
            statusDot?.classList.remove('active');
            statusDot?.classList.add('inactive');
            statusText.textContent = 'Тестовый режим';
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

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods
    getMessageCount() {
        return this.messages.length;
    }

    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    exportChatHistory() {
        const exportData = {
            exportDate: new Date().toISOString(),
            messageCount: this.messages.length,
            messages: this.messages
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lucy-chat-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Add additional CSS for chat interface
const chatInterfaceStyles = `
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
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

.message-sender {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.confidence-indicator {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.confidence-bar {
    width: 100%;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    margin-top: 0.25rem;
    overflow: hidden;
}

.confidence-fill {
    height: 100%;
    background: var(--success-color);
    transition: width 0.3s ease;
}

.error-message {
    background: var(--danger-color) !important;
    color: white !important;
}

.confirm-dialog .confirm-content {
    background: white;
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: var(--shadow-xl);
    max-width: 400px;
    width: 90%;
    animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from {
        transform: translateY(50px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.confirm-dialog h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
}

.confirm-dialog p {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
}

.confirm-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
}

.confirm-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
}

.confirm-btn.cancel {
    background: var(--light-bg);
    color: var(--text-secondary);
}

.confirm-btn.cancel:hover {
    background: var(--border-color);
}

.confirm-btn.confirm {
    background: var(--primary-color);
    color: white;
}

.confirm-btn.confirm:hover {
    background: var(--primary-dark);
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = chatInterfaceStyles;
document.head.appendChild(styleSheet);

// Initialize chat interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
    console.log('Chat Interface initialized');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatInterface;
}