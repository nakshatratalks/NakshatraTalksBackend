import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { sendError, ErrorCodes } from '../utils/response.utils';
import { supabaseAdmin } from '../config/supabase';

/**
 * User roles in the system
 */
export enum UserRole {
  USER = 'user',
  ASTROLOGER = 'astrologer',
  ADMIN = 'admin',
}

/**
 * Middleware to check if user has required role(s)
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        sendError(res, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
        return;
      }

      // Get user profile with role from database
      const { data: profile, error } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error || !profile) {
        sendError(res, ErrorCodes.UNAUTHORIZED, 'User profile not found', 401);
        return;
      }

      const userRole = profile.role as UserRole;

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(userRole)) {
        sendError(
          res,
          ErrorCodes.FORBIDDEN,
          'Insufficient permissions to access this resource',
          403
        );
        return;
      }

      // Attach role to request for use in controllers
      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('Error in requireRole middleware:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Authorization check failed', 500);
    }
  };
};

/**
 * Middleware to check if user is admin (checks admins table)
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
      return;
    }

    // Check if user is in admins table
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, full_name, role, is_active, linked_user_id')
      .eq('auth_user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      sendError(
        res,
        ErrorCodes.FORBIDDEN,
        'Admin access required. You must be an admin to access this resource.',
        403
      );
      return;
    }

    // Attach admin info to request
    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      linkedUserId: admin.linked_user_id,
    };

    next();
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Authorization check failed', 500);
  }
};

/**
 * Middleware to check if user is astrologer
 */
export const requireAstrologer = requireRole([UserRole.ASTROLOGER]);

/**
 * Middleware to check if user is admin or astrologer
 */
export const requireAdminOrAstrologer = requireRole([UserRole.ADMIN, UserRole.ASTROLOGER]);

/**
 * Middleware to check resource ownership
 * Use for endpoints where users can only access their own resources
 */
export const requireOwnership = (resourceIdParam = 'id') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        sendError(res, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
        return;
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // Get user role
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      // Admins can access any resource
      if (profile?.role === UserRole.ADMIN) {
        next();
        return;
      }

      // Check if user owns the resource
      if (resourceId !== userId) {
        sendError(
          res,
          ErrorCodes.FORBIDDEN,
          'You can only access your own resources',
          403
        );
        return;
      }

      next();
    } catch (error) {
      console.error('Error in requireOwnership middleware:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Ownership check failed', 500);
    }
  };
};
