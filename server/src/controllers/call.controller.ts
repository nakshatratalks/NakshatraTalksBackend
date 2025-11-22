import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { deductFromWallet } from '../controllers/wallet.controller';

/**
 * Get available astrologers for call
 * GET /api/v1/call/astrologers
 */
export const getAvailableAstrologersForCall = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      specialization,
      language,
      minRating,
      maxPrice,
      sortBy = 'rating',
      onlyLive,
      limit: limitParam = '20',
      offset: offsetParam = '0',
    } = req.query;

    const limit = parseInt(limitParam as string, 10);
    const offset = parseInt(offsetParam as string, 10);

    // Build query
    let query = supabaseAdmin
      .from('astrologers')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
      .eq('is_available', true)
      .not('call_price_per_minute', 'is', null);

    // Apply filters
    if (specialization) {
      query = query.contains('specialization', [String(specialization)]);
    }

    if (language) {
      query = query.contains('languages', [String(language)]);
    }

    if (minRating) {
      query = query.gte('rating', Number(minRating));
    }

    if (maxPrice) {
      query = query.lte('call_price_per_minute', Number(maxPrice));
    }

    if (onlyLive === 'true') {
      query = query.eq('is_live', true);
    }

    // Apply sorting
    const validSortFields: Record<string, string> = {
      rating: 'rating',
      price: 'call_price_per_minute',
      experience: 'experience',
      calls: 'total_calls',
    };

    const sortField = validSortFields[String(sortBy)] || 'rating';
    const ascending = sortField === 'call_price_per_minute'; // Price ascending, others descending

    query = query.order(sortField, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: astrologers, error, count } = await query;

    if (error) {
      console.error('Error fetching astrologers for call:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch astrologers', 500, error);
      return;
    }

    const formattedAstrologers = astrologers?.map(a => ({
      id: a.id,
      name: a.name,
      image: a.image,
      isLive: a.is_live,
      isAvailable: a.is_available,
      specialization: a.specialization || [],
      languages: a.languages || [],
      experience: a.experience,
      rating: a.rating || 0,
      totalCalls: a.total_calls || 0,
      callPricePerMinute: a.call_price_per_minute,
      nextAvailableAt: a.next_available_at || null,
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
      data: formattedAstrologers,
      pagination,
    });
  } catch (error) {
    console.error('Error in getAvailableAstrologersForCall:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch astrologers', 500, error);
  }
};

/**
 * Validate balance before starting a call
 * POST /api/v1/call/validate-balance
 */
export const validateBalanceForCall = async (
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

    // Get astrologer call pricing
    const { data: astrologer, error: astrologerError } = await supabaseAdmin
      .from('astrologers')
      .select('call_price_per_minute')
      .eq('id', astrologerId)
      .single();

    if (astrologerError || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    const pricePerMinute = astrologer.call_price_per_minute;
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
    const canStartCall = currentBalance >= minimumRequired;
    const estimatedMinutes = Math.floor(currentBalance / pricePerMinute);

    if (!canStartCall) {
      const shortfall = minimumRequired - currentBalance;
      sendError(
        res,
        ErrorCodes.INSUFFICIENT_BALANCE,
        `You need ₹${shortfall.toFixed(2)} more to start this call`,
        400,
        {
          canStartCall: false,
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
        canStartCall: true,
        currentBalance,
        pricePerMinute,
        minimumRequired,
        estimatedMinutes,
      },
      'Sufficient balance available'
    );
  } catch (error) {
    console.error('Error in validateBalanceForCall:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to validate balance', 500, error);
  }
};

/**
 * Start a call session
 * POST /api/v1/call/sessions
 */
export const startCallSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { astrologerId, sessionType = 'call' } = req.body;

    if (!astrologerId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Astrologer ID is required', 400);
      return;
    }

    const validSessionTypes = ['call', 'video'];
    if (!validSessionTypes.includes(sessionType)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session type. Must be call or video', 400);
      return;
    }

    // Get astrologer details with call pricing
    const { data: astrologer, error: astrologerError } = await supabaseAdmin
      .from('astrologers')
      .select('id, name, call_price_per_minute, is_available, status')
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

    const pricePerMinute = astrologer.call_price_per_minute;
    const minimumRequired = pricePerMinute * 5; // 5 minutes minimum

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

    // Create new call session
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
      console.error('Error creating call session:', sessionError);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to start call session', 500, sessionError);
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
        // Twilio room details will be added here later
        twilioRoomId: null, // Placeholder for future Twilio integration
        twilioToken: null, // Placeholder for future Twilio integration
      },
      'Call session created successfully',
      201
    );
  } catch (error) {
    console.error('Error in startCallSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to start call session', 500, error);
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

    // Calculate exact duration in seconds
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    const durationMinutes = durationSeconds / 60;

    // Calculate exact per-second cost (no rounding up)
    const totalCost = parseFloat((durationMinutes * session.price_per_minute).toFixed(2));

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
 * End a call session
 * POST /api/v1/call/sessions/:sessionId/end
 */
export const endCallSession = async (
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
      .in('session_type', ['call', 'video'])
      .single();

    if (sessionError || !session) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Active call session not found', 404);
      return;
    }

    const endTime = new Date();
    const startTime = new Date(session.start_time);

    // Calculate exact duration in seconds
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    const durationMinutes = durationSeconds / 60;

    // Calculate exact per-second cost (no rounding up)
    const totalCost = parseFloat((durationMinutes * session.price_per_minute).toFixed(2));

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

    // Format duration message
    const durationText = durationSeconds < 60
      ? `${Math.round(durationSeconds)} seconds`
      : `${durationMinutes.toFixed(1)} minutes`;

    sendSuccess(
      res,
      {
        sessionId: updatedSession.id,
        startTime: updatedSession.start_time,
        endTime: updatedSession.end_time,
        duration: updatedSession.duration,
        durationSeconds: Math.round(durationSeconds),
        pricePerMinute: updatedSession.price_per_minute,
        totalCost: updatedSession.total_cost,
        remainingBalance: deductResult.remainingBalance,
        transactionId: deductResult.transactionId,
      },
      `Call session ended successfully. Total cost: ₹${updatedSession.total_cost} for ${durationText}`
    );
  } catch (error) {
    console.error('Error in endCallSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to end call session', 500, error);
  }
};

