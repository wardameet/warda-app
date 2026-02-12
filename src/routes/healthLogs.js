const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Health log types
const LOG_TYPES = ['MOOD', 'PAIN', 'SLEEP', 'APPETITE', 'MOBILITY', 'MEDICATION_TAKEN', 'MEDICATION_SKIPPED', 'VITALS', 'INCIDENT', 'NOTE'];

// GET /api/health-logs/:userId - Get health logs with filters
router.get('/:userId', tabletAuth, async (req, res) => {
  try {
    const { type, from, to, limit } = req.query;
    const where = { userId: req.params.userId };
    if (type) where.type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const logs = await prisma.healthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 100
    });
    
    // Summary stats
    const today = new Date(); today.setHours(0,0,0,0);
    const todayLogs = logs.filter(l => new Date(l.createdAt) >= today);
    const moodLogs = logs.filter(l => l.type === 'MOOD').slice(0, 7);
    const avgMood = moodLogs.length > 0 ? (moodLogs.reduce((s, l) => s + parseInt(l.value) || 0, 0) / moodLogs.length).toFixed(1) : null;
    
    res.json({ success: true, logs, total: logs.length, todayCount: todayLogs.length, avgMood, types: LOG_TYPES });
  } catch (err) {
    console.error('Get health logs error:', err);
    res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// POST /api/health-logs - Create health log
router.post('/', tabletAuth, async (req, res) => {
  try {
    const { userId, type, value, notes, recordedBy } = req.body;
    if (!userId || !type || !value) return res.status(400).json({ error: 'userId, type, value required' });
    if (!LOG_TYPES.includes(type)) return res.status(400).json({ error: `Invalid type. Must be: ${LOG_TYPES.join(', ')}` });
    
    const log = await prisma.healthLog.create({
      data: { userId, type, value, notes: notes || null, recordedBy: recordedBy || 'staff' }
    });

    // Auto-alert for concerning values
    if (type === 'MOOD' && parseInt(value) <= 2) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, preferredName: true, careHomeId: true } });
      await prisma.alert.create({
        data: { userId, type: 'MOOD', severity: 'HIGH', message: `${user.preferredName || user.firstName} reported low mood (${value}/5)`, careHomeId: user.careHomeId }
      });
    }
    if (type === 'PAIN' && parseInt(value) >= 7) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, preferredName: true, careHomeId: true } });
      await prisma.alert.create({
        data: { userId, type: 'HEALTH', severity: 'HIGH', message: `${user.preferredName || user.firstName} reported high pain (${value}/10)`, careHomeId: user.careHomeId }
      });
    }
    if (type === 'INCIDENT') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, preferredName: true, careHomeId: true } });
      await prisma.alert.create({
        data: { userId, type: 'HEALTH', severity: 'CRITICAL', message: `Incident reported for ${user.preferredName || user.firstName}: ${value}`, careHomeId: user.careHomeId }
      });
    }

    res.json({ success: true, log });
  } catch (err) {
    console.error('Create health log error:', err);
    res.status(500).json({ success: false, error: 'Failed to create log' });
  }
});

// GET /api/health-logs/:userId/report - GP-ready health summary
router.get('/:userId/report', async (req, res) => {
  try {
    const { from, to } = req.query;
    const periodStart = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const periodEnd = to ? new Date(to) : new Date();

    const [user, logs, meds, conversations, alerts] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.userId }, include: { profile: true, careHome: { select: { name: true } } } }),
      prisma.healthLog.findMany({ where: { userId: req.params.userId, createdAt: { gte: periodStart, lte: periodEnd } }, orderBy: { createdAt: 'desc' } }),
      prisma.medication.findMany({ where: { userId: req.params.userId, isActive: true } }),
      prisma.conversation.findMany({ where: { userId: req.params.userId, startedAt: { gte: periodStart } }, select: { startedAt: true, endedAt: true, messageCount: true, moodSummary: true } }),
      prisma.alert.findMany({ where: { userId: req.params.userId, createdAt: { gte: periodStart } }, orderBy: { createdAt: 'desc' } })
    ]);

    if (!user) return res.status(404).json({ error: 'Resident not found' });

    const name = user.preferredName || user.firstName;
    const age = user.dateOfBirth ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / 31557600000) : null;

    // Mood summary
    const moodLogs = logs.filter(l => l.type === 'MOOD');
    const avgMood = moodLogs.length > 0 ? (moodLogs.reduce((s, l) => s + (parseInt(l.value) || 0), 0) / moodLogs.length).toFixed(1) : 'N/A';
    const lowMoodDays = moodLogs.filter(l => parseInt(l.value) <= 2).length;

    // Pain summary
    const painLogs = logs.filter(l => l.type === 'PAIN');
    const avgPain = painLogs.length > 0 ? (painLogs.reduce((s, l) => s + (parseInt(l.value) || 0), 0) / painLogs.length).toFixed(1) : 'N/A';

    // Medication adherence
    const medTaken = logs.filter(l => l.type === 'MEDICATION_TAKEN').length;
    const medSkipped = logs.filter(l => l.type === 'MEDICATION_SKIPPED').length;
    const adherence = medTaken + medSkipped > 0 ? ((medTaken / (medTaken + medSkipped)) * 100).toFixed(0) : 'N/A';

    // Sleep
    const sleepLogs = logs.filter(l => l.type === 'SLEEP');
    const avgSleep = sleepLogs.length > 0 ? (sleepLogs.reduce((s, l) => s + (parseFloat(l.value) || 0), 0) / sleepLogs.length).toFixed(1) : 'N/A';

    // Engagement
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((s, c) => s + (c.messageCount || 0), 0);

    // Incidents
    const incidents = logs.filter(l => l.type === 'INCIDENT');
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

    const report = {
      resident: { name: `${user.firstName} ${user.lastName}`, preferredName: name, age, room: user.roomNumber, careHome: user.careHome?.name },
      period: { from: periodStart.toISOString().split('T')[0], to: periodEnd.toISOString().split('T')[0], days: Math.ceil((periodEnd - periodStart) / 86400000) },
      health: { dementiaStage: user.profile?.dementiaStage || 'Not recorded', mobility: user.profile?.mobilityLevel || 'Not recorded', hearing: user.profile?.hearing || 'Not recorded', vision: user.profile?.vision || 'Not recorded' },
      mood: { average: avgMood, outOf: 5, totalEntries: moodLogs.length, lowMoodDays, trend: moodLogs.length >= 2 ? (parseInt(moodLogs[0]?.value) >= parseInt(moodLogs[moodLogs.length-1]?.value) ? 'improving' : 'declining') : 'insufficient_data' },
      pain: { average: avgPain, outOf: 10, totalEntries: painLogs.length },
      sleep: { averageHours: avgSleep, totalEntries: sleepLogs.length },
      medications: { active: meds.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, times: m.timeOfDay })), adherencePercent: adherence, taken: medTaken, skipped: medSkipped },
      engagement: { totalConversations, totalMessages, avgMessagesPerDay: totalConversations > 0 ? (totalMessages / Math.max(1, Math.ceil((periodEnd - periodStart) / 86400000))).toFixed(1) : '0' },
      incidents: incidents.map(i => ({ date: i.createdAt, description: i.value, notes: i.notes })),
      criticalAlerts: criticalAlerts.map(a => ({ date: a.createdAt, type: a.type, message: a.message })),
      generatedAt: new Date().toISOString()
    };

    res.json({ success: true, report });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

module.exports = router;
