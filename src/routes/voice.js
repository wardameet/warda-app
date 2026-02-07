/**
 * Voice Routes
 * Text-to-speech and speech-to-text endpoints
 */

const express = require('express');
const router = express.Router();
const { textToSpeech, VOICES } = require('../services/voice');
const { transcribeBase64 } = require('../services/transcribe');
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

// Transcribe audio from tablet
router.post("/transcribe", async (req, res) => {
  try {
    const { audio, format, sampleRate } = req.body;
    if (!audio) return res.status(400).json({ success: false, error: "Audio data required" });
    const result = await transcribeBase64(audio, {
      languageCode: "en-GB",
      mediaSampleRate: sampleRate || 16000,
      mediaEncoding: format || "pcm",
    });
    res.json({ success: result.success, transcript: result.transcript, confidence: result.confidence, error: result.error });
  } catch (error) {
    console.error("Transcribe error:", error);
    res.status(500).json({ success: false, error: "Transcription failed" });
  }
});

// ─── Voice Navigation Commands ──────────────────────────────
const NAVIGATION_COMMANDS = [
  // Home
  { patterns: ['take me home', 'go home', 'go back home', 'home screen', 'main screen', 'back to start'], screen: 'home', response: "Taking you home, dear." },
  // Family
  { patterns: ['show my family', 'family screen', 'see my family', 'who is my family', 'open family', 'my family'], screen: 'family', response: "Here's your family, love." },
  // Chat
  { patterns: ['chat with warda', 'talk to warda', 'start chatting', 'type a message', 'text warda', 'open chat'], screen: 'talk', response: "Let's have a wee chat." },
  // Voice
  { patterns: ['voice mode', 'speak to warda', 'talk mode', 'use my voice'], screen: 'voice', response: "I'm listening, dear." },
  // Activities
  { patterns: ['show activities', 'what can i do', 'activities', 'games', 'things to do', 'open activities'], screen: 'activities', response: "Let's find something fun to do!" },
  // Health
  { patterns: ['my health', 'health screen', 'how am i doing', 'health check', 'show health', 'open health'], screen: 'health', response: "Let's check how you're doing." },
  // My Day
  { patterns: ['my day', 'what is today', 'today schedule', 'daily schedule', 'show my day', "what's on today"], screen: 'myday', response: "Here's your day, love." },
  // Faith
  { patterns: ['my faith', 'prayer', 'pray', 'faith screen', 'spiritual', 'open faith', 'bible', 'quran'], screen: 'faith', response: "A moment of peace for you." },
  // Settings
  { patterns: ['settings', 'change settings', 'volume', 'brightness', 'make it louder', 'make it bigger', 'text size'], screen: 'settings', response: "Here are your settings, dear." },
  // Browse
  { patterns: ['browse web', 'internet', 'open browser', 'search online', 'go online', 'browse'], screen: 'browse', response: "Let's have a look online." },
  // Help
  { patterns: ['help me', 'i need help', 'call for help', 'emergency', 'help please', 'get help'], screen: 'help', response: "I'm getting help for you right now, dear. Don't worry." },
  // Call family
  { patterns: ['video call my family', 'start a video call', 'open video call'], screen: 'videocall', response: "I'll connect you now, dear." },
];

function detectNavCommand(message) {
  const lower = message.toLowerCase().trim();
  for (const cmd of NAVIGATION_COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (lower.includes(pattern)) {
        return { screen: cmd.screen, response: cmd.response, matched: pattern };
      }
    }
  }
  return null;
}

// Voice command endpoint - checks for navigation first, falls back to conversation
router.post('/command', async (req, res) => {
  try {
    const { userId, message, context } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message required' });

    // 1. Check for navigation commands
    const navCmd = detectNavCommand(message);
    if (navCmd) {
      const audio = await textToSpeech(navCmd.response, VOICES.female);
      return res.json({
        success: true,
        type: 'navigation',
        screen: navCmd.screen,
        text: navCmd.response,
        audio: audio.audio,
        contentType: audio.contentType
      });
    }

    // 2. Check for "call [name]" pattern - match family member
    const callMatch = message.toLowerCase().match(/(?:call|ring|phone|video call)\s+(.+)/i);
    if (callMatch) {
      const name = callMatch[1].trim();
      const audio = await textToSpeech(`I'll try to connect you with ${name} now.`, VOICES.female);
      return res.json({
        success: true,
        type: 'call',
        calleeName: name,
        text: `I'll try to connect you with ${name} now.`,
        audio: audio.audio,
        contentType: audio.contentType
      });
    }

    // 3. Fall back to normal Warda conversation
    const wardaResponse = await getWardaResponse(message, [], context || {});
    const audio = await textToSpeech(wardaResponse.text, VOICES.female);
    res.json({
      success: true,
      type: 'conversation',
      text: wardaResponse.text,
      audio: audio.audio,
      contentType: audio.contentType,
      mood: wardaResponse.mood,
      intent: wardaResponse.intent
    });
  } catch (error) {
    console.error('Voice command error:', error);
    res.status(500).json({ success: false, error: 'Failed to process command' });
  }
});

