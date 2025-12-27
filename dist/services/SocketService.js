"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const User_1 = __importDefault(require("../models/User"));
const Ride_1 = __importDefault(require("../models/Ride"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Call_1 = require("../models/Call");
const CallService_1 = __importDefault(require("./CallService"));
const GroupChatService_1 = __importDefault(require("./GroupChatService"));
class SocketService {
    constructor(server) {
        this.connectedUsers = new Map();
        this.userSockets = new Map();
        this.rideRooms = new Map();
        this.driverLocations = new Map();
        this.activeCalls = new Map();
        this.groupChatRooms = new Map();
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });
        this.callService = new CallService_1.default();
        this.groupChatService = new GroupChatService_1.default();
        this.setupMiddleware();
        this.setupEventHandlers();
        (0, logger_1.logInfo)('Socket.io service initialized with WebRTC support');
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                if (!token) {
                    (0, logger_1.logWarn)('Socket connection attempted without token', { socketId: socket.id });
                    return next(new Error('Authentication token required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env['JWT_SECRET']);
                const user = await User_1.default.findByPk(decoded.id);
                if (!user) {
                    (0, logger_1.logWarn)('Socket connection attempted with invalid user', { userId: decoded.id });
                    return next(new Error('Invalid user'));
                }
                socket.userId = user.id;
                socket.user = user;
                (0, logger_1.logInfo)('Socket authenticated', { userId: user.id, socketId: socket.id });
                next();
            }
            catch (error) {
                (0, logger_1.logError)('Socket authentication failed', error, { socketId: socket.id });
                next(new Error('Authentication failed'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        const userId = socket.userId;
        const socketId = socket.id;
        this.connectedUsers.set(userId, socketId);
        this.userSockets.set(socketId, userId);
        (0, logger_1.logInfo)('User connected via Socket.io', { userId, socketId });
        socket.join(`user:${userId}`);
        socket.emit('connected', {
            message: 'Connected to Hitch real-time services',
            userId,
            timestamp: new Date().toISOString(),
        });
        this.setupSocketEventHandlers(socket);
        socket.on('disconnect', (reason) => {
            this.handleDisconnection(socket, reason);
        });
    }
    setupSocketEventHandlers(socket) {
        socket.on('join_ride', (data) => this.handleJoinRide(socket, data));
        socket.on('leave_ride', (data) => this.handleLeaveRide(socket, data));
        socket.on('driver_location_update', (data) => this.handleDriverLocationUpdate(socket, data));
        socket.on('ride_status_update', (data) => this.handleRideStatusUpdate(socket, data));
        socket.on('booking_status_update', (data) => this.handleBookingStatusUpdate(socket, data));
        socket.on('send_message', (data) => this.handleSendMessage(socket, data));
        socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
        socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
        socket.on('call_initiate', (data) => this.handleCallInitiate(socket, data));
        socket.on('call_accept', (data) => this.handleCallAccept(socket, data));
        socket.on('call_reject', (data) => this.handleCallReject(socket, data));
        socket.on('call_end', (data) => this.handleCallEnd(socket, data));
        socket.on('call_signal', (data) => this.handleCallSignal(socket, data));
        socket.on('join_call', (data) => this.handleJoinCall(socket, data));
        socket.on('leave_call', (data) => this.handleLeaveCall(socket, data));
        socket.on('join_group_chat', (data) => this.handleJoinGroupChat(socket, data));
        socket.on('leave_group_chat', (data) => this.handleLeaveGroupChat(socket, data));
        socket.on('group_typing_start', (data) => this.handleGroupTypingStart(socket, data));
        socket.on('group_typing_stop', (data) => this.handleGroupTypingStop(socket, data));
        socket.on('group_message_read', (data) => this.handleGroupMessageRead(socket, data));
        socket.on('ping', () => socket.emit('pong'));
        socket.on('get_online_users', (data) => this.handleGetOnlineUsers(socket, data));
    }
    async handleJoinRide(socket, data) {
        try {
            const { rideId } = data;
            const userId = socket.userId;
            const hasAccess = await this.verifyRideAccess(userId, rideId);
            if (!hasAccess) {
                socket.emit('error', { message: 'Access denied to this ride' });
                return;
            }
            socket.join(`ride:${rideId}`);
            if (!this.rideRooms.has(rideId)) {
                this.rideRooms.set(rideId, new Set());
            }
            this.rideRooms.get(rideId).add(userId);
            (0, logger_1.logInfo)('User joined ride room', { userId, rideId });
            socket.to(`ride:${rideId}`).emit('user_joined_ride', {
                userId,
                userName: `${socket.user.firstName} ${socket.user.lastName}`,
                timestamp: new Date().toISOString(),
            });
            const currentLocation = this.driverLocations.get(rideId);
            if (currentLocation) {
                socket.emit('driver_location', currentLocation);
            }
            socket.emit('joined_ride', { rideId, timestamp: new Date().toISOString() });
        }
        catch (error) {
            (0, logger_1.logError)('Error joining ride', error, { userId: socket.userId, rideId: data.rideId });
            socket.emit('error', { message: 'Failed to join ride' });
        }
    }
    handleLeaveRide(socket, data) {
        const { rideId } = data;
        const userId = socket.userId;
        socket.leave(`ride:${rideId}`);
        if (this.rideRooms.has(rideId)) {
            this.rideRooms.get(rideId).delete(userId);
            if (this.rideRooms.get(rideId).size === 0) {
                this.rideRooms.delete(rideId);
            }
        }
        (0, logger_1.logInfo)('User left ride room', { userId, rideId });
        socket.to(`ride:${rideId}`).emit('user_left_ride', {
            userId,
            userName: `${socket.user.firstName} ${socket.user.lastName}`,
            timestamp: new Date().toISOString(),
        });
        socket.emit('left_ride', { rideId, timestamp: new Date().toISOString() });
    }
    async handleDriverLocationUpdate(socket, data) {
        try {
            const userId = socket.userId;
            const { rideId, latitude, longitude, heading, speed } = data;
            const ride = await Ride_1.default.findOne({ where: { id: rideId, driverId: userId } });
            if (!ride) {
                socket.emit('error', { message: 'Not authorized to update location for this ride' });
                return;
            }
            const locationUpdate = {
                rideId,
                latitude,
                longitude,
                ...(heading !== undefined && { heading }),
                ...(speed !== undefined && { speed }),
                timestamp: new Date(),
            };
            this.driverLocations.set(rideId, locationUpdate);
            this.io.to(`ride:${rideId}`).emit('driver_location', locationUpdate);
            (0, logger_1.logInfo)('Driver location updated', { userId, rideId, latitude, longitude });
        }
        catch (error) {
            (0, logger_1.logError)('Error updating driver location', error, { userId: socket.userId, rideId: data.rideId });
            socket.emit('error', { message: 'Failed to update location' });
        }
    }
    async handleRideStatusUpdate(socket, data) {
        try {
            const userId = socket.userId;
            const { rideId, status } = data;
            const ride = await Ride_1.default.findOne({ where: { id: rideId, driverId: userId } });
            if (!ride) {
                socket.emit('error', { message: 'Not authorized to update this ride' });
                return;
            }
            const statusUpdate = {
                rideId,
                status,
                driverId: userId,
                timestamp: new Date(),
            };
            this.io.to(`ride:${rideId}`).emit('ride_status_update', statusUpdate);
            await this.notifyRideStatusChange(rideId, status);
            (0, logger_1.logInfo)('Ride status updated', { userId, rideId, status });
        }
        catch (error) {
            (0, logger_1.logError)('Error updating ride status', error, { userId: socket.userId, rideId: data.rideId });
            socket.emit('error', { message: 'Failed to update ride status' });
        }
    }
    async handleBookingStatusUpdate(socket, data) {
        try {
            const userId = socket.userId;
            const { bookingId, rideId, status } = data;
            const booking = await Booking_1.default.findByPk(bookingId, {
                include: [{ model: Ride_1.default, as: 'ride' }],
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
            const statusUpdate = {
                bookingId,
                rideId,
                status,
                passengerId: booking.passengerId,
                timestamp: new Date(),
            };
            this.io.to(`ride:${rideId}`).emit('booking_status_update', statusUpdate);
            if (isDriver) {
                this.io.to(`user:${booking.passengerId}`).emit('booking_status_update', statusUpdate);
            }
            if (isPassenger) {
                this.io.to(`user:${booking.ride?.driverId}`).emit('booking_status_update', statusUpdate);
            }
            (0, logger_1.logInfo)('Booking status updated', { userId, bookingId, rideId, status });
        }
        catch (error) {
            (0, logger_1.logError)('Error updating booking status', error, { userId: socket.userId, bookingId: data.bookingId });
            socket.emit('error', { message: 'Failed to update booking status' });
        }
    }
    async handleSendMessage(socket, data) {
        try {
            const userId = socket.userId;
            const { rideId, message, type = 'text' } = data;
            const hasAccess = await this.verifyRideAccess(userId, rideId);
            if (!hasAccess) {
                socket.emit('error', { message: 'Access denied to this ride chat' });
                return;
            }
            const chatMessage = {
                rideId,
                senderId: userId,
                message,
                type,
                timestamp: new Date(),
            };
            this.io.to(`ride:${rideId}`).emit('new_message', {
                ...chatMessage,
                senderName: `${socket.user.firstName} ${socket.user.lastName}`,
                senderAvatar: socket.user.profileImage,
            });
            (0, logger_1.logInfo)('Chat message sent', { userId, rideId, messageLength: message.length });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending message', error, { userId: socket.userId, rideId: data.rideId });
            socket.emit('error', { message: 'Failed to send message' });
        }
    }
    handleTypingStart(socket, data) {
        const { rideId } = data;
        socket.to(`ride:${rideId}`).emit('user_typing', {
            userId: socket.userId,
            userName: socket.user.firstName,
            isTyping: true,
        });
    }
    handleTypingStop(socket, data) {
        const { rideId } = data;
        socket.to(`ride:${rideId}`).emit('user_typing', {
            userId: socket.userId,
            userName: socket.user.firstName,
            isTyping: false,
        });
    }
    handleGetOnlineUsers(socket, data) {
        const { rideId } = data;
        const usersInRide = this.rideRooms.get(rideId) || new Set();
        socket.emit('online_users', {
            rideId,
            userIds: Array.from(usersInRide),
            count: usersInRide.size,
        });
    }
    async handleCallInitiate(socket, data) {
        try {
            const userId = socket.userId;
            const { to, callType } = data;
            const targetSocketId = this.connectedUsers.get(to);
            if (!targetSocketId) {
                socket.emit('call_error', {
                    message: 'User is not online',
                    code: 'USER_OFFLINE',
                });
                return;
            }
            const result = await this.callService.initiateCall({
                callerId: userId,
                calleeId: to,
                callType: callType === 'video' ? Call_1.CallType.VIDEO : Call_1.CallType.VOICE,
                callPurpose: Call_1.CallPurpose.RIDE_COMMUNICATION,
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
            const call = result.call;
            const sessionId = result.sessionId;
            this.activeCalls.set(call.id, new Set([userId, to]));
            socket.join(`call:${call.id}`);
            this.io.to(`user:${to}`).socketsJoin(`call:${call.id}`);
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
            socket.emit('call_initiated', {
                callId: call.id,
                sessionId,
                to,
                status: 'ringing',
            });
            (0, logger_1.logInfo)('Call initiated via Socket.io', {
                callId: call.id,
                from: userId,
                to,
                callType: call.callType,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error initiating call', error, { userId: socket.userId });
            socket.emit('call_error', { message: 'Failed to initiate call' });
        }
    }
    async handleCallAccept(socket, data) {
        try {
            const userId = socket.userId;
            const { callId } = data;
            const result = await this.callService.acceptCall(callId, userId);
            if (!result.success) {
                socket.emit('call_error', { message: result.error });
                return;
            }
            this.io.to(`call:${callId}`).emit('call_accepted', {
                callId,
                by: userId,
                timestamp: new Date().toISOString(),
            });
            (0, logger_1.logInfo)('Call accepted via Socket.io', { callId, userId });
        }
        catch (error) {
            (0, logger_1.logError)('Error accepting call', error, { callId: data.callId, userId: socket.userId });
            socket.emit('call_error', { message: 'Failed to accept call' });
        }
    }
    async handleCallReject(socket, data) {
        try {
            const userId = socket.userId;
            const { callId, reason } = data;
            const result = await this.callService.rejectCall(callId, userId, reason);
            if (!result.success) {
                socket.emit('call_error', { message: result.error });
                return;
            }
            this.io.to(`call:${callId}`).emit('call_rejected', {
                callId,
                by: userId,
                reason,
                timestamp: new Date().toISOString(),
            });
            this.cleanupCall(callId);
            (0, logger_1.logInfo)('Call rejected via Socket.io', { callId, userId, reason });
        }
        catch (error) {
            (0, logger_1.logError)('Error rejecting call', error, { callId: data.callId, userId: socket.userId });
            socket.emit('call_error', { message: 'Failed to reject call' });
        }
    }
    async handleCallEnd(socket, data) {
        try {
            const userId = socket.userId;
            const { callId, reason } = data;
            const result = await this.callService.endCall(callId, userId, reason);
            if (!result.success) {
                socket.emit('call_error', { message: result.error });
                return;
            }
            this.io.to(`call:${callId}`).emit('call_ended', {
                callId,
                by: userId,
                reason,
                duration: result.call?.duration,
                timestamp: new Date().toISOString(),
            });
            this.cleanupCall(callId);
            (0, logger_1.logInfo)('Call ended via Socket.io', { callId, userId, reason });
        }
        catch (error) {
            (0, logger_1.logError)('Error ending call', error, { callId: data.callId, userId: socket.userId });
            socket.emit('call_error', { message: 'Failed to end call' });
        }
    }
    async handleCallSignal(socket, data) {
        try {
            const userId = socket.userId;
            if (!data.sessionId || !data.type || !data.to) {
                socket.emit('call_error', { message: 'Invalid signal data' });
                return;
            }
            data.from = userId;
            const isValid = await this.callService.handleSignaling(data);
            if (!isValid) {
                socket.emit('call_error', { message: 'Invalid signaling session' });
                return;
            }
            this.io.to(`user:${data.to}`).emit('call_signal', {
                ...data,
                timestamp: new Date().toISOString(),
            });
            (0, logger_1.logInfo)('WebRTC signal forwarded', {
                sessionId: data.sessionId,
                type: data.type,
                from: data.from,
                to: data.to,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error handling call signal', error, { userId: socket.userId });
            socket.emit('call_error', { message: 'Signal forwarding failed' });
        }
    }
    handleJoinCall(socket, data) {
        const { callId } = data;
        const userId = socket.userId;
        const callParticipants = this.activeCalls.get(callId);
        if (!callParticipants || !callParticipants.has(userId)) {
            socket.emit('call_error', { message: 'Access denied to this call' });
            return;
        }
        socket.join(`call:${callId}`);
        socket.emit('joined_call', { callId });
        (0, logger_1.logInfo)('User joined call room', { userId, callId });
    }
    handleLeaveCall(socket, data) {
        const { callId } = data;
        const userId = socket.userId;
        socket.leave(`call:${callId}`);
        socket.emit('left_call', { callId });
        (0, logger_1.logInfo)('User left call room', { userId, callId });
    }
    cleanupCall(callId) {
        this.io.in(`call:${callId}`).socketsLeave(`call:${callId}`);
        this.activeCalls.delete(callId);
        (0, logger_1.logInfo)('Call cleanup completed', { callId });
    }
    handleDisconnection(socket, reason) {
        const userId = socket.userId;
        const socketId = socket.id;
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socketId);
        for (const [rideId, users] of this.rideRooms.entries()) {
            if (users.has(userId)) {
                users.delete(userId);
                socket.to(`ride:${rideId}`).emit('user_left_ride', {
                    userId,
                    userName: `${socket.user?.firstName} ${socket.user?.lastName}`,
                    timestamp: new Date().toISOString(),
                });
                if (users.size === 0) {
                    this.rideRooms.delete(rideId);
                }
            }
        }
        for (const [callId, participants] of this.activeCalls.entries()) {
            if (participants.has(userId)) {
                socket.to(`call:${callId}`).emit('call_participant_disconnected', {
                    callId,
                    userId,
                    timestamp: new Date().toISOString(),
                });
                if (participants.size === 2) {
                    this.io.to(`call:${callId}`).emit('call_ended', {
                        callId,
                        reason: 'participant_disconnected',
                        timestamp: new Date().toISOString(),
                    });
                    this.cleanupCall(callId);
                }
                else {
                    participants.delete(userId);
                }
            }
        }
        (0, logger_1.logInfo)('User disconnected from Socket.io', { userId, socketId, reason });
    }
    async verifyRideAccess(userId, rideId) {
        try {
            const rideAsDriver = await Ride_1.default.findOne({ where: { id: rideId, driverId: userId } });
            if (rideAsDriver)
                return true;
            const booking = await Booking_1.default.findOne({
                where: { rideId, passengerId: userId },
                include: [{ model: Ride_1.default, as: 'ride' }],
            });
            return !!booking;
        }
        catch (error) {
            (0, logger_1.logError)('Error verifying ride access', error, { userId, rideId });
            return false;
        }
    }
    async notifyRideStatusChange(rideId, status) {
        try {
            const bookings = await Booking_1.default.findAll({
                where: { rideId },
                include: [{ model: User_1.default, as: 'passenger' }],
            });
            (0, logger_1.logInfo)('Ride status change notification sent', { rideId, status, passengerCount: bookings.length });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending ride status notifications', error, { rideId, status });
        }
    }
    sendToUser(userId, event, data) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(`user:${userId}`).emit(event, data);
        }
    }
    sendToRide(rideId, event, data) {
        this.io.to(`ride:${rideId}`).emit(event, data);
    }
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    getRideUsers(rideId) {
        const users = this.rideRooms.get(rideId);
        return users ? Array.from(users) : [];
    }
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    getActiveRidesCount() {
        return this.rideRooms.size;
    }
    async handleJoinGroupChat(socket, data) {
        try {
            const { groupChatId } = data;
            const userId = socket.userId;
            const hasAccess = await this.verifyGroupChatAccess(userId, groupChatId);
            if (!hasAccess) {
                socket.emit('error', { message: 'Access denied to this group chat' });
                return;
            }
            socket.join(`group_${groupChatId}`);
            if (!this.groupChatRooms.has(groupChatId)) {
                this.groupChatRooms.set(groupChatId, new Set());
            }
            this.groupChatRooms.get(groupChatId).add(userId);
            (0, logger_1.logInfo)('User joined group chat room', { userId, groupChatId });
            socket.to(`group_${groupChatId}`).emit('user_joined_group', {
                userId,
                userName: `${socket.user.firstName} ${socket.user.lastName}`,
                groupChatId,
                timestamp: new Date().toISOString(),
            });
            const onlineUsers = this.getGroupChatUsers(groupChatId);
            socket.emit('group_online_users', { groupChatId, users: onlineUsers });
        }
        catch (error) {
            (0, logger_1.logError)('Error joining group chat room', error, { userId: socket.userId, groupChatId: data.groupChatId });
            socket.emit('error', { message: 'Failed to join group chat' });
        }
    }
    handleLeaveGroupChat(socket, data) {
        try {
            const { groupChatId } = data;
            const userId = socket.userId;
            socket.leave(`group_${groupChatId}`);
            const groupUsers = this.groupChatRooms.get(groupChatId);
            if (groupUsers) {
                groupUsers.delete(userId);
                if (groupUsers.size === 0) {
                    this.groupChatRooms.delete(groupChatId);
                }
            }
            (0, logger_1.logInfo)('User left group chat room', { userId, groupChatId });
            socket.to(`group_${groupChatId}`).emit('user_left_group', {
                userId,
                groupChatId,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error leaving group chat room', error, { userId: socket.userId, groupChatId: data.groupChatId });
        }
    }
    handleGroupTypingStart(socket, data) {
        const userId = socket.userId;
        const { groupChatId } = data;
        socket.to(`group_${groupChatId}`).emit('group_typing_start', {
            userId,
            userName: socket.user.firstName,
            groupChatId,
            timestamp: new Date().toISOString(),
        });
        (0, logger_1.logInfo)('Group typing started', { userId, groupChatId });
    }
    handleGroupTypingStop(socket, data) {
        const userId = socket.userId;
        const { groupChatId } = data;
        socket.to(`group_${groupChatId}`).emit('group_typing_stop', {
            userId,
            groupChatId,
            timestamp: new Date().toISOString(),
        });
        (0, logger_1.logInfo)('Group typing stopped', { userId, groupChatId });
    }
    async handleGroupMessageRead(socket, data) {
        try {
            const userId = socket.userId;
            const { groupChatId, messageId } = data;
            await this.groupChatService.markMessagesAsRead(groupChatId, userId, messageId);
            socket.to(`group_${groupChatId}`).emit('group_message_read', {
                userId,
                groupChatId,
                messageId,
                timestamp: new Date().toISOString(),
            });
            (0, logger_1.logInfo)('Group messages marked as read', { userId, groupChatId, messageId });
        }
        catch (error) {
            (0, logger_1.logError)('Error marking group messages as read', error, { userId: socket.userId, ...data });
            socket.emit('error', { message: 'Failed to mark messages as read' });
        }
    }
    async verifyGroupChatAccess(userId, groupChatId) {
        try {
            const { GroupChatParticipant } = await Promise.resolve().then(() => __importStar(require('../models/GroupChatParticipant')));
            const participant = await GroupChatParticipant.findOne({
                where: {
                    groupChatId,
                    userId,
                    status: 'active',
                },
            });
            return !!participant;
        }
        catch (error) {
            (0, logger_1.logError)('Error verifying group chat access', error, { userId, groupChatId });
            return false;
        }
    }
    getGroupChatUsers(groupChatId) {
        const users = this.groupChatRooms.get(groupChatId);
        return users ? Array.from(users) : [];
    }
    emitToGroup(groupChatId, event, data) {
        this.io.to(`group_${groupChatId}`).emit(event, data);
    }
    emitToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
    }
}
exports.SocketService = SocketService;
exports.default = SocketService;
//# sourceMappingURL=SocketService.js.map