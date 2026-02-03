/**
 * WARDA - Presence API Routes
 * ============================
 * REST endpoints for checking online presence
 * 
 * GET /api/presence/:careHomeId       - Who's online in a care home
 * GET /api/presence/tablet/:residentId - Is a resident's tablet online
 */

const express = require('express');
const router = express.Router();
const { getPresence, isUserOnline } = require('../services/socket');

// GET /api/presence/:careHomeId - Online users in a care home
router.get('/:careHomeId', (req, res) => {
  try {
    const { careHomeId } = req.params;
    const onlineUsers = getPresence(careHomeId);

    res.json({
      success: true,
      careHomeId,
      online: onlineUsers,
      count: onlineUsers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Presence error:', error);
    res.status(500).json({ success: false, error: 'Failed to get presence' });
  }
});

// GET /api/presence/tablet/:residentId - Is tablet online
router.get('/tablet/:residentId', (req, res) => {
  try {
    const { residentId } = req.params;
    const online = isUserOnline('tablet', residentId);

    res.json({
      success: true,
      residentId,
      tabletOnline: online,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Tablet presence error:', error);
    res.status(500).json({ success: false, error: 'Failed to check tablet status' });
  }
});

module.exports = router;
