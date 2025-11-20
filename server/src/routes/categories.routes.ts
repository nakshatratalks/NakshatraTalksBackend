import { Router } from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Public routes
router.get('/', getAllCategories);

// Admin routes
router.post('/admin/categories', authenticateUser, requireAdmin, createCategory);
router.put('/admin/categories/:id', authenticateUser, requireAdmin, updateCategory);
router.delete('/admin/categories/:id', authenticateUser, requireAdmin, deleteCategory);

export default router;
