// ============================================================
// WARDA — Transcribe Routes
// Speech-to-text API endpoints
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { transcribeAudio, transcribeBase64 } = require('../services/transcribe');

// Multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// POST /api/transcribe/audio — Upload audio file for transcription
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    const result = await transcribeAudio(req.file.buffer, {
      languageCode: req.body.language || 'en-GB',
      mediaSampleRate: parseInt(req.body.sampleRate) || 16000,
      mediaEncoding: req.body.encoding || 'pcm'
    });

    res.json(result);
  } catch (error) {
    console.error('Transcribe route error:', error);
    res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});

// POST /api/transcribe/base64 — Send base64 audio for transcription
router.post('/base64', async (req, res) => {
  try {
    const { audio, language, sampleRate, encoding } = req.body;

    if (!audio) {
      return res.status(400).json({ success: false, error: 'No audio data provided' });
    }

    const result = await transcribeBase64(audio, {
      languageCode: language || 'en-GB',
      mediaSampleRate: sampleRate || 16000,
      mediaEncoding: encoding || 'pcm'
    });

    res.json(result);
  } catch (error) {
    console.error('Base64 transcribe route error:', error);
    res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});

module.exports = router;
