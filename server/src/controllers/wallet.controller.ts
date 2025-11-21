import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import {
  sendSuccess,
  sendError,
  ErrorCodes,
  sendPaginatedSuccess,
  calculatePagination
} from '../utils/response.utils';
import { validatePagination } from '../utils/validation.utils';

/**
 * Get wallet balance
 * GET /api/v1/wallet/balance
 */
export const getWalletBalance = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      userId: req.user.id,
      balance: user.wallet_balance || 0,
      currency: 'INR',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in getWalletBalance:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch wallet balance', 500, error);
  }
};

/**
 * Add money to wallet (Recharge)
 * POST /api/v1/wallet/recharge
 */
export const rechargeWallet = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { amount, paymentMethod, paymentId } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid amount', 400);
      return;
    }

    if (!paymentMethod || !paymentId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Payment method and payment ID are required', 400);
      return;
    }

    // Get current balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (userError || !user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    const balanceBefore = user.wallet_balance || 0;
    const newBalance = balanceBefore + Number(amount);

    // Update wallet balance
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ wallet_balance: newBalance })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Error updating wallet balance:', updateError);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update wallet balance', 500, updateError);
      return;
    }

    // Create transaction record
    const { data: transaction, error: txnError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: req.user.id,
        type: 'recharge',
        amount: Number(amount),
        description: 'Wallet recharge',
        payment_method: paymentMethod,
        payment_id: paymentId,
        status: 'success',
        balance_before: balanceBefore,
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (txnError) {
      console.error('Error creating transaction:', txnError);
      // Note: Balance is already updated, so we continue with success response
    }

    sendSuccess(
      res,
      {
        transactionId: transaction?.id,
        amount: Number(amount),
        newBalance,
        status: 'success',
      },
      'Wallet recharged successfully'
    );
  } catch (error) {
    console.error('Error in rechargeWallet:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to recharge wallet', 500, error);
  }
};

/**
 * Get transaction history
 * GET /api/v1/wallet/transactions
 */
export const getTransactionHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const {
      page: pageParam,
      limit: limitParam,
      type,
      startDate,
      endDate
    } = req.query;

    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    let query = supabaseAdmin
      .from('transactions')
      .select('*, astrologers(name)', { count: 'exact' })
      .eq('user_id', req.user.id);

    if (type) {
      query = query.eq('type', type);
    }

    if (startDate) {
      query = query.gte('created_at', String(startDate));
    }

    if (endDate) {
      query = query.lte('created_at', String(endDate));
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch transactions', 500, error);
      return;
    }

    const pagination = calculatePagination(count || 0, page, limit);

    sendPaginatedSuccess(
      res,
      transactions?.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        astrologerId: t.astrologer_id,
        astrologerName: t.astrologers?.name,
        duration: t.duration,
        status: t.status,
        createdAt: t.created_at,
      })) || [],
      pagination
    );
  } catch (error) {
    console.error('Error in getTransactionHistory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch transaction history', 500, error);
  }
};

/**
 * Get all transactions (Admin only)
 * GET /api/v1/admin/transactions
 */
export const getAllTransactions = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page: pageParam,
      limit: limitParam,
      type,
      status,
      startDate,
      endDate
    } = req.query;

    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    let query = supabaseAdmin
      .from('transactions')
      .select('*, users(name, phone), astrologers(name)', { count: 'exact' });

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', String(startDate));
    }

    if (endDate) {
      query = query.lte('created_at', String(endDate));
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error fetching all transactions:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch transactions', 500, error);
      return;
    }

    const pagination = calculatePagination(count || 0, page, limit);

    sendPaginatedSuccess(
      res,
      transactions?.map(t => ({
        id: t.id,
        userId: t.user_id,
        userName: t.users?.name,
        userPhone: t.users?.phone,
        type: t.type,
        amount: t.amount,
        description: t.description,
        astrologerId: t.astrologer_id,
        astrologerName: t.astrologers?.name,
        status: t.status,
        paymentMethod: t.payment_method,
        createdAt: t.created_at,
      })) || [],
      pagination
    );
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch transactions', 500, error);
  }
};

/**
 * Deduct from wallet (Internal use - for chat sessions)
 */
export const deductFromWallet = async (
  userId: string,
  amount: number,
  description: string,
  astrologerId?: string,
  sessionId?: string,
  duration?: number
): Promise<{ success: boolean; error?: string; transactionId?: string; remainingBalance?: number }> => {
  try {
    // Get current balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    const balanceBefore = user.wallet_balance || 0;

    // Check sufficient balance
    if (balanceBefore < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const newBalance = balanceBefore - amount;

    // Update wallet balance
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ wallet_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: 'Failed to update balance' };
    }

    // Create transaction record
    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: -amount,
        description,
        astrologer_id: astrologerId,
        session_id: sessionId,
        duration,
        status: 'completed',
        balance_before: balanceBefore,
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    return {
      success: true,
      transactionId: transaction?.id,
      remainingBalance: newBalance
    };
  } catch (error) {
    console.error('Error in deductFromWallet:', error);
    return { success: false, error: 'Internal error' };
  }
};
