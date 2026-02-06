// ============================================================
// WARDA — Proactive Conversation Engine (Enhanced)
// Warda speaks FIRST — not just reactive
// Uses persona data: proactiveTopics, dailyRoutines, favouriteTopics
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Time Periods ───────────────────────────────────────────
function getTimePeriod() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'early_morning';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'lunchtime';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 23) return 'bedtime';
  return 'night';  // 23:00 - 05:00
}

function getDayOfWeek() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

function getSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ─── Get Proactive Message for Resident ─────────────────────
// This is the core function: decides what Warda should say
async function getProactiveMessage(residentId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: residentId },
      include: {
        profile: true,
      }
    });

    if (!user || !user.profile) {
      return getGenericMessage(getTimePeriod());
    }

    const profile = user.profile;
    const persona = profile.generatedPersona || {};
    const timePeriod = getTimePeriod();
    const day = getDayOfWeek();
    const season = getSeason();

    // ─── Priority-based message selection ───────────────
    
    // 1. MEDICATION REMINDER (highest priority)
    const pendingMeds = await checkMedicationDue(user.medications);
    if (pendingMeds.length > 0) {
      return buildMedicationReminder(user, pendingMeds, persona);
    }

    // 2. PENDING FAMILY MESSAGES
    const pendingMessages = await checkPendingFamilyMessages(residentId);
    if (pendingMessages.length > 0) {
      return buildFamilyMessageDelivery(user, pendingMessages, persona);
    }

    // 3. DAILY ROUTINE CHECK-INS
    const routineMessage = getRoutineMessage(profile, timePeriod, day, persona);
    if (routineMessage) {
      return routineMessage;
    }

    // 4. PROACTIVE TOPICS (from persona)
    const proactiveTopics = persona.proactiveTopics || [];
    if (proactiveTopics.length > 0) {
      const topic = proactiveTopics[Math.floor(Math.random() * proactiveTopics.length)];
      return {
        type: 'proactive_topic',
        message: topic,
        context: { topic, timePeriod }
      };
    }

    // 5. FAVOURITE TOPICS (conversation starter)
    const favouriteTopics = profile.interests ? JSON.parse(profile.interests) : [];
    if (favouriteTopics.length > 0) {
      const topic = favouriteTopics[Math.floor(Math.random() * favouriteTopics.length)];
      return buildTopicStarter(user, topic, persona, season);
    }

    // 6. TIME-BASED GREETING (fallback)
    return getTimeBasedGreeting(user, persona, timePeriod);

  } catch (error) {
    console.error('Proactive message error:', error);
    return getGenericMessage(getTimePeriod());
  }
}

// ─── Check Medication Due ───────────────────────────────────
async function checkMedicationDue(medications) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const pendingMeds = [];

  for (const med of medications) {
    // Use timeOfDay array from schema
    const times = med.timeOfDay || [];
    if (times.length === 0) continue;

    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      // Check if within 15 min window of scheduled time
      const diffMinutes = (currentHour * 60 + currentMinutes) - (h * 60 + m);
      if (diffMinutes >= 0 && diffMinutes <= 15) {
        // Check if not already taken today
        const takenToday = med.lastTakenAt && 
          new Date(med.lastTakenAt).toDateString() === now.toDateString();
        if (!takenToday) {
          pendingMeds.push({ name: med.name, dosage: med.dosage, time });
        }
      }
    }
  }

  return pendingMeds;
}

// ─── Check Pending Family Messages ──────────────────────────
















    console.error('Check pending messages error:', error);
    return [];
  }
}

// ─── Build Medication Reminder ──────────────────────────────
function buildMedicationReminder(user, meds, persona) {
  const name = user.preferredName || user.firstName;
  const medNames = meds.map(m => m.name).join(' and ');
  
  const gentleReminders = [
    `${name}, it's time for your ${medNames}. Would you like me to remind you again in a few minutes if you're not ready?`,
    `Hello ${name}, just a gentle reminder — it's time for your ${medNames}. No rush, dear.`,
    `${name}, your ${medNames} is due now. Shall I let the staff know you need help with it?`
  ];

  return {
    type: 'medication_reminder',
    message: gentleReminders[Math.floor(Math.random() * gentleReminders.length)],
    context: { medications: meds, priority: 'high' },
    requiresConfirmation: true
  };
}

