import { Router } from 'express';
import {
  getLiveAstrologers,
  getTopRatedAstrologers,
  getAstrologerDetails,
  createAstrologer,
  updateAstrologer,
  deleteAstrologer,
  getAllAstrologers,
  updateLiveStatus,
} from '../controllers/astrologers.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin, requireAdminOrAstrologer } from '../middleware/rbac.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/astrologers/live:
 *   get:
 *     summary: Get live astrologers
 *     tags: [Home Screen]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of astrologers to return
 *     responses:
 *       200:
 *         description: List of live astrologers
 */
router.get('/live', getLiveAstrologers);

/**
 * @swagger
 * /api/v1/astrologers/top-rated:
 *   get:
 *     summary: Get top-rated astrologers
 *     tags: [Home Screen]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [rating, calls, price]
 *     responses:
 *       200:
 *         description: List of top-rated astrologers
 */
router.get('/top-rated', getTopRatedAstrologers);

/**
 * @swagger
 * /api/v1/astrologers/{id}:
 *   get:
 *     summary: Get astrologer details
 *     tags: [Astrologers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Astrologer details
 *       404:
 *         description: Astrologer not found
 */
router.get('/:id', getAstrologerDetails);

/**
 * @swagger
 * /api/v1/astrologers/{id}/live-status:
 *   patch:
 *     summary: Update astrologer live status
 *     tags: [Astrologers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isLive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Live status updated
 */
router.patch('/:id/live-status', authenticateUser, requireAdminOrAstrologer, updateLiveStatus);

/**
 * @swagger
 * /api/v1/admin/astrologers:
 *   post:
 *     summary: Create new astrologer (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - image
 *               - specialization
 *               - languages
 *               - experience
 *               - pricePerMinute
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               image:
 *                 type: string
 *               bio:
 *                 type: string
 *               specialization:
 *                 type: array
 *                 items:
 *                   type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               experience:
 *                 type: integer
 *               education:
 *                 type: array
 *                 items:
 *                   type: string
 *               pricePerMinute:
 *                 type: number
 *               workingHours:
 *                 type: object
 *     responses:
 *       201:
 *         description: Astrologer created
 */
// Admin routes - these will be mounted separately at /api/v1/admin/astrologers
export const adminRouter = Router();

/**
 * @swagger
 * /api/v1/admin/astrologers:
 *   get:
 *     summary: Get all astrologers (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of astrologers
 */
adminRouter.get('/', authenticateUser, requireAdmin, getAllAstrologers);

/**
 * @swagger
 * /api/v1/admin/astrologers:
 *   post:
 *     summary: Create new astrologer (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - image
 *               - specialization
 *               - languages
 *               - experience
 *               - pricePerMinute
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               image:
 *                 type: string
 *               bio:
 *                 type: string
 *               specialization:
 *                 type: array
 *                 items:
 *                   type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               experience:
 *                 type: integer
 *               education:
 *                 type: array
 *                 items:
 *                   type: string
 *               pricePerMinute:
 *                 type: number
 *               workingHours:
 *                 type: object
 *     responses:
 *       201:
 *         description: Astrologer created
 */
adminRouter.post('/', authenticateUser, requireAdmin, createAstrologer);

/**
 * @swagger
 * /api/v1/admin/astrologers/{id}:
 *   put:
 *     summary: Update astrologer (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Astrologer updated
 */
adminRouter.put('/:id', authenticateUser, requireAdmin, updateAstrologer);

/**
 * @swagger
 * /api/v1/admin/astrologers/{id}:
 *   delete:
 *     summary: Delete astrologer (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Astrologer deleted
 */
adminRouter.delete('/:id', authenticateUser, requireAdmin, deleteAstrologer);

export default router;
