import { Router } from 'express';
import {
  getWalletBalance,
  rechargeWallet,
  getTransactionHistory,
  getAllTransactions,
} from '../controllers/wallet.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// User routes
router.get('/balance', authenticateUser, getWalletBalance);
router.post('/recharge', authenticateUser, rechargeWallet);
router.get('/transactions', authenticateUser, getTransactionHistory);

// Admin routes
router.get('/admin/transactions', authenticateUser, requireAdmin, getAllTransactions);

export default router;
