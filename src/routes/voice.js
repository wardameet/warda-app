/**
 * Voice Routes
 * Text-to-speech and speech-to-text endpoints
 */

const express = require('express');
const router = express.Router();
const { textToSpeech, VOICES } = require('../services/voice');
const { getWardaResponse } = require('../services/claude');

// Convert text to speech
router.post('/speak', async (req, res) => {
  try {
    const { text, voice } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const voiceId = voice || VOICES.female;
    const result = await textToSpeech(text, voiceId);

    res.json({
      success: true,
      audio: result.audio,
      contentType: result.contentType
    });
  } catch (error) {
    console.error('Speak error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate speech' });
  }
});

// Voice conversation - receive text, get Warda response as audio
router.post('/conversation', async (req, res) => {
  try {
    const { userId, message, context } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Get Warda's text response
    const wardaResponse = await getWardaResponse(message, [], context || {});

    // Convert to speech
    const audio = await textToSpeech(wardaResponse.text, VOICES.female);

    res.json({
      success: true,
      text: wardaResponse.text,
      audio: audio.audio,
      contentType: audio.contentType,
      mood: wardaResponse.mood
    });
  } catch (error) {
    console.error('Voice conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to process voice conversation' });
  }
});

// Get available voices
router.get('/voices', (req, res) => {
  res.json({ success: true, voices: VOICES });
});

module.exports = router;
