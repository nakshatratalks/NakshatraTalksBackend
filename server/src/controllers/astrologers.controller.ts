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
import {
  validatePagination,
  isValidEmail,
  isValidPhone,
  sanitizeString,
  validateRequiredFields,
  isValidPrice
} from '../utils/validation.utils';

/**
 * Get live astrologers
 * GET /api/v1/astrologers/live
 */
export const getLiveAstrologers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;

    const { data: astrologers, error } = await supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('is_live', true)
      .eq('is_available', true)
      .eq('status', 'approved')
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching live astrologers:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch live astrologers', 500, error);
      return;
    }

    sendSuccess(res, astrologers?.map(a => formatAstrologerResponse(a)) || []);
  } catch (error) {
    console.error('Error in getLiveAstrologers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch live astrologers', 500, error);
  }
};

/**
 * Get top-rated astrologers
 * GET /api/v1/astrologers/top-rated
 */
export const getTopRatedAstrologers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;
    const sortBy = String(req.query.sortBy || 'rating');

    // Validate sortBy parameter
    const validSortFields = ['rating', 'total_calls', 'price_per_minute'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'rating';

    const { data: astrologers, error } = await supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('status', 'approved')
      .order(sortField, { ascending: sortField === 'price_per_minute' })
      .limit(limit);

    if (error) {
      console.error('Error fetching top-rated astrologers:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch top-rated astrologers', 500, error);
      return;
    }

    sendSuccess(res, astrologers?.map(a => formatAstrologerResponse(a, true)) || []);
  } catch (error) {
    console.error('Error in getTopRatedAstrologers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch top-rated astrologers', 500, error);
  }
};

/**
 * Get astrologer details by ID
 * GET /api/v1/astrologers/:id
 */
export const getAstrologerDetails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: astrologer, error } = await supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    // Fetch reviews for this astrologer
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('*, users(name)')
      .eq('astrologer_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedReviews = reviews?.map(r => ({
      userId: r.user_id,
      userName: r.users?.name || 'Anonymous',
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })) || [];

    sendSuccess(res, {
      ...formatAstrologerResponse(astrologer, true),
      bio: astrologer.bio,
      totalReviews: astrologer.total_reviews || 0,
      education: astrologer.education || [],
      workingHours: astrologer.working_hours || {},
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error('Error in getAstrologerDetails:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch astrologer details', 500, error);
  }
};

/**
 * Create astrologer (Admin only)
 * POST /api/v1/admin/astrologers
 */
export const createAstrologer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      image,
      bio,
      specialization,
      languages,
      experience,
      education,
      pricePerMinute,
      workingHours,
    } = req.body;

    // Validate required fields
    const { isValid, missingFields } = validateRequiredFields(req.body, [
      'name',
      'phone',
      'image',
      'specialization',
      'languages',
      'experience',
      'pricePerMinute',
    ]);

    if (!isValid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
      return;
    }

    // Validate phone
    if (!isValidPhone(phone)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid phone number format', 400);
      return;
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid email format', 400);
      return;
    }

    // Validate price
    if (!isValidPrice(pricePerMinute)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid price per minute', 400);
      return;
    }

    // Check if phone already exists
    const { data: existingAstrologer } = await supabaseAdmin
      .from('astrologers')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingAstrologer) {
      sendError(res, ErrorCodes.CONFLICT, 'Astrologer with this phone number already exists', 409);
      return;
    }

    // Create astrologer (use new pricing fields)
    const { data: newAstrologer, error } = await supabaseAdmin
      .from('astrologers')
      .insert({
        name: sanitizeString(name),
        email: email?.trim() || null,
        phone: phone.trim(),
        image,
        bio: bio || null,
        specialization,
        languages,
        experience: Number(experience),
        education: education || [],
        chat_price_per_minute: Number(pricePerMinute),
        call_price_per_minute: Number(pricePerMinute),
        price_per_minute: Number(pricePerMinute), // Keep for backward compatibility
        working_hours: workingHours || {},
        rating: 0,
        total_calls: 0,
        total_reviews: 0,
        is_available: true,
        is_live: false,
        status: 'pending',
        role: 'astrologer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating astrologer:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create astrologer', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        id: newAstrologer.id,
        name: newAstrologer.name,
        phone: newAstrologer.phone,
        email: newAstrologer.email,
        status: newAstrologer.status,
      },
      'Astrologer created successfully',
      201
    );
  } catch (error) {
    console.error('Error in createAstrologer:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create astrologer', 500, error);
  }
};

