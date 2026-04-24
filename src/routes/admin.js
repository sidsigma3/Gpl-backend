import express from 'express';
import { syncData } from '../jobs/syncCricHeroes.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/sync/trigger', adminAuth, async (req, res) => {
  try {
    await syncData();
    res.json({ success: true, message: 'Sync triggered successfully', error: null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sync failed', error: error.message });
  }
});

export default router;
