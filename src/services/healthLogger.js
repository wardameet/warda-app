/**
 * Health Logger Service
 * P1 Item 8: Health Symptoms Logging via Conversation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SYMPTOM_PATTERNS = {
  pain: {
    patterns: [
      /\b(pain|hurt|hurts|hurting|sore|ache|aching|throbbing|stiff|stiffness)\b/i,
      /my\s+(knee|back|hip|shoulder|neck|head|stomach|chest|leg|arm|hand|foot|ankle|wrist)\s+(is\s+)?(sore|hurting|painful|aching|stiff)/i,
      /\b(can't|cannot|difficult)\s+(move|walk|bend|lift|reach|grip|stand|sit)\b/i
    ],
    severity: 'medium',
    bodyPartExtractor: /my\s+(knee|back|hip|shoulder|neck|head|stomach|chest|leg|arm|hand|foot|ankle|wrist|elbow|finger|toe|jaw)/i
  },
  dizzy: {
    patterns: [
      /\b(dizzy|dizziness|lightheaded|light.headed|unsteady|vertigo|room\s+spinning)\b/i,
      /\b(feel|feeling)\s+(faint|wobbly|unbalanced)\b/i
    ],
    severity: 'high'
  },
  breathing: {
    patterns: [
      /\b(breathless|breathe|breathing|short\s+of\s+breath|out\s+of\s+breath|can't\s+breathe|wheezing)\b/i,
      /\b(chest|heart)\s+(tight|tightness|pressure|heavy)\b/i
    ],
    severity: 'high'
  },
  nausea: {
    patterns: [
      /\b(nauseous|nausea|sick|vomit|vomiting|throwing\s+up|queasy|stomach\s+upset)\b/i,
      /\b(going\s+to|feel\s+like)\s+(be\s+)?sick\b/i
    ],
    severity: 'medium'
  },
  fatigue: {
    patterns: [
      /\b(tired|exhausted|fatigue|fatigued|no\s+energy|worn\s+out|drained|sluggish|lethargic)\b/i,
      /\b(can't|cannot)\s+(stay\s+awake|keep\s+my\s+eyes\s+open)\b/i
    ],
    severity: 'low'
  },
  appetite: {
    patterns: [
      /\b(not\s+hungry|no\s+appetite|can't\s+eat|don't\s+want\s+to\s+eat|off\s+my\s+food|not\s+eating)\b/i
    ],
    severity: 'low'
  },
  confusion: {
    patterns: [
      /\b(confused|confusion|don't\s+know\s+where\s+I\s+am|lost|can't\s+remember|forget|forgot|forgetful)\b/i,
      /\b(where\s+am\s+I|who\s+are\s+you|what\s+day\s+is\s+it)\b/i
    ],
    severity: 'medium'
  },
  fall: {
    patterns: [
      /\b(fell|fallen|fall|tripped|stumbled|lost\s+my\s+balance|slipped)\b/i
    ],
    severity: 'high'
  },
  vision: {
    patterns: [
      /\b(can't\s+see|blurry|blurred|seeing\s+double)\b/i,
      /\b(my\s+)?(vision|sight|eyesight)\s+(is\s+)?(getting\s+worse|blurry|poor|bad)\b/i
    ],
    severity: 'medium'
  },
  skin: {
    patterns: [
      /\b(rash|itchy|itching|swollen|swelling|bruise|bruised|lump|bump)\b/i
    ],
    severity: 'low'
  }
};

const MOOD_SCORE_MAP = {
  'happy': 8, 'content': 7, 'engaged': 7, 'neutral': 5,
  'reflective': 5, 'tired': 4, 'anxious': 3, 'needs_comfort': 3,
  'sad': 2, 'health_concern': 2, 'distressed': 1, 'confused': 3
};

function extractMoodScore(mood, userMessage, wardaResponse) {
  let score = MOOD_SCORE_MAP[mood] || 5;
  const lower = userMessage.toLowerCase();
  if (lower.match(/\b(wonderful|fantastic|great|brilliant|lovely|happy|enjoying|laugh|laughing|smiling)\b/)) {
    score = Math.min(10, score + 2);
  }
  if (lower.match(/\b(good|nice|fine|okay|alright|pleasant|well)\b/) && !lower.match(/not\s+(good|fine|okay|well)/)) {
    score = Math.min(10, score + 1);
  }
  if (lower.match(/\b(terrible|awful|dreadful|horrible|miserable|worst)\b/)) {
    score = Math.max(1, score - 2);
  }
  if (lower.match(/\b(bad|poor|rough|difficult|struggling|hard)\b/)) {
    score = Math.max(1, score - 1);
  }
  return Math.round(score);
}

function detectSymptoms(userMessage) {
  const symptoms = [];
  for (const [symptomType, config] of Object.entries(SYMPTOM_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(userMessage)) {
        const symptom = {
          type: symptomType,
          severity: config.severity,
          matchedText: userMessage.match(pattern)?.[0] || '',
          detectedAt: new Date().toISOString()
        };
        if (config.bodyPartExtractor) {
          const bodyMatch = userMessage.match(config.bodyPartExtractor);
          if (bodyMatch) symptom.bodyPart = bodyMatch[1];
        }
        symptoms.push(symptom);
        break;
      }
    }
  }
  return symptoms;
}

async function logConversationHealth(userId, userMessage, wardaResponse, mood) {
  try {
    const moodScore = extractMoodScore(mood, userMessage, wardaResponse);
    const symptoms = detectSymptoms(userMessage);
    await prisma.healthLog.create({
      data: {
        userId, type: 'MOOD', value: String(moodScore),
        notes: JSON.stringify({ mood, score: moodScore, messageSnippet: userMessage.substring(0, 100), timestamp: new Date().toISOString() }),
        recordedBy: 'warda-ai'
      }
    });
    for (const symptom of symptoms) {
      await prisma.healthLog.create({
        data: {
          userId, type: 'SYMPTOM', value: symptom.type,
          notes: JSON.stringify({ severity: symptom.severity, bodyPart: symptom.bodyPart || null, matchedText: symptom.matchedText, fullMessage: userMessage.substring(0, 200), detectedAt: symptom.detectedAt }),
          recordedBy: 'warda-ai'
        }
      });
      console.log('Symptom logged: ' + symptom.type + ' (' + symptom.severity + ') for ' + userId);
    }
    await checkMoodTrendAlert(userId, moodScore);
    return { moodScore, symptoms, logged: true };
  } catch (err) {
    console.error('Error logging conversation health:', err);
    return { moodScore: 5, symptoms: [], logged: false };
  }
}

async function checkMoodTrendAlert(userId, currentScore) {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const recentMoods = await prisma.healthLog.findMany({
      where: { userId, type: 'MOOD', createdAt: { gte: threeDaysAgo } },
      orderBy: { createdAt: 'desc' }, take: 10
    });
    if (recentMoods.length < 3) return;
    const scores = recentMoods.map(m => {
      try { return parseInt(JSON.parse(m.notes).score) || 5; }
      catch(e) { return parseInt(m.value) || 5; }
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 4) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const firstName = user?.firstName || 'Resident';
      const recentAlert = await prisma.alert.findFirst({
        where: { userId, type: 'MOOD_TREND', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      });
      if (!recentAlert) {
        await prisma.alert.create({
          data: {
            userId, careHomeId: user?.careHomeId, type: 'MOOD_TREND',
            severity: avg < 3 ? 'HIGH' : 'MEDIUM',
            title: 'Persistent low mood detected for ' + firstName,
            description: firstName + ' average mood score has been ' + avg.toFixed(1) + '/10 over the last 3 days. Recent scores: ' + scores.slice(0, 5).join(', ') + '. Consider checking in.',
            status: 'ACTIVE'
          }
        });
        console.log('MOOD TREND ALERT: ' + firstName + ' avg ' + avg.toFixed(1) + '/10 over 3 days');
      }
    }
  } catch (err) {
    console.error('Error checking mood trend:', err);
  }
}

async function getMoodTrend(userId, days = 7) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const moodLogs = await prisma.healthLog.findMany({
      where: { userId, type: 'MOOD', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' }
    });
    const dailyScores = {};
    moodLogs.forEach(log => {
      const day = log.createdAt.toISOString().split('T')[0];
      if (!dailyScores[day]) dailyScores[day] = [];
      try { dailyScores[day].push(parseInt(JSON.parse(log.notes).score) || parseInt(log.value) || 5); }
      catch(e) { dailyScores[day].push(parseInt(log.value) || 5); }
    });
    const trend = Object.entries(dailyScores).map(([date, scores]) => ({
      date, avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      conversations: scores.length, min: Math.min(...scores), max: Math.max(...scores)
    }));
    const allScores = moodLogs.map(l => {
      try { return parseInt(JSON.parse(l.notes).score) || 5; }
      catch(e) { return parseInt(l.value) || 5; }
    });
    const overallAvg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : null;
    const dayOfWeekScores = {};
    moodLogs.forEach(log => {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][log.createdAt.getDay()];
      if (!dayOfWeekScores[dayName]) dayOfWeekScores[dayName] = [];
      try { dayOfWeekScores[dayName].push(parseInt(JSON.parse(log.notes).score) || 5); }
      catch(e) { dayOfWeekScores[dayName].push(parseInt(log.value) || 5); }
    });
    const dayPatterns = Object.entries(dayOfWeekScores).map(([day, scores]) => ({
      day, avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1), count: scores.length
    })).sort((a, b) => parseFloat(a.avg) - parseFloat(b.avg));
    return {
      trend, overallAverage: overallAvg, totalConversations: allScores.length,
      dayPatterns, lowestDay: dayPatterns.length > 0 ? dayPatterns[0] : null,
      highestDay: dayPatterns.length > 0 ? dayPatterns[dayPatterns.length - 1] : null
    };
  } catch (err) {
    console.error('Error getting mood trend:', err);
    return null;
  }
}

async function getSymptomHistory(userId, days = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const symptoms = await prisma.healthLog.findMany({
      where: { userId, type: 'SYMPTOM', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }
    });
    const grouped = {};
    symptoms.forEach(s => {
      if (!grouped[s.value]) grouped[s.value] = [];
      grouped[s.value].push({ date: s.createdAt, notes: s.notes ? JSON.parse(s.notes) : null });
    });
    return {
      totalSymptoms: symptoms.length, byType: grouped,
      recent: symptoms.slice(0, 20).map(s => ({
        type: s.value, date: s.createdAt, details: s.notes ? JSON.parse(s.notes) : null
      }))
    };
  } catch (err) {
    console.error('Error getting symptom history:', err);
    return null;
  }
}

module.exports = {
  extractMoodScore, detectSymptoms, logConversationHealth,
  checkMoodTrendAlert, getMoodTrend, getSymptomHistory, MOOD_SCORE_MAP
};