/**
 * Update astrologer (Admin only)
 * PUT /api/v1/admin/astrologers/:id
 */
export const updateAstrologer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Build update object with only provided fields
    const allowedFields = [
      'name',
      'email',
      'image',
      'bio',
      'specialization',
      'languages',
      'experience',
      'education',
      'pricePerMinute',
      'workingHours',
      'isAvailable',
      'status',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateData[dbField] = req.body[field];
      }
    }

    // Validate email if provided
    if (updateData.email && !isValidEmail(updateData.email as string)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid email format', 400);
      return;
    }

    // Validate price if provided
    if (updateData.price_per_minute && !isValidPrice(updateData.price_per_minute as number)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid price per minute', 400);
      return;
    }

    const { data: updatedAstrologer, error } = await supabaseAdmin
      .from('astrologers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
        return;
      }
      console.error('Error updating astrologer:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update astrologer', 500, error);
      return;
    }

    sendSuccess(res, formatAstrologerResponse(updatedAstrologer, true), 'Astrologer updated successfully');
  } catch (error) {
    console.error('Error in updateAstrologer:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update astrologer', 500, error);
  }
};

/**
 * Delete astrologer (Admin only)
 * DELETE /api/v1/admin/astrologers/:id
 */
export const deleteAstrologer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('astrologers')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
        return;
      }
      console.error('Error deleting astrologer:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete astrologer', 500, error);
      return;
    }

    sendSuccess(res, null, 'Astrologer deleted successfully');
  } catch (error) {
    console.error('Error in deleteAstrologer:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete astrologer', 500, error);
  }
};

/**
 * Get all astrologers (Admin only)
 * GET /api/v1/admin/astrologers
 */
