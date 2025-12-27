"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Call = exports.CallPurpose = exports.CallStatus = exports.CallType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = __importDefault(require("./User"));
var CallType;
(function (CallType) {
    CallType["VOICE"] = "voice";
    CallType["VIDEO"] = "video";
    CallType["EMERGENCY"] = "emergency";
})(CallType || (exports.CallType = CallType = {}));
var CallStatus;
(function (CallStatus) {
    CallStatus["INITIATED"] = "initiated";
    CallStatus["RINGING"] = "ringing";
    CallStatus["ACCEPTED"] = "accepted";
    CallStatus["REJECTED"] = "rejected";
    CallStatus["ENDED"] = "ended";
    CallStatus["FAILED"] = "failed";
    CallStatus["MISSED"] = "missed";
})(CallStatus || (exports.CallStatus = CallStatus = {}));
var CallPurpose;
(function (CallPurpose) {
    CallPurpose["RIDE_COMMUNICATION"] = "ride_communication";
    CallPurpose["COURIER_DELIVERY"] = "courier_delivery";
    CallPurpose["EMERGENCY_CALL"] = "emergency_call";
    CallPurpose["CUSTOMER_SUPPORT"] = "customer_support";
})(CallPurpose || (exports.CallPurpose = CallPurpose = {}));
class Call extends sequelize_1.Model {
    getDurationFormatted() {
        if (!this.duration)
            return '00:00';
        const minutes = Math.floor(this.duration / 60);
        const seconds = this.duration % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    isActiveCall() {
        return [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ACCEPTED].includes(this.status);
    }
    canRecord() {
        return this.recordingEnabled && !this.isEmergency;
    }
}
exports.Call = Call;
Call.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    callerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User initiating the call',
    },
    calleeId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User receiving the call',
    },
    callType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CallType)),
        allowNull: false,
        defaultValue: CallType.VOICE,
        comment: 'Type of call: voice, video, or emergency',
    },
    callPurpose: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CallPurpose)),
        allowNull: false,
        defaultValue: CallPurpose.RIDE_COMMUNICATION,
        comment: 'Purpose/context of the call',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CallStatus)),
        allowNull: false,
        defaultValue: CallStatus.INITIATED,
        comment: 'Current status of the call',
    },
    rideId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'rides',
            key: 'id',
        },
        comment: 'Associated ride ID if call is ride-related',
    },
    deliveryId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'delivery_agreements',
            key: 'id',
        },
        comment: 'Associated delivery ID if call is delivery-related',
    },
    isEmergency: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is an emergency call',
    },
    startedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'When the call was actually connected',
    },
    endedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'When the call was terminated',
    },
    duration: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Call duration in seconds',
    },
    recordingUrl: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'URL to call recording if available',
    },
    recordingEnabled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether call recording is enabled',
    },
    quality: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        validate: {
            min: 1,
            max: 5,
        },
        comment: 'Call quality rating from 1-5',
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Additional call metadata and technical information',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Call',
    tableName: 'calls',
    indexes: [
        {
            fields: ['caller_id'],
        },
        {
            fields: ['callee_id'],
        },
        {
            fields: ['ride_id'],
        },
        {
            fields: ['delivery_id'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['call_type'],
        },
        {
            fields: ['is_emergency'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['caller_id', 'callee_id', 'created_at'],
        },
    ],
});
Call.belongsTo(User_1.default, {
    foreignKey: 'callerId',
    as: 'caller',
});
Call.belongsTo(User_1.default, {
    foreignKey: 'calleeId',
    as: 'callee',
});
User_1.default.hasMany(Call, {
    foreignKey: 'callerId',
    as: 'outgoingCalls',
});
User_1.default.hasMany(Call, {
    foreignKey: 'calleeId',
    as: 'incomingCalls',
});
exports.default = Call;
//# sourceMappingURL=Call.js.map