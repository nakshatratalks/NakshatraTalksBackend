import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  SendOtpRequest,
  VerifyOtpRequest,
  OtpSendResponse,
  OtpVerifyResponse,
  ErrorResponse,
  AuthenticatedRequest,
} from '../types/auth.types';

/**
 * Send OTP to the provided phone number
 * @param req - Express request with phone in body
 * @param res - Express response
 */
export const sendOtp = async (
  req: Request<object, OtpSendResponse | ErrorResponse, SendOtpRequest>,
  res: Response<OtpSendResponse | ErrorResponse>
): Promise<void> => {
  try {
    const { phone } = req.body;

    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Phone number is required and must be a valid string',
      });
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)',
      });
      return;
    }

    // Send OTP via Supabase
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: 'sms',
      },
    });

    if (error) {
      console.error('OTP send error:', error);
      res.status(500).json({
        error: 'OTP Send Failed',
        message: error.message || 'Failed to send OTP. Please try again.',
        details: error,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your phone number',
    });
  } catch (error) {
    console.error('Unexpected error in sendOtp:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while sending OTP',
      details: error,
    });
  }
};

/**
 * Verify OTP and authenticate user
 * @param req - Express request with phone and otp in body
 * @param res - Express response
 */
export const verifyOtp = async (
  req: Request<object, OtpVerifyResponse | ErrorResponse, VerifyOtpRequest>,
  res: Response<OtpVerifyResponse | ErrorResponse>
): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    // Validate inputs
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Phone number is required and must be a valid string',
      });
      return;
    }

    if (!otp || typeof otp !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'OTP is required and must be a valid string',
      });
      return;
    }

    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      console.error('OTP verification error:', error);
      res.status(401).json({
        error: 'OTP Verification Failed',
        message: error.message || 'Invalid or expired OTP. Please try again.',
        details: error,
      });
      return;
    }

    // Check if session and user exist
    if (!data.session || !data.user) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Unable to create session. Please try again.',
      });
      return;
    }

    // Return access token and user data
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    });
  } catch (error) {
    console.error('Unexpected error in verifyOtp:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while verifying OTP',
      details: error,
    });
  }
};

/**
 * Get current authenticated user
 * @param req - Express request with authenticated user
 * @param res - Express response
 */
export const getCurrentUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      details: error,
    });
  }
};