export const getAllAstrologers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { page: pageParam, limit: limitParam, search, status, specialization } = req.query;
    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    let query = supabaseAdmin
      .from('astrologers')
      .select('*', { count: 'exact' });

    if (search) {
      const searchStr = String(search);
      query = query.or(`name.ilike.%${searchStr}%,email.ilike.%${searchStr}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (specialization) {
      query = query.contains('specialization', [String(specialization)]);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: astrologers, error, count } = await query;

    if (error) {
      console.error('Error fetching astrologers:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch astrologers', 500, error);
      return;
    }

    const pagination = calculatePagination(count || 0, page, limit);

    sendPaginatedSuccess(
      res,
      astrologers?.map(a => formatAstrologerResponse(a, true)) || [],
      pagination
    );
  } catch (error) {
    console.error('Error in getAllAstrologers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch astrologers', 500, error);
  }
};

/**
 * Update astrologer live status
 * PATCH /api/v1/astrologers/:id/live-status
 */
export const updateLiveStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isLive } = req.body;

    if (typeof isLive !== 'boolean') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'isLive must be a boolean value', 400);
      return;
    }

    // Verify astrologer owns this profile (or is admin)
    if (req.user?.id !== id && req.user?.role !== 'admin') {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only update your own live status', 403);
      return;
    }

    const { data: updatedAstrologer, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        is_live: isLive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
        return;
      }
      console.error('Error updating live status:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update live status', 500, error);
      return;
    }

    sendSuccess(
      res,
      { isLive: updatedAstrologer.is_live },
      `Live status ${isLive ? 'enabled' : 'disabled'} successfully`
    );
  } catch (error) {
    console.error('Error in updateLiveStatus:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update live status', 500, error);
  }
};

/**
 * Get all unique specializations from astrologers
 * GET /api/v1/specializations
 */
export const getSpecializations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const isActiveParam = req.query.isActive;

    // Build query to fetch all astrologers' specializations
    let query = supabaseAdmin
      .from('astrologers')
      .select('specialization')
      .eq('status', 'approved');

    // Filter by active status if provided
    if (isActiveParam !== undefined) {
      const isActive = isActiveParam === 'true';
      query = query.eq('is_available', isActive);
    }

    const { data: astrologers, error } = await query;

    if (error) {
      console.error('Error fetching specializations:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch specializations', 500, error);
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
        id: `spec-${index + 1}`,
        name,
        icon: null,
        description: null,
        order: index + 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    sendSuccess(res, specializations, 'Specializations fetched successfully');
  } catch (error) {
    console.error('Error in getSpecializations:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch specializations', 500, error);
  }
};

/**
 * Toggle chat availability status
 * PATCH /api/v1/astrologers/:id/toggle-chat-availability
 */
export const toggleChatAvailability = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { chatAvailable } = req.body;

    if (typeof chatAvailable !== 'boolean') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'chatAvailable must be a boolean value', 400);
      return;
    }

    // Verify astrologer owns this profile (or is admin)
    if (req.user?.id !== id && req.user?.role !== 'admin') {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only update your own availability status', 403);
      return;
    }

    const { data: updatedAstrologer, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        chat_available: chatAvailable,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
        return;
      }
      console.error('Error updating chat availability:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update chat availability', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        chatAvailable: updatedAstrologer.chat_available,
        lastActivityAt: updatedAstrologer.last_activity_at
      },
      `Chat availability ${chatAvailable ? 'enabled' : 'disabled'} successfully`
    );
  } catch (error) {
    console.error('Error in toggleChatAvailability:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update chat availability', 500, error);
  }
};

/**
 * Toggle call availability status
 * PATCH /api/v1/astrologers/:id/toggle-call-availability
 */
export const toggleCallAvailability = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { callAvailable } = req.body;

    if (typeof callAvailable !== 'boolean') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'callAvailable must be a boolean value', 400);
      return;
    }

    // Verify astrologer owns this profile (or is admin)
    if (req.user?.id !== id && req.user?.role !== 'admin') {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only update your own availability status', 403);
      return;
    }

    const { data: updatedAstrologer, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        call_available: callAvailable,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
        return;
      }
      console.error('Error updating call availability:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update call availability', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        callAvailable: updatedAstrologer.call_available,
        lastActivityAt: updatedAstrologer.last_activity_at
      },
      `Call availability ${callAvailable ? 'enabled' : 'disabled'} successfully`
    );
  } catch (error) {
    console.error('Error in toggleCallAvailability:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update call availability', 500, error);
  }
};

/**
 * Update heartbeat timestamp
 * POST /api/v1/astrologers/:id/heartbeat
 */
export const updateHeartbeat = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify astrologer owns this profile
    if (req.user?.id !== id) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only update your own heartbeat', 403);
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('astrologers')
      .update({
        last_activity_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating heartbeat:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update heartbeat', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        success: true,
        lastActivityAt: now
      }
    );
  } catch (error) {
    console.error('Error in updateHeartbeat:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update heartbeat', 500, error);
  }
};

/**
 * Get astrologer availability status
 * GET /api/v1/astrologers/:id/availability-status
 */
export const getAvailabilityStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify astrologer owns this profile (or is admin)
    if (req.user?.id !== id && req.user?.role !== 'admin') {
      sendError(res, ErrorCodes.FORBIDDEN, 'You can only view your own availability status', 403);
      return;
    }

    const { data: astrologer, error } = await supabaseAdmin
      .from('astrologers')
      .select('id, chat_available, call_available, last_activity_at, chat_price_per_minute, call_price_per_minute')
      .eq('id', id)
      .single();

    if (error || !astrologer) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Astrologer not found', 404);
      return;
    }

    sendSuccess(res, {
      id: astrologer.id,
      chatAvailable: astrologer.chat_available,
      callAvailable: astrologer.call_available,
      lastActivityAt: astrologer.last_activity_at,
      chatPricePerMinute: astrologer.chat_price_per_minute,
      callPricePerMinute: astrologer.call_price_per_minute,
    });
  } catch (error) {
    console.error('Error in getAvailabilityStatus:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch availability status', 500, error);
  }
};

/**
 * Helper function to format astrologer response
 */
const formatAstrologerResponse = (astrologer: any, includeDetails = false) => {
  const base = {
    id: astrologer.id,
    name: astrologer.name,
    image: astrologer.image,
    isLive: astrologer.is_live,
    specialization: astrologer.specialization || [],
    languages: astrologer.languages || [],
    experience: astrologer.experience,
    rating: astrologer.rating || 0,
    totalCalls: astrologer.total_calls || 0,
  };

  if (includeDetails) {
    return {
      ...base,
      email: astrologer.email,
      phone: astrologer.phone,
      // Use new pricing fields, fallback to old field for backward compatibility
      chatPricePerMinute: astrologer.chat_price_per_minute || astrologer.price_per_minute,
      callPricePerMinute: astrologer.call_price_per_minute || astrologer.price_per_minute,
      pricePerMinute: astrologer.price_per_minute, // Keep for backward compatibility
      isAvailable: astrologer.is_available,
      chatAvailable: astrologer.chat_available,
      callAvailable: astrologer.call_available,
      lastActivityAt: astrologer.last_activity_at,
      nextAvailableAt: astrologer.next_available_at || null,
      status: astrologer.status,
    };
  }

  return base;
};
