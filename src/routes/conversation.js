/**
 * Conversation Routes
 * Handles AI conversation with Warda using Claude API
 * WITH RESIDENT PROFILE PERSONALISATION + FAMILY MESSAGE DETECTION
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getWardaResponse, getResidentProfile, buildPersonalisedPrompt } = require('../services/claude');
const { saveConversation, getConversationHistory } = require('../services/dynamodb');

const prisma = new PrismaClient();

// ─── Family message intent detection ───
function detectFamilyMessageIntent(message) {
  const lower = message.toLowerCase();
  const patterns = [
    /(?:tell|say to|message|text|send|let)\s+(\w+)\s+(?:that\s+)?(.+)/i,
    /(?:can you|could you|please)\s+(?:tell|say to|message|text|send|let)\s+(\w+)\s+(?:that\s+)?(.+)/i,
    /(?:i want to|i'd like to|i need to)\s+(?:tell|say to|message|send|text)\s+(\w+)\s+(?:that\s+)?(.+)/i,
    /(?:send|give)\s+(?:a\s+)?(?:message|note|text)\s+to\s+(\w+)\s*[:\-,]?\s*(.+)/i,
    /(?:let)\s+(\w+)\s+know\s+(?:that\s+)?(.+)/i
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return { name: match[1], content: match[2] };
    }
  }
  return null;
}

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
        const resident = await prisma.user.findUnique({ where: { id: userId }, select: { preferredName: true, firstName: true, careHomeId: true } });
        const resName = resident?.preferredName || resident?.firstName || 'Resident';
        const alertType = wardaResponse.mood === 'health_concern' ? 'HEALTH' : 'MOOD';
        const alertSeverity = wardaResponse.mood === 'health_concern' ? 'high' : 'medium';
        const alertMessage = wardaResponse.mood === 'health_concern'
          ? `Health concern: ${resName} said "${message.substring(0, 100)}"`
          : `${resName} may need comfort. Said: "${message.substring(0, 100)}"`;

        const alert = await prisma.alert.create({
          data: {
            userId,
            type: alertType,
            severity: alertSeverity,
            message: alertMessage,
          }
        });

        console.log('🚨 ALERT CREATED:', alertType, alertSeverity, '-', resName);

        // Notify staff via WebSocket
        const io = req.app.get('io');
        if (io && resident?.careHomeId) {
          io.to(`careHome-${resident.careHomeId}`).emit('staff-alert', {
            id: alert.id,
            type: alertType,
            severity: alertSeverity,
            message: alertMessage,
            residentName: resName,
            timestamp: new Date().toISOString()
          });
          console.log('📡 Staff notified via WebSocket for', resident.careHomeId);
        }
      } catch (alertErr) {
        console.error('Failed to create alert:', alertErr);
      }
    }

    // ─── FAMILY MESSAGE DETECTION ───
    let familyMessageSent = null;
    const intent = detectFamilyMessageIntent(message);

    if (intent) {
      try {
        const familyContacts = await prisma.familyContact.findMany({
          where: { userId: userId }
        });

        const contact = familyContacts.find(function(fc) {
          return fc.name.toLowerCase().includes(intent.name.toLowerCase());
        });

        if (contact) {
          // Clean up message
          var cleanMessage = intent.content
            .replace(/\s*please\s*$/i, '')
            .replace(/^\s+|\s+$/g, '');
          cleanMessage = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);

          // Get resident info
          var resident = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, preferredName: true }
          });
          var residentName = (resident && resident.preferredName) || (resident && resident.firstName) || 'Your loved one';

          // Save message to DB
          try {
            await prisma.message.create({
              data: {
                content: cleanMessage,
                sender: userId,
                type: 'text',
                userId: userId,
                isFromWarda: false
              }
            });
          } catch (dbErr) {
            console.error('Failed to save family message:', dbErr);
          }

          // Broadcast to family via WebSocket
          var io = req.app.get('io');
          if (io) {
            var familyPayload = {
              id: 'fam_' + Date.now(),
              content: cleanMessage,
              senderId: userId,
              senderName: residentName,
              recipientId: contact.id,
              recipientName: contact.name,
              type: 'text',
              sentViaWarda: true,
              timestamp: new Date().toISOString()
            };
            io.to('family:' + userId).emit('message:from_resident', familyPayload);
            console.log('Family message sent: "' + cleanMessage + '" to ' + contact.name);
          }

          familyMessageSent = {
            contactName: contact.name.split(' ')[0],
            message: cleanMessage
          };
        }
      } catch (famErr) {
        console.error('Family message detection error:', famErr);
      }
    }

    // Build response text
    var responseText = wardaResponse.text;
    if (familyMessageSent) {
      responseText = responseText + '\n\nI have sent your message to ' + familyMessageSent.contactName + '.';
    }

    res.json({
      success: true,
      response: {
        text: responseText,
        mood: wardaResponse.mood,
        suggestions: wardaResponse.suggestions,
        profileUsed: wardaResponse.profileUsed,
        familyMessageSent: familyMessageSent
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
    let greeting;
    if (userId) {
      const profile = await getResidentProfile(userId);
      if (profile) {
        const { getTimeGreeting } = require('../services/claude');
        const tg = getTimeGreeting(profile);
        if (tg) {
          greeting = tg;
        } else if (profile.greetingStyle) {
          greeting = profile.greetingStyle;
        } else {
          const hour = new Date().getHours();
          const nm = profile.preferredName || residentName || 'there';
          let g = 'Hello';
          if (hour < 12) g = 'Good morning';
          else if (hour < 17) g = 'Good afternoon';
          else g = 'Good evening';
          if (profile.useGaelic) { g = hour < 12 ? 'Madainn mhath' : 'Feasgar math'; }
          greeting = g + ', ' + nm + '! It is Warda here. How are you feeling today, dear?';
        }
      } else {
        greeting = 'Hello there! It is Warda. How are you feeling today?';
      }
    } else {
      greeting = 'Hello there! It is Warda. How are you feeling today?';
    }
    res.json({ success: true, greeting, sessionId: 'session_' + (userId || 'anon') + '_' + Date.now() });
  } catch (error) {
    console.error('Start error:', error);
    res.status(500).json({ success: false, error: 'Failed to start conversation' });
  }
});
module.exports = router;