// ─── Build Family Message Delivery ──────────────────────────
function buildFamilyMessageDelivery(user, messages, persona) {
  const name = user.preferredName || user.firstName;
  const msg = messages[0];
  const senderName = msg.sender?.firstName || 'your family';

  return {
    type: 'family_message',
    message: `${name}, you've got a lovely message from ${senderName}! ${senderName} says: "${msg.content}". Would you like to send a message back?`,
    context: { 
      messageId: msg.id, 
      senderId: msg.senderId, 
      senderName,
      remainingMessages: messages.length - 1 
    },
    markAsDelivered: true
  };
}

// ─── Get Routine Message ────────────────────────────────────
function getRoutineMessage(profile, timePeriod, day, persona) {
  const dailyRoutines = profile.dailyRoutines ? 
    (typeof profile.dailyRoutines === 'string' ? JSON.parse(profile.dailyRoutines) : profile.dailyRoutines) : {};
  
  const name = profile.preferredName || '';

  // Time-specific routine messages
  const routineMap = {
    early_morning: () => {
      if (dailyRoutines.wakeTime) {
        return {
          type: 'routine',
          message: persona.timeBasedGreetings?.morning?.[0] || 
            `Good morning, ${name}! I hope you slept well. It's a new day.`,
          context: { routine: 'wake_up', timePeriod }
        };
      }
      return null;
    },
    morning: () => {
      if (dailyRoutines.morningRoutine) {
        return {
          type: 'routine',
          message: `${name}, how has your morning been so far? ${dailyRoutines.morningRoutine}`,
          context: { routine: 'morning_check', timePeriod }
        };
      }
      return null;
    },
    lunchtime: () => ({
      type: 'routine',
      message: `${name}, it's nearly lunchtime! Are you looking forward to your meal?`,
      context: { routine: 'lunch', timePeriod }
    }),
    afternoon: () => {
      // Sundowning check
      if (profile.sundowners) {
        return {
          type: 'sundowning_support',
          message: persona.comfortPhrases?.[0] || 
            `${name}, you're doing really well today. I'm right here with you. Everything is absolutely fine.`,
          context: { routine: 'sundowning_support', timePeriod, priority: 'high' }
        };
      }
      return null;
    },
    evening: () => ({
      type: 'routine',
      message: persona.timeBasedGreetings?.evening?.[0] || 
        `${name}, it's been a lovely day. How are you feeling this evening?`,
      context: { routine: 'evening_check', timePeriod }
    }),
    bedtime: () => {
      const familyNames = profile.familyTree ? 
        Object.values(typeof profile.familyTree === 'string' ? JSON.parse(profile.familyTree) : profile.familyTree)
          .filter(f => f.name).map(f => f.name).slice(0, 2).join(' and ') : '';
      return {
        type: 'bedtime_routine',
        message: `Good night, ${name}. ${familyNames ? familyNames + ' send' + (familyNames.includes(' and ') ? '' : 's') + ' their love. ' : ''}Sleep well, dear. I'll be right here if you need me.`,
        context: { routine: 'bedtime', timePeriod }
      };
    },
    night: () => ({
      type: 'night_companion',
      message: `I'm here, ${name}. Everything is fine. It's the middle of the night. Would you like some gentle music, or shall I just keep you company for a wee while?`,
      context: { routine: 'night_companion', timePeriod, priority: 'gentle' }
    })
  };

  const routineFn = routineMap[timePeriod];
  return routineFn ? routineFn() : null;
}

// ─── Build Topic Starter ────────────────────────────────────
function buildTopicStarter(user, topic, persona, season) {
  const name = user.preferredName || user.firstName;
  
  const starters = [
    `${name}, I was thinking about ${topic}. You know so much about it — tell me more?`,
    `You know what I'd love to hear about, ${name}? Your thoughts on ${topic}.`,
    `${name}, with ${season} here, it made me think of ${topic}. Do you have any stories about that?`,
    `I remember you love ${topic}, ${name}. What's your favourite thing about it?`
  ];

  return {
    type: 'topic_starter',
    message: starters[Math.floor(Math.random() * starters.length)],
    context: { topic, season }
  };
}

