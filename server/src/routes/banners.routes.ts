import { Router } from 'express';
import {
  getActiveBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banners.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Public routes
router.get('/', getActiveBanners);

// Admin routes
router.post('/admin/banners', authenticateUser, requireAdmin, createBanner);
router.put('/admin/banners/:id', authenticateUser, requireAdmin, updateBanner);
router.delete('/admin/banners/:id', authenticateUser, requireAdmin, deleteBanner);

export default router;
