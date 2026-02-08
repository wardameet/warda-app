/**
 * Mood Tracking Routes - P1 Item 10
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getMoodTrend, getSymptomHistory } = require('../services/healthLogger');

router.get('/trend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const trend = await getMoodTrend(userId, days);
    if (!trend) return res.status(404).json({ error: 'No mood data found' });
    res.json({ success: true, data: trend });
  } catch (err) {
    console.error('Error getting mood trend:', err);
    res.status(500).json({ error: 'Failed to get mood trend' });
  }
});

router.get('/patterns/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const trend = await getMoodTrend(userId, days);
    if (!trend) return res.status(404).json({ error: 'No mood data found' });
    const analysis = {
      dayPatterns: trend.dayPatterns, lowestDay: trend.lowestDay,
      highestDay: trend.highestDay, overallAverage: trend.overallAverage, insight: null
    };
    if (trend.lowestDay && trend.highestDay && trend.lowestDay.day !== trend.highestDay.day) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const name = user?.firstName || 'Resident';
      if (parseFloat(trend.lowestDay.avg) < parseFloat(trend.highestDay.avg) - 1.5) {
        analysis.insight = name + ' tends to be quieter on ' + trend.lowestDay.day + 's (avg ' + trend.lowestDay.avg + ') and brighter on ' + trend.highestDay.day + 's (avg ' + trend.highestDay.avg + ').';
      }
    }
    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('Error getting mood patterns:', err);
    res.status(500).json({ error: 'Failed to get mood patterns' });
  }
});

router.get('/engagement/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const conversations = await prisma.conversation.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { _count: { select: { messages: true } } }
    });
    const moodTrend = await getMoodTrend(userId, days);
    const familyMessages = await prisma.message.count({
      where: { OR: [{ senderId: userId }, { recipientId: userId }], createdAt: { gte: since } }
    });
    const alerts = await prisma.alert.count({ where: { userId, createdAt: { gte: since } } });
    const totalMessages = conversations.reduce((sum, c) => sum + (c._count?.messages || 0), 0);
    const dailyActivity = {};
    conversations.forEach(c => {
      const day = c.createdAt.toISOString().split('T')[0];
      if (!dailyActivity[day]) dailyActivity[day] = { conversations: 0, messages: 0 };
      dailyActivity[day].conversations++;
      dailyActivity[day].messages += c._count?.messages || 0;
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    res.json({
      success: true,
      data: {
        resident: { id: userId, name: user ? user.firstName + ' ' + user.lastName : 'Unknown', careHomeId: user?.careHomeId },
        period: { days, from: since.toISOString(), to: new Date().toISOString() },
        engagement: {
          totalConversations: conversations.length, totalMessages,
          avgMessagesPerConversation: conversations.length > 0 ? (totalMessages / conversations.length).toFixed(1) : 0,
          familyMessages, alerts, activeDays: Object.keys(dailyActivity).length, dailyActivity
        },
        mood: moodTrend ? { average: moodTrend.overallAverage, trend: moodTrend.trend, lowestDay: moodTrend.lowestDay, highestDay: moodTrend.highestDay } : null
      }
    });
  } catch (err) {
    console.error('Error getting engagement report:', err);
    res.status(500).json({ error: 'Failed to get engagement report' });
  }
});

router.get('/care-home/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const residents = await prisma.user.findMany({
      where: { careHomeId, role: 'RESIDENT' },
      select: { id: true, firstName: true, lastName: true, roomNumber: true }
    });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overview = await Promise.all(residents.map(async (resident) => {
      const latestMood = await prisma.healthLog.findFirst({
        where: { userId: resident.id, type: 'MOOD' }, orderBy: { createdAt: 'desc' }
      });
      const recentMoods = await prisma.healthLog.findMany({
        where: { userId: resident.id, type: 'MOOD', createdAt: { gte: sevenDaysAgo } }
      });
      const scores = recentMoods.map(m => {
        try { return parseInt(JSON.parse(m.notes).score) || 5; }
        catch(e) { return parseInt(m.value) || 5; }
      });
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
      const activeAlerts = await prisma.alert.count({ where: { userId: resident.id, status: 'ACTIVE' } });
      const weekConversations = await prisma.conversation.count({
        where: { userId: resident.id, createdAt: { gte: sevenDaysAgo } }
      });
      let latestScore = null;
      if (latestMood) {
        try { latestScore = parseInt(JSON.parse(latestMood.notes).score); }
        catch(e) { latestScore = parseInt(latestMood.value); }
      }
      return {
        id: resident.id, name: resident.firstName + ' ' + resident.lastName, room: resident.roomNumber,
        latestMoodScore: latestScore, weeklyAverage: avgScore, weeklyConversations: weekConversations,
        activeAlerts,
        status: avgScore === null ? 'no_data' : parseFloat(avgScore) >= 6 ? 'good' : parseFloat(avgScore) >= 4 ? 'moderate' : 'concern'
      };
    }));
    const statusOrder = { concern: 0, moderate: 1, no_data: 2, good: 3 };
    overview.sort((a, b) => (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9));
    res.json({ success: true, data: overview });
  } catch (err) {
    console.error('Error getting care home mood overview:', err);
    res.status(500).json({ error: 'Failed to get care home overview' });
  }
});

router.get('/symptoms/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const history = await getSymptomHistory(userId, days);
    if (!history) return res.status(404).json({ error: 'No symptom data found' });
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Error getting symptom history:', err);
    res.status(500).json({ error: 'Failed to get symptom history' });
  }
});

module.exports = router;
