/**
 * Conversation Routes
 * Handles AI conversation with Warda using Claude API
 */

const express = require('express');
const router = express.Router();
const { getWardaResponse } = require('../services/claude');
const { saveConversation, getConversationHistory } = require('../services/dynamodb');

// Send message to Warda (text)
router.post('/message', async (req, res) => {
  try {
    const { userId, message, context } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'userId and message are required'
      });
    }

    // Get conversation history for context
    const history = await getConversationHistory(userId, 10);

    // Get response from Claude
    const wardaResponse = await getWardaResponse(message, history, context);

    // Save conversation turn
    await saveConversation(userId, {
      userMessage: message,
      wardaResponse: wardaResponse.text,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      response: {
        text: wardaResponse.text,
        mood: wardaResponse.mood,
        suggestions: wardaResponse.suggestions
      }
    });
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Get conversation history
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const history = await getConversationHistory(userId, limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    });
  }
});

// Start new conversation session
router.post('/start', async (req, res) => {
  try {
    const { userId, residentName } = req.body;

    // Generate greeting based on time of day
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const greeting = `${timeGreeting}, ${residentName || 'there'}! It's Warda. How are you feeling today?`;

    res.json({
      success: true,
      greeting,
      sessionId: `session_${userId}_${Date.now()}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start conversation'
    });
  }
});

module.exports = router;