// ─── Time-Based Greeting (fallback) ─────────────────────────
function getTimeBasedGreeting(user, persona, timePeriod) {
  const name = user.preferredName || user.firstName;
  
  // Try persona greetings first
  const periodMap = {
    early_morning: 'morning',
    morning: 'morning',
    lunchtime: 'afternoon',
    afternoon: 'afternoon',
    evening: 'evening',
    bedtime: 'night',
    night: 'night'
  };

  const greetingKey = periodMap[timePeriod] || 'morning';
  const personaGreetings = persona.timeBasedGreetings?.[greetingKey];
  
  if (personaGreetings && personaGreetings.length > 0) {
    return {
      type: 'greeting',
      message: personaGreetings[Math.floor(Math.random() * personaGreetings.length)],
      context: { timePeriod }
    };
  }

  // Generic fallback
  const genericGreetings = {
    morning: `Good morning, ${name}! How are you feeling today?`,
    afternoon: `Hello ${name}, I hope you're having a lovely afternoon.`,
    evening: `Good evening, ${name}. How has your day been?`,
    night: `I'm here with you, ${name}. Everything is fine.`
  };

  return {
    type: 'greeting',
    message: genericGreetings[greetingKey],
    context: { timePeriod }
  };
}

// ─── Generic Message (absolute fallback) ────────────────────
function getGenericMessage(timePeriod) {
  const messages = {
    early_morning: "Good morning! I hope you slept well. How are you feeling?",
    morning: "Hello! It's a lovely morning. Is there anything you'd like to do today?",
    lunchtime: "It's nearly lunchtime! How has your morning been?",
    afternoon: "Good afternoon! What have you been up to?",
    evening: "Good evening! I hope you've had a nice day.",
    bedtime: "It's getting late. Sleep well, dear. I'm right here.",
    night: "I'm here. Everything is fine. Would you like some gentle music?"
  };

  return {
    type: 'generic',
    message: messages[timePeriod] || messages.morning,
    context: { timePeriod }
  };
}

// ─── Proactive Scheduler ────────────────────────────────────
// Called by a timer to check all active residents
async function runProactiveCheck() {
  try {
    const activeResidents = await prisma.user.findMany({
      where: { 
        status: 'ACTIVE',
      },
      select: { id: true, preferredName: true, firstName: true }
    });

    const messages = [];
    for (const resident of activeResidents) {
      const msg = await getProactiveMessage(resident.id);
      if (msg) {
        messages.push({ residentId: resident.id, ...msg });
      }
    }

    return messages;
  } catch (error) {
    console.error('Proactive check error:', error);
    return [];
  }
}

// ─── Start Proactive Timer ──────────────────────────────────
let proactiveInterval = null;

function startProactiveEngine(io, intervalMinutes = 30) {
  if (proactiveInterval) clearInterval(proactiveInterval);

  console.log(`🔔 Proactive engine started (every ${intervalMinutes} min)`);

  proactiveInterval = setInterval(async () => {
    try {
      const messages = await runProactiveCheck();
      
      for (const msg of messages) {
        // Emit to tablet via WebSocket
        io.to(`resident-${msg.residentId}`).emit('proactive-message', {
          type: msg.type,
          message: msg.message,
          context: msg.context,
          timestamp: new Date().toISOString()
        });

        // Mark family messages as delivered if applicable
        if (msg.markAsDelivered && msg.context?.messageId) {
          await prisma.message.update({
            where: { id: msg.context.messageId },
            data: { isDelivered: true, deliveredAt: new Date() }
          });
        }

        // Log the proactive interaction
        await prisma.healthLog.create({
          data: {
            userId: msg.residentId,
            type: 'PROACTIVE_INTERACTION',
            value: msg.type,
            notes: msg.message.substring(0, 200),
            severity: msg.context?.priority === 'high' ? 'MEDIUM' : 'LOW'
          }
        }).catch(err => console.error('Failed to log proactive:', err));
      }

      if (messages.length > 0) {
        console.log(`🔔 Proactive: sent ${messages.length} messages`);
      }
    } catch (error) {
      console.error('Proactive timer error:', error);
    }
  }, intervalMinutes * 60 * 1000);

  // Also run immediately on start
  setTimeout(async () => {
    const messages = await runProactiveCheck();
    console.log(`🔔 Proactive initial check: ${messages.length} residents need attention`);
  }, 5000);
}

function stopProactiveEngine() {
  if (proactiveInterval) {
    clearInterval(proactiveInterval);
    proactiveInterval = null;
    console.log('🔔 Proactive engine stopped');
  }
}

module.exports = {
  getProactiveMessage,
  runProactiveCheck,
  startProactiveEngine,
  stopProactiveEngine,
  getTimePeriod,
  getSeason,
  getDayOfWeek
};
