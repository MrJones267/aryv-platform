/**
 * Simple WebSocket Service for ARYV Real-time Features
 * Compatible with Cloudflare Durable Objects WebSocket implementation
 */

interface WebSocketMessage {
  type: string;
  data?: any;
  room?: string;
  message?: string;
  location?: any;
}

class SimpleWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Function[]> = new Map();

  private getWebSocketUrl(): string {
    // Use the deployed WebSocket server
    return __DEV__ 
      ? 'wss://aryv-api-websocket.majokoobo.workers.dev/ws'
      : 'wss://aryv-api-websocket.majokoobo.workers.dev/ws';
  }

  async connect(userId: string, token: string): Promise<boolean> {
    try {
      if (this.isConnected) {
        console.log('WebSocket already connected');
        return true;
      }

      const wsUrl = `${this.getWebSocketUrl()}?userId=${userId}&token=${token}`;
      console.log('Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Start ping/pong for keep-alive
          this.startPingPong();
          
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          
          if (this.reconnectAttempts === 0) {
            reject(new Error('WebSocket connection failed'));
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.attemptReconnect(userId, token);
        };

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      return false;
    }
  }

  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Handle ping/pong
      if (message.type === 'ping') {
        this.send({ type: 'pong' });
        return;
      }

      // Emit to registered handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      handlers.forEach(handler => {
        try {
          handler(message.data || message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private send(message: WebSocketMessage) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  // Join a room for group communications
  joinRoom(roomId: string) {
    this.send({
      type: 'join_room',
      room: roomId
    });
  }

  // Leave a room
  leaveRoom(roomId: string) {
    this.send({
      type: 'leave_room', 
      room: roomId
    });
  }

  // Send a chat message to a room
  sendMessage(roomId: string, message: string) {
    this.send({
      type: 'send_message',
      room: roomId,
      message
    });
  }

  // Send location update
  sendLocationUpdate(roomId: string, location: any) {
    this.send({
      type: 'location_update',
      room: roomId,
      location
    });
  }

  // Register message handler
  on(messageType: string, handler: Function) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  // Remove message handler
  off(messageType: string, handler: Function) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private startPingPong() {
    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  private attemptReconnect(userId: string, token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect(userId, token);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.messageHandlers.clear();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const webSocketService = new SimpleWebSocketService();
export default webSocketService;