import { Router } from 'express';
import { getDashboardStats } from '../controllers/analytics.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Admin routes
router.get('/dashboard', authenticateUser, requireAdmin, getDashboardStats);

export default router;
