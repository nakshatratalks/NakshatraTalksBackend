import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { deductFromWallet } from '../controllers/wallet.controller';

/**
 * Start a chat session
 * POST /api/v1/chat/sessions
 */
export const startChatSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { astrologerId, sessionType } = req.body;

    if (!astrologerId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Astrologer ID is required', 400);
      return;
    }

    const validSessionTypes = ['chat', 'call', 'video'];
    if (!sessionType || !validSessionTypes.includes(sessionType)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session type', 400);
      return;
    }

    // Get astrologer details
    const { data: astrologer, error: astrologerError } = await supabaseAdmin
      .from('astrologers')
      .select('id, name, price_per_minute, is_available, status')
      .eq('id', astrologerId)
      .single();

    if (astrologerError || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    if (!astrologer.is_available || astrologer.status !== 'approved') {
      sendError(res, ErrorCodes.BAD_REQUEST, 'Astrologer is not available', 400);
      return;
    }

    // Check user wallet balance (at least 1 minute worth)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (!user || (user.wallet_balance || 0) < astrologer.price_per_minute) {
      sendError(res, ErrorCodes.INSUFFICIENT_BALANCE, 'Insufficient wallet balance', 400);
      return;
    }

    // Create chat session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: req.user.id,
        astrologer_id: astrologerId,
        session_type: sessionType,
        start_time: new Date().toISOString(),
        price_per_minute: astrologer.price_per_minute,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating chat session:', sessionError);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to start chat session', 500, sessionError);
      return;
    }

    sendSuccess(
      res,
      {
        sessionId: session.id,
        astrologerId: session.astrologer_id,
        astrologerName: astrologer.name,
        pricePerMinute: session.price_per_minute,
        startTime: session.start_time,
        status: session.status,
      },
      'Chat session started',
      201
    );
  } catch (error) {
    console.error('Error in startChatSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to start chat session', 500, error);
  }
};

/**
 * End a chat session
 * PATCH /api/v1/chat/sessions/:sessionId/end
 */
export const endChatSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { sessionId } = req.params;

    // Get session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Active session not found', 404);
      return;
    }

    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const totalCost = durationMinutes * session.price_per_minute;

    // Deduct from wallet
    const deductResult = await deductFromWallet(
      req.user.id,
      totalCost,
      `Chat with astrologer`,
      session.astrologer_id,
      sessionId,
      durationMinutes
    );

    if (!deductResult.success) {
      sendError(
        res,
        ErrorCodes.INSUFFICIENT_BALANCE,
        deductResult.error || 'Failed to deduct from wallet',
        400
      );
      return;
    }

    // Update session
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        end_time: endTime.toISOString(),
        duration: durationMinutes,
        total_cost: totalCost,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to end session', 500, updateError);
      return;
    }

    // Update astrologer total calls
    await supabaseAdmin.rpc('increment_astrologer_calls', { astrologer_id: session.astrologer_id });

    sendSuccess(res, {
      sessionId: updatedSession.id,
      duration: updatedSession.duration,
      totalCost: updatedSession.total_cost,
      endTime: updatedSession.end_time,
      status: updatedSession.status,
    });
  } catch (error) {
    console.error('Error in endChatSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to end chat session', 500, error);
  }
};

/**
 * Get chat messages for a session
 * GET /api/v1/chat/sessions/:sessionId/messages
 */
export const getChatMessages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { sessionId } = req.params;
    const limit = Number(req.query.limit) || 50;

    // Verify user has access to this session
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .or(`user_id.eq.${req.user.id},astrologer_id.eq.${req.user.id}`)
      .single();

    if (!session) {
      sendError(res, ErrorCodes.FORBIDDEN, 'Access denied to this session', 403);
      return;
    }

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching messages:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch messages', 500, error);
      return;
    }

    sendSuccess(res, messages || []);
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch messages', 500, error);
  }
};

/**
 * Send a chat message
 * POST /api/v1/chat/sessions/:sessionId/messages
 */
export const sendChatMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { sessionId } = req.params;
    const { message, type } = req.body;

    if (!message || typeof message !== 'string') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Message is required', 400);
      return;
    }

    const validTypes = ['text', 'image', 'file'];
    if (!type || !validTypes.includes(type)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid message type', 400);
      return;
    }

    // Verify session is active and user has access
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id, astrologer_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Session not found', 404);
      return;
    }

    if (session.status !== 'active') {
      sendError(res, ErrorCodes.BAD_REQUEST, 'Session is not active', 400);
      return;
    }

    // Determine sender type
    let senderType: 'user' | 'astrologer';
    if (req.user.id === session.user_id) {
      senderType = 'user';
    } else if (req.user.id === session.astrologer_id) {
      senderType = 'astrologer';
    } else {
      sendError(res, ErrorCodes.FORBIDDEN, 'Access denied to this session', 403);
      return;
    }

    // Create message
    const { data: newMessage, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender_id: req.user.id,
        sender_type: senderType,
        message,
        type,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to send message', 500, error);
      return;
    }

    sendSuccess(res, newMessage, 'Message sent successfully', 201);
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to send message', 500, error);
  }
};

/**
 * Rate a chat session
 * POST /api/v1/chat/sessions/:sessionId/rating
 */
export const rateChatSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { sessionId } = req.params;
    const { rating, review, tags } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Rating must be between 1 and 5', 400);
      return;
    }

    // Update session with rating
    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        rating: Number(rating),
        review: review || null,
        tags: tags || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Completed session not found', 404);
        return;
      }
      console.error('Error rating session:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to rate session', 500, error);
      return;
    }

    sendSuccess(res, { sessionId: session.id, rating: session.rating }, 'Session rated successfully');
  } catch (error) {
    console.error('Error in rateChatSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to rate session', 500, error);
  }
};
