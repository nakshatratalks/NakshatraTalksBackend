/**
 * Availability-related types for astrologer real-time status management
 */

/**
 * Request body for toggling chat availability
 */
export interface ToggleChatAvailabilityRequest {
  chatAvailable: boolean;
}

/**
 * Request body for toggling call availability
 */
export interface ToggleCallAvailabilityRequest {
  callAvailable: boolean;
}

/**
 * Response for astrologer availability status
 */
export interface AstrologerAvailabilityStatus {
  id: string;
  chatAvailable: boolean;
  callAvailable: boolean;
  lastActivityAt: string | null;
  chatPricePerMinute: number;
  callPricePerMinute: number;
}

/**
 * Heartbeat request (no body needed, just updates timestamp)
 */
export interface HeartbeatRequest {}

/**
 * Heartbeat response
 */
export interface HeartbeatResponse {
  success: boolean;
  lastActivityAt: string;
}

/**
 * Available astrologer data for client-side browsing
 */
export interface AvailableAstrologer {
  id: string;
  name: string;
  image: string;
  bio: string | null;
  specialization: string[];
  languages: string[];
  experience: number;
  rating: number;
  totalCalls: number;
  totalReviews: number;
  pricePerMinute: number; // Will be chat_price_per_minute or call_price_per_minute based on context
  isLive: boolean;
}

/**
 * Query parameters for browsing available astrologers
 */
export interface BrowseAvailableAstrologersQuery {
  specialization?: string;
  language?: string;
  minRating?: number;
  maxPrice?: number;
  sortBy?: 'rating' | 'price' | 'experience' | 'totalCalls';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
