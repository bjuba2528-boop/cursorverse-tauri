// Audio Processor Component for CursorVerse Tauri
// Обработка аудио в реальном времени, детекция хлопков, анализ качества

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isProcessing = false;
        this.audioBuffer = [];
        this.recordingStream = null;
        
        // Настройки обработки аудио
        this.settings = {
            sampleRate: 44100,
            bufferSize: 4096,
            channels: 1,
            noiseThreshold: 0.01,
            voiceActivityThreshold: 0.1,
            clapThreshold: 0.8,
            clapDebounce: 500
        };
        
        this.lastClapTime = 0;
        this.audioLevel = 0;
        this.isVoiceActive = false;
        
        this.initializeAudio();
        this.bindEvents();
        console.log('🔊 Audio Processor initialized');
    }

    async initializeAudio() {
        try {
            console.log('🎤 Requesting microphone access...');
            
            // Запрашиваем доступ к микрофону с настройками
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.settings.sampleRate
                }
            });

            // Создаем аудио контекст
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Настраиваем аудио узлы
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.gainNode = this.audioContext.createGain();
            
            // Настраиваем анализатор
            this.analyser.fftSize = this.settings.bufferSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // Соединяем аудио узлы
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            
            // Сохраняем поток для очистки
            this.recordingStream = stream;

            console.log('✅ Audio processor initialized successfully');
            this.emitEvent('audio-ready');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize audio processor:', error);
            this.emitEvent('audio-error', { error: error.message });
            
            // Обрабатываем специфические ошибки
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
            } else if (error.name === 'NotFoundError') {
                this.showError('Микрофон не найден. Проверьте подключение.');
            } else if (error.name === 'NotReadableError') {
                this.showError('Микрофон используется другим приложением.');
            } else {
                this.showError('Не удалось инициализировать аудио: ' + error.message);
            }
            
            return false;
        }
    }

    bindEvents() {
        // Слушаем события голосового распознавания
        window.addEventListener('voice-start', () => {
            this.startProcessing();
        });

        window.addEventListener('voice-end', () => {
            this.stopProcessing();
        });

        // Клавиатурные сокращения для аудио
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === 'm') {
                event.preventDefault();
                this.toggleProcessing();
            }
        });
    }

    startProcessing() {
        if (this.isProcessing) {
            console.log('⚠️ Audio processing already active');
            return;
        }

        if (!this.analyser) {
            console.error('❌ Audio analyser not initialized');
            return;
        }

        this.isProcessing = true;
        this.audioBuffer = [];
        console.log('🎙️ Starting audio processing...');
        
        // Запускаем анализ аудио
        this.processAudio();
        this.emitEvent('audio-processing-started');
    }

    stopProcessing() {
        this.isProcessing = false;
        console.log('⏹️ Stopping audio processing');
        
        // Обрабатываем оставшиеся данные
        if (this.audioBuffer.length > 0) {
            this.processBufferedAudio();
        }
        
        this.emitEvent('audio-processing-stopped');
    }

    toggleProcessing() {
        if (this.isProcessing) {
            this.stopProcessing();
        } else {
            this.startProcessing();
        }
    }

    processAudio() {
        if (!this.isProcessing || !this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const frequencyData = new Uint8Array(bufferLength);
        const timeData = new Uint8Array(bufferLength);

        const analyze = () => {
            if (!this.isProcessing) return;

            // Получаем аудио данные
            this.analyser.getByteFrequencyData(frequencyData);
            this.analyser.getByteTimeDomainData(timeData);

            // Обрабатываем данные
            this.processAudioData(frequencyData, timeData);

            // Продолжаем анализ
            requestAnimationFrame(analyze);
        };

        analyze();
    }

    processAudioData(frequencyData, timeData) {
        // Вычисляем метрики аудио
        const metrics = this.calculateAudioMetrics(frequencyData, timeData);

        // Сохраняем данные для обработки
        this.audioBuffer.push({
            timestamp: Date.now(),
            frequencyData: Array.from(frequencyData),
            timeData: Array.from(timeData),
            metrics: metrics
        });

        // Ограничиваем размер буфера
        if (this.audioBuffer.length > 100) {
            this.audioBuffer.shift();
        }

        // Обновляем UI с текущими уровнями аудио
        this.updateAudioLevels(metrics);

        // Детекция голосовой активности
        this.detectVoiceActivity(metrics);

        // Детекция хлопков
        this.detectClap(metrics);

        // Отправляем данные другим компонентам
        this.broadcastAudioData(metrics);
    }

    calculateAudioMetrics(frequencyData, timeData) {
        // Вычисляем RMS (Root Mean Square) для громкости
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i] * frequencyData[i];
        }
        const rms = Math.sqrt(sum / frequencyData.length) / 255; // Нормализация к 0-1

        // Вычисляем пиковую частоту
        let maxMagnitude = 0;
        let peakFrequency = 0;
        const nyquist = this.audioContext.sampleRate / 2;
        
        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > maxMagnitude) {
                maxMagnitude = frequencyData[i];
                peakFrequency = (i / frequencyData.length) * nyquist;
            }
        }

        // Вычисляем спектральный центроид (яркость звука)
        let weightedSum = 0;
        let magnitudeSum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const frequency = (i / frequencyData.length) * nyquist;
            weightedSum += frequency * frequencyData[i];
            magnitudeSum += frequencyData[i];
        }
        const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

        // Вычисляем количество нулевых переходов (для детекции речи)
        let zeroCrossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            if ((timeData[i] - 128) * (timeData[i - 1] - 128) < 0) {
                zeroCrossings++;
            }
        }
        const zeroCrossingRate = zeroCrossings / timeData.length;

        // Определяем качество аудио
        const audioQuality = {
            signalToNoiseRatio: this.calculateSNR(frequencyData),
            clippingDetected: this.detectClipping(frequencyData),
            silencePercentage: this.calculateSilencePercentage(frequencyData)
        };

        // Детекция активности
        const hasActivity = rms > this.settings.noiseThreshold;

        return {
            rms: rms,
            peakFrequency: peakFrequency,
            spectralCentroid: spectralCentroid,
            zeroCrossingRate: zeroCrossingRate,
            hasActivity: hasActivity,
            volume: Math.round(rms * 100), // Проценты
            audioQuality: audioQuality,
            timestamp: Date.now()
        };
    }

    detectClap(metrics) {
        const currentTime = Date.now();
        
        // Защита от множественных срабатываний
        if (currentTime - this.lastClapTime < this.settings.clapDebounce) {
            return false;
        }

        // Детекция хлопка: высокая амплитуда + широкий спектр + резкое изменение
        const amplitudeCondition = metrics.rms > this.settings.clapThreshold;
        const spectrumCondition = metrics.peakFrequency > 2000; // Высокие частоты
        const qualityCondition = !metrics.audioQuality.clippingDetected;
        
        const isClap = amplitudeCondition && spectrumCondition && qualityCondition;

        if (isClap) {
            this.lastClapTime = currentTime;
            this.handleClapDetection(metrics);
        }

        return isClap;
    }

    handleClapDetection(metrics) {
        console.log('👏 Clap detected! RMS:', metrics.rms.toFixed(2));
        
        // Визуальная обратная связь
        this.showClapFeedback();
        
        // Автоматически запускаем распознавание речи
        if (window.voiceRecognition && !window.voiceRecognition.isActive()) {
            console.log('🎤 Auto-starting voice recognition after clap...');
            setTimeout(() => {
                window.voiceRecognition.start();
            }, 200);
        }
        
        // Отправляем событие в систему
        this.emitEvent('clap-detected', metrics);
        
        // Показываем уведомление
        this.showNotification('👏 Хлопок обнаружен! Запускаю распознавание речи...', 'success');
    }

    showClapFeedback() {
        const voiceButton = document.querySelector('.btn-voice');
        if (voiceButton) {
            // Добавляем визуальный эффект
            voiceButton.classList.add('clap-detected');
            
            // Создаем ripple эффект
            const ripple = document.createElement('div');
            ripple.className = 'clap-ripple';
            voiceButton.appendChild(ripple);
            
            // Удаляем эффекты после анимации
            setTimeout(() => {
                voiceButton.classList.remove('clap-detected');
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        }
    }

    detectVoiceActivity(metrics) {
        // Детекция голосовой активности на основе множественных метрик
        const isVoice = 
            metrics.rms > this.settings.voiceActivityThreshold &&
            metrics.zeroCrossingRate > 0.05 && // У речи больше нулевых переходов
            metrics.spectralCentroid > 500 && // Речь имеет определенные частотные характеристики
            metrics.spectralCentroid < 4000; // Но не слишком высокие

        // Отправляем события об изменении голосовой активности
        if (isVoice && !this.isVoiceActive) {
            this.isVoiceActive = true;
            this.emitEvent('voice-activity-start', metrics);
        } else if (!isVoice && this.isVoiceActive) {
            this.isVoiceActive = false;
            this.emitEvent('voice-activity-end', metrics);
        }

        return isVoice;
    }

    updateAudioLevels(metrics) {
        // Обновляем UI с уровнем аудио
        const audioLevelElement = document.getElementById('audio-level');
        if (audioLevelElement) {
            audioLevelElement.textContent = `${metrics.volume}%`;
        }

        // Обновляем визуализацию на кнопке
        const voiceButton = document.querySelector('.btn-voice');
        if (voiceButton && this.isProcessing) {
            const intensity = metrics.rms;
            voiceButton.style.filter = `brightness(${1 + intensity * 0.3})`;
            
            // Добавляем легкую пульсацию при активности
            if (metrics.hasActivity) {
                const scale = 1 + intensity * 0.05;
                voiceButton.style.transform = `scale(${scale})`;
            } else {
                voiceButton.style.transform = 'scale(1)';
            }
        }

        // Обновляем статус
        this.updateAudioStatus(metrics);
    }

    updateAudioStatus(metrics) {
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');
        
        if (!statusText || !statusDot) return;

        if (this.isProcessing) {
            if (metrics.hasActivity) {
                statusText.textContent = 'Речь обнаружена';
                statusDot.classList.add('active');
                statusDot.classList.remove('listening');
            } else {
                statusText.textContent = 'Слушаю...';
                statusDot.classList.add('listening');
                statusDot.classList.remove('active');
            }
        }
    }

    broadcastAudioData(metrics) {
        // Отправляем данные другим компонентам
        this.emitEvent('audio-data-update', metrics);
        
        // Можно добавить специфичные события
        if (metrics.volume > 80) {
            this.emitEvent('high-audio-level', metrics);
        }
        
        if (metrics.audioQuality.clippingDetected) {
            this.emitEvent('audio-clipping', metrics);
        }
    }

    processBufferedAudio() {
        if (this.audioBuffer.length === 0) return;

        console.log(`📊 Processing ${this.audioBuffer.length} buffered audio frames`);

        // Анализируем полный аудио сегмент
        const analysis = this.analyzeAudioSegment(this.audioBuffer);
        
        // Отправляем анализ в бэкенд если нужно
        if (window.__TAURI__) {
            window.__TAURI__.invoke('process_audio_segment', {
                analysis: analysis,
                duration: this.audioBuffer.length * (this.settings.bufferSize / this.settings.sampleRate) * 1000
            }).catch(error => {
                console.error('Error sending audio analysis to backend:', error);
            });
        }
    }

    analyzeAudioSegment(audioBuffer) {
        if (audioBuffer.length === 0) return null;

        // Вычисляем общие метрики для аудио сегмента
        let totalRms = 0;
        let totalPeakFreq = 0;
        let totalSpectralCentroid = 0;
        let totalZeroCrossingRate = 0;
        let activityFrames = 0;

        audioBuffer.forEach(frame => {
            totalRms += frame.metrics.rms;
            totalPeakFreq += frame.metrics.peakFrequency;
            totalSpectralCentroid += frame.metrics.spectralCentroid;
            totalZeroCrossingRate += frame.metrics.zeroCrossingRate;
            if (frame.metrics.hasActivity) activityFrames++;
        });

        const frameCount = audioBuffer.length;

        return {
            averageRms: totalRms / frameCount,
            averagePeakFrequency: totalPeakFreq / frameCount,
            averageSpectralCentroid: totalSpectralCentroid / frameCount,
            averageZeroCrossingRate: totalZeroCrossingRate / frameCount,
            activityRatio: activityFrames / frameCount,
            duration: frameCount * (this.settings.bufferSize / this.settings.sampleRate),
            frameCount: frameCount
        };
    }

    // Вспомогательные методы для анализа качества
    calculateSNR(frequencyData) {
        const signalLevel = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
        const noiseLevel = Math.min(...frequencyData);
        return signalLevel / (noiseLevel + 1);
    }

    detectClipping(frequencyData) {
        return frequencyData.some(val => val >= 250); // Почти максимальное значение
    }

    calculateSilencePercentage(frequencyData) {
        const silenceThreshold = 10;
        const silentSamples = frequencyData.filter(val => val < silenceThreshold).length;
        return silentSamples / frequencyData.length;
    }

    // Запись аудио
    async startRecording() {
        try {
            if (this.recordingStream) {
                console.warn('⚠️ Recording already in progress');
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.recordingStream = stream;
            console.log('🎙️ Recording started');
            this.emitEvent('recording-started');
            return true;

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showError('Не удалось начать запись: ' + error.message);
            return false;
        }
    }

    stopRecording() {
        if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
            this.recordingStream = null;
            console.log('⏹️ Recording stopped');
            this.emitEvent('recording-stopped');
        }
    }

    isRecording() {
        return this.recordingStream !== null;
    }

    // Управление настройками
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️ Audio settings updated:', this.settings);
        this.emitEvent('settings-updated', this.settings);
    }

    getSettings() {
        return { ...this.settings };
    }

    // Утилиты
    emitEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    showError(message) {
        console.error('❌ Audio Processor Error:', message);
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Используем общую систему уведомлений
        if (window.voiceRecognition && window.voiceRecognition.showNotification) {
            window.voiceRecognition.showNotification(message, type);
        } else {
            // Fallback уведомление
            console.log(`🔔 [${type.toUpperCase()}] ${message}`);
        }
    }

    // Public getters
    isAudioProcessing() {
        return this.isProcessing;
    }

    getAudioLevel() {
        return this.audioLevel;
    }

    isVoiceActive() {
        return this.isVoiceActive;
    }

    getAudioMetrics() {
        return this.audioBuffer.length > 0 ? 
            this.audioBuffer[this.audioBuffer.length - 1].metrics : 
            null;
    }

    // Cleanup
    cleanup() {
        this.stopProcessing();
        this.stopRecording();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
        }
        
        console.log('🧹 Audio processor cleaned up');
        this.emitEvent('audio-cleaned-up');
    }
}

