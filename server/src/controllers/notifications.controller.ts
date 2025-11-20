import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import {
  sendSuccess,
  sendError,
  ErrorCodes,
  calculatePagination
} from '../utils/response.utils';
import { validatePagination, sanitizeString, validateRequiredFields } from '../utils/validation.utils';

/**
 * Get user notifications
 * GET /api/v1/notifications
 */
export const getUserNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { page: pageParam, limit: limitParam, isRead } = req.query;
    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .or(`user_id.eq.${req.user.id},user_id.is.null`); // User-specific or broadcast

    if (isRead !== undefined && isRead !== 'all') {
      query = query.eq('is_read', isRead === 'true');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch notifications', 500, error);
      return;
    }

    // Count unread notifications
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${req.user.id},user_id.is.null`)
      .eq('is_read', false);

    const pagination = calculatePagination(count || 0, page, limit);

    sendSuccess(res, {
      notifications: notifications?.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.is_read,
        data: n.data,
        createdAt: n.created_at,
      })) || [],
      unreadCount: unreadCount || 0,
      pagination,
    });
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch notifications', 500, error);
  }
};

/**
 * Mark notification as read
 * PATCH /api/v1/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Notification not found', 404);
        return;
      }
      console.error('Error marking notification as read:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to mark notification as read', 500, error);
      return;
    }

    sendSuccess(res, { id: data.id, isRead: data.is_read }, 'Notification marked as read');
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to mark notification as read', 500, error);
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/v1/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to mark all notifications as read', 500, error);
      return;
    }

    sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to mark all notifications as read', 500, error);
  }
};

/**
 * Send notification (Admin only)
 * POST /api/v1/admin/notifications
 */
export const sendNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { title, message, type, targetUsers, scheduledAt, data } = req.body;

    const { isValid, missingFields } = validateRequiredFields(req.body, ['title', 'message', 'type']);

    if (!isValid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
      return;
    }

    const validTypes = ['wallet', 'chat', 'promotion', 'system'];
    if (!validTypes.includes(type)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid notification type', 400);
      return;
    }

    // Handle broadcast or specific users
    const notificationsToInsert = [];

    if (targetUsers && Array.isArray(targetUsers) && targetUsers[0] === 'all') {
      // Broadcast notification (user_id will be null)
      notificationsToInsert.push({
        user_id: null,
        title: sanitizeString(title),
        message: sanitizeString(message),
        type,
        is_read: false,
        data: data || null,
        created_at: scheduledAt || new Date().toISOString(),
      });
    } else if (targetUsers && Array.isArray(targetUsers)) {
      // Specific users
      for (const userId of targetUsers) {
        notificationsToInsert.push({
          user_id: userId,
          title: sanitizeString(title),
          message: sanitizeString(message),
          type,
          is_read: false,
          data: data || null,
          created_at: scheduledAt || new Date().toISOString(),
        });
      }
    } else {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'targetUsers must be an array', 400);
      return;
    }

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationsToInsert)
      .select();

    if (error) {
      console.error('Error sending notification:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to send notification', 500, error);
      return;
    }

    sendSuccess(
      res,
      { count: notifications?.length || 0 },
      'Notification(s) sent successfully',
      201
    );
  } catch (error) {
    console.error('Error in sendNotification:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to send notification', 500, error);
  }
};
