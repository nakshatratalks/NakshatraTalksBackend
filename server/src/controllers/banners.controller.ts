import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { validateRequiredFields, sanitizeString } from '../utils/validation.utils';

/**
 * Get active banners
 * GET /api/v1/banners
 */
export const getActiveBanners = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const now = new Date().toISOString();

    const { data: banners, error } = await supabaseAdmin
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching banners:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch banners', 500, error);
      return;
    }

    sendSuccess(res, banners?.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      buttonText: b.button_text,
      buttonAction: b.button_action,
      image: b.image,
      backgroundColor: b.background_color,
      isActive: b.is_active,
      order: b.order,
      startDate: b.start_date,
      endDate: b.end_date,
    })) || []);
  } catch (error) {
    console.error('Error in getActiveBanners:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch banners', 500, error);
  }
};

/**
 * Create banner (Admin only)
 * POST /api/v1/admin/banners
 */
export const createBanner = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      title,
      subtitle,
      buttonText,
      buttonAction,
      image,
      backgroundColor,
      order,
      startDate,
      endDate,
      isActive
    } = req.body;

    const { isValid, missingFields } = validateRequiredFields(req.body, ['title']);

    if (!isValid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
      return;
    }

    const { data: newBanner, error } = await supabaseAdmin
      .from('banners')
      .insert({
        title: sanitizeString(title),
        subtitle: subtitle ? sanitizeString(subtitle) : null,
        button_text: buttonText || null,
        button_action: buttonAction || null,
        image: image || null,
        background_color: backgroundColor || '#FFCF0D',
        order: order || 0,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive !== undefined ? isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create banner', 500, error);
      return;
    }

    sendSuccess(res, {
      id: newBanner.id,
      title: newBanner.title,
      order: newBanner.order,
      isActive: newBanner.is_active,
    }, 'Banner created successfully', 201);
  } catch (error) {
    console.error('Error in createBanner:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create banner', 500, error);
  }
};

/**
 * Update banner (Admin only)
 * PUT /api/v1/admin/banners/:id
 */
export const updateBanner = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'title', 'subtitle', 'buttonText', 'buttonAction', 'image',
      'backgroundColor', 'order', 'startDate', 'endDate', 'isActive'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateData[dbField] = req.body[field];
      }
    }

    const { data: updatedBanner, error } = await supabaseAdmin
      .from('banners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Banner not found', 404);
        return;
      }
      console.error('Error updating banner:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update banner', 500, error);
      return;
    }

    sendSuccess(res, updatedBanner, 'Banner updated successfully');
  } catch (error) {
    console.error('Error in updateBanner:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update banner', 500, error);
  }
};

/**
 * Delete banner (Admin only)
 * DELETE /api/v1/admin/banners/:id
 */
export const deleteBanner = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('banners')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Banner not found', 404);
        return;
      }
      console.error('Error deleting banner:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete banner', 500, error);
      return;
    }

    sendSuccess(res, null, 'Banner deleted successfully');
  } catch (error) {
    console.error('Error in deleteBanner:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete banner', 500, error);
  }
};
