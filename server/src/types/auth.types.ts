import { Request } from 'express';
import { User } from '@supabase/supabase-js';

/**
 * Request body for sending OTP
 */
export interface SendOtpRequest {
  phone: string;
}

/**
 * Request body for verifying OTP
 */
export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

/**
 * Authenticated user data
 */
export interface AuthenticatedUser extends User {
  id: string;
  phone?: string;
  email?: string;
  role?: 'user' | 'astrologer' | 'admin';
}

/**
 * Admin user data (from admins table)
 */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: string;
  linkedUserId?: string;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  admin?: AdminUser;
}

/**
 * OTP send response
 */
export interface OtpSendResponse {
  success: boolean;
  message: string;
}

/**
 * OTP verify response
 */
export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  access_token?: string;
  refresh_token?: string;
  user?: AuthenticatedUser;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}
