const { tabletAuth } = require("../middleware/apiAuth");
// ============================================================
// WARDA — Orientation Routes
// Time, date, weather, season for ambient display
// ============================================================

const express = require('express');
const router = express.Router();
const { getOrientationData, getWeather, clearWeatherCache } = require('../services/weather');
const prisma = require('../lib/prisma');

// GET /api/orientation — Full orientation data for tablet
router.get('/', tabletAuth, async (req, res) => {
  try {
    // Get care home location if residentId provided
    let location = 'Edinburgh,GB';
    
    if (req.query.residentId) {
      const user = await prisma.user.findUnique({
        where: { id: req.query.residentId },
        include: { careHome: true }
      });
      if (user?.careHome?.address) {
        // Extract city from address for weather lookup
        location = user.careHome.city ? user.careHome.city + ",GB" : location;
      }
    } else if (req.query.location) {
      location = req.query.location;
    }

    const data = await getOrientationData(location);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Orientation error:', error);
    res.status(500).json({ success: false, error: 'Failed to get orientation data' });
  }
});

// GET /api/orientation/weather — Just weather
router.get('/weather', tabletAuth, async (req, res) => {
  try {
    const location = req.query.location || 'Edinburgh,GB';
    const weather = await getWeather(location);
    res.json({ success: true, weather });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get weather' });
  }
});

// POST /api/orientation/clear-cache — Clear weather cache
router.post('/clear-cache', tabletAuth, (req, res) => {
  clearWeatherCache();
  res.json({ success: true, message: 'Weather cache cleared' });
});

module.exports = router;
