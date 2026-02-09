const express = require('express');
const router = express.Router();
const { translateText, SUPPORTED_LANGUAGES } = require('../services/translateService');

// GET /api/translate/languages — list supported languages
router.get('/languages', (req, res) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([name, info]) => ({
    name,
    code: info.code,
    nativeName: info.nativeName,
    direction: info.direction,
    greeting: info.greeting
  }));
  res.json({ success: true, languages });
});

// POST /api/translate — translate text
router.post('/', async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ success: false, error: 'text and targetLanguage are required' });
    }
    const result = await translateText(text, targetLanguage, sourceLanguage || 'English');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Translate API error:', error);
    res.status(500).json({ success: false, error: 'Translation failed' });
  }
});

module.exports = router;
