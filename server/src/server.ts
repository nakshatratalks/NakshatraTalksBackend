import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { setupSwagger } from './config/swagger';
import { supabaseAdmin } from './config/supabase';

// Import routes
import authRoutes from './routes/auth.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import usersRoutes from './routes/users.routes';
import astrologersRoutes, { adminRouter as adminAstrologersRoutes } from './routes/astrologers.routes';
import categoriesRoutes from './routes/categories.routes';
import specializationsRoutes from './routes/specializations.routes';
import searchRoutes from './routes/search.routes';
import feedbackRoutes from './routes/feedback.routes';
import walletRoutes from './routes/wallet.routes';
import bannersRoutes from './routes/banners.routes';
import chatRoutes from './routes/chat.routes';
import callRoutes from './routes/call.routes';
import notificationsRoutes from './routes/notifications.routes';
import reviewsRoutes from './routes/reviews.routes';
import analyticsRoutes from './routes/analytics.routes';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Swagger documentation
setupSwagger(app);

// API v1 Routes
const API_VERSION = '/api/v1';

app.use('/auth', authRoutes); // Keep auth at root for backward compatibility
app.use('/auth/admin', adminAuthRoutes); // Admin authentication routes
app.use(`${API_VERSION}/users`, usersRoutes);
app.use(`${API_VERSION}/astrologers`, astrologersRoutes);
app.use(`${API_VERSION}/categories`, categoriesRoutes);
app.use(`${API_VERSION}/specializations`, specializationsRoutes);
app.use(`${API_VERSION}/search`, searchRoutes);
app.use(`${API_VERSION}/feedback`, feedbackRoutes);
app.use(`${API_VERSION}/wallet`, walletRoutes);
app.use(`${API_VERSION}/banners`, bannersRoutes);
app.use(`${API_VERSION}/chat`, chatRoutes);
app.use(`${API_VERSION}/call`, callRoutes);
app.use(`${API_VERSION}/notifications`, notificationsRoutes);
app.use(`${API_VERSION}`, reviewsRoutes); // Reviews routes have /astrologers/:id/reviews

// Admin routes
app.use(`${API_VERSION}/admin/astrologers`, adminAstrologersRoutes);
app.use(`${API_VERSION}/admin/analytics`, analyticsRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Server is healthy and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: NakshatraTalks API is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T10:30:00.000Z
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 123.456
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'NakshatraTalks API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to NakshatraTalks API',
    version: '1.0.0',
    apiVersion: 'v1',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      auth: {
        sendOtp: '/auth/send-otp',
        verifyOtp: '/auth/verify-otp',
        me: '/auth/me',
      },
      users: {
        profile: '/api/v1/users/profile',
        updateProfile: '/api/v1/users/profile (PUT)',
      },
      astrologers: {
        live: '/api/v1/astrologers/live',
        topRated: '/api/v1/astrologers/top-rated',
        details: '/api/v1/astrologers/:id',
      },
      categories: '/api/v1/categories',
      search: '/api/v1/search/astrologers',
      feedback: '/api/v1/feedback',
      wallet: {
        balance: '/api/v1/wallet/balance',
        recharge: '/api/v1/wallet/recharge',
        transactions: '/api/v1/wallet/transactions',
      },
      banners: '/api/v1/banners',
      chat: {
        start: '/api/v1/chat/sessions',
        end: '/api/v1/chat/sessions/:sessionId/end',
        messages: '/api/v1/chat/sessions/:sessionId/messages',
      },
      call: {
        astrologers: '/api/v1/call/astrologers',
        specializations: '/api/v1/call/specializations',
        start: '/api/v1/call/sessions',
        end: '/api/v1/call/sessions/:sessionId/end',
        active: '/api/v1/call/sessions/active',
      },
      notifications: '/api/v1/notifications',
      reviews: '/api/v1/astrologers/:id/reviews',
      admin: {
        users: '/api/v1/admin/users',
        astrologers: '/api/v1/admin/astrologers',
        categories: '/api/v1/admin/categories',
        feedback: '/api/v1/admin/feedback',
        banners: '/api/v1/admin/banners',
        transactions: '/api/v1/admin/transactions',
        notifications: '/api/v1/admin/notifications',
        reviews: '/api/v1/admin/reviews/:id',
        analytics: '/api/v1/admin/analytics/dashboard',
      },
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Auto-offline detection cron job
// Runs every minute to check for inactive astrologers (no heartbeat > 2 minutes)
cron.schedule('* * * * *', async () => {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        chat_available: false,
        call_available: false,
      })
      .lt('last_activity_at', twoMinutesAgo.toISOString())
      .or('chat_available.eq.true,call_available.eq.true')
      .select('id');

    if (error) {
      console.error('[Cron] Error setting inactive astrologers offline:', error);
    } else if (data && data.length > 0) {
      console.log(`[Cron] Set ${data.length} astrologer(s) offline due to inactivity`);
    }
  } catch (error) {
    console.error('[Cron] Auto-offline detection error:', error);
  }
});

console.log('⏰ Auto-offline detection cron job started (runs every minute)');

// Start server only when not running in a serverless environment (e.g., Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('🚀 Server is running');
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🔐 Authentication endpoints:`);
    console.log(`   - POST ${PORT}/auth/send-otp`);
    console.log(`   - POST ${PORT}/auth/verify-otp`);
    console.log(`   - GET ${PORT}/auth/me (protected)`);
  });
}

export default app;
