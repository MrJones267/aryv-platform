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
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const GroupChatController_1 = __importStar(require("../controllers/GroupChatController"));
const auth_1 = require("../middleware/auth");
const createGroupLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many group creation attempts, please try again later.',
});
const joinGroupLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many join attempts, please try again later.',
});
const generalGroupLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many requests, please try again later.',
});
const groupActionLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many group actions, please try again later.',
});
const router = (0, express_1.Router)();
const groupChatController = new GroupChatController_1.default();
router.post('/', auth_1.authenticateToken, createGroupLimit, GroupChatController_1.groupChatValidationRules.createGroupChat, (req, res) => groupChatController.createGroupChat(req, res));
router.post('/join', auth_1.authenticateToken, joinGroupLimit, GroupChatController_1.groupChatValidationRules.joinGroup, (req, res) => groupChatController.joinGroup(req, res));
router.get('/my-chats', auth_1.authenticateToken, generalGroupLimit, (req, res) => groupChatController.getUserGroupChats(req, res));
router.post('/:groupChatId/leave', auth_1.authenticateToken, groupActionLimit, GroupChatController_1.groupChatValidationRules.leaveGroup, (req, res) => groupChatController.leaveGroup(req, res));
router.post('/:groupChatId/messages', auth_1.authenticateToken, generalGroupLimit, GroupChatController_1.groupChatValidationRules.sendMessage, (req, res) => groupChatController.sendMessage(req, res));
router.get('/:groupChatId/messages', auth_1.authenticateToken, generalGroupLimit, GroupChatController_1.groupChatValidationRules.getMessages, (req, res) => groupChatController.getGroupMessages(req, res));
router.post('/:groupChatId/read', auth_1.authenticateToken, generalGroupLimit, GroupChatController_1.groupChatValidationRules.markAsRead, (req, res) => groupChatController.markAsRead(req, res));
router.post('/messages/:messageId/reactions', auth_1.authenticateToken, generalGroupLimit, GroupChatController_1.groupChatValidationRules.addReaction, (req, res) => groupChatController.addReaction(req, res));
router.post('/messages/:messageId/pin', auth_1.authenticateToken, groupActionLimit, GroupChatController_1.groupChatValidationRules.addReaction, (req, res) => groupChatController.togglePin(req, res));
router.put('/:groupChatId/participants/:participantId', auth_1.authenticateToken, groupActionLimit, GroupChatController_1.groupChatValidationRules.updateParticipant, (req, res) => groupChatController.updateParticipant(req, res));
router.post('/:groupChatId/vote-keep-active', auth_1.authenticateToken, groupActionLimit, GroupChatController_1.groupChatValidationRules.voteToKeepGroup, (req, res) => groupChatController.voteToKeepGroup(req, res));
exports.default = router;
//# sourceMappingURL=groupChat.js.map