const { requireAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const { detectSentiment, detectLanguage, analyzeConversation } = require('../services/comprehendService');

// POST /api/sentiment/analyze — full conversation analysis
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { text, languageCode } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const result = await analyzeConversation(text, languageCode || 'en');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Sentiment API error:', error);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// POST /api/sentiment/detect-language — auto-detect language
router.post('/detect-language', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const result = await detectLanguage(text);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Language detection error:', error);
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

module.exports = router;
