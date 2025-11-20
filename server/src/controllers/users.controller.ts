import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes, sendPaginatedSuccess, calculatePagination } from '../utils/response.utils';
import { validatePagination, isValidEmail, sanitizeString } from '../utils/validation.utils';

/**
 * Get current user profile
 * GET /api/v1/users/profile
 */
export const getUserProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User profile not found', 404);
      return;
    }

    // Remove sensitive data
    const { ...userProfile } = profile;

    sendSuccess(res, {
      userId: userProfile.id,
      name: userProfile.name,
      phone: userProfile.phone,
      email: userProfile.email,
      profileImage: userProfile.profile_image,
      walletBalance: userProfile.wallet_balance || 0,
      dateOfBirth: userProfile.date_of_birth,
      placeOfBirth: userProfile.place_of_birth,
      timeOfBirth: userProfile.time_of_birth,
      gender: userProfile.gender,
      maritalStatus: userProfile.marital_status,
      createdAt: userProfile.created_at,
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch user profile', 500, error);
  }
};

/**
 * Update user profile
 * PUT /api/v1/users/profile
 */
export const updateUserProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'User not authenticated', 401);
      return;
    }

    const {
      name,
      email,
      profileImage,
      dateOfBirth,
      placeOfBirth,
      timeOfBirth,
      gender,
      maritalStatus,
    } = req.body;

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid email format', 400);
      return;
    }

    // Validate gender if provided
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid gender value', 400);
      return;
    }

    // Validate marital status if provided
    if (maritalStatus && !['single', 'married', 'divorced', 'widowed'].includes(maritalStatus)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid marital status value', 400);
      return;
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = sanitizeString(name);
    if (email !== undefined) updateData.email = email.trim() || null;
    if (profileImage !== undefined) updateData.profile_image = profileImage;
    if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth;
    if (placeOfBirth !== undefined) updateData.place_of_birth = sanitizeString(placeOfBirth);
    if (timeOfBirth !== undefined) updateData.time_of_birth = timeOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (maritalStatus !== undefined) updateData.marital_status = maritalStatus;

    // Update user profile
    const { data: updatedProfile, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update profile', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        userId: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
        profileImage: updatedProfile.profile_image,
        dateOfBirth: updatedProfile.date_of_birth,
        placeOfBirth: updatedProfile.place_of_birth,
        timeOfBirth: updatedProfile.time_of_birth,
        gender: updatedProfile.gender,
        maritalStatus: updatedProfile.marital_status,
        updatedAt: updatedProfile.updated_at,
      },
      'Profile updated successfully'
    );
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update profile', 500, error);
  }
};

/**
 * Get all users (Admin only)
 * GET /api/v1/admin/users
 */
export const getAllUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { page: pageParam, limit: limitParam, search, status } = req.query;
    const { page, limit, error: validationError } = validatePagination(pageParam, limitParam);

    if (validationError) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, validationError, 400);
      return;
    }

    // Build query
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      const searchStr = String(search);
      query = query.or(`name.ilike.%${searchStr}%,email.ilike.%${searchStr}%,phone.ilike.%${searchStr}%`);
    }

    // Apply status filter
    if (status) {
      const isActive = status === 'active';
      query = query.eq('is_active', isActive);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch users', 500, error);
      return;
    }

    const pagination = calculatePagination(count || 0, page, limit);

    sendPaginatedSuccess(
      res,
      users?.map(user => ({
        userId: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        profileImage: user.profile_image,
        walletBalance: user.wallet_balance || 0,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
      })) || [],
      pagination
    );
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch users', 500, error);
  }
};
