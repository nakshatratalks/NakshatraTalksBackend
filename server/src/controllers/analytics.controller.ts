import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';

/**
 * Get dashboard statistics (Admin only)
 * GET /api/v1/admin/analytics/dashboard
 */
export const getDashboardStats = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Get total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get total astrologers
    const { count: totalAstrologers } = await supabaseAdmin
      .from('astrologers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Get active chats
    const { count: activeChats } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get new users today
    const { count: newUsersToday } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart);

    // Get today's revenue
    const { data: todayTransactions } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('type', 'recharge')
      .eq('status', 'success')
      .gte('created_at', todayStart);

    const todayRevenue = todayTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Get total revenue
    const { data: allTransactions } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('type', 'recharge')
      .eq('status', 'success');

    const totalRevenue = allTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Get average session duration
    const { data: completedSessions } = await supabaseAdmin
      .from('chat_sessions')
      .select('duration')
      .eq('status', 'completed')
      .not('duration', 'is', null);

    const averageSessionDuration = completedSessions && completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length
      : 0;

    // Get top astrologers
    const { data: topAstrologers } = await supabaseAdmin
      .from('astrologers')
      .select('id, name, image, rating, total_calls, total_reviews')
      .eq('status', 'approved')
      .order('total_calls', { ascending: false })
      .limit(5);

    // Get revenue chart data (last 7 days)
    const revenueChart = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      const { data: dayTransactions } = await supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('type', 'recharge')
        .eq('status', 'success')
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd);

      const dayRevenue = dayTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      revenueChart.push({
        date: date.toISOString().split('T')[0],
        revenue: dayRevenue,
      });
    }

    sendSuccess(res, {
      totalUsers: totalUsers || 0,
      totalAstrologers: totalAstrologers || 0,
      activeChats: activeChats || 0,
      todayRevenue,
      totalRevenue,
      newUsersToday: newUsersToday || 0,
      averageSessionDuration: Number(averageSessionDuration.toFixed(1)),
      topAstrologers: topAstrologers?.map(a => ({
        id: a.id,
        name: a.name,
        image: a.image,
        rating: a.rating,
        totalCalls: a.total_calls,
        totalReviews: a.total_reviews,
      })) || [],
      revenueChart,
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch dashboard statistics', 500, error);
  }
};
