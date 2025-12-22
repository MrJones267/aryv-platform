/**
 * @fileoverview Socket.io service for real-time features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logInfo, logError, logWarn } from '../utils/logger';
import User from '../models/User';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import { RideStatus, BookingStatus } from '../types';
import { CallType, CallPurpose } from '../models/Call';
import CallService from './CallService';
import GroupChatService from './GroupChatService';

// Commented out unused interface
// interface AuthenticatedSocket extends SocketIOServer {
//   userId?: string;
//   user?: any;
// }

interface LocationUpdate {
  rideId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

interface ChatMessage {
  rideId: string;
  senderId: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'location' | 'system';
}

interface RideStatusUpdate {
  rideId: string;
  status: RideStatus;
  driverId: string;
  timestamp: Date;
}

interface BookingStatusUpdate {
  bookingId: string;
  rideId: string;
  status: BookingStatus;
  passengerId: string;
  timestamp: Date;
}

interface CallSignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
  sessionId: string;
  data: any;
  from: string;
  to: string;
}

interface CallNotification {
  callId: string;
  callType: 'voice' | 'video';
  from: string;
  to: string;
  action: 'initiate' | 'accept' | 'reject' | 'end';
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private userSockets: Map<string, string> = new Map(); // socketId -> userId
  private rideRooms: Map<string, Set<string>> = new Map(); // rideId -> Set of userIds
  private driverLocations: Map<string, LocationUpdate> = new Map(); // rideId -> latest location
  private callService: CallService;
  private activeCalls: Map<string, Set<string>> = new Map(); // callId -> Set of userIds
  private groupChatService: GroupChatService;
  private groupChatRooms: Map<string, Set<string>> = new Map(); // groupChatId -> Set of userIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.callService = new CallService();
    this.groupChatService = new GroupChatService();
    this.setupMiddleware();
    this.setupEventHandlers();

    logInfo('Socket.io service initialized with WebRTC support');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          logWarn('Socket connection attempted without token', { socketId: socket.id });
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as any;
        const user = await User.findByPk(decoded.id);

        if (!user) {
          logWarn('Socket connection attempted with invalid user', { userId: decoded.id });
          return next(new Error('Invalid user'));
        }

        socket.userId = user.id;
        socket.user = user;

        logInfo('Socket authenticated', { userId: user.id, socketId: socket.id });
        next();
      } catch (error) {
        logError('Socket authentication failed', error as Error, { socketId: socket.id });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: any): void {
    const userId = socket.userId;
    const socketId = socket.id;

    // Track connected user
    this.connectedUsers.set(userId, socketId);
    this.userSockets.set(socketId, userId);

    logInfo('User connected via Socket.io', { userId, socketId });

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected to Hitch real-time services',
      userId,
      timestamp: new Date().toISOString(),
    });

    // Set up event handlers
    this.setupSocketEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });
  }

  private setupSocketEventHandlers(socket: any): void {
    // Ride-related events
    socket.on('join_ride', (data: { rideId: string }) => this.handleJoinRide(socket, data));
    socket.on('leave_ride', (data: { rideId: string }) => this.handleLeaveRide(socket, data));
    socket.on('driver_location_update', (data: LocationUpdate) => this.handleDriverLocationUpdate(socket, data));
    socket.on('ride_status_update', (data: RideStatusUpdate) => this.handleRideStatusUpdate(socket, data));
    socket.on('booking_status_update', (data: BookingStatusUpdate) => this.handleBookingStatusUpdate(socket, data));

    // Chat events
    socket.on('send_message', (data: ChatMessage) => this.handleSendMessage(socket, data));
    socket.on('typing_start', (data: { rideId: string }) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data: { rideId: string }) => this.handleTypingStop(socket, data));

    // Call/WebRTC events
    socket.on('call_initiate', (data: CallNotification) => this.handleCallInitiate(socket, data));
    socket.on('call_accept', (data: { callId: string }) => this.handleCallAccept(socket, data));
    socket.on('call_reject', (data: { callId: string, reason?: string }) => this.handleCallReject(socket, data));
    socket.on('call_end', (data: { callId: string, reason?: string }) => this.handleCallEnd(socket, data));
    socket.on('call_signal', (data: CallSignalData) => this.handleCallSignal(socket, data));
    socket.on('join_call', (data: { callId: string }) => this.handleJoinCall(socket, data));
    socket.on('leave_call', (data: { callId: string }) => this.handleLeaveCall(socket, data));

    // Group chat events
    socket.on('join_group_chat', (data: { groupChatId: string }) => this.handleJoinGroupChat(socket, data));
    socket.on('leave_group_chat', (data: { groupChatId: string }) => this.handleLeaveGroupChat(socket, data));
    socket.on('group_typing_start', (data: { groupChatId: string }) => this.handleGroupTypingStart(socket, data));
    socket.on('group_typing_stop', (data: { groupChatId: string }) => this.handleGroupTypingStop(socket, data));
    socket.on('group_message_read', (data: { groupChatId: string, messageId?: string }) => this.handleGroupMessageRead(socket, data));

    // General events
    socket.on('ping', () => socket.emit('pong'));
    socket.on('get_online_users', (data: { rideId: string }) => this.handleGetOnlineUsers(socket, data));
  }

  private async handleJoinRide(socket: any, data: { rideId: string }): Promise<void> {
    try {
      const { rideId } = data;
      const userId = socket.userId;

      // Verify user has access to this ride
      const hasAccess = await this.verifyRideAccess(userId, rideId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this ride' });
        return;
      }

      // Join ride room
      socket.join(`ride:${rideId}`);

      // Track user in ride
      if (!this.rideRooms.has(rideId)) {
        this.rideRooms.set(rideId, new Set());
      }
      this.rideRooms.get(rideId)!.add(userId);

      logInfo('User joined ride room', { userId, rideId });

      // Notify others in the ride
      socket.to(`ride:${rideId}`).emit('user_joined_ride', {
        userId,
        userName: `${socket.user.firstName  } ${  socket.user.lastName}`,
        timestamp: new Date().toISOString(),
      });

      // Send current driver location if available
      const currentLocation = this.driverLocations.get(rideId);
      if (currentLocation) {
        socket.emit('driver_location', currentLocation);
      }

      socket.emit('joined_ride', { rideId, timestamp: new Date().toISOString() });
    } catch (error) {
      logError('Error joining ride', error as Error, { userId: socket.userId, rideId: data.rideId });
      socket.emit('error', { message: 'Failed to join ride' });
    }
  }

  private handleLeaveRide(socket: any, data: { rideId: string }): void {
    const { rideId } = data;
    const userId = socket.userId;

    socket.leave(`ride:${rideId}`);

    // Remove user from ride tracking
    if (this.rideRooms.has(rideId)) {
      this.rideRooms.get(rideId)!.delete(userId);
      if (this.rideRooms.get(rideId)!.size === 0) {
        this.rideRooms.delete(rideId);
      }
    }

    logInfo('User left ride room', { userId, rideId });

    // Notify others in the ride
    socket.to(`ride:${rideId}`).emit('user_left_ride', {
      userId,
      userName: `${socket.user.firstName  } ${  socket.user.lastName}`,
      timestamp: new Date().toISOString(),
    });

    socket.emit('left_ride', { rideId, timestamp: new Date().toISOString() });
  }

  private async handleDriverLocationUpdate(socket: any, data: LocationUpdate): Promise<void> {
    try {
      const userId = socket.userId;
      const { rideId, latitude, longitude, heading, speed } = data;

      // Verify user is the driver of this ride
      const ride = await Ride.findOne({ where: { id: rideId, driverId: userId } });
      if (!ride) {
        socket.emit('error', { message: 'Not authorized to update location for this ride' });
        return;
      }

      const locationUpdate: LocationUpdate = {
        rideId,
        latitude,
        longitude,
        ...(heading !== undefined && { heading }),
        ...(speed !== undefined && { speed }),
        timestamp: new Date(),
      };

      // Store latest location
      this.driverLocations.set(rideId, locationUpdate);

      // Broadcast to all users in the ride
      this.io.to(`ride:${rideId}`).emit('driver_location', locationUpdate);

      logInfo('Driver location updated', { userId, rideId, latitude, longitude });
    } catch (error) {
      logError('Error updating driver location', error as Error, { userId: socket.userId, rideId: data.rideId });
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  private async handleRideStatusUpdate(socket: any, data: RideStatusUpdate): Promise<void> {
    try {
      const userId = socket.userId;
      const { rideId, status } = data;

      // Verify user is the driver of this ride
      const ride = await Ride.findOne({ where: { id: rideId, driverId: userId } });
      if (!ride) {
        socket.emit('error', { message: 'Not authorized to update this ride' });
        return;
      }

      const statusUpdate: RideStatusUpdate = {
        rideId,
        status,
        driverId: userId,
        timestamp: new Date(),
      };

      // Broadcast to all users in the ride
      this.io.to(`ride:${rideId}`).emit('ride_status_update', statusUpdate);

      // Send push notifications to passengers (implementation depends on notification service)
      await this.notifyRideStatusChange(rideId, status);

      logInfo('Ride status updated', { userId, rideId, status });
    } catch (error) {
      logError('Error updating ride status', error as Error, { userId: socket.userId, rideId: data.rideId });
      socket.emit('error', { message: 'Failed to update ride status' });
    }
  }

  private async handleBookingStatusUpdate(socket: any, data: BookingStatusUpdate): Promise<void> {
    try {
      const userId = socket.userId;
      const { bookingId, rideId, status } = data;

      // Verify user has permission to update this booking
      const booking = await Booking.findByPk(bookingId, {
        include: [{ model: Ride, as: 'ride' }],
      });

      if (!booking) {
        socket.emit('error', { message: 'Booking not found' });
        return;
      }

      const isDriver = booking.ride?.driverId === userId;
      const isPassenger = booking.passengerId === userId;

      if (!isDriver && !isPassenger) {
        socket.emit('error', { message: 'Not authorized to update this booking' });
        return;
      }

      const statusUpdate: BookingStatusUpdate = {
        bookingId,
        rideId,
        status,
        passengerId: booking.passengerId,
        timestamp: new Date(),
      };

      // Broadcast to all users in the ride
      this.io.to(`ride:${rideId}`).emit('booking_status_update', statusUpdate);

      // Notify specific users
      if (isDriver) {
        this.io.to(`user:${booking.passengerId}`).emit('booking_status_update', statusUpdate);
      }
      if (isPassenger) {
        this.io.to(`user:${booking.ride?.driverId}`).emit('booking_status_update', statusUpdate);
      }

      logInfo('Booking status updated', { userId, bookingId, rideId, status });
    } catch (error) {
      logError('Error updating booking status', error as Error, { userId: socket.userId, bookingId: data.bookingId });
      socket.emit('error', { message: 'Failed to update booking status' });
    }
  }

  private async handleSendMessage(socket: any, data: ChatMessage): Promise<void> {
    try {
      const userId = socket.userId;
      const { rideId, message, type = 'text' } = data;

      // Verify user has access to this ride
      const hasAccess = await this.verifyRideAccess(userId, rideId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this ride chat' });
        return;
      }

      const chatMessage: ChatMessage = {
        rideId,
        senderId: userId,
        message,
        type,
        timestamp: new Date(),
      };

      // Store message in database (optional - implement if persistent chat is needed)
      // await this.storeChatMessage(chatMessage);

      // Broadcast to all users in the ride
      this.io.to(`ride:${rideId}`).emit('new_message', {
        ...chatMessage,
        senderName: `${socket.user.firstName  } ${  socket.user.lastName}`,
        senderAvatar: socket.user.profileImage,
      });

      logInfo('Chat message sent', { userId, rideId, messageLength: message.length });
    } catch (error) {
      logError('Error sending message', error as Error, { userId: socket.userId, rideId: data.rideId });
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private handleTypingStart(socket: any, data: { rideId: string }): void {
    const { rideId } = data;
    socket.to(`ride:${rideId}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.user.firstName,
      isTyping: true,
    });
  }

  private handleTypingStop(socket: any, data: { rideId: string }): void {
    const { rideId } = data;
    socket.to(`ride:${rideId}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.user.firstName,
      isTyping: false,
    });
  }

  private handleGetOnlineUsers(socket: any, data: { rideId: string }): void {
    const { rideId } = data;
    const usersInRide = this.rideRooms.get(rideId) || new Set();

    socket.emit('online_users', {
      rideId,
      userIds: Array.from(usersInRide),
      count: usersInRide.size,
    });
  }

  // Call/WebRTC handlers
  private async handleCallInitiate(socket: any, data: CallNotification): Promise<void> {
    try {
      const userId = socket.userId;
      const { to, callType } = data;

      // Check if target user is online
      const targetSocketId = this.connectedUsers.get(to);
      if (!targetSocketId) {
        socket.emit('call_error', {
          message: 'User is not online',
          code: 'USER_OFFLINE',
        });
        return;
      }

      // Initiate call through call service
      const result = await this.callService.initiateCall({
        callerId: userId,
        calleeId: to,
        callType: callType === 'video' ? CallType.VIDEO : CallType.VOICE,
        callPurpose: CallPurpose.RIDE_COMMUNICATION,
        metadata: {
          initiatedVia: 'socket',
          userAgent: socket.handshake.headers['user-agent'],
        },
      });

      if (!result.success) {
        socket.emit('call_error', {
          message: result.error,
          code: 'CALL_INITIATION_FAILED',
        });
        return;
      }

      const call = result.call!;
      const sessionId = result.sessionId!;

      // Add participants to call room
      this.activeCalls.set(call.id, new Set([userId, to]));

      // Join both users to call room
      socket.join(`call:${call.id}`);
      this.io.to(`user:${to}`).socketsJoin(`call:${call.id}`);

      // Notify callee about incoming call
      this.io.to(`user:${to}`).emit('incoming_call', {
        callId: call.id,
        sessionId,
        callType: call.callType,
        from: userId,
        caller: {
          id: socket.user.id,
          name: `${socket.user.firstName} ${socket.user.lastName}`,
          avatar: socket.user.profilePicture,
        },
        isEmergency: call.isEmergency,
        timestamp: new Date().toISOString(),
      });

      // Confirm to caller
      socket.emit('call_initiated', {
        callId: call.id,
        sessionId,
        to,
        status: 'ringing',
      });

      logInfo('Call initiated via Socket.io', {
        callId: call.id,
        from: userId,
        to,
        callType: call.callType,
      });

    } catch (error) {
      logError('Error initiating call', error as Error, { userId: socket.userId });
      socket.emit('call_error', { message: 'Failed to initiate call' });
    }
  }

  private async handleCallAccept(socket: any, data: { callId: string }): Promise<void> {
    try {
      const userId = socket.userId;
      const { callId } = data;

      const result = await this.callService.acceptCall(callId, userId);

      if (!result.success) {
        socket.emit('call_error', { message: result.error });
        return;
      }

      // Notify all participants
      this.io.to(`call:${callId}`).emit('call_accepted', {
        callId,
        by: userId,
        timestamp: new Date().toISOString(),
      });

      logInfo('Call accepted via Socket.io', { callId, userId });

    } catch (error) {
      logError('Error accepting call', error as Error, { callId: data.callId, userId: socket.userId });
      socket.emit('call_error', { message: 'Failed to accept call' });
    }
  }

  private async handleCallReject(socket: any, data: { callId: string, reason?: string }): Promise<void> {
    try {
      const userId = socket.userId;
      const { callId, reason } = data;

      const result = await this.callService.rejectCall(callId, userId, reason);

      if (!result.success) {
        socket.emit('call_error', { message: result.error });
        return;
      }

      // Notify all participants and clean up
      this.io.to(`call:${callId}`).emit('call_rejected', {
        callId,
        by: userId,
        reason,
        timestamp: new Date().toISOString(),
      });

      this.cleanupCall(callId);

      logInfo('Call rejected via Socket.io', { callId, userId, reason });

    } catch (error) {
      logError('Error rejecting call', error as Error, { callId: data.callId, userId: socket.userId });
      socket.emit('call_error', { message: 'Failed to reject call' });
    }
  }

  private async handleCallEnd(socket: any, data: { callId: string, reason?: string }): Promise<void> {
    try {
      const userId = socket.userId;
      const { callId, reason } = data;

      const result = await this.callService.endCall(callId, userId, reason);

      if (!result.success) {
        socket.emit('call_error', { message: result.error });
        return;
      }

      // Notify all participants and clean up
      this.io.to(`call:${callId}`).emit('call_ended', {
        callId,
        by: userId,
        reason,
        duration: result.call?.duration,
        timestamp: new Date().toISOString(),
      });

      this.cleanupCall(callId);

      logInfo('Call ended via Socket.io', { callId, userId, reason });

    } catch (error) {
      logError('Error ending call', error as Error, { callId: data.callId, userId: socket.userId });
      socket.emit('call_error', { message: 'Failed to end call' });
    }
  }

  private async handleCallSignal(socket: any, data: CallSignalData): Promise<void> {
    try {
      const userId = socket.userId;

      // Validate signal data
      if (!data.sessionId || !data.type || !data.to) {
        socket.emit('call_error', { message: 'Invalid signal data' });
        return;
      }

      // Ensure sender is authorized for this session
      data.from = userId;

      // Process signaling through call service
      const isValid = await this.callService.handleSignaling(data);

      if (!isValid) {
        socket.emit('call_error', { message: 'Invalid signaling session' });
        return;
      }

      // Forward signal to target user
      this.io.to(`user:${data.to}`).emit('call_signal', {
        ...data,
        timestamp: new Date().toISOString(),
      });

      logInfo('WebRTC signal forwarded', {
        sessionId: data.sessionId,
        type: data.type,
        from: data.from,
        to: data.to,
      });

    } catch (error) {
      logError('Error handling call signal', error as Error, { userId: socket.userId });
      socket.emit('call_error', { message: 'Signal forwarding failed' });
    }
  }

  private handleJoinCall(socket: any, data: { callId: string }): void {
    const { callId } = data;
    const userId = socket.userId;

    // Verify user is part of this call
    const callParticipants = this.activeCalls.get(callId);
    if (!callParticipants || !callParticipants.has(userId)) {
      socket.emit('call_error', { message: 'Access denied to this call' });
      return;
    }

    socket.join(`call:${callId}`);
    socket.emit('joined_call', { callId });

    logInfo('User joined call room', { userId, callId });
  }

  private handleLeaveCall(socket: any, data: { callId: string }): void {
    const { callId } = data;
    const userId = socket.userId;

    socket.leave(`call:${callId}`);
    socket.emit('left_call', { callId });

    logInfo('User left call room', { userId, callId });
  }

  private cleanupCall(callId: string): void {
    // Remove all sockets from call room
    this.io.in(`call:${callId}`).socketsLeave(`call:${callId}`);

    // Remove from active calls tracking
    this.activeCalls.delete(callId);

    logInfo('Call cleanup completed', { callId });
  }

  private handleDisconnection(socket: any, reason: string): void {
    const userId = socket.userId;
    const socketId = socket.id;

    // Clean up user tracking
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socketId);

    // Remove user from all ride rooms
    for (const [rideId, users] of this.rideRooms.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        socket.to(`ride:${rideId}`).emit('user_left_ride', {
          userId,
          userName: `${socket.user?.firstName  } ${  socket.user?.lastName}`,
          timestamp: new Date().toISOString(),
        });

        if (users.size === 0) {
          this.rideRooms.delete(rideId);
        }
      }
    }

    // Handle active calls cleanup
    for (const [callId, participants] of this.activeCalls.entries()) {
      if (participants.has(userId)) {
        // Notify other participants that user disconnected
        socket.to(`call:${callId}`).emit('call_participant_disconnected', {
          callId,
          userId,
          timestamp: new Date().toISOString(),
        });

        // If this was a 1-on-1 call, end it
        if (participants.size === 2) {
          this.io.to(`call:${callId}`).emit('call_ended', {
            callId,
            reason: 'participant_disconnected',
            timestamp: new Date().toISOString(),
          });
          this.cleanupCall(callId);
        } else {
          participants.delete(userId);
        }
      }
    }

    logInfo('User disconnected from Socket.io', { userId, socketId, reason });
  }

  private async verifyRideAccess(userId: string, rideId: string): Promise<boolean> {
    try {
      // Check if user is the driver
      const rideAsDriver = await Ride.findOne({ where: { id: rideId, driverId: userId } });
      if (rideAsDriver) return true;

      // Check if user has a booking for this ride
      const booking = await Booking.findOne({
        where: { rideId, passengerId: userId },
        include: [{ model: Ride, as: 'ride' }],
      });

      return !!booking;
    } catch (error) {
      logError('Error verifying ride access', error as Error, { userId, rideId });
      return false;
    }
  }

  private async notifyRideStatusChange(rideId: string, status: RideStatus): Promise<void> {
    try {
      // Get all passengers for this ride
      const bookings = await Booking.findAll({
        where: { rideId },
        include: [{ model: User, as: 'passenger' }],
      });

      // Send notifications (implementation depends on notification service)
      // This is a placeholder for push notification service integration
      logInfo('Ride status change notification sent', { rideId, status, passengerCount: bookings.length });
    } catch (error) {
      logError('Error sending ride status notifications', error as Error, { rideId, status });
    }
  }

  // Public methods for external use
  public sendToUser(userId: string, event: string, data: any): void {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  public sendToRide(rideId: string, event: string, data: any): void {
    this.io.to(`ride:${rideId}`).emit(event, data);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getRideUsers(rideId: string): string[] {
    const users = this.rideRooms.get(rideId);
    return users ? Array.from(users) : [];
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getActiveRidesCount(): number {
    return this.rideRooms.size;
  }

  // Group chat handler methods
  private async handleJoinGroupChat(socket: any, data: { groupChatId: string }): Promise<void> {
    try {
      const { groupChatId } = data;
      const userId = socket.userId;

      // Verify user is a participant of this group
      const hasAccess = await this.verifyGroupChatAccess(userId, groupChatId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this group chat' });
        return;
      }

      // Join group chat room
      socket.join(`group_${groupChatId}`);

      // Track user in group
      if (!this.groupChatRooms.has(groupChatId)) {
        this.groupChatRooms.set(groupChatId, new Set());
      }
      this.groupChatRooms.get(groupChatId)!.add(userId);

      logInfo('User joined group chat room', { userId, groupChatId });

      // Notify others in the group
      socket.to(`group_${groupChatId}`).emit('user_joined_group', {
        userId,
        userName: `${socket.user.firstName  } ${  socket.user.lastName}`,
        groupChatId,
        timestamp: new Date().toISOString(),
      });

      // Send current online users in the group
      const onlineUsers = this.getGroupChatUsers(groupChatId);
      socket.emit('group_online_users', { groupChatId, users: onlineUsers });

    } catch (error) {
      logError('Error joining group chat room', error as Error, { userId: socket.userId, groupChatId: data.groupChatId });
      socket.emit('error', { message: 'Failed to join group chat' });
    }
  }

  private handleLeaveGroupChat(socket: any, data: { groupChatId: string }): void {
    try {
      const { groupChatId } = data;
      const userId = socket.userId;

      // Leave group chat room
      socket.leave(`group_${groupChatId}`);

      // Remove user from tracking
      const groupUsers = this.groupChatRooms.get(groupChatId);
      if (groupUsers) {
        groupUsers.delete(userId);
        if (groupUsers.size === 0) {
          this.groupChatRooms.delete(groupChatId);
        }
      }

      logInfo('User left group chat room', { userId, groupChatId });

      // Notify others in the group
      socket.to(`group_${groupChatId}`).emit('user_left_group', {
        userId,
        groupChatId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Error leaving group chat room', error as Error, { userId: socket.userId, groupChatId: data.groupChatId });
    }
  }

  private handleGroupTypingStart(socket: any, data: { groupChatId: string }): void {
    const userId = socket.userId;
    const { groupChatId } = data;

    socket.to(`group_${groupChatId}`).emit('group_typing_start', {
      userId,
      userName: socket.user.firstName,
      groupChatId,
      timestamp: new Date().toISOString(),
    });

    logInfo('Group typing started', { userId, groupChatId });
  }

  private handleGroupTypingStop(socket: any, data: { groupChatId: string }): void {
    const userId = socket.userId;
    const { groupChatId } = data;

    socket.to(`group_${groupChatId}`).emit('group_typing_stop', {
      userId,
      groupChatId,
      timestamp: new Date().toISOString(),
    });

    logInfo('Group typing stopped', { userId, groupChatId });
  }

  private async handleGroupMessageRead(socket: any, data: { groupChatId: string, messageId?: string }): Promise<void> {
    try {
      const userId = socket.userId;
      const { groupChatId, messageId } = data;

      // Update read status in database
      await this.groupChatService.markMessagesAsRead(groupChatId, userId, messageId);

      // Notify other group members
      socket.to(`group_${groupChatId}`).emit('group_message_read', {
        userId,
        groupChatId,
        messageId,
        timestamp: new Date().toISOString(),
      });

      logInfo('Group messages marked as read', { userId, groupChatId, messageId });

    } catch (error) {
      logError('Error marking group messages as read', error as Error, { userId: socket.userId, ...data });
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  private async verifyGroupChatAccess(userId: string, groupChatId: string): Promise<boolean> {
    try {
      // Import GroupChatParticipant locally to avoid circular dependency
      const { GroupChatParticipant } = await import('../models/GroupChatParticipant');

      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId,
          userId,
          status: 'active',
        },
      });

      return !!participant;
    } catch (error) {
      logError('Error verifying group chat access', error as Error, { userId, groupChatId });
      return false;
    }
  }

  public getGroupChatUsers(groupChatId: string): string[] {
    const users = this.groupChatRooms.get(groupChatId);
    return users ? Array.from(users) : [];
  }

  public emitToGroup(groupChatId: string, event: string, data: any): void {
    this.io.to(`group_${groupChatId}`).emit(event, data);
  }

  public emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }
}

export default SocketService;
