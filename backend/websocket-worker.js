/**
 * Cloudflare Durable Objects WebSocket Handler for ARYV Real-Time Features
 * Supports: Socket.IO-like functionality, real-time chat, live tracking
 */

// Durable Object for managing WebSocket connections
export class ARYVRealtimeServer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.connections = new Map();
    this.rooms = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP requests for real-time API
    if (url.pathname === '/realtime/health') {
      return new Response(JSON.stringify({
        success: true,
        message: 'ARYV Real-time server is running',
        connections: this.connections.size,
        rooms: this.rooms.size,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async handleWebSocket(request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token');

    // Basic authentication check
    if (!userId || !token) {
      return new Response('Authentication required', { status: 401 });
    }

    // Create WebSocket pair
    const [client, server] = Object.values(new WebSocketPair());

    // Store connection
    const connectionId = crypto.randomUUID();
    this.connections.set(connectionId, {
      socket: server,
      userId,
      token,
      rooms: new Set(),
      lastPing: Date.now()
    });

    // Handle WebSocket messages
    server.addEventListener('message', (event) => {
      this.handleMessage(connectionId, event.data);
    });

    // Handle WebSocket close
    server.addEventListener('close', () => {
      this.handleDisconnect(connectionId);
    });

    // Accept WebSocket connection
    server.accept();

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      data: {
        connectionId,
        userId,
        timestamp: new Date().toISOString()
      }
    }));

    // Start ping/pong for keep-alive
    this.startPingPong(connectionId);

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(connectionId, message) {
    try {
      const data = JSON.parse(message);
      const connection = this.connections.get(connectionId);

      if (!connection) return;

      switch (data.type) {
        case 'join_room':
          this.joinRoom(connectionId, data.room);
          break;

        case 'leave_room':
          this.leaveRoom(connectionId, data.room);
          break;

        case 'send_message':
          this.broadcastToRoom(data.room, {
            type: 'message',
            data: {
              userId: connection.userId,
              message: data.message,
              timestamp: new Date().toISOString()
            }
          });
          break;

        case 'location_update':
          this.broadcastToRoom(data.room, {
            type: 'location_update',
            data: {
              userId: connection.userId,
              location: data.location,
              timestamp: new Date().toISOString()
            }
          });
          break;

        case 'ping':
          connection.socket.send(JSON.stringify({ type: 'pong' }));
          connection.lastPing = Date.now();
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  joinRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Add user to room
    connection.rooms.add(roomId);

    // Add room to rooms map
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(connectionId);

    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      data: {
        userId: connection.userId,
        roomId,
        timestamp: new Date().toISOString()
      }
    });
  }

  leaveRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove user from room
    connection.rooms.delete(roomId);

    // Remove from rooms map
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      data: {
        userId: connection.userId,
        roomId,
        timestamp: new Date().toISOString()
      }
    });
  }

  broadcastToRoom(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    room.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(messageStr);
        } catch (error) {
          console.error('Error sending message to connection:', error);
          this.handleDisconnect(connectionId);
        }
      }
    });
  }

  handleDisconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from all rooms
    connection.rooms.forEach(roomId => {
      this.leaveRoom(connectionId, roomId);
    });

    // Remove connection
    this.connections.delete(connectionId);

    console.log(`Connection ${connectionId} disconnected`);
  }

  startPingPong(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Send ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (!this.connections.has(connectionId)) {
        clearInterval(pingInterval);
        return;
      }

      const conn = this.connections.get(connectionId);
      if (conn.socket.readyState === WebSocket.OPEN) {
        // Check if client is still responsive
        if (Date.now() - conn.lastPing > 60000) {
          console.log('Connection timeout, closing');
          conn.socket.close();
          this.handleDisconnect(connectionId);
          clearInterval(pingInterval);
        } else {
          conn.socket.send(JSON.stringify({ type: 'ping' }));
        }
      } else {
        clearInterval(pingInterval);
        this.handleDisconnect(connectionId);
      }
    }, 30000);
  }
}

// Main Worker with WebSocket support
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route WebSocket connections to Durable Object
    if (url.pathname.startsWith('/ws') || request.headers.get('Upgrade') === 'websocket') {
      // Get Durable Object instance
      const durableObjectId = env.ARYV_REALTIME.idFromName('global');
      const durableObject = env.ARYV_REALTIME.get(durableObjectId);
      
      return durableObject.fetch(request);
    }

    // Handle regular HTTP requests (existing API)
    return handleHttpRequest(request, env, ctx);
  }
};

// Import existing HTTP handler
async function handleHttpRequest(request, env, ctx) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === '/health') {
    return new Response(JSON.stringify({
      success: true,
      message: 'ARYV API with WebSocket support is running!',
      timestamp: new Date().toISOString(),
      websocket: true
    }), { headers: corsHeaders });
  }

  // Existing API endpoints (auth, etc.)
  // ... (include your existing API logic here)
  
  return new Response(JSON.stringify({
    success: true,
    message: 'ARYV API with WebSocket support',
    path,
    websocket_available: true,
    timestamp: new Date().toISOString()
  }), { headers: corsHeaders });
}