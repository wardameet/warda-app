/**
 * Proactive Conversation Initiator
 * Warda starts conversations based on time of day, mood patterns, and engagement
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getWardaResponse } = require('./claude');
const { textToSpeech, VOICES } = require('./voice');

// Time-based prompts (UK timezone)
const TIME_PROMPTS = {
  morning: [
    "Good morning! Did you sleep well? I was thinking about you.",
    "Rise and shine, dear! Shall I tell you what day it is?",
    "Good morning! I heard the birds singing and thought of you.",
  ],
  midmorning: [
    "Would you fancy a wee cup of tea? I could keep you company.",
    "How are you getting on this morning? Anything on your mind?",
    "I was just thinking about our last chat. Would you like to talk?",
  ],
  afternoon: [
    "Good afternoon! Have you had a nice lunch?",
    "The afternoon is a lovely time for a chat, don't you think?",
    "I hope you're having a pleasant day. Shall we catch up?",
  ],
  evening: [
    "Good evening, dear. How has your day been?",
    "The evening is drawing in. Would you like some company?",
    "I hope today has been kind to you. Fancy a wee chat?",
  ]
};

// Mood-based check-ins
const MOOD_CHECKINS = {
  sad: [
    "I noticed you seemed a bit down earlier. I'm here if you want to talk, love.",
    "Just checking in on you. Remember, you're never alone.",
  ],
  anxious: [
    "How are you feeling, dear? Take a deep breath with me.",
    "I'm right here with you. Would you like to hear something calming?",
  ],
  lonely: [
    "I was thinking about you and wanted to say hello.",
    "Would you like me to help you send a wee message to your family?",
  ]
};

function getTimeSlot() {
  const hour = new Date().getUTCHours() + 0; // UTC - adjust for BST/GMT
  if (hour >= 7 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 12) return 'midmorning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return null; // Don't initiate during night
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function getResidentsForProactive() {
  try {
    const residents = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: {
        profile: { select: { preferredName: true, communicationPreferences: true } },
        conversations: { take: 1, orderBy: { startedAt: 'desc' }, select: { startedAt: true } },
        alerts: { take: 1, orderBy: { createdAt: 'desc' }, select: { severity: true, type: true, createdAt: true } }
      }
    });
    return residents;
  } catch (err) {
    console.error('Failed to get residents for proactive:', err);
    return [];
  }
}

async function generateProactiveMessage(resident) {
  const timeSlot = getTimeSlot();
  if (!timeSlot) return null; // Night time

  const name = resident.profile?.preferredName || resident.firstName;
  
  // Check last conversation - don't bother if they chatted recently (< 2 hours)
  const lastConvo = resident.conversations?.[0];
  if (lastConvo) {
    const hoursSince = (Date.now() - new Date(lastConvo.startedAt).getTime()) / 3600000;
    if (hoursSince < 2) return null;
  }

  // Check recent mood alerts
  const recentAlert = resident.alerts?.[0];
  let moodPrompt = null;
  if (recentAlert && (Date.now() - new Date(recentAlert.createdAt).getTime()) < 14400000) {
    if (recentAlert.severity === 'HIGH' || recentAlert.type === 'MOOD') {
      moodPrompt = pickRandom(MOOD_CHECKINS.sad);
    }
  }

  // Pick message
  const baseMessage = moodPrompt || pickRandom(TIME_PROMPTS[timeSlot]);
  
  // Personalize with name
  const personalizedMessage = `${name}, ${baseMessage.charAt(0).toLowerCase()}${baseMessage.slice(1)}`;
  
  return {
    text: personalizedMessage,
    type: moodPrompt ? 'mood_checkin' : 'time_based',
    timeSlot,
    residentId: resident.id,
    residentName: name
  };
}

// Main proactive check - runs periodically
async function runProactiveCheck(io) {
  console.log('[Proactive] Running check...');
  const residents = await getResidentsForProactive();
  
  for (const resident of residents) {
    const message = await generateProactiveMessage(resident);
    if (!message) continue;

    try {
      // Generate audio
      const audio = await textToSpeech(message.text, VOICES.female);
      
      // Send to tablet via socket
      if (io) {
        io.to(`tablet:${resident.id}`).emit('proactive:message', {
          text: message.text,
          audio: audio.audio,
          type: message.type,
          timeSlot: message.timeSlot
        });
      }

      console.log(`[Proactive] Sent ${message.type} to ${message.residentName}: "${message.text.substring(0, 50)}..."`);
    } catch (err) {
      console.error(`[Proactive] Failed for ${resident.id}:`, err.message);
    }
  }
}

// Start the proactive scheduler
function startProactiveScheduler(io) {
  // Run every 90 minutes during waking hours
  const INTERVAL = 90 * 60 * 1000; // 90 minutes
  
  console.log('[Proactive] Scheduler started (every 90 min)');
  
  // Initial check after 5 minutes
  setTimeout(() => runProactiveCheck(io), 5 * 60 * 1000);
  
  // Then every 90 minutes
  setInterval(() => {
    const timeSlot = getTimeSlot();
    if (timeSlot) { // Only during waking hours
      runProactiveCheck(io);
    }
  }, INTERVAL);
}

module.exports = { startProactiveScheduler, runProactiveCheck, generateProactiveMessage };
