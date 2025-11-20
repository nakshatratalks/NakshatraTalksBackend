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
import { validatePagination, isValidEmail, sanitizeString } from '../utils/validation.utils';

/**
 * Submit feedback
 * POST /api/v1/feedback
 */
export const submitFeedback = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, comments, rating, category } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Name is required', 400);
      return;
    }

    if (!comments || typeof comments !== 'string' || comments.trim().length < 10) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Comments must be at least 10 characters', 400);
      return;
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid email format', 400);
      return;
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Rating must be between 1 and 5', 400);
      return;
    }

    const { data: feedback, error } = await supabaseAdmin
      .from('feedback')
      .insert({
        user_id: req.user?.id || null,
        name: sanitizeString(name),
        email: email?.trim() || null,
        comments: sanitizeString(comments),
        rating: rating || null,
        category: category || 'general',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting feedback:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to submit feedback', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        feedbackId: feedback.id,
        status: feedback.status,
        createdAt: feedback.created_at,
      },
      'Thank you for your feedback!',
      201
    );
  } catch (error) {
    console.error('Error in submitFeedback:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to submit feedback', 500, error);
  }
};

/**
 * Get all feedback (Admin only)
 * GET /api/v1/admin/feedback
 */
export const getAllFeedback = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page: pageParam,
      limit: limitParam,
      status,
      rating,
      startDate,
      endDate
    } = req.query;

    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    let query = supabaseAdmin
      .from('feedback')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (rating) {
      query = query.eq('rating', Number(rating));
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

    const { data: feedback, error, count } = await query;

    if (error) {
      console.error('Error fetching feedback:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch feedback', 500, error);
      return;
    }

    const pagination = calculatePagination(count || 0, page, limit);

    sendPaginatedSuccess(
      res,
      feedback?.map(f => ({
        id: f.id,
        name: f.name,
        email: f.email,
        comments: f.comments,
        rating: f.rating,
        category: f.category,
        status: f.status,
        adminNotes: f.admin_notes,
        createdAt: f.created_at,
      })) || [],
      pagination
    );
  } catch (error) {
    console.error('Error in getAllFeedback:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch feedback', 500, error);
  }
};

/**
 * Update feedback status (Admin only)
 * PATCH /api/v1/admin/feedback/:id
 */
export const updateFeedbackStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'reviewed', 'resolved'];
    if (status && !validStatuses.includes(status)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid status value', 400);
      return;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.admin_notes = sanitizeString(adminNotes);

    const { data: updatedFeedback, error } = await supabaseAdmin
      .from('feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Feedback not found', 404);
        return;
      }
      console.error('Error updating feedback:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update feedback', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        id: updatedFeedback.id,
        status: updatedFeedback.status,
        adminNotes: updatedFeedback.admin_notes,
      },
      'Feedback updated successfully'
    );
  } catch (error) {
    console.error('Error in updateFeedbackStatus:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update feedback', 500, error);
  }
};

/**
 * Delete feedback (Admin only)
 * DELETE /api/v1/admin/feedback/:id
 */
export const deleteFeedback = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('feedback')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Feedback not found', 404);
        return;
      }
      console.error('Error deleting feedback:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete feedback', 500, error);
      return;
    }

    sendSuccess(res, null, 'Feedback deleted successfully');
  } catch (error) {
    console.error('Error in deleteFeedback:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete feedback', 500, error);
  }
};
