import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../types/auth.types';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { isValidEmail, validateRequiredFields } from '../utils/validation.utils';

/**
 * Admin signup with email/password
 * POST /auth/admin/signup
 */
export const adminSignup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validate required fields
    const { isValid, missingFields } = validateRequiredFields(req.body, [
      'username',
      'email',
      'password',
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

    // Validate email
    if (!isValidEmail(email)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid email format', 400);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        'Password must be at least 8 characters',
        400
      );
      return;
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existingAdmin) {
      sendError(
        res,
        ErrorCodes.CONFLICT,
        'Admin with this username or email already exists',
        409
      );
      return;
    }

    // Create auth user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
          user_type: 'admin',
        },
      },
    });

    if (authError || !authData.user) {
      console.error('Admin signup error:', authError);
      sendError(
        res,
        ErrorCodes.SERVER_ERROR,
        authError?.message || 'Failed to create admin account',
        500,
        authError
      );
      return;
    }

    // Create admin record in admins table
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .insert({
        auth_user_id: authData.user.id,
        username,
        email,
        password_hash: 'managed_by_supabase_auth',
        full_name: fullName || null,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (adminError) {
      console.error('Error creating admin record:', adminError);
      // Cleanup: delete auth user if admin record creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      sendError(
        res,
        ErrorCodes.SERVER_ERROR,
        'Failed to create admin profile',
        500,
        adminError
      );
      return;
    }

    sendSuccess(
      res,
      {
        adminId: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        message: 'Admin account created successfully. Please sign in.',
      },
      'Admin account created successfully',
      201
    );
  } catch (error) {
    console.error('Error in adminSignup:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create admin account', 500, error);
  }
};

/**
 * Admin signin with email/password
 * POST /auth/admin/signin
 */
export const adminSignin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    const { isValid, missingFields } = validateRequiredFields(req.body, [
      'email',
      'password',
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

    // Sign in via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      console.error('Admin signin error:', authError);
      sendError(
        res,
        ErrorCodes.UNAUTHORIZED,
        authError?.message || 'Invalid email or password',
        401,
        authError
      );
      return;
    }

    // Get admin profile from admins table
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, full_name, role, is_active, linked_user_id')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (adminError || !admin) {
      sendError(
        res,
        ErrorCodes.FORBIDDEN,
        'Admin account not found or not authorized',
        403
      );
      return;
    }

    if (!admin.is_active) {
      sendError(
        res,
        ErrorCodes.FORBIDDEN,
        'Admin account is inactive. Contact system administrator.',
        403
      );
      return;
    }

    // Update last login
    await supabaseAdmin
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    sendSuccess(res, {
      success: true,
      message: 'Admin signed in successfully',
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        linkedUserId: admin.linked_user_id,
      },
    });
  } catch (error) {
    console.error('Error in adminSignin:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to sign in', 500, error);
  }
};

/**
 * Get current admin profile
 * GET /auth/admin/me
 */
export const getCurrentAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
      return;
    }

    // Get admin profile
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, full_name, role, is_active, linked_user_id, last_login, created_at')
      .eq('auth_user_id', req.user.id)
      .single();

    if (error || !admin) {
      sendError(res, ErrorCodes.FORBIDDEN, 'Admin account not found', 403);
      return;
    }

    sendSuccess(res, {
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        isActive: admin.is_active,
        linkedUserId: admin.linked_user_id,
        lastLogin: admin.last_login,
        createdAt: admin.created_at,
      },
    });
  } catch (error) {
    console.error('Error in getCurrentAdmin:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch admin profile', 500, error);
  }
};

/**
 * Link admin account to a regular user account
 * POST /auth/admin/link-user
 */
export const linkAdminToUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'User ID is required', 400);
      return;
    }

    // Get admin
    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('auth_user_id', req.user.id)
      .single();

    if (!admin) {
      sendError(res, ErrorCodes.FORBIDDEN, 'Admin account not found', 403);
      return;
    }

    // Verify user exists
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, phone, name')
      .eq('id', userId)
      .single();

    if (!user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    // Link admin to user
    const { error: linkError } = await supabaseAdmin
      .from('admins')
      .update({ linked_user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', admin.id);

    if (linkError) {
      console.error('Error linking admin to user:', linkError);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to link accounts', 500, linkError);
      return;
    }

    sendSuccess(res, {
      message: 'Admin account successfully linked to user account',
      linkedUser: {
        id: user.id,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Error in linkAdminToUser:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to link accounts', 500, error);
  }
};