/**
 * Get active call session
 * GET /api/v1/call/sessions/active
 */
export const getActiveCallSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    // Get active call/video session for this user
    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*, astrologers(name, image)')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .in('session_type', ['call', 'video'])
      .maybeSingle();

    if (error) {
      console.error('Error fetching active call session:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch active call session', 500, error);
      return;
    }

    if (!session) {
      sendSuccess(res, null, 'No active call session found');
      return;
    }

    sendSuccess(res, {
      id: session.id,
      userId: session.user_id,
      astrologerId: session.astrologer_id,
      astrologerName: session.astrologers?.name,
      astrologerImage: session.astrologers?.image,
      sessionType: session.session_type,
      startTime: session.start_time,
      pricePerMinute: session.price_per_minute,
      status: session.status,
      // Twilio room details will be added here later
      twilioRoomId: null,
      twilioToken: null,
    });
  } catch (error) {
    console.error('Error in getActiveCallSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch active call session', 500, error);
  }
};

/**
 * Get call history with filters
 * GET /api/v1/call/sessions
 */
export const getCallHistory = async (
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

    // Build query for call/video sessions only
    let query = supabaseAdmin
      .from('chat_sessions')
      .select('*, astrologers(name, image)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .in('session_type', ['call', 'video']);

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
      console.error('Error fetching call history:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch call history', 500, error);
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
    console.error('Error in getCallHistory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch call history', 500, error);
  }
};

/**
 * Get call session details
 * GET /api/v1/call/sessions/:sessionId
 */
export const getCallSessionDetails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { sessionId } = req.params;

    // Verify user has access to this session
    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*, astrologers(name, image, phone)')
      .eq('id', sessionId)
      .or(`user_id.eq.${req.user.id},astrologer_id.eq.${req.user.id}`)
      .in('session_type', ['call', 'video'])
      .single();

    if (error || !session) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Call session not found', 404);
      return;
    }

    sendSuccess(res, {
      id: session.id,
      userId: session.user_id,
      astrologerId: session.astrologer_id,
      astrologerName: session.astrologers?.name,
      astrologerImage: session.astrologers?.image,
      sessionType: session.session_type,
      startTime: session.start_time,
      endTime: session.end_time,
      duration: session.duration,
      pricePerMinute: session.price_per_minute,
      totalCost: session.total_cost,
      status: session.status,
      rating: session.rating,
      review: session.review,
      tags: session.tags,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      // Twilio room details will be added here later
      twilioRoomId: null,
      twilioToken: null,
    });
  } catch (error) {
    console.error('Error in getCallSessionDetails:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch call session details', 500, error);
  }
};

/**
 * Rate a call session
 * POST /api/v1/call/sessions/:sessionId/rating
 */
export const rateCallSession = async (
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
      .in('session_type', ['call', 'video'])
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Completed call session not found', 404);
        return;
      }
      console.error('Error rating call session:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to rate call session', 500, error);
      return;
    }

    sendSuccess(res, { sessionId: session.id, rating: session.rating }, 'Call session rated successfully');
  } catch (error) {
    console.error('Error in rateCallSession:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to rate call session', 500, error);
  }
};

/**
 * Get all unique specializations from astrologers who offer calls
 * GET /api/v1/call/specializations
 */
export const getCallSpecializations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const isActiveParam = req.query.isActive;

    // Build query to fetch specializations from astrologers who offer call services
    let query = supabaseAdmin
      .from('astrologers')
      .select('specialization')
      .eq('status', 'approved')
      .not('call_price_per_minute', 'is', null);

    // Filter by active status if provided
    if (isActiveParam !== undefined) {
      const isActive = isActiveParam === 'true';
      query = query.eq('is_available', isActive);
    }

    const { data: astrologers, error } = await query;

    if (error) {
      console.error('Error fetching call specializations:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch call specializations', 500, error);
      return;
    }

    // Extract and flatten all specializations
    const specializationsSet = new Set<string>();
    astrologers?.forEach((astrologer: any) => {
      if (Array.isArray(astrologer.specialization)) {
        astrologer.specialization.forEach((spec: string) => {
          if (spec && spec.trim()) {
            specializationsSet.add(spec.trim());
          }
        });
      }
    });

    // Convert to array and format as objects with metadata
    const specializations = Array.from(specializationsSet)
      .sort()
      .map((name, index) => ({
        id: `call-spec-${index + 1}`,
        name,
        icon: null,
        description: null,
        order: index + 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    sendSuccess(res, specializations, 'Call specializations fetched successfully');
  } catch (error) {
    console.error('Error in getCallSpecializations:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch call specializations', 500, error);
  }
};
