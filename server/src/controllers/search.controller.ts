import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { supabaseAdmin } from '../config/supabase';
import { sendError, ErrorCodes } from '../utils/response.utils';

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
      isNew,
      sortBy,
      order,
      limit: limitParam = '20',
      offset: offsetParam = '0'
    } = req.query;

    const limit = Math.min(parseInt(limitParam as string, 10), 100); // Max 100 results
    const offset = parseInt(offsetParam as string, 10);

    let query = supabaseAdmin
      .from('astrologers')
      .select('*', { count: 'exact' })
      .eq('status', 'approved');

    // Text search (name, email, bio)
    if (q) {
      const searchStr = String(q).toLowerCase();
      query = query.or(`name.ilike.%${searchStr}%,email.ilike.%${searchStr}%,bio.ilike.%${searchStr}%`);
    }

    // Languages filter (comma-separated)
    if (languages) {
      const langArray = String(languages).split(',').map(l => l.trim());
      query = query.overlaps('languages', langArray);
    }

    // Specialization filter (comma-separated, matches ANY)
    if (specialization) {
      const specArray = String(specialization).split(',').map(s => s.trim());
      query = query.overlaps('specialization', specArray);
    }

    // Rating filter
    if (minRating) {
      query = query.gte('rating', Number(minRating));
    }

    // Price filters (using chat_price_per_minute as default)
    if (minPrice) {
      query = query.gte('chat_price_per_minute', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('chat_price_per_minute', Number(maxPrice));
    }

    // Availability filter
    if (isAvailable !== undefined) {
      query = query.eq('is_available', isAvailable === 'true');
    }

    // New astrologers filter (created in last 30 days)
    if (isNew === 'true') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    // Sorting
    const validSortFields = ['rating', 'chat_price_per_minute', 'experience', 'total_calls'];
    const sortField = sortBy && validSortFields.includes(String(sortBy))
      ? String(sortBy)
      : 'rating';
    const sortOrder = order === 'asc';

    query = query
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    const { data: astrologers, error, count } = await query;

    if (error) {
      console.error('Error searching astrologers:', error);
      sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to search astrologers', 500, error);
      return;
    }

    // Get unique filter values for frontend (from ALL approved astrologers, not just filtered results)
    const { data: allAstrologers } = await supabaseAdmin
      .from('astrologers')
      .select('languages, specialization, chat_price_per_minute')
      .eq('status', 'approved');

    const allLanguages = new Set<string>();
    const allSpecializations = new Set<string>();
    let minPriceValue = Infinity;
    let maxPriceValue = 0;

    allAstrologers?.forEach(a => {
      a.languages?.forEach((lang: string) => allLanguages.add(lang));
      a.specialization?.forEach((spec: string) => allSpecializations.add(spec));
      if (a.chat_price_per_minute) {
        minPriceValue = Math.min(minPriceValue, a.chat_price_per_minute);
        maxPriceValue = Math.max(maxPriceValue, a.chat_price_per_minute);
      }
    });

    const totalPages = Math.ceil((count || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    res.status(200).json({
      success: true,
      data: {
        results: astrologers?.map(a => ({
          id: a.id,
          phone: a.phone,
          name: a.name,
          email: a.email,
          image: a.image,
          bio: a.bio,
          specialization: a.specialization || [],
          languages: a.languages || [],
          experience: a.experience,
          education: a.education || [],
          chatPricePerMinute: a.chat_price_per_minute,
          callPricePerMinute: a.call_price_per_minute,
          pricePerMinute: a.chat_price_per_minute, // Default to chat price for backward compatibility
          rating: a.rating || 0,
          totalCalls: a.total_calls || 0,
          totalReviews: a.total_reviews || 0,
          isAvailable: a.is_available,
          isLive: a.is_live,
          workingHours: a.working_hours || {},
          nextAvailableAt: a.next_available_at,
          status: a.status,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })) || [],
        total: count || 0,
        filters: {
          languages: Array.from(allLanguages).sort(),
          specializations: Array.from(allSpecializations).sort(),
          priceRange: {
            min: minPriceValue === Infinity ? 0 : minPriceValue,
            max: maxPriceValue,
          },
        },
      },
      pagination: {
        currentPage,
        totalPages,
        totalItems: count || 0,
        itemsPerPage: limit,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    });
  } catch (error) {
    console.error('Error in searchAstrologers:', error);
    sendError(res, ErrorCodes.SERVER_ERROR, 'Failed to search astrologers', 500, error);
  }
};
