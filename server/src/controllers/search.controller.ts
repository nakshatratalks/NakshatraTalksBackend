import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.utils';

/**
 * Search astrologers with advanced filters
 * GET /api/v1/search/astrologers
 */
export const searchAstrologers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      q,
      languages,
      specialization,
      minRating,
      maxPrice,
      minPrice,
      isAvailable,
      sortBy,
      order
    } = req.query;

    let query = supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('status', 'approved');

    // Text search
    if (q) {
      const searchStr = String(q);
      query = query.or(`name.ilike.%${searchStr}%,bio.ilike.%${searchStr}%`);
    }

    // Languages filter
    if (languages) {
      const langArray = String(languages).split(',');
      query = query.overlaps('languages', langArray);
    }

    // Specialization filter
    if (specialization) {
      query = query.contains('specialization', [String(specialization)]);
    }

    // Rating filter
    if (minRating) {
      query = query.gte('rating', Number(minRating));
    }

    // Price filters
    if (minPrice) {
      query = query.gte('price_per_minute', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price_per_minute', Number(maxPrice));
    }

    // Availability filter
    if (isAvailable !== undefined) {
      query = query.eq('is_available', isAvailable === 'true');
    }

    // Sorting
    const sortField = sortBy && ['rating', 'price_per_minute', 'experience', 'total_calls'].includes(String(sortBy))
      ? String(sortBy)
      : 'rating';
    const sortOrder = order === 'asc' ? true : false;

    query = query.order(sortField, { ascending: sortOrder });

    const { data: astrologers, error } = await query;

    if (error) {
      console.error('Error searching astrologers:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to search astrologers', 500, error);
      return;
    }

    // Get unique filter values for frontend
    const allLanguages = new Set<string>();
    const allSpecializations = new Set<string>();
    let minPriceValue = Infinity;
    let maxPriceValue = 0;

    astrologers?.forEach(a => {
      a.languages?.forEach((lang: string) => allLanguages.add(lang));
      a.specialization?.forEach((spec: string) => allSpecializations.add(spec));
      if (a.price_per_minute) {
        minPriceValue = Math.min(minPriceValue, a.price_per_minute);
        maxPriceValue = Math.max(maxPriceValue, a.price_per_minute);
      }
    });

    sendSuccess(res, {
      results: astrologers?.map(a => ({
        id: a.id,
        name: a.name,
        image: a.image,
        rating: a.rating || 0,
        totalCalls: a.total_calls || 0,
        pricePerMinute: a.price_per_minute,
        specialization: a.specialization || [],
        languages: a.languages || [],
        experience: a.experience,
        isAvailable: a.is_available,
        isLive: a.is_live,
      })) || [],
      total: astrologers?.length || 0,
      filters: {
        languages: Array.from(allLanguages),
        specializations: Array.from(allSpecializations),
        priceRange: {
          min: minPriceValue === Infinity ? 0 : minPriceValue,
          max: maxPriceValue,
        },
      },
    });
  } catch (error) {
    console.error('Error in searchAstrologers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to search astrologers', 500, error);
  }
};
