import { Router } from 'express';
import {
  getAstrologerReviews,
  submitReview,
  moderateReview,
} from '../controllers/reviews.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Public routes
router.get('/astrologers/:id/reviews', getAstrologerReviews);

// User routes
router.post('/astrologers/:id/reviews', authenticateUser, submitReview);

// Admin routes
router.patch('/admin/reviews/:id', authenticateUser, requireAdmin, moderateReview);

export default router;
