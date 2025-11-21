import { Router } from 'express';
import {
  startChatSession,
  endChatSession,
  getChatMessages,
  sendChatMessage,
  rateChatSession,
  getActiveSession,
  validateBalance,
  getChatHistory,
} from '../controllers/chat.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/chat/sessions:
 *   post:
 *     summary: Create a new chat session
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - astrologerId
 *               - sessionType
 *             properties:
 *               astrologerId:
 *                 type: string
 *                 format: uuid
 *               sessionType:
 *                 type: string
 *                 enum: [chat, call, video]
 *     responses:
 *       201:
 *         description: Chat session created successfully
 *       400:
 *         description: Insufficient balance or validation error
 *       404:
 *         description: Astrologer not found
 */
router.post('/sessions', authenticateUser, startChatSession);

/**
 * @swagger
 * /api/v1/chat/sessions:
 *   get:
 *     summary: Get chat history with filters
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *       - in: query
 *         name: astrologerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 */
router.get('/sessions', authenticateUser, getChatHistory);

/**
 * @swagger
 * /api/v1/chat/sessions/active:
 *   get:
 *     summary: Get active chat session
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active session retrieved (or null if no active session)
 */
router.get('/sessions/active', authenticateUser, getActiveSession);

/**
 * @swagger
 * /api/v1/chat/sessions/{sessionId}/end:
 *   post:
 *     summary: End a chat session
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endReason:
 *                 type: string
 *                 enum: [user_ended, astrologer_ended, timeout, insufficient_balance]
 *     responses:
 *       200:
 *         description: Session ended successfully
 *       404:
 *         description: Active session not found
 */
router.post('/sessions/:sessionId/end', authenticateUser, endChatSession);

/**
 * @swagger
 * /api/v1/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get chat messages for a session
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       403:
 *         description: Access denied to this session
 */
router.get('/sessions/:sessionId/messages', authenticateUser, getChatMessages);

/**
 * @swagger
 * /api/v1/chat/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send a chat message
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - type
 *             properties:
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, file]
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Session is not active
 *       403:
 *         description: Access denied to this session
 */
router.post('/sessions/:sessionId/messages', authenticateUser, sendChatMessage);

/**
 * @swagger
 * /api/v1/chat/sessions/{sessionId}/rating:
 *   post:
 *     summary: Rate a completed chat session
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Session rated successfully
 *       404:
 *         description: Completed session not found
 */
router.post('/sessions/:sessionId/rating', authenticateUser, rateChatSession);

/**
 * @swagger
 * /api/v1/chat/validate-balance:
 *   post:
 *     summary: Validate wallet balance before starting a chat
 *     tags: [Browse Chat Screen]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - astrologerId
 *             properties:
 *               astrologerId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Balance validation result
 *       400:
 *         description: Insufficient balance
 *       404:
 *         description: Astrologer not found
 */
router.post('/validate-balance', authenticateUser, validateBalance);

export default router;
