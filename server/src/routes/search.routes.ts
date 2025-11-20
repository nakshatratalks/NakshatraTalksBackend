import { Router } from 'express';
import { searchAstrologers } from '../controllers/search.controller';

const router = Router();

// Public route
router.get('/astrologers', searchAstrologers);

export default router;
