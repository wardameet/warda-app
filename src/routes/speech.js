const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const { textToSpeech, LANGUAGE_VOICES } = require('../services/pollyService');

// GET /api/speech/voices — list available voices
router.get('/voices', (req, res) => {
  const voices = Object.entries(LANGUAGE_VOICES).map(([lang, config]) => ({
    language: lang, voiceId: config.voiceId, engine: config.engine, isFallback: config.fallback || false
  }));
  res.json({ success: true, voices });
});

// POST /api/speech/speak — convert text to speech
router.post('/speak', async (req, res) => {
  try {
    const { text, language, speed } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const result = await textToSpeech(text, language || 'English', { speed });
    res.set({ 'Content-Type': 'audio/mpeg', 'X-Voice-Id': result.voiceId, 'X-Language': result.language });
    res.send(result.audioBuffer);
  } catch (error) {
    console.error('Speech API error:', error);
    res.status(500).json({ success: false, error: 'Text-to-speech failed' });
  }
});

module.exports = router;
