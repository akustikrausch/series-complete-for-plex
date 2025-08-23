// Audio Generator - Creates notification sounds using Web Audio API
class AudioGenerator {
    constructor() {
        this.audioContext = null;
        this.initContext();
    }

    initContext() {
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    playBeep(frequency = 440, duration = 200, type = 'sine') {
        if (!this.audioContext) return;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        // Envelope
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.3, now + duration / 1000 - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);

        oscillator.start(now);
        oscillator.stop(now + duration / 1000);
    }

    playSuccess() {
        // Pleasant ascending two-tone chime
        this.playBeep(523, 150, 'sine'); // C5
        setTimeout(() => {
            this.playBeep(659, 200, 'sine'); // E5
        }, 150);
    }

    playError() {
        // Low descending tone
        this.playBeep(300, 250, 'sawtooth');
        setTimeout(() => {
            this.playBeep(200, 250, 'sawtooth');
        }, 100);
    }

    playWarning() {
        // Medium repeated beep
        this.playBeep(440, 100, 'square');
        setTimeout(() => {
            this.playBeep(440, 100, 'square');
        }, 150);
    }

    playInfo() {
        // Single soft tone
        this.playBeep(440, 150, 'sine');
    }

    playNotification(type = 'info') {
        switch (type) {
            case 'success':
                this.playSuccess();
                break;
            case 'error':
                this.playError();
                break;
            case 'warning':
                this.playWarning();
                break;
            default:
                this.playInfo();
        }
    }
}

// Create global instance
window.audioGenerator = new AudioGenerator();

// Integrate with WebSocket client when it's ready
document.addEventListener('DOMContentLoaded', () => {
    // Give WebSocket client time to initialize
    setTimeout(() => {
        if (window.wsClient && window.wsClient.playSound) {
            // Store original method
            const originalPlaySound = window.wsClient.playSound.bind(window.wsClient);
            
            // Override with fallback to audio generator
            window.wsClient.playSound = function(type) {
                // Try actual sound file first
                const sound = this.sounds[type];
                if (sound && sound.src) {
                    sound.currentTime = 0;
                    sound.play().catch(() => {
                        // Fallback to generated sound if file fails
                        window.audioGenerator.playNotification(type);
                    });
                } else {
                    // Use generated sound if no file
                    window.audioGenerator.playNotification(type);
                }
            };
        }
    }, 100);
});