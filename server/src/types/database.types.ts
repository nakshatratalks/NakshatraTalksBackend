/**
 * Database types for NakshatraTalks API
 * Defines all entity interfaces that mirror the database schema
 */

/**
 * User entity
 */
export interface UserProfile {
  id: string;
  phone: string; // Primary identifier (unique, required)
  name?: string;
  email?: string; // Optional
  profileImage?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  timeOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  walletBalance: number;
  role: 'user' | 'astrologer' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Astrologer entity
 */
export interface Astrologer {
  id: string;
  phone: string; // Unique, required
  name: string;
  email?: string; // Optional
  image: string;
  bio?: string;
  specialization: string[];
  languages: string[];
  experience: number;
  education: string[];
  pricePerMinute: number;
  rating: number;
  totalCalls: number;
  totalReviews: number;
  isAvailable: boolean;
  isLive: boolean;
  workingHours: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Category entity
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Feedback entity
 */
export interface Feedback {
  id: string;
  userId?: string; // Optional - can be anonymous
  name: string; // Required
  email?: string; // Optional
  comments: string; // Required
  rating?: number; // Optional
  category: string;
  status: 'pending' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transaction entity
 */
export interface Transaction {
  id: string;
  userId: string;
  type: 'recharge' | 'debit' | 'refund';
  amount: number;
  description: string;
  astrologerId?: string;
  sessionId?: string;
  duration?: number;
  paymentId?: string;
  paymentMethod?: string;
  status: 'pending' | 'success' | 'failed' | 'completed';
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

/**
 * Chat Session entity
 */
export interface ChatSession {
  id: string;
  userId: string;
  astrologerId: string;
  sessionType: 'chat' | 'call' | 'video';
  startTime: string;
  endTime?: string;
  duration?: number;
  pricePerMinute: number;
  totalCost?: number;
  status: 'active' | 'completed' | 'cancelled';
  rating?: number;
  review?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat Message entity
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'user' | 'astrologer';
  message: string;
  type: 'text' | 'image' | 'file';
  isRead: boolean;
  createdAt: string;
}

/**
 * Banner entity
 */
export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonAction?: string;
  image?: string;
  backgroundColor?: string;
  order: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Notification entity
 */
export interface Notification {
  id: string;
  userId?: string; // null for broadcast
  title: string;
  message: string;
  type: 'wallet' | 'chat' | 'promotion' | 'system';
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Review entity
 */
export interface Review {
  id: string;
  userId: string;
  userName: string;
  astrologerId: string;
  sessionId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}