// Добавляем CSS для визуальных эффектов
const audioProcessorStyles = `
.clap-detected {
    animation: clapPulse 0.6s ease !important;
}

@keyframes clapPulse {
    0%, 100% { 
        transform: scale(1); 
        box-shadow: 0 0 20px rgba(99, 102, 241, 0.6); 
    }
    50% { 
        transform: scale(1.1); 
        box-shadow: 0 0 40px rgba(99, 102, 241, 0.8); 
    }
}

.clap-ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border: 3px solid var(--primary-light, #818cf8);
    border-radius: 50%;
    animation: rippleEffect 0.6s ease-out;
    pointer-events: none;
}

@keyframes rippleEffect {
    from {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
    to {
        transform: translate(-50%, -50%) scale(1.5);
        opacity: 0;
    }
}

#audio-level {
    transition: all 0.3s ease;
}

#audio-level.high {
    color: #ef4444;
    font-weight: bold;
}

#audio-level.medium {
    color: #f59e0b;
}

#audio-level.low {
    color: #10b981;
}
`;

// Инжектируем стили
const styleSheet = document.createElement('style');
styleSheet.textContent = audioProcessorStyles;
document.head.appendChild(styleSheet);

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔊 Initializing Audio Processor system...');
    window.audioProcessor = new AudioProcessor();
    
    // Делаем доступным глобально
    window.AudioProcessor = AudioProcessor;
    
    // Автоматически запускаем обработку при готовности
    setTimeout(() => {
        if (window.audioProcessor) {
            console.log('✅ Audio Processor system ready');
        }
    }, 1000);
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioProcessor;
}

console.log('🔊 Audio Processor module loaded');