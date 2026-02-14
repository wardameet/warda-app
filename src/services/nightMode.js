/**
 * Night Mode & Sleep Support Service
 * P1 Item 7: Sleep & Night-Time Support
 */

const prisma = require('../lib/prisma');

function getTimePeriod(hour) {
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'daytime';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 6) return 'night';
  return 'daytime';
}

function isNightTime(hour) {
  return hour >= 21 || hour < 6;
}

function isSleepTime(hour) {
  return hour >= 23 || hour < 5;
}

async function generateBedtimeMessage(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        familyContacts: { take: 3 }
      }
    });
    if (!user) return null;
    const firstName = user.firstName || 'dear';
    const profile = user.profile;
    let familyMention = '';
    if (user.familyContacts && user.familyContacts.length > 0) {
      const primaryFamily = user.familyContacts[0];
      const familyName = primaryFamily.firstName || 'your family';
      familyMention = ' ' + familyName + ' sends their love.';
    }
    let comfortPhrase = '';
    if (profile) {
      const personalData = profile.step7Data || profile.step6Data;
      if (personalData && typeof personalData === 'object') {
        const bedtimePrefs = personalData.bedtimeRoutine || personalData.eveningRoutine;
        if (bedtimePrefs) {
          comfortPhrase = ' I know you like ' + bedtimePrefs + '.';
        }
      }
    }
    const bedtimeMessages = [
      'Good night, ' + firstName + '.' + familyMention + ' Tomorrow will be a lovely day. Sleep well, dear.' + comfortPhrase,
      'Time to rest now, ' + firstName + '.' + familyMention + ' You have had a good day. Sweet dreams.',
      'Goodnight, ' + firstName + '. I will be right here if you need me during the night.' + familyMention,
      'Sleep well, ' + firstName + '. The night is peaceful and you are safe and warm.' + familyMention,
    ];
    const message = bedtimeMessages[Math.floor(Math.random() * bedtimeMessages.length)];
    return { message, type: 'bedtime_routine', voiceSpeed: 'slow', volume: 'low' };
  } catch (err) {
    console.error('Error generating bedtime message:', err);
    return null;
  }
}

async function generateNightWakingResponse(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    if (!user) return null;
    const firstName = user.firstName || 'dear';
    const hour = new Date().getHours();
    const nightResponses = [
      'I am here, ' + firstName + '. Everything is fine. It is the middle of the night - you are safe in your room. Would you like some gentle music to help you drift off?',
      'Hello, ' + firstName + '. Cannot sleep? That is alright, I am here with you. Would you like me to play some soft sounds - perhaps rain or the ocean?',
      'It is still night-time, ' + firstName + '. Everything is peaceful. Shall I tell you a wee story, or would you prefer some calming music?',
      'Do not worry, ' + firstName + '. I am right here. It is ' + (hour < 4 ? 'still early' : 'nearly morning') + '. Would you like to chat quietly, or shall I play something soothing?',
    ];
    const response = nightResponses[Math.floor(Math.random() * nightResponses.length)];
    return {
      message: response,
      type: 'night_companion',
      voiceSpeed: 'slow',
      volume: 'low',
      suggestions: ['Play gentle music', 'Tell me a story', 'I am okay, goodnight']
    };
  } catch (err) {
    console.error('Error generating night waking response:', err);
    return null;
  }
}

async function generateMorningMessage(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        familyContacts: { take: 1 }
      }
    });
    if (!user) return null;
    const firstName = user.firstName || 'dear';
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[now.getDay()];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    let dayPreview = '';
    try {
      const events = await prisma.calendarEvent.findMany({
        where: { userId, date: { gte: todayStart, lt: todayEnd } },
        orderBy: { date: 'asc' },
        take: 3
      });
      if (events.length > 0) {
        const eventNames = events.map(e => e.title).join(', ');
        dayPreview = ' You have got ' + eventNames + ' today.';
      }
    } catch (e) {}
    let messageMention = '';
    try {
      const unreadMessages = await prisma.message.count({
        where: {
          recipientId: userId,
          isDelivered: false,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      if (unreadMessages > 0) {
        messageMention = ' You have ' + unreadMessages + ' new message' + (unreadMessages > 1 ? 's' : '') + ' from your family.';
      }
    } catch (e) {}
    const morningMessages = [
      'Good morning, ' + firstName + '! It is ' + dayName + ', and I hope you slept well.' + dayPreview + messageMention + ' What would you like to do first?',
      'Rise and shine, ' + firstName + '! It is a lovely ' + dayName + ' morning.' + dayPreview + messageMention,
      'Good morning, ' + firstName + '. How did you sleep? It is ' + dayName + ' today.' + dayPreview + messageMention,
    ];
    const message = morningMessages[Math.floor(Math.random() * morningMessages.length)];
    return { message, type: 'morning_wakeup', voiceSpeed: 'normal', volume: 'normal' };
  } catch (err) {
    console.error('Error generating morning message:', err);
    return null;
  }
}

async function logSleepInteraction(userId, interactionType, details = {}) {
  try {
    await prisma.healthLog.create({
      data: {
        userId,
        type: 'SLEEP',
        value: interactionType,
        notes: JSON.stringify({
          wokeAt: new Date().toISOString(),
          interactionType,
          duration: details.duration || null,
          resolvedBy: details.resolvedBy || 'warda',
          ...details
        }),
        recordedBy: 'warda-system'
      }
    });
    console.log('Sleep interaction logged: ' + interactionType + ' for ' + userId);
    return true;
  } catch (err) {
    console.error('Error logging sleep interaction:', err);
    return false;
  }
}

async function getSleepSummary(userId, days = 7) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sleepLogs = await prisma.healthLog.findMany({
      where: { userId, type: 'SLEEP', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }
    });
    const nightWakings = sleepLogs.filter(l => l.value === 'night_waking');
    const avgWakingsPerNight = days > 0 ? (nightWakings.length / days).toFixed(1) : 0;
    return {
      totalInteractions: sleepLogs.length,
      nightWakings: nightWakings.length,
      avgWakingsPerNight,
      recentLogs: sleepLogs.slice(0, 10).map(l => ({
        type: l.value,
        time: l.createdAt,
        notes: l.notes ? JSON.parse(l.notes) : null
      }))
    };
  } catch (err) {
    console.error('Error getting sleep summary:', err);
    return null;
  }
}

module.exports = {
  getTimePeriod, isNightTime, isSleepTime,
  generateBedtimeMessage, generateNightWakingResponse, generateMorningMessage,
  logSleepInteraction, getSleepSummary
};
