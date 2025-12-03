// Clap Detection Component for Voice Lucy Assistant
class ClapDetection {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isDetecting = false;
        this.isEnabled = true;
        this.clapThreshold = 0.8; // Threshold for clap detection
        this.lastClapTime = 0;
        this.clapDebounce = 500; // Minimum time between claps (ms)
        
        this.initializeAudio();
        this.bindEvents();
    }

    async initializeAudio() {
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Configure analyser
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect microphone to analyser
            this.microphone.connect(this.analyser);
            
            console.log('Clap detection audio initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize audio for clap detection:', error);
            this.showError('Не удалось получить доступ к микрофону для детекции хлопков');
        }
    }

    bindEvents() {
        // Bind to clap toggle button
        const clapToggle = document.getElementById('clap-toggle');
        if (clapToggle) {
            clapToggle.addEventListener('click', () => {
                this.toggle();
            });
        }
    }

    start() {
        if (!this.audioContext || !this.analyser) {
            console.error('Audio not initialized for clap detection');
            return false;
        }

        if (this.isDetecting) {
            console.log('Clap detection already running');
            return true;
        }

        this.isDetecting = true;
        this.detectClaps();
        console.log('Clap detection started');
        return true;
    }

    stop() {
        this.isDetecting = false;
        console.log('Clap detection stopped');
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        
        const clapStatus = document.getElementById('clap-status');
        const clapToggle = document.getElementById('clap-toggle');
        
        if (this.isEnabled) {
            this.start();
            if (clapStatus) clapStatus.textContent = 'ВКЛ';
            if (clapToggle) clapToggle.classList.remove('disabled');
            console.log('Clap detection enabled');
        } else {
            this.stop();
            if (clapStatus) clapStatus.textContent = 'ВЫКЛ';
            if (clapToggle) clapToggle.classList.add('disabled');
            console.log('Clap detection disabled');
        }
    }

    detectClaps() {
        if (!this.isDetecting) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeDataArray = new Uint8Array(bufferLength);

        const analyze = () => {
            if (!this.isDetecting) return;

            // Get frequency and time domain data
            this.analyser.getByteFrequencyData(dataArray);
            this.analyser.getByteTimeDomainData(timeDataArray);

            // Detect clap characteristics
            const isClap = this.analyzeForClap(dataArray, timeDataArray);
            
            if (isClap) {
                this.handleClapDetection();
            }

            // Update audio level display
            this.updateAudioLevel(dataArray);

            // Continue analysis
            requestAnimationFrame(analyze);
        };

        analyze();
    }

    analyzeForClap(frequencyData, timeData) {
        const currentTime = Date.now();
        
        // Debounce claps to prevent multiple detections
        if (currentTime - this.lastClapTime < this.clapDebounce) {
            return false;
        }

        // Clap characteristics:
        // 1. Sharp, loud sound (high amplitude)
        // 2. Broad frequency spectrum
        // 3. Quick attack and decay

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        const averageAmplitude = sum / frequencyData.length / 255; // Normalize to 0-1

        // Calculate frequency spread (claps have broad spectrum)
        let maxFreq = 0;
        let activeFreqBands = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > 50) { // Threshold for active frequency
                activeFreqBands++;
            }
            if (frequencyData[i] > maxFreq) {
                maxFreq = frequencyData[i];
            }
        }
        const frequencySpread = activeFreqBands / frequencyData.length;

        // Check for sharp onset in time domain
        let timeVariation = 0;
        for (let i = 1; i < timeData.length; i++) {
            timeVariation += Math.abs(timeData[i] - timeData[i-1]);
        }
        timeVariation = timeVariation / timeData.length;

        // Combined detection logic
        const amplitudeCondition = averageAmplitude > this.clapThreshold;
        const frequencyCondition = frequencySpread > 0.3; // At least 30% of spectrum active
        const timeCondition = timeVariation > 10; // Sharp variation

        const isClap = amplitudeCondition && frequencyCondition && timeCondition;

        console.log('Clap analysis:', {
            amplitude: averageAmplitude.toFixed(2),
            frequencySpread: frequencySpread.toFixed(2),
            timeVariation: timeVariation.toFixed(2),
            isClap: isClap
        });

        return isClap;
    }

    async handleClapDetection() {
        this.lastClapTime = Date.now();
        
        console.log('Clap detected!');
        
        // Visual feedback
        this.showClapFeedback();
        
        // Trigger voice recognition
        if (window.voiceRecognition) {
            // Auto-start voice recognition on clap
            if (!window.voiceRecognition.isActive()) {
                window.voiceRecognition.start();
                
                // Show notification
                this.showNotification('Хлопок обнаружен! Запускаю распознавание речи...', 'success');
            }
        }

        // Send clap event to backend if Tauri is available
        if (window.__TAURI__) {
            try {
                await window.__TAURI__.invoke('process_clap_detection', { 
                    clap_detected: true 
                });
            } catch (error) {
                console.error('Error sending clap detection to backend:', error);
            }
        }
    }

    showClapFeedback() {
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton) {
            // Add visual feedback
            voiceButton.classList.add('clap-detected');
            
            // Create ripple effect
            const ripple = document.createElement('div');
            ripple.className = 'clap-ripple';
            voiceButton.appendChild(ripple);
            
            // Remove effects after animation
            setTimeout(() => {
                voiceButton.classList.remove('clap-detected');
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        }
    }

    updateAudioLevel(frequencyData) {
        // Calculate average audio level
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        const averageLevel = (sum / frequencyData.length / 255) * 100; // Convert to percentage

        // Update UI
        const audioLevelElement = document.getElementById('audio-level');
        if (audioLevelElement) {
            audioLevelElement.textContent = `${Math.round(averageLevel)}%`;
        }

        // Update voice button based on audio level
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton && this.isDetecting) {
            const intensity = averageLevel / 100;
            voiceButton.style.filter = `brightness(${1 + intensity * 0.3})`;
        }
    }

    showNotification(message, type = 'info') {
        console.log(`Clap Detection Notification (${type}):`, message);
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles for toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
        console.error('Clap Detection Error:', message);
    }

    // Calibration methods
    calibrateClapThreshold() {
        console.log('Starting clap threshold calibration...');
        this.showNotification('Сделайте хлопок для калибровки...', 'info');
        
        // Listen for next clap to calibrate threshold
        const originalThreshold = this.clapThreshold;
        this.clapThreshold = 0.3; // Lower threshold for calibration
        
        const calibratedHandler = () => {
            // Capture the current level and set as new threshold
            if (this.analyser) {
                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const averageAmplitude = sum / dataArray.length / 255;
                
                // Set threshold slightly above average
                this.clapThreshold = Math.min(0.9, averageAmplitude * 1.2);
                
                console.log(`Clap threshold calibrated to: ${this.clapThreshold.toFixed(2)}`);
                this.showNotification(`Порог калибровки: ${Math.round(this.clapThreshold * 100)}%`, 'success');
            }
            
            // Remove temporary handler
            this.analyser.removeEventListener('audioprocess', calibratedHandler);
        };
        
        // Temporary handler for calibration
        setTimeout(() => {
            this.clapThreshold = originalThreshold;
        }, 5000); // Reset if no clap within 5 seconds
    }

    // Public methods
    isEnabled() {
        return this.isEnabled;
    }

    isDetecting() {
        return this.isDetecting;
    }

    getThreshold() {
        return this.clapThreshold;
    }

    setThreshold(value) {
        this.clapThreshold = Math.max(0.1, Math.min(0.9, value));
        console.log(`Clap threshold set to: ${this.clapThreshold}`);
    }
}

// Add CSS for clap detection animations
const clapDetectionStyles = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.clap-detected {
    animation: clapPulse 0.6s ease;
}

@keyframes clapPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); box-shadow: 0 0 30px rgba(99, 102, 241, 0.6); }
}

.clap-ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border: 3px solid var(--primary-light);
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

.control-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--text-secondary);
    border-color: var(--text-secondary);
    color: white;
}

.toast {
    z-index: 1000;
}

.toast-error {
    background: var(--danger-color);
}

.toast-success {
    background: var(--success-color);
}

.toast-info {
    background: var(--primary-color);
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = clapDetectionStyles;
document.head.appendChild(styleSheet);

// Initialize clap detection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.clapDetection = new ClapDetection();
    
    // Auto-start clap detection
    setTimeout(() => {
        if (window.clapDetection) {
            window.clapDetection.start();
            console.log('Clap detection auto-started');
        }
    }, 1000);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClapDetection;
}