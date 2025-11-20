import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { sanitizeString, isValidRating } from '../utils/validation.utils';

/**
 * Get reviews for an astrologer
 * GET /api/v1/astrologers/:id/reviews
 */
export const getAstrologerReviews = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 20;

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('*, users(name)')
      .eq('astrologer_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching reviews:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch reviews', 500, error);
      return;
    }

    sendSuccess(res, reviews?.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.users?.name || 'Anonymous',
      rating: r.rating,
      comment: r.comment,
      tags: r.tags || [],
      createdAt: r.created_at,
    })) || []);
  } catch (error) {
    console.error('Error in getAstrologerReviews:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch reviews', 500, error);
  }
};

/**
 * Submit a review for an astrologer
 * POST /api/v1/astrologers/:id/reviews
 */
export const submitReview = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { id: astrologerId } = req.params;
    const { rating, comment, tags, sessionId } = req.body;

    // Validate required fields
    if (!rating || !sessionId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Rating and sessionId are required', 400);
      return;
    }

    // Validate rating
    if (!isValidRating(rating)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Rating must be between 1 and 5', 400);
      return;
    }

    // Verify user has completed a session with this astrologer
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .eq('astrologer_id', astrologerId)
      .eq('status', 'completed')
      .single();

    if (sessionError || !session) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only review astrologers you have consulted', 403);
      return;
    }

    // Check if user already reviewed this session
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (existingReview) {
      sendError(res, ErrorCodes.CONFLICT, 'You have already reviewed this session', 409);
      return;
    }

    // Get user name
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', req.user.id)
      .single();

    // Create review
    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: req.user.id,
        user_name: user?.name || 'Anonymous',
        astrologer_id: astrologerId,
        session_id: sessionId,
        rating: Number(rating),
        comment: comment ? sanitizeString(comment) : null,
        tags: tags || [],
        status: 'approved', // Auto-approve for now, can add moderation later
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting review:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to submit review', 500, error);
      return;
    }

    // Update astrologer rating
    await updateAstrologerRating(astrologerId);

    sendSuccess(
      res,
      {
        reviewId: review.id,
        status: review.status,
      },
      'Review submitted successfully',
      201
    );
  } catch (error) {
    console.error('Error in submitReview:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to submit review', 500, error);
  }
};

/**
 * Moderate review (Admin only)
 * PATCH /api/v1/admin/reviews/:id
 */
export const moderateReview = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid status value', 400);
      return;
    }

    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Review not found', 404);
        return;
      }
      console.error('Error moderating review:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to moderate review', 500, error);
      return;
    }

    // Update astrologer rating
    await updateAstrologerRating(review.astrologer_id);

    sendSuccess(res, { id: review.id, status: review.status }, 'Review moderated successfully');
  } catch (error) {
    console.error('Error in moderateReview:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to moderate review', 500, error);
  }
};

/**
 * Helper function to update astrologer rating
 */
const updateAstrologerRating = async (astrologerId: string): Promise<void> => {
  try {
    // Calculate average rating from approved reviews
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('astrologer_id', astrologerId)
      .eq('status', 'approved');

    if (!reviews || reviews.length === 0) {
      return;
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / reviews.length;

    // Update astrologer
    await supabaseAdmin
      .from('astrologers')
      .update({
        rating: Number(avgRating.toFixed(1)),
        total_reviews: reviews.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', astrologerId);
  } catch (error) {
    console.error('Error updating astrologer rating:', error);
  }
};
