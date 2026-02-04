/**
 * Analytics Routes
 * Engagement metrics for care home dashboards
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/analytics/summary/:careHomeId
router.get('/summary/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all residents for this care home
    const residents = await prisma.user.findMany({
      where: { careHomeId },
      select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true }
    });
    const residentIds = residents.map(r => r.id);

    // Total conversations (from Message table, group by date)
    const messages = await prisma.message.findMany({
      where: { userId: { in: residentIds }, createdAt: { gte: since } },
      select: { id: true, userId: true, mood: true, isFromWarda: true, createdAt: true }
    });

    // Alerts
    const alerts = await prisma.alert.findMany({
      where: { userId: { in: residentIds }, createdAt: { gte: since } },
      select: { id: true, type: true, severity: true, isResolved: true, userId: true, createdAt: true }
    });

    // Conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId: { in: residentIds }, startedAt: { gte: since } },
      select: { id: true, userId: true, mood: true, duration: true, startedAt: true }
    });

    // Daily breakdown
    const dailyMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, messages: 0, alerts: 0, conversations: 0 };
    }
    messages.forEach(m => {
      const key = m.createdAt.toISOString().split('T')[0];
      if (dailyMap[key]) dailyMap[key].messages++;
    });
    alerts.forEach(a => {
      const key = a.createdAt.toISOString().split('T')[0];
      if (dailyMap[key]) dailyMap[key].alerts++;
    });
    conversations.forEach(c => {
      const key = c.startedAt.toISOString().split('T')[0];
      if (dailyMap[key]) dailyMap[key].conversations++;
    });

    // Mood distribution
    const moods = {};
    messages.filter(m => m.mood).forEach(m => { moods[m.mood] = (moods[m.mood] || 0) + 1; });
    conversations.filter(c => c.mood).forEach(c => { moods[c.mood] = (moods[c.mood] || 0) + 1; });

    // Alert types
    const alertTypes = {};
    alerts.forEach(a => { alertTypes[a.type] = (alertTypes[a.type] || 0) + 1; });

    // Per-resident engagement
    const perResident = residents.map(r => {
      const rMsgs = messages.filter(m => m.userId === r.id).length;
      const rAlerts = alerts.filter(a => a.userId === r.id).length;
      const rConvos = conversations.filter(c => c.userId === r.id).length;
      const rMoods = {};
      messages.filter(m => m.userId === r.id && m.mood).forEach(m => { rMoods[m.mood] = (rMoods[m.mood] || 0) + 1; });
      return {
        id: r.id,
        name: r.preferredName || r.firstName,
        lastName: r.lastName,
        room: r.roomNumber,
        messages: rMsgs,
        alerts: rAlerts,
        conversations: rConvos,
        moods: rMoods,
        avgDaily: days > 0 ? Math.round((rMsgs / days) * 10) / 10 : 0,
      };
    });

    const resolvedAlerts = alerts.filter(a => a.isResolved).length;

    res.json({
      success: true,
      analytics: {
        period: { days, since: since.toISOString() },
        totals: {
          residents: residents.length,
          messages: messages.length,
          conversations: conversations.length,
          alerts: alerts.length,
          resolvedAlerts,
          unresolvedAlerts: alerts.length - resolvedAlerts,
        },
        daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
        moods,
        alertTypes,
        perResident,
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
