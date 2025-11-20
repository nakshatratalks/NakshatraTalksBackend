import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';
import { validateRequiredFields, sanitizeString } from '../utils/validation.utils';

/**
 * Get all categories
 * GET /api/v1/categories
 */
export const getAllCategories = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch categories', 500, error);
      return;
    }

    sendSuccess(res, categories?.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      isActive: c.is_active,
      order: c.order,
    })) || []);
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to fetch categories', 500, error);
  }
};

/**
 * Create category (Admin only)
 * POST /api/v1/admin/categories
 */
export const createCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, icon, description, order, isActive } = req.body;

    const { isValid, missingFields } = validateRequiredFields(req.body, ['name', 'icon']);

    if (!isValid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
      return;
    }

    const { data: newCategory, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name: sanitizeString(name),
        icon,
        description: description || null,
        order: order || 0,
        is_active: isActive !== undefined ? isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create category', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        id: newCategory.id,
        name: newCategory.name,
        icon: newCategory.icon,
        description: newCategory.description,
        order: newCategory.order,
        isActive: newCategory.is_active,
      },
      'Category created successfully',
      201
    );
  } catch (error) {
    console.error('Error in createCategory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to create category', 500, error);
  }
};

/**
 * Update category (Admin only)
 * PUT /api/v1/admin/categories/:id
 */
export const updateCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = ['name', 'icon', 'description', 'order', 'isActive'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const dbField = field === 'isActive' ? 'is_active' : field;
        updateData[dbField] = field === 'name' && typeof req.body[field] === 'string'
          ? sanitizeString(req.body[field])
          : req.body[field];
      }
    }

    const { data: updatedCategory, error } = await supabaseAdmin
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Category not found', 404);
        return;
      }
      console.error('Error updating category:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update category', 500, error);
      return;
    }

    sendSuccess(
      res,
      {
        id: updatedCategory.id,
        name: updatedCategory.name,
        icon: updatedCategory.icon,
        description: updatedCategory.description,
        order: updatedCategory.order,
        isActive: updatedCategory.is_active,
      },
      'Category updated successfully'
    );
  } catch (error) {
    console.error('Error in updateCategory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to update category', 500, error);
  }
};

/**
 * Delete category (Admin only)
 * DELETE /api/v1/admin/categories/:id
 */
export const deleteCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Category not found', 404);
        return;
      }
      console.error('Error deleting category:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete category', 500, error);
      return;
    }

    sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to delete category', 500, error);
  }
};
