import { Router } from 'express';
import {
  startChatSession,
  endChatSession,
  getChatMessages,
  sendChatMessage,
  rateChatSession,
} from '../controllers/chat.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// All chat routes require authentication
router.post('/sessions', authenticateUser, startChatSession);
router.patch('/sessions/:sessionId/end', authenticateUser, endChatSession);
router.get('/sessions/:sessionId/messages', authenticateUser, getChatMessages);
router.post('/sessions/:sessionId/messages', authenticateUser, sendChatMessage);
router.post('/sessions/:sessionId/rating', authenticateUser, rateChatSession);

export default router;
