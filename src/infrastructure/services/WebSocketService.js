/**
 * WebSocket Service
 * Handles real-time communication with clients
 *
 * Part of Infrastructure Layer - Clean Architecture
 */
const WebSocket = require('ws');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.analysisProgress = new Map();
    this.backgroundTasks = new Map();
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    if (this.wss) {
      console.log('[WebSocket] Already initialized');
      return;
    }

    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws, req) => this._handleConnection(ws, req));

    this._startHeartbeat();

    console.log('[WebSocket] Service initialized');
  }

  /**
   * Handle new client connection
   * @private
   */
  _handleConnection(ws, req) {
    const clientId = this._generateClientId();
    this.clients.set(clientId, {
      ws,
      alive: true,
      connectedAt: new Date(),
      ip: req.socket.remoteAddress,
      subscriptions: []
    });

    console.log(`[WebSocket] Client connected: ${clientId}`);

    // Send connection confirmation
    this._sendToClient(clientId, {
      type: 'connected',
      clientId,
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    });

    // Send current analysis status
    if (this.analysisProgress.size > 0) {
      this._sendToClient(clientId, {
        type: 'analysis_status',
        tasks: Array.from(this.analysisProgress.entries()).map(([id, progress]) => ({
          id,
          ...progress
        }))
      });
    }

    // Setup event handlers
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) client.alive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this._handleClientMessage(clientId, data);
      } catch (error) {
        console.error('[WebSocket] Invalid message:', error.message);
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Client error (${clientId}):`, error.message);
      this.clients.delete(clientId);
    });
  }

  /**
   * Handle message from client
   * @private
   */
  _handleClientMessage(clientId, data) {
    switch (data.type) {
      case 'ping':
        this._sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      case 'subscribe':
        const client = this.clients.get(clientId);
        if (client) {
          client.subscriptions = data.events || [];
        }
        break;
      default:
        console.log(`[WebSocket] Unknown message type: ${data.type}`);
    }
  }

  /**
   * Start heartbeat to detect dead connections
   * @private
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
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
    }, 30000);
  }

  /**
   * Generate unique client ID
   * @private
   */
  _generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send message to specific client
   * @private
   */
  _sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} data - Message data
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Broadcast to clients with specific subscription
   * @param {string} event - Event name
   * @param {Object} data - Message data
   */
  broadcastToSubscribers(event, data) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN &&
          (!client.subscriptions.length || client.subscriptions.includes(event))) {
        client.ws.send(JSON.stringify({ ...data, event }));
      }
    });
  }

  // === Analysis Progress Methods ===

  /**
   * Start tracking analysis progress
   * @param {string} seriesId - Series ID
   * @param {string} seriesTitle - Series title
   * @param {number} totalEpisodes - Total episodes
   * @returns {string} Task ID
   */
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
      timestamp: new Date().toISOString()
    });

    return taskId;
  }

  /**
   * Update analysis progress
   * @param {string} taskId - Task ID
   * @param {number} analyzedEpisodes - Episodes analyzed
   * @param {Object} additionalData - Additional data
   */
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
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Complete analysis
   * @param {string} taskId - Task ID
   * @param {Object} result - Analysis result
   */
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
      timestamp: new Date().toISOString()
    });

    setTimeout(() => {
      this.analysisProgress.delete(taskId);
    }, 5000);
  }

  /**
   * Fail analysis
   * @param {string} taskId - Task ID
   * @param {Error|string} error - Error
   */
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
      timestamp: new Date().toISOString()
    });

    this.analysisProgress.delete(taskId);
  }

  // === Notification Methods ===

  /**
   * Send notification to all clients
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {Object} options - Additional options
   */
  sendNotification(title, message, type = 'info', options = {}) {
    this.broadcast({
      type: 'notification',
      notification: {
        title,
        message,
        type,
        sound: options.sound || false,
        duration: options.duration || 5000,
        action: options.action || null
      },
      timestamp: new Date().toISOString()
    });
  }

  // === Status Methods ===

  /**
   * Get service status
   * @returns {Object} Status information
   */
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

  /**
   * Shutdown the service
   */
  async shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[WebSocket] Service shutdown complete');
  }
}

module.exports = WebSocketService;
