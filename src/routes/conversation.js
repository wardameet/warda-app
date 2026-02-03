/**
 * Conversation Routes
 * Handles AI conversation with Warda using Claude API
 * NOW LOADS RESIDENT PROFILE FOR PERSONALISATION
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getWardaResponse, getResidentProfile, buildPersonalisedPrompt } = require('../services/claude');
const { saveConversation, getConversationHistory } = require('../services/dynamodb');

const prisma = new PrismaClient();

// Send message to Warda (text)
router.post('/message', async (req, res) => {
  try {
    const { userId, message, context = {} } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ success: false, error: 'userId and message are required' });
    }

    // Get conversation history for context
    const history = await getConversationHistory(userId, 10);

    // Pass userId in context so Claude service can load the profile
    const wardaResponse = await getWardaResponse(message, history, { ...context, userId });

    // Save conversation turn
    await saveConversation(userId, {
      userMessage: message,
      wardaResponse: wardaResponse.text,
      mood: wardaResponse.mood,
      timestamp: new Date().toISOString()
    });

    // If mood indicates concern, create an alert
    if (wardaResponse.mood === 'health_concern' || wardaResponse.mood === 'needs_comfort') {
      try {
        await prisma.alert.create({
          data: {
            userId,
            careHomeId: (await prisma.user.findUnique({ where: { id: userId }, select: { careHomeId: true } }))?.careHomeId,
            type: wardaResponse.mood === 'health_concern' ? 'HEALTH' : 'MOOD',
            severity: wardaResponse.mood === 'health_concern' ? 'HIGH' : 'MEDIUM',
            title: wardaResponse.mood === 'health_concern' 
              ? `Health concern detected for resident`
              : `Resident may need comfort`,
            description: `Resident said: "${message.substring(0, 100)}"`,
            status: 'ACTIVE'
          }
        });
      } catch (alertErr) {
        console.error('Failed to create alert:', alertErr);
      }
    }

    res.json({
      success: true,
      response: {
        text: wardaResponse.text,
        mood: wardaResponse.mood,
        suggestions: wardaResponse.suggestions,
        profileUsed: wardaResponse.profileUsed
      }
    });
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Get conversation history
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const history = await getConversationHistory(userId, limit);
    res.json({ success: true, history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Start new conversation session - NOW PERSONALISED
router.post('/start', async (req, res) => {
  try {
    const { userId, residentName } = req.body;

    // Try to load resident profile for personalised greeting
    let greeting;
    if (userId) {
      const profile = await getResidentProfile(userId);
      if (profile && profile.greetingStyle) {
        greeting = profile.greetingStyle;
      } else {
        const hour = new Date().getHours();
        const name = profile?.preferredName || residentName || 'there';
        let timeGreeting = 'Hello';
        if (hour < 12) timeGreeting = 'Good morning';
        else if (hour < 17) timeGreeting = 'Good afternoon';
        else timeGreeting = 'Good evening';

        if (profile?.useGaelic) {
          if (hour < 12) timeGreeting = 'Madainn mhath';
          else if (hour < 17) timeGreeting = 'Feasgar math';
          else timeGreeting = 'Feasgar math';
        }
        greeting = `${timeGreeting}, ${name}! It's Warda here. How are you feeling today, dear?`;
      }
    } else {
      greeting = `Hello there! It's Warda. How are you feeling today?`;
    }

    res.json({
      success: true,
      greeting,
      sessionId: `session_${userId || 'anon'}_${Date.now()}`
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to start conversation' });
  }
});

module.exports = router;
