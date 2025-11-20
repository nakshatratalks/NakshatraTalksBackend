import { Router } from 'express';
import {
  adminSignup,
  adminSignin,
  getCurrentAdmin,
  linkAdminToUser,
} from '../controllers/admin-auth.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

/**
 * @swagger
 * /auth/admin/signup:
 *   post:
 *     summary: Admin signup with email/password
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin_john
 *               email:
 *                 type: string
 *                 example: admin@nakshatratalks.com
 *               password:
 *                 type: string
 *                 example: SecurePassword123!
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: Admin account created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Admin already exists
 */
router.post('/signup', adminSignup);

/**
 * @swagger
 * /auth/admin/signin:
 *   post:
 *     summary: Admin signin with email/password
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@nakshatratalks.com
 *               password:
 *                 type: string
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Admin signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/signin', adminSignin);

/**
 * @swagger
 * /auth/admin/me:
 *   get:
 *     summary: Get current admin profile
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 */
router.get('/me', authenticateUser, requireAdmin, getCurrentAdmin);

/**
 * @swagger
 * /auth/admin/link-user:
 *   post:
 *     summary: Link admin account to a regular user account
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user account to link
 *     responses:
 *       200:
 *         description: Accounts linked successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.post('/link-user', authenticateUser, requireAdmin, linkAdminToUser);

export default router;
