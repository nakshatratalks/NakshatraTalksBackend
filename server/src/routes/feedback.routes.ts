import { Router } from 'express';
import {
  submitFeedback,
  getAllFeedback,
  updateFeedbackStatus,
  deleteFeedback,
} from '../controllers/feedback.controller';
import { authenticateUser, optionalAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Public route (with optional auth)
router.post('/', optionalAuth, submitFeedback);

// Admin routes
router.get('/admin/feedback', authenticateUser, requireAdmin, getAllFeedback);
router.patch('/admin/feedback/:id', authenticateUser, requireAdmin, updateFeedbackStatus);
router.delete('/admin/feedback/:id', authenticateUser, requireAdmin, deleteFeedback);

export default router;
