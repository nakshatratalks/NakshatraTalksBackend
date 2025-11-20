/**
 * Validation utility functions
 */

/**
 * Validate phone number format (E.164)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (
  page?: string | number | string[] | unknown,
  limit?: string | number | string[] | unknown
): { page: number; limit: number; error?: string } => {
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;

  if (pageNum < 1) {
    return { page: 1, limit: limitNum, error: 'Page must be greater than 0' };
  }

  if (limitNum < 1 || limitNum > 100) {
    return { page: pageNum, limit: 20, error: 'Limit must be between 1 and 100' };
  }

  return { page: pageNum, limit: limitNum };
};

/**
 * Validate rating (1-5)
 */
export const isValidRating = (rating: number): boolean => {
  return rating >= 1 && rating <= 5;
};

/**
 * Validate price
 */
export const isValidPrice = (price: number): boolean => {
  return price >= 0 && Number.isFinite(price);
};

/**
 * Validate date string
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Sanitize string input
 */
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Validate required fields
 */
export const validateRequiredFields = (
  data: Record<string, unknown>,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } => {
  const missingFields = requiredFields.filter(
    field => !data[field] || (typeof data[field] === 'string' && !data[field].toString().trim())
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

/**
 * Validate enum value
 */
export const isValidEnum = <T extends string>(
  value: string,
  enumValues: readonly T[]
): value is T => {
  return enumValues.includes(value as T);
};
