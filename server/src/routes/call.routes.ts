import { Router } from 'express';
import {
  getAvailableAstrologersForCall,
  startCallSession,
  endCallSession,
  getActiveCallSession,
  validateBalanceForCall,
  getCallHistory,
  rateCallSession,
  getCallSessionDetails,
  getCallSpecializations,
} from '../controllers/call.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/call/astrologers:
 *   get:
 *     summary: Get available astrologers for call
 *     description: Browse astrologers available for call/video sessions with call pricing
 *     tags: [Browse Call Screen]
 *     parameters:
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *         description: Filter by specialization
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum call price per minute
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [rating, price, experience, calls]
 *         description: Sort astrologers by field
 *       - in: query
 *         name: onlyLive
 *         schema:
 *           type: boolean
 *         description: Show only live astrologers
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
 *         description: List of astrologers available for call
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       image:
 *                         type: string
 *                       isLive:
 *                         type: boolean
 *                       isAvailable:
 *                         type: boolean
 *                       specialization:
 *                         type: array
 *                         items:
 *                           type: string
 *                       languages:
 *                         type: array
 *                         items:
 *                           type: string
 *                       experience:
 *                         type: integer
 *                       rating:
 *                         type: number
 *                       totalCalls:
 *                         type: integer
 *                       callPricePerMinute:
 *                         type: number
 *                       nextAvailableAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                 pagination:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/astrologers', getAvailableAstrologersForCall);

/**
 * @swagger
 * /api/v1/call/specializations:
 *   get:
 *     summary: Get all available specializations for call
 *     description: Fetch all unique astrologer specializations for call filter chips
 *     tags: [Browse Call Screen]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter only active specializations (from available astrologers who offer calls)
 *     responses:
 *       200:
 *         description: List of call specializations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                         example: "Vedic"
 *                       icon:
 *                         type: string
 *                         nullable: true
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       order:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Server error
 */
router.get('/specializations', getCallSpecializations);

/**
 * @swagger
 * /api/v1/call/validate-balance:
 *   post:
 *     summary: Validate wallet balance before starting a call
 *     tags: [Browse Call Screen]
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
router.post('/validate-balance', authenticateUser, validateBalanceForCall);

/**
 * @swagger
 * /api/v1/call/sessions:
 *   post:
 *     summary: Start a new call session
 *     tags: [Browse Call Screen]
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
 *               sessionType:
 *                 type: string
 *                 enum: [call, video]
 *                 default: call
 *     responses:
 *       201:
 *         description: Call session created successfully
 *       400:
 *         description: Insufficient balance or validation error
 *       404:
 *         description: Astrologer not found
 */
router.post('/sessions', authenticateUser, startCallSession);

/**
 * @swagger
 * /api/v1/call/sessions:
 *   get:
 *     summary: Get call history with filters
 *     tags: [Browse Call Screen]
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
 *         description: Call history retrieved successfully
 */
router.get('/sessions', authenticateUser, getCallHistory);

/**
 * @swagger
 * /api/v1/call/sessions/active:
 *   get:
 *     summary: Get active call session
 *     tags: [Browse Call Screen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active call session retrieved (or null if no active session)
 */
router.get('/sessions/active', authenticateUser, getActiveCallSession);

/**
 * @swagger
 * /api/v1/call/sessions/{sessionId}:
 *   get:
 *     summary: Get call session details
 *     tags: [Browse Call Screen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Call session details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:sessionId', authenticateUser, getCallSessionDetails);

/**
 * @swagger
 * /api/v1/call/sessions/{sessionId}/end:
 *   post:
 *     summary: End a call session
 *     tags: [Browse Call Screen]
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
 *         description: Call session ended successfully
 *       404:
 *         description: Active session not found
 */
router.post('/sessions/:sessionId/end', authenticateUser, endCallSession);

/**
 * @swagger
 * /api/v1/call/sessions/{sessionId}/rating:
 *   post:
 *     summary: Rate a completed call session
 *     tags: [Browse Call Screen]
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
router.post('/sessions/:sessionId/rating', authenticateUser, rateCallSession);

export default router;
