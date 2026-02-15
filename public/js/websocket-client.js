// WebSocket Client for Real-time Notifications
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.clientId = null;
        this.connected = false;
        this.notifications = [];
        this.activeTasks = new Map();
        this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        this.init();
    }

    init() {
        this.connect();
        this.createNotificationContainer();
        this.createStatusIndicator();
        this.loadSounds();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('[WebSocket] Connecting to:', wsUrl);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('[WebSocket] Connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.updateStatusIndicator('connected');
                this.showNotification('Connected', 'Real-time updates active', 'success', { duration: 2000 });
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('[WebSocket] Invalid message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('[WebSocket] Disconnected');
                this.connected = false;
                this.updateStatusIndicator('disconnected');
                this.handleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                this.updateStatusIndicator('error');
            };
        } catch (error) {
            console.error('[WebSocket] Connection failed:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            this.showNotification(
                'Connection Lost', 
                'Unable to establish real-time connection. Please refresh the page.', 
                'error',
                { persistent: true }
            );
        }
    }

    handleMessage(data) {
        console.log('[WebSocket] Message:', data);
        
        switch (data.type) {
            case 'connected':
                this.clientId = data.clientId;
                break;
                
            case 'analysis_started':
                this.handleAnalysisStarted(data);
                break;
                
            case 'analysis_progress':
                this.handleAnalysisProgress(data);
                break;
                
            case 'analysis_completed':
                this.handleAnalysisCompleted(data);
                break;
                
            case 'analysis_failed':
                this.handleAnalysisFailed(data);
                break;
                
            case 'background_task_started':
                this.handleBackgroundTaskStarted(data);
                break;
                
            case 'background_task_update':
                this.handleBackgroundTaskUpdate(data);
                break;
                
            case 'background_task_completed':
                this.handleBackgroundTaskCompleted(data);
                break;
                
            case 'notification':
                this.handleNotification(data.notification);
                break;
                
            default:
                console.log('[WebSocket] Unknown message type:', data.type);
        }
    }

    // Analysis handlers
    handleAnalysisStarted(data) {
        this.activeTasks.set(data.taskId, {
            type: 'analysis',
            seriesId: data.seriesId,
            seriesTitle: data.seriesTitle,
            totalEpisodes: data.totalEpisodes,
            progress: 0
        });
        
        this.updateTasksDisplay();
        // Removed individual notification to avoid spam during batch analysis
    }

    handleAnalysisProgress(data) {
        const task = this.activeTasks.get(data.taskId);
        if (task) {
            task.progress = data.progress;
            task.analyzedEpisodes = data.analyzedEpisodes;
            this.updateTasksDisplay();
            this.updateSeriesCardProgress(data.seriesId, data.progress);
        }
    }

    handleAnalysisCompleted(data) {
        this.activeTasks.delete(data.taskId);
        this.updateTasksDisplay();
        
        if (data.notification) {
            this.handleNotification(data.notification);
        }
        
        // Update the series card with new data
        if (window.refreshSeriesCard) {
            window.refreshSeriesCard(data.seriesId);
        }
        
        // Removed sound to avoid spam during batch analysis
    }

    handleAnalysisFailed(data) {
        this.activeTasks.delete(data.taskId);
        this.updateTasksDisplay();
        
        if (data.notification) {
            this.handleNotification(data.notification);
        }
        
        // Removed sound to avoid spam during batch analysis
    }

    // Background task handlers
    handleBackgroundTaskStarted(data) {
        this.activeTasks.set(data.taskId, {
            type: 'background',
            name: data.name,
            description: data.description,
            progress: 0
        });
        this.updateTasksDisplay();
    }

    handleBackgroundTaskUpdate(data) {
        const task = this.activeTasks.get(data.taskId);
        if (task) {
            task.status = data.status;
            if (data.progress !== null) {
                task.progress = data.progress;
            }
            this.updateTasksDisplay();
        }
    }

    handleBackgroundTaskCompleted(data) {
        this.activeTasks.delete(data.taskId);
        this.updateTasksDisplay();
        
        if (data.notification) {
            this.handleNotification(data.notification);
        }
    }

    // Notification handler
    handleNotification(notification) {
        this.showNotification(
            notification.title,
            notification.message,
            notification.type,
            {
                sound: notification.sound,
                duration: notification.duration,
                action: notification.action
            }
        );
    }

    // UI Methods
    createNotificationContainer() {
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-20 right-4 z-50 space-y-2 max-w-sm';
            document.body.appendChild(container);
        }
    }

    createStatusIndicator() {
        if (!document.getElementById('websocket-status')) {
            const indicator = document.createElement('div');
            indicator.id = 'websocket-status';
            indicator.className = 'fixed bottom-4 right-4 flex items-center space-x-2 bg-plex-dark rounded-lg px-3 py-2 shadow-lg z-40';
            indicator.innerHTML = `
                <div id="ws-status-dot" class="w-3 h-3 rounded-full bg-gray-500"></div>
                <span id="ws-status-text" class="text-xs text-plex-light">Connecting...</span>
                <div id="ws-tasks-count" class="hidden ml-2 px-2 py-1 bg-primary-600 rounded text-xs text-plex-dark font-semibold">0</div>
            `;
            document.body.appendChild(indicator);
        }
    }

    updateStatusIndicator(status) {
        const dot = document.getElementById('ws-status-dot');
        const text = document.getElementById('ws-status-text');
        
        if (dot && text) {
            switch (status) {
                case 'connected':
                    dot.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
                    text.textContent = 'Connected';
                    break;
                case 'disconnected':
                    dot.className = 'w-3 h-3 rounded-full bg-yellow-500';
                    text.textContent = 'Reconnecting...';
                    break;
                case 'error':
                    dot.className = 'w-3 h-3 rounded-full bg-red-500';
                    text.textContent = 'Error';
                    break;
            }
        }
    }

    updateTasksDisplay() {
        const tasksCount = document.getElementById('ws-tasks-count');
        if (tasksCount) {
            const count = this.activeTasks.size;
            if (count > 0) {
                tasksCount.textContent = count;
                tasksCount.classList.remove('hidden');
                
                // Create or update tasks tooltip
                this.updateTasksTooltip();
            } else {
                tasksCount.classList.add('hidden');
            }
        }
    }

    updateTasksTooltip() {
        let tooltip = document.getElementById('ws-tasks-tooltip');
        if (!tooltip && this.activeTasks.size > 0) {
            tooltip = document.createElement('div');
            tooltip.id = 'ws-tasks-tooltip';
            tooltip.className = 'fixed bottom-14 right-4 bg-plex-dark rounded-lg p-4 shadow-xl max-w-md hidden';
            document.body.appendChild(tooltip);
            
            // Show on hover
            const statusDiv = document.getElementById('websocket-status');
            if (statusDiv) {
                statusDiv.addEventListener('mouseenter', () => {
                    tooltip.classList.remove('hidden');
                });
                statusDiv.addEventListener('mouseleave', () => {
                    tooltip.classList.add('hidden');
                });
            }
        }
        
        if (tooltip) {
            let html = '<div class="space-y-2">';
            this.activeTasks.forEach((task, id) => {
                if (task.type === 'analysis') {
                    html += `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-plex-white">${task.seriesTitle}</span>
                            <div class="flex items-center space-x-2">
                                <div class="w-20 h-2 bg-plex-gray rounded-full overflow-hidden">
                                    <div class="h-full bg-primary-600 transition-all duration-300" style="width: ${task.progress}%"></div>
                                </div>
                                <span class="text-xs text-plex-light">${task.progress}%</span>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-plex-white">${task.name}</span>
                            <span class="text-xs text-plex-light">${task.status || 'Running'}</span>
                        </div>
                    `;
                }
            });
            html += '</div>';
            tooltip.innerHTML = html;
        }
    }

    updateSeriesCardProgress(seriesId, progress) {
        // Find the series card and update its progress indicator
        const card = document.querySelector(`[data-series-id="${seriesId}"]`);
        if (card) {
            let progressBar = card.querySelector('.ws-progress-bar');
            if (!progressBar) {
                // Create progress bar if it doesn't exist
                const analyzeButton = card.querySelector('button[onclick*="quickAnalyze"]');
                if (analyzeButton) {
                    progressBar = document.createElement('div');
                    progressBar.className = 'ws-progress-bar w-full h-1 bg-plex-gray rounded-full overflow-hidden mt-2';
                    progressBar.innerHTML = `<div class="h-full bg-primary-600 transition-all duration-300" style="width: 0%"></div>`;
                    analyzeButton.parentElement.appendChild(progressBar);
                }
            }
            
            if (progressBar) {
                const fill = progressBar.querySelector('div');
                if (fill) {
                    fill.style.width = `${progress}%`;
                }
                
                // Remove progress bar when complete
                if (progress >= 100) {
                    setTimeout(() => {
                        progressBar.remove();
                    }, 1000);
                }
            }
        }
    }

    showNotification(title, message, type = 'info', options = {}) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const id = `notification-${Date.now()}`;
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `glass-effect rounded-lg p-4 shadow-xl transform transition-all duration-300 translate-x-full`;
        
        // Type-specific styling
        const typeStyles = {
            success: ['border-l-4', 'border-green-500'],
            error: ['border-l-4', 'border-red-500'],
            warning: ['border-l-4', 'border-yellow-500'],
            info: ['border-l-4', 'border-blue-500']
        };
        
        const classes = typeStyles[type] || typeStyles.info;
        notification.classList.add(...classes);
        
        // Build notification HTML
        notification.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <h4 class="font-semibold text-plex-white">${title}</h4>
                    <p class="text-sm text-plex-light mt-1">${message}</p>
                    ${options.action ? `
                        <button data-action="view-details" data-detail-action="${options.action}" class="mt-2 text-xs text-primary-500 hover:text-plex-white transition">
                            View Details →
                        </button>
                    ` : ''}
                </div>
                <button data-action="close-notification" data-notification-id="${id}" class="ml-4 text-plex-light hover:text-plex-white">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full');
        });
        
        // Play sound if requested
        if (options.sound && this.soundEnabled) {
            this.playSound(type);
        }
        
        // Auto-remove unless persistent
        if (!options.persistent) {
            const duration = options.duration || 5000;
            setTimeout(() => {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, duration);
        }
        
        // Add to notifications array
        this.notifications.push({ id, title, message, type, timestamp: new Date() });
        
        // Limit notifications array size
        if (this.notifications.length > 50) {
            this.notifications.shift();
        }
    }

    // Sound methods
    loadSounds() {
        this.sounds = {
            success: new Audio('/sounds/established.mp3'),
            error: new Audio('/sounds/error.mp3'),
            warning: new Audio('/sounds/warning.mp3'),
            info: new Audio('/sounds/info.mp3')
        };
        
        // Set volume
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.3;
        });
    }

    playSound(type) {
        const sound = this.sounds[type] || this.sounds.info;
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.log('[WebSocket] Could not play sound:', error);
            });
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('soundEnabled', this.soundEnabled);
        return this.soundEnabled;
    }

    // Public API
    send(data) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    subscribe(events) {
        this.send({
            type: 'subscribe',
            events: events
        });
    }

    getStatus() {
        return {
            connected: this.connected,
            clientId: this.clientId,
            activeTasks: this.activeTasks.size,
            notifications: this.notifications.length
        };
    }
}

// Initialize WebSocket client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.wsClient = new WebSocketClient();
    console.log('[WebSocket] Client initialized');
});