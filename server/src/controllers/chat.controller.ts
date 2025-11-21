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
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session type. Must be chat, call, or video', 400);
      return;
    }

    // Get astrologer details with new pricing fields
    const { data: astrologer, error: astrologerError } = await supabaseAdmin
      .from('astrologers')
      .select('id, name, chat_price_per_minute, call_price_per_minute, is_available, status')
      .eq('id', astrologerId)
      .single();

    if (astrologerError || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    if (astrologer.status !== 'approved') {
      sendError(res, ErrorCodes.BAD_REQUEST, 'Astrologer is not approved', 400);
      return;
    }

    if (!astrologer.is_available) {
      sendError(res, ErrorCodes.BAD_REQUEST, 'Astrologer is currently unavailable', 400);
      return;
    }

    // Determine price based on session type
    const pricePerMinute = sessionType === 'chat'
      ? astrologer.chat_price_per_minute
      : astrologer.call_price_per_minute;

    // Minimum balance required (5 minutes)
    const minimumRequired = pricePerMinute * 5;

    // Check user wallet balance
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (!user || (user.wallet_balance || 0) < minimumRequired) {
      sendError(
        res,
        ErrorCodes.INSUFFICIENT_BALANCE,
        `Insufficient wallet balance. Minimum ₹${minimumRequired} required (5 minutes at ₹${pricePerMinute}/min). Please recharge to continue.`,
        400
      );
      return;
    }

    // Check for existing active session and end it
    const { data: existingSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSession) {
      // End the existing session automatically
      await endExistingSession(existingSession.id, req.user.id);
    }

    // Create new chat session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: req.user.id,
        astrologer_id: astrologerId,
        session_type: sessionType,
        start_time: new Date().toISOString(),
        price_per_minute: pricePerMinute,
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
        id: session.id,
        userId: session.user_id,
        astrologerId: session.astrologer_id,
        astrologerName: astrologer.name,
        sessionType: session.session_type,
        startTime: session.start_time,
        endTime: null,
        duration: null,
        pricePerMinute: session.price_per_minute,
        totalCost: null,
        status: session.status,
        rating: null,
        review: null,
        tags: null,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      'Chat session created successfully',
      201
    );
  } catch (error) {
    console.error('Error in startChatSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to start chat session', 500, error);
  }
};

/**
 * Helper function to end an existing active session
 */
const endExistingSession = async (sessionId: string, userId: string): Promise<void> => {
  try {
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return;

    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const totalCost = durationMinutes * session.price_per_minute;

    // Deduct from wallet
    await deductFromWallet(
      userId,
      totalCost,
      `${session.session_type} session ended automatically`,
      session.astrologer_id,
      sessionId,
      durationMinutes
    );

    // Update session
    await supabaseAdmin
      .from('chat_sessions')
      .update({
        end_time: endTime.toISOString(),
        duration: durationMinutes,
        total_cost: totalCost,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Update astrologer total calls
    await supabaseAdmin.rpc('increment_astrologer_calls', { astrologer_id: session.astrologer_id });
  } catch (error) {
    console.error('Error ending existing session:', error);
  }
};

/**
 * End a chat session
 * POST /api/v1/chat/sessions/:sessionId/end
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
    const { endReason } = req.body;

    // Validate endReason if provided
    const validEndReasons = ['user_ended', 'astrologer_ended', 'timeout', 'insufficient_balance'];
    if (endReason && !validEndReasons.includes(endReason)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid end reason', 400);
      return;
    }

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
      `${session.session_type} session with astrologer`,
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

    sendSuccess(
      res,
      {
        sessionId: updatedSession.id,
        startTime: updatedSession.start_time,
        endTime: updatedSession.end_time,
        duration: updatedSession.duration,
        pricePerMinute: updatedSession.price_per_minute,
        totalCost: updatedSession.total_cost,
        remainingBalance: deductResult.remainingBalance,
        transactionId: deductResult.transactionId,
      },
      `Session ended successfully. Total cost: ₹${updatedSession.total_cost} for ${updatedSession.duration} minutes`
    );
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

/**
 * Get active chat session
 * GET /api/v1/chat/sessions/active
 */
export const getActiveSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    // Get active session for this user
    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*, astrologers(name)')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error fetching active session:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch active session', 500, error);
      return;
    }

    if (!session) {
      sendSuccess(res, null, 'No active session found');
      return;
    }

    sendSuccess(res, {
      id: session.id,
      userId: session.user_id,
      astrologerId: session.astrologer_id,
      astrologerName: session.astrologers?.name,
      sessionType: session.session_type,
      startTime: session.start_time,
      pricePerMinute: session.price_per_minute,
      status: session.status,
    });
  } catch (error) {
    console.error('Error in getActiveSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch active session', 500, error);
  }
};

/**
 * Validate balance before starting a chat
 * POST /api/v1/chat/validate-balance
 */
export const validateBalance = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { astrologerId } = req.body;

    if (!astrologerId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Astrologer ID is required', 400);
      return;
    }

    // Get astrologer pricing (default to chat price)
    const { data: astrologer, error: astrologerError } = await supabaseAdmin
      .from('astrologers')
      .select('chat_price_per_minute, call_price_per_minute')
      .eq('id', astrologerId)
      .single();

    if (astrologerError || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    // Use chat price as default (user can override with sessionType in actual session start)
    const pricePerMinute = astrologer.chat_price_per_minute;
    const minimumRequired = pricePerMinute * 5; // 5 minutes minimum

    // Get user wallet balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (userError || !user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    const currentBalance = user.wallet_balance || 0;
    const canStartChat = currentBalance >= minimumRequired;
    const estimatedMinutes = Math.floor(currentBalance / pricePerMinute);

    if (!canStartChat) {
      const shortfall = minimumRequired - currentBalance;
      sendError(
        res,
        ErrorCodes.INSUFFICIENT_BALANCE,
        `You need ₹${shortfall.toFixed(2)} more to start this chat`,
        400,
        {
          canStartChat: false,
          currentBalance,
          pricePerMinute,
          minimumRequired,
          shortfall,
        }
      );
      return;
    }

    sendSuccess(
      res,
      {
        canStartChat: true,
        currentBalance,
        pricePerMinute,
        minimumRequired,
        estimatedMinutes,
      },
      'Sufficient balance available'
    );
  } catch (error) {
    console.error('Error in validateBalance:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to validate balance', 500, error);
  }
};

/**
 * Get chat history with filters
 * GET /api/v1/chat/sessions
 */
export const getChatHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { status, astrologerId, limit: limitParam = '20', offset: offsetParam = '0' } = req.query;
    const limit = parseInt(limitParam as string, 10);
    const offset = parseInt(offsetParam as string, 10);

    // Build query
    let query = supabaseAdmin
      .from('chat_sessions')
      .select('*, astrologers(name, image)', { count: 'exact' })
      .eq('user_id', req.user.id);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (astrologerId) {
      query = query.eq('astrologer_id', astrologerId);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error('Error fetching chat history:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch chat history', 500, error);
      return;
    }

    const formattedSessions = sessions?.map(s => ({
      id: s.id,
      astrologerId: s.astrologer_id,
      astrologerName: s.astrologers?.name,
      astrologerImage: s.astrologers?.image,
      sessionType: s.session_type,
      startTime: s.start_time,
      endTime: s.end_time,
      duration: s.duration,
      pricePerMinute: s.price_per_minute,
      totalCost: s.total_cost,
      status: s.status,
      rating: s.rating,
      review: s.review,
      createdAt: s.created_at,
    })) || [];

    const totalPages = Math.ceil((count || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const pagination = {
      currentPage,
      totalPages,
      totalItems: count || 0,
      itemsPerPage: limit,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };

    res.status(200).json({
      success: true,
      data: formattedSessions,
      pagination,
    });
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch chat history', 500, error);
  }
};
