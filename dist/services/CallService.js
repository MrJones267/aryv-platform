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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallService = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Call_1 = __importStar(require("../models/Call"));
const models_1 = require("../models");
const NotificationService_1 = require("./NotificationService");
const logger_1 = require("../utils/logger");
class CallService {
    constructor() {
        this.activeSessions = new Map();
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async initiateCall(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            if (request.callerId === request.calleeId) {
                throw new Error('Cannot call yourself');
            }
            const [caller, callee] = await Promise.all([
                models_1.User.findByPk(request.callerId, { transaction }),
                models_1.User.findByPk(request.calleeId, { transaction }),
            ]);
            if (!caller || !callee) {
                throw new Error('Invalid caller or callee');
            }
            const activeCall = await this.getActiveCallForUser(request.callerId);
            if (activeCall) {
                throw new Error('User is already in an active call');
            }
            const calleeActiveCall = await this.getActiveCallForUser(request.calleeId);
            if (calleeActiveCall) {
                throw new Error('Callee is busy in another call');
            }
            const call = await Call_1.default.create({
                callerId: request.callerId,
                calleeId: request.calleeId,
                callType: request.callType,
                callPurpose: request.callPurpose,
                rideId: request.rideId,
                deliveryId: request.deliveryId,
                isEmergency: request.isEmergency || false,
                recordingEnabled: this.shouldEnableRecording(request),
                status: 'INITIATED',
                metadata: {
                    ...request.metadata,
                    initiatedFrom: 'mobile_app',
                    timestamp: new Date().toISOString(),
                },
            }, { transaction });
            const sessionId = `call_${call.id}_${Date.now()}`;
            const session = {
                id: sessionId,
                callId: call.id,
                participants: [request.callerId, request.calleeId],
                createdAt: new Date(),
                isActive: true,
            };
            this.activeSessions.set(sessionId, session);
            await transaction.commit();
            await this.sendCallNotifications(call, caller, callee);
            (0, logger_1.logInfo)('Call initiated successfully', {
                callId: call.id,
                sessionId,
                callerId: request.callerId,
                calleeId: request.calleeId,
                callType: request.callType,
            });
            return {
                success: true,
                call,
                sessionId,
            };
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Error initiating call', error, {
                callerId: request.callerId,
                calleeId: request.calleeId,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async acceptCall(callId, userId) {
        try {
            const call = await Call_1.default.findByPk(callId);
            if (!call) {
                throw new Error('Call not found');
            }
            if (call.calleeId !== userId) {
                throw new Error('Only the callee can accept the call');
            }
            if (call.status !== Call_1.CallStatus.INITIATED && call.status !== Call_1.CallStatus.RINGING) {
                throw new Error(`Cannot accept call in status: ${call.status}`);
            }
            await call.update({
                status: Call_1.CallStatus.ACCEPTED,
                startedAt: new Date(),
            });
            await this.notifyCallStatusChange(call, 'accepted');
            (0, logger_1.logInfo)('Call accepted', {
                callId,
                userId,
                duration: 0,
            });
            return {
                success: true,
                call,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Error accepting call', error, { callId, userId });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async rejectCall(callId, userId, reason) {
        try {
            const call = await Call_1.default.findByPk(callId);
            if (!call) {
                throw new Error('Call not found');
            }
            if (call.calleeId !== userId) {
                throw new Error('Only the callee can reject the call');
            }
            if (!call.isActiveCall()) {
                throw new Error(`Cannot reject call in status: ${call.status}`);
            }
            await call.update({
                status: Call_1.CallStatus.REJECTED,
                endedAt: new Date(),
                metadata: {
                    ...call.metadata,
                    rejectionReason: reason || 'rejected_by_user',
                },
            });
            await this.cleanupCallSession(call.id);
            await this.notifyCallStatusChange(call, 'rejected');
            (0, logger_1.logInfo)('Call rejected', {
                callId,
                userId,
                reason,
            });
            return {
                success: true,
                call,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Error rejecting call', error, { callId, userId });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async endCall(callId, userId, reason) {
        try {
            const call = await Call_1.default.findByPk(callId);
            if (!call) {
                throw new Error('Call not found');
            }
            if (call.callerId !== userId && call.calleeId !== userId) {
                throw new Error('Only call participants can end the call');
            }
            if (call.status !== Call_1.CallStatus.ACCEPTED) {
                throw new Error(`Cannot end call in status: ${call.status}`);
            }
            await call.update({
                status: Call_1.CallStatus.ENDED,
                endedAt: new Date(),
                metadata: {
                    ...call.metadata,
                    endReason: reason || 'ended_by_user',
                    endedBy: userId,
                },
            });
            await this.cleanupCallSession(call.id);
            await this.notifyCallStatusChange(call, 'ended');
            (0, logger_1.logInfo)('Call ended', {
                callId,
                userId,
                duration: call.duration,
                reason,
            });
            return {
                success: true,
                call,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Error ending call', error, { callId, userId });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async handleSignaling(signalData) {
        try {
            const session = this.activeSessions.get(signalData.sessionId);
            if (!session || !session.isActive) {
                (0, logger_1.logWarning)('Received signaling for inactive session', { sessionId: signalData.sessionId });
                return false;
            }
            if (!session.participants.includes(signalData.from)) {
                (0, logger_1.logWarning)('Unauthorized signaling attempt', {
                    sessionId: signalData.sessionId,
                    from: signalData.from,
                });
                return false;
            }
            await this.logCallEvent(session.callId, 'signaling_data', {
                type: signalData.type,
                from: signalData.from,
                to: signalData.to,
                dataSize: JSON.stringify(signalData.data).length,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('Error handling signaling', error, signalData);
            return false;
        }
    }
    async getCallHistory(userId, limit = 50, offset = 0) {
        try {
            return await Call_1.default.findAll({
                where: {
                    [sequelize_1.Op.or]: [
                        { callerId: userId },
                        { calleeId: userId },
                    ],
                },
                include: [
                    {
                        model: models_1.User,
                        as: 'caller',
                        attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
                    },
                    {
                        model: models_1.User,
                        as: 'callee',
                        attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
                    },
                ],
                order: [['createdAt', 'DESC']],
                limit,
                offset,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error fetching call history', error, { userId });
            return [];
        }
    }
    async getActiveCallForUser(userId) {
        try {
            return await Call_1.default.findOne({
                where: {
                    [sequelize_1.Op.or]: [
                        { callerId: userId },
                        { calleeId: userId },
                    ],
                    status: [Call_1.CallStatus.INITIATED, Call_1.CallStatus.RINGING, Call_1.CallStatus.ACCEPTED],
                },
                include: [
                    {
                        model: models_1.User,
                        as: 'caller',
                        attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
                    },
                    {
                        model: models_1.User,
                        as: 'callee',
                        attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
                    },
                ],
                order: [['createdAt', 'DESC']],
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error fetching active call', error, { userId });
            return null;
        }
    }
    async updateCallQuality(callId, userId, quality) {
        try {
            const call = await Call_1.default.findByPk(callId);
            if (!call) {
                throw new Error('Call not found');
            }
            if (call.callerId !== userId && call.calleeId !== userId) {
                throw new Error('Only call participants can rate the call');
            }
            if (quality < 1 || quality > 5) {
                throw new Error('Quality rating must be between 1 and 5');
            }
            await call.update({ quality });
            await this.logCallEvent(callId, 'quality_update', {
                rating: quality,
                ratedBy: userId,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('Error updating call quality', error, { callId, userId, quality });
            return false;
        }
    }
    async initiateEmergencyCall(userId, location) {
        try {
            (0, logger_1.logInfo)('Emergency call initiated', {
                userId,
                location,
                timestamp: new Date().toISOString(),
            });
            const emergencyContact = await this.getEmergencyContact(userId);
            if (!emergencyContact) {
                throw new Error('No emergency contact available');
            }
            return await this.initiateCall({
                callerId: userId,
                calleeId: emergencyContact.id,
                callType: Call_1.CallType.VOICE,
                callPurpose: Call_1.CallPurpose.EMERGENCY_CALL,
                isEmergency: true,
                metadata: {
                    location,
                    emergencyType: 'user_initiated',
                    autoRecord: true,
                },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error initiating emergency call', error, { userId });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    shouldEnableRecording(request) {
        return request.isEmergency || request.callPurpose === Call_1.CallPurpose.CUSTOMER_SUPPORT;
    }
    async sendCallNotifications(call, caller, callee) {
        try {
            await this.notificationService.sendNotification(callee.id, {
                title: `Incoming ${call.callType} call`,
                body: `${caller.firstName} ${caller.lastName} is calling you`,
                type: 'incoming_call',
                data: {
                    callId: call.id,
                    callType: call.callType,
                    callerId: caller.id,
                    callerName: `${caller.firstName} ${caller.lastName}`,
                    callerAvatar: caller.profilePicture,
                    isEmergency: call.isEmergency,
                },
            });
            if (call.isEmergency) {
                await this.notifyEmergencyContacts(caller.id, call);
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error sending call notifications', error);
        }
    }
    async notifyCallStatusChange(call, status) {
        try {
            const participants = [call.callerId, call.calleeId];
            for (const participantId of participants) {
                await this.notificationService.sendNotification(participantId, {
                    title: 'Call Status Update',
                    body: `Call ${status}`,
                    type: 'call_status_update',
                    data: {
                        callId: call.id,
                        status,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error notifying call status change', error);
        }
    }
    async cleanupCallSession(callId) {
        try {
            for (const [sessionId, session] of this.activeSessions.entries()) {
                if (session.callId === callId) {
                    session.isActive = false;
                    this.activeSessions.delete(sessionId);
                    break;
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error cleaning up call session', error, { callId });
        }
    }
    async logCallEvent(callId, eventType, eventData) {
        try {
            await database_1.sequelize.models['CallEvent'].create({
                callId,
                eventType,
                eventData,
                timestamp: new Date(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error logging call event', error);
        }
    }
    async getEmergencyContact(userId) {
        try {
            return await models_1.User.findOne({
                where: { role: 'admin' },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error getting emergency contact', error, { userId });
            return null;
        }
    }
    async notifyEmergencyContacts(userId, call) {
        try {
            (0, logger_1.logWarning)('Emergency call initiated - alerting emergency contacts', {
                userId,
                callId: call.id,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error notifying emergency contacts', error);
        }
    }
    async getCallStatistics(userId) {
        try {
            const whereClause = userId ? {
                [sequelize_1.Op.or]: [
                    { callerId: userId },
                    { calleeId: userId },
                ],
            } : {};
            const stats = await Call_1.default.findAll({
                where: whereClause,
                attributes: [
                    'callType',
                    'status',
                    [database_1.sequelize.fn('COUNT', '*'), 'count'],
                    [database_1.sequelize.fn('AVG', database_1.sequelize.col('duration')), 'avgDuration'],
                    [database_1.sequelize.fn('AVG', database_1.sequelize.col('quality')), 'avgQuality'],
                ],
                group: ['callType', 'status'],
                raw: true,
            });
            return stats;
        }
        catch (error) {
            (0, logger_1.logError)('Error fetching call statistics', error, { userId });
            return [];
        }
    }
}
exports.CallService = CallService;
exports.default = CallService;
//# sourceMappingURL=CallService.js.map