import { Router } from 'express';
import { getSpecializations } from '../controllers/astrologers.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/specializations:
 *   get:
 *     summary: Get all available specializations
 *     description: Fetch all unique astrologer specializations for filter chips
 *     tags: [Browse Chat Screen]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter only active specializations (from available astrologers)
 *     responses:
 *       200:
 *         description: List of specializations
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
router.get('/', getSpecializations);

export default router;
