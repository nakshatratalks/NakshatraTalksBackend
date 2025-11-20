import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, ErrorResponse } from '../types/auth.types';

/**
 * Middleware to authenticate user using JWT token from Authorization header
 * Extracts token from "Bearer <token>" format and verifies it with Supabase
 * Attaches authenticated user to req.user
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response<ErrorResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header',
      });
      return;
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
      return;
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        details: error,
      });
      return;
    }

    if (!data.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    // Attach user to request object
    req.user = data.user as AuthenticatedRequest['user'];

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Unexpected error in authenticateUser middleware:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during authentication',
      details: error,
    });
  }
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if token is missing/invalid
 * Use for routes where authentication is optional
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (token) {
      const { data } = await supabase.auth.getUser(token);

      if (data.user) {
        req.user = data.user as AuthenticatedRequest['user'];
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if there's an error
    console.error('Error in optionalAuth middleware:', error);
    next();
  }
};
