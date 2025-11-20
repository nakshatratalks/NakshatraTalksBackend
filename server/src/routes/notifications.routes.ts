import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendNotification,
} from '../controllers/notifications.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// User routes
router.get('/', authenticateUser, getUserNotifications);
router.patch('/:id/read', authenticateUser, markNotificationAsRead);
router.patch('/read-all', authenticateUser, markAllNotificationsAsRead);

// Admin routes
router.post('/admin/notifications', authenticateUser, requireAdmin, sendNotification);

export default router;
