/**
 * @fileoverview Group Chat routes for enhanced messaging functionality
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import GroupChatController, { groupChatValidationRules } from '../controllers/GroupChatController';
import { authenticateToken } from '../middleware/auth';

// Rate limiters for different operations
const createGroupLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 group creations per minute
  message: 'Too many group creation attempts, please try again later.',
});

const joinGroupLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 join attempts per minute
  message: 'Too many join attempts, please try again later.',
});

const generalGroupLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: 'Too many requests, please try again later.',
});

const groupActionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 actions per minute
  message: 'Too many group actions, please try again later.',
});

const router = Router();
const groupChatController = new GroupChatController();

/**
 * Group Chat Management Routes
 */

// Create new group chat
router.post(
  '/',
  authenticateToken,
  createGroupLimit,
  groupChatValidationRules.createGroupChat,
  (req: Request, res: Response) => groupChatController.createGroupChat(req as any, res),
);

// Join a group chat (by ID or join code)
router.post(
  '/join',
  authenticateToken,
  joinGroupLimit,
  groupChatValidationRules.joinGroup,
  (req: Request, res: Response) => groupChatController.joinGroup(req as any, res),
);

// Get user's group chats
router.get(
  '/my-chats',
  authenticateToken,
  generalGroupLimit,
  (req: Request, res: Response) => groupChatController.getUserGroupChats(req as any, res),
);

// Leave a group chat
router.post(
  '/:groupChatId/leave',
  authenticateToken,
  groupActionLimit,
  groupChatValidationRules.leaveGroup,
  (req: Request, res: Response) => groupChatController.leaveGroup(req as any, res),
);

/**
 * Group Chat Messaging Routes
 */

// Send message to group chat
router.post(
  '/:groupChatId/messages',
  authenticateToken,
  generalGroupLimit,
  groupChatValidationRules.sendMessage,
  (req: Request, res: Response) => groupChatController.sendMessage(req as any, res),
);

// Get group chat messages
router.get(
  '/:groupChatId/messages',
  authenticateToken,
  generalGroupLimit,
  groupChatValidationRules.getMessages,
  (req: Request, res: Response) => groupChatController.getGroupMessages(req as any, res),
);

// Mark messages as read
router.post(
  '/:groupChatId/read',
  authenticateToken,
  generalGroupLimit,
  groupChatValidationRules.markAsRead,
  (req: Request, res: Response) => groupChatController.markAsRead(req as any, res),
);

/**
 * Message Interaction Routes
 */

// Add reaction to message
router.post(
  '/messages/:messageId/reactions',
  authenticateToken,
  generalGroupLimit,
  groupChatValidationRules.addReaction,
  (req: Request, res: Response) => groupChatController.addReaction(req as any, res),
);

// Toggle message pin status
router.post(
  '/messages/:messageId/pin',
  authenticateToken,
  groupActionLimit,
  groupChatValidationRules.addReaction, // Reuse message validation
  (req: Request, res: Response) => groupChatController.togglePin(req as any, res),
);

/**
 * Participant Management Routes
 */

// Update participant (role, status, etc.)
router.put(
  '/:groupChatId/participants/:participantId',
  authenticateToken,
  groupActionLimit,
  groupChatValidationRules.updateParticipant,
  (req: Request, res: Response) => groupChatController.updateParticipant(req as any, res),
);

/**
 * Group Lifecycle Management Routes
 */

// Vote to keep group active after ride completion
router.post(
  '/:groupChatId/vote-keep-active',
  authenticateToken,
  groupActionLimit,
  groupChatValidationRules.voteToKeepGroup,
  (req: Request, res: Response) => groupChatController.voteToKeepGroup(req as any, res),
);

export default router;
