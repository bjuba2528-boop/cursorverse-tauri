// Audio Processor Component for Voice Lucy Assistant
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isProcessing = false;
        this.audioBuffer = [];
        this.recordingStream = null;
        
        // Audio processing settings
        this.settings = {
            sampleRate: 44100,
            bufferSize: 4096,
            channels: 1,
            noiseThreshold: 0.01,
            voiceActivityThreshold: 0.1
        };

        this.initializeAudio();
        this.bindEvents();
    }

    async initializeAudio() {
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.settings.sampleRate
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Set up audio nodes
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.gainNode = this.audioContext.createGain();
            
            // Configure analyser
            this.analyser.fftSize = this.settings.bufferSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // Connect audio nodes
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            
            // Store stream for cleanup
            this.recordingStream = stream;

            console.log('Audio processor initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize audio processor:', error);
            this.showError('Не удалось инициализировать аудио процессор');
            return false;
        }
    }

    bindEvents() {
        // Listen for voice recognition state changes
        document.addEventListener('voiceRecognitionStart', () => {
            this.startProcessing();
        });

        document.addEventListener('voiceRecognitionStop', () => {
            this.stopProcessing();
        });
    }

    startProcessing() {
        if (this.isProcessing) {
            console.log('Audio processing already active');
            return;
        }

        this.isProcessing = true;
        this.audioBuffer = [];
        console.log('Audio processing started');
        
        // Start audio analysis
        this.processAudio();
    }

    stopProcessing() {
        this.isProcessing = false;
        console.log('Audio processing stopped');
        
        // Process any remaining audio
        if (this.audioBuffer.length > 0) {
            this.processBufferedAudio();
        }
    }

    processAudio() {
        if (!this.isProcessing || !this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const frequencyData = new Uint8Array(bufferLength);
        const timeData = new Uint8Array(bufferLength);

        const analyze = () => {
            if (!this.isProcessing) return;

            // Get audio data
            this.analyser.getByteFrequencyData(frequencyData);
            this.analyser.getByteTimeDomainData(timeData);

            // Process the audio data
            this.processAudioData(frequencyData, timeData);

            // Continue processing
            requestAnimationFrame(analyze);
        };

        analyze();
    }

    processAudioData(frequencyData, timeData) {
        // Calculate various audio metrics
        const metrics = this.calculateAudioMetrics(frequencyData, timeData);

        // Store audio data for processing
        this.audioBuffer.push({
            timestamp: Date.now(),
            frequencyData: Array.from(frequencyData),
            timeData: Array.from(timeData),
            metrics: metrics
        });

        // Limit buffer size
        if (this.audioBuffer.length > 100) {
            this.audioBuffer.shift();
        }

        // Update UI with current audio levels
        this.updateAudioLevels(metrics);

        // Detect voice activity
        this.detectVoiceActivity(metrics);

        // Send audio data to other components if needed
        this.broadcastAudioData(metrics);
    }

    calculateAudioMetrics(frequencyData, timeData) {
        // Calculate RMS (Root Mean Square) for volume
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i] * frequencyData[i];
        }
        const rms = Math.sqrt(sum / frequencyData.length) / 255; // Normalize to 0-1

        // Calculate peak frequency
        let maxMagnitude = 0;
        let peakFrequency = 0;
        const nyquist = this.audioContext.sampleRate / 2;
        
        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > maxMagnitude) {
                maxMagnitude = frequencyData[i];
                peakFrequency = (i / frequencyData.length) * nyquist;
            }
        }

        // Calculate spectral centroid (brightness)
        let weightedSum = 0;
        let magnitudeSum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const frequency = (i / frequencyData.length) * nyquist;
            weightedSum += frequency * frequencyData[i];
            magnitudeSum += frequencyData[i];
        }
        const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

        // Calculate zero crossing rate (for speech detection)
        let zeroCrossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            if ((timeData[i] - 128) * (timeData[i - 1] - 128) < 0) {
                zeroCrossings++;
            }
        }
        const zeroCrossingRate = zeroCrossings / timeData.length;

        // Detect if there's significant audio activity
        const hasActivity = rms > this.settings.noiseThreshold;

        return {
            rms: rms,
            peakFrequency: peakFrequency,
            spectralCentroid: spectralCentroid,
            zeroCrossingRate: zeroCrossingRate,
            hasActivity: hasActivity,
            volume: Math.round(rms * 100), // Percentage
            timestamp: Date.now()
        };
    }

    updateAudioLevels(metrics) {
        // Update audio level display
        const audioLevelElement = document.getElementById('audio-level');
        if (audioLevelElement) {
            audioLevelElement.textContent = `${metrics.volume}%`;
        }

        // Update voice button intensity based on audio level
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton && this.isProcessing) {
            const intensity = metrics.rms;
            voiceButton.style.filter = `brightness(${1 + intensity * 0.5})`;
            
            // Add subtle scale effect based on volume
            if (metrics.hasActivity) {
                const scale = 1 + intensity * 0.05;
                voiceButton.style.transform = `scale(${scale})`;
            } else {
                voiceButton.style.transform = 'scale(1)';
            }
        }

        // Update status based on audio metrics
        this.updateAudioStatus(metrics);
    }

    updateAudioStatus(metrics) {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
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

    detectVoiceActivity(metrics) {
        // Simple voice activity detection based on multiple metrics
        const isVoice = 
            metrics.rms > this.settings.voiceActivityThreshold &&
            metrics.zeroCrossingRate > 0.05 && // Speech has higher zero crossing rate
            metrics.spectralCentroid > 500 && // Speech typically has certain frequency characteristics
            metrics.spectralCentroid < 4000; // But not too high (avoid whistles)

        // Emit voice activity events
        if (isVoice && !this.lastVoiceState) {
            document.dispatchEvent(new CustomEvent('voiceStart'));
        } else if (!isVoice && this.lastVoiceState) {
            document.dispatchEvent(new CustomEvent('voiceEnd'));
        }

        this.lastVoiceState = isVoice;
        return isVoice;
    }

    broadcastAudioData(metrics) {
        // Send audio metrics to other components
        if (window.clapDetection && window.clapDetection.updateAudioLevel) {
            window.clapDetection.updateAudioLevel(metrics.volume);
        }

        // Could also send to visualization components
        document.dispatchEvent(new CustomEvent('audioDataUpdate', {
            detail: metrics
        }));
    }

    processBufferedAudio() {
        if (this.audioBuffer.length === 0) return;

        console.log(`Processing ${this.audioBuffer.length} buffered audio frames`);

        // Analyze the complete audio segment
        const analysis = this.analyzeAudioSegment(this.audioBuffer);
        
        // Could send this analysis to backend for additional processing
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

        // Calculate overall metrics for the audio segment
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

    // Audio recording methods
    async startRecording() {
        try {
            // Request microphone access for recording
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.settings.sampleRate
                }
            });

            // Create media recorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.recordingChunks = [];
            this.recordingMediaRecorder = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordingChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                this.processRecording();
            };

            mediaRecorder.start(100); // Collect data every 100ms
            console.log('Audio recording started');

            return true;

        } catch (error) {
            console.error('Failed to start audio recording:', error);
            this.showError('Не удалось начать запись аудио');
            return false;
        }
    }

    stopRecording() {
        if (this.recordingMediaRecorder && this.recordingMediaRecorder.state === 'recording') {
            this.recordingMediaRecorder.stop();
            console.log('Audio recording stopped');
        }
    }

    async processRecording() {
        if (!this.recordingChunks || this.recordingChunks.length === 0) return;

        // Create blob from recorded chunks
        const audioBlob = new Blob(this.recordingChunks, {
            type: 'audio/webm;codecs=opus'
        });

        // Could send this to backend for processing or save it
        console.log('Recording processed, blob size:', audioBlob.size);

        // Convert to base64 for sending to backend
        const base64Audio = await this.blobToBase64(audioBlob);
        
        if (window.__TAURI__) {
            try {
                await window.__TAURI__.invoke('process_audio_recording', {
                    audioData: base64Audio,
                    format: 'webm'
                });
            } catch (error) {
                console.error('Error sending recording to backend:', error);
            }
        }

        // Clean up
        this.recordingChunks = [];
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]); // Remove data:...;base64, prefix
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Utility methods
    getAudioDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error getting audio devices:', error);
            return [];
        }
    };

    setAudioDevice = async (deviceId) => {
        try {
            if (this.recordingStream) {
                this.recordingStream.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Reinitialize with new device
            this.recordingStream = stream;
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            console.log('Audio device changed to:', deviceId);
            return true;

        } catch (error) {
            console.error('Error setting audio device:', error);
            return false;
        }
    };

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('Audio processor settings updated:', this.settings);
    }

    showError(message) {
        console.error('Audio Processor Error:', message);
        
        // Show in UI
        if (window.showNotification) {
            window.showNotification(message, 'error');
        }
    }

    // Cleanup
    cleanup() {
        this.stopProcessing();
        
        if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('Audio processor cleaned up');
    }

    // Public getters
    isAudioProcessing() {
        return this.isProcessing;
    }

    getAudioMetrics() {
        return this.audioBuffer.length > 0 ? 
            this.audioBuffer[this.audioBuffer.length - 1].metrics : 
            null;
    }
}

// Global notification helper
window.showNotification = function(message, type = 'info') {
    console.log(`Audio Processor Notification (${type}):`, message);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style the toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideIn 0.3s ease;
        max-width: 300px;
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
};

// Add necessary CSS animations
const audioProcessorStyles = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = audioProcessorStyles;
document.head.appendChild(styleSheet);

// Initialize audio processor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.audioProcessor = new AudioProcessor();
    console.log('Audio Processor initialized');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioProcessor;
}