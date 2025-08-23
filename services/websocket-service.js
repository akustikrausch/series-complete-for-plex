// WebSocket Service for Real-time Notifications
const WebSocket = require('ws');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map();
        this.analysisProgress = new Map();
        this.backgroundTasks = new Map();
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws',
            clientTracking: true
        });

        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, {
                ws,
                alive: true,
                connectedAt: new Date(),
                ip: req.socket.remoteAddress
            });

            console.log(`[WebSocket] Client connected: ${clientId}`);

            // Send initial connection confirmation
            this.sendToClient(clientId, {
                type: 'connected',
                clientId,
                message: 'WebSocket connection established',
                timestamp: new Date()
            });

            // Send current analysis status if any
            if (this.analysisProgress.size > 0) {
                this.sendToClient(clientId, {
                    type: 'analysis_status',
                    tasks: Array.from(this.analysisProgress.entries()).map(([id, progress]) => ({
                        id,
                        ...progress
                    }))
                });
            }

            // Setup heartbeat
            ws.on('pong', () => {
                const client = this.clients.get(clientId);
                if (client) client.alive = true;
            });

            // Handle messages from client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(clientId, data);
                } catch (error) {
                    console.error('[WebSocket] Invalid message:', error);
                }
            });

            // Handle disconnection
            ws.on('close', () => {
                console.log(`[WebSocket] Client disconnected: ${clientId}`);
                this.clients.delete(clientId);
            });

            ws.on('error', (error) => {
                console.error(`[WebSocket] Client error (${clientId}):`, error);
                this.clients.delete(clientId);
            });
        });

        // Setup heartbeat interval
        this.startHeartbeat();

        console.log('[WebSocket] Service initialized');
    }

    handleClientMessage(clientId, data) {
        switch (data.type) {
            case 'ping':
                this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
                break;
            case 'subscribe':
                // Client subscribing to specific events
                const client = this.clients.get(clientId);
                if (client) {
                    client.subscriptions = data.events || [];
                }
                break;
            default:
                console.log(`[WebSocket] Unknown message type: ${data.type}`);
        }
    }

    startHeartbeat() {
        setInterval(() => {
            this.clients.forEach((client, clientId) => {
                if (!client.alive) {
                    console.log(`[WebSocket] Removing inactive client: ${clientId}`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                    return;
                }
                
                client.alive = false;
                client.ws.ping();
            });
        }, 30000); // 30 seconds
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Send message to specific client
    sendToClient(clientId, data) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(data));
        }
    }

    // Broadcast to all connected clients
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }

    // Broadcast to clients with specific subscription
    broadcastToSubscribers(event, data) {
        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN && 
                (!client.subscriptions || client.subscriptions.includes(event))) {
                client.ws.send(JSON.stringify({ ...data, event }));
            }
        });
    }

    // === Analysis Progress Methods ===

    startAnalysis(seriesId, seriesTitle, totalEpisodes) {
        const taskId = `analysis_${seriesId}_${Date.now()}`;
        this.analysisProgress.set(taskId, {
            seriesId,
            seriesTitle,
            totalEpisodes,
            analyzedEpisodes: 0,
            startTime: new Date(),
            status: 'running',
            progress: 0
        });

        this.broadcast({
            type: 'analysis_started',
            taskId,
            seriesId,
            seriesTitle,
            totalEpisodes,
            timestamp: new Date()
        });

        return taskId;
    }

    updateAnalysisProgress(taskId, analyzedEpisodes, additionalData = {}) {
        const task = this.analysisProgress.get(taskId);
        if (!task) return;

        task.analyzedEpisodes = analyzedEpisodes;
        task.progress = Math.round((analyzedEpisodes / task.totalEpisodes) * 100);
        Object.assign(task, additionalData);

        this.broadcast({
            type: 'analysis_progress',
            taskId,
            seriesId: task.seriesId,
            seriesTitle: task.seriesTitle,
            progress: task.progress,
            analyzedEpisodes,
            totalEpisodes: task.totalEpisodes,
            timestamp: new Date()
        });
    }

    completeAnalysis(taskId, result) {
        const task = this.analysisProgress.get(taskId);
        if (!task) return;

        task.status = 'completed';
        task.endTime = new Date();
        task.duration = task.endTime - task.startTime;
        task.result = result;

        this.broadcast({
            type: 'analysis_completed',
            taskId,
            seriesId: task.seriesId,
            seriesTitle: task.seriesTitle,
            duration: task.duration,
            result,
            timestamp: new Date()
            // Removed notification to avoid spam during batch analysis
        });

        // Remove from active tasks after a delay
        setTimeout(() => {
            this.analysisProgress.delete(taskId);
        }, 5000);
    }

    failAnalysis(taskId, error) {
        const task = this.analysisProgress.get(taskId);
        if (!task) return;

        task.status = 'failed';
        task.error = error;

        this.broadcast({
            type: 'analysis_failed',
            taskId,
            seriesId: task.seriesId,
            seriesTitle: task.seriesTitle,
            error: error.message || error,
            timestamp: new Date()
            // Removed notification to avoid spam during batch analysis
        });

        this.analysisProgress.delete(taskId);
    }

    // === Background Task Methods ===

    registerBackgroundTask(name, description) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.backgroundTasks.set(taskId, {
            name,
            description,
            status: 'running',
            startTime: new Date()
        });

        this.broadcast({
            type: 'background_task_started',
            taskId,
            name,
            description,
            timestamp: new Date()
        });

        return taskId;
    }

    updateBackgroundTask(taskId, status, progress = null) {
        const task = this.backgroundTasks.get(taskId);
        if (!task) return;

        task.status = status;
        if (progress !== null) task.progress = progress;

        this.broadcast({
            type: 'background_task_update',
            taskId,
            name: task.name,
            status,
            progress,
            timestamp: new Date()
        });
    }

    completeBackgroundTask(taskId, result = null) {
        const task = this.backgroundTasks.get(taskId);
        if (!task) return;

        task.status = 'completed';
        task.endTime = new Date();
        task.result = result;

        this.broadcast({
            type: 'background_task_completed',
            taskId,
            name: task.name,
            result,
            duration: task.endTime - task.startTime,
            timestamp: new Date(),
            notification: {
                title: 'Task Complete',
                message: `${task.name} finished successfully`,
                type: 'success',
                sound: true
            }
        });

        this.backgroundTasks.delete(taskId);
    }

    // === Notification Methods ===

    sendNotification(title, message, type = 'info', options = {}) {
        this.broadcast({
            type: 'notification',
            notification: {
                title,
                message,
                type, // success, error, warning, info
                sound: options.sound || false,
                duration: options.duration || 5000,
                action: options.action || null
            },
            timestamp: new Date()
        });
    }

    // === Status Methods ===

    getStatus() {
        return {
            connected: this.clients.size,
            activeTasks: this.analysisProgress.size,
            backgroundTasks: this.backgroundTasks.size,
            clients: Array.from(this.clients.entries()).map(([id, client]) => ({
                id,
                connectedAt: client.connectedAt,
                alive: client.alive
            }))
        };
    }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;