/**
 * Sleep Routes - P1 Item 7
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  generateBedtimeMessage, generateNightWakingResponse, generateMorningMessage,
  logSleepInteraction, getSleepSummary, isNightTime, getTimePeriod
} = require('../services/nightMode');

router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const summary = await getSleepSummary(userId, days);
    if (!summary) return res.status(404).json({ error: 'No sleep data found' });
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error getting sleep summary:', err);
    res.status(500).json({ error: 'Failed to get sleep summary' });
  }
});

router.post('/log', async (req, res) => {
  try {
    const { userId, interactionType, details } = req.body;
    if (!userId || !interactionType) return res.status(400).json({ error: 'userId and interactionType required' });
    const logged = await logSleepInteraction(userId, interactionType, details || {});
    res.json({ success: logged });
  } catch (err) {
    console.error('Error logging sleep:', err);
    res.status(500).json({ error: 'Failed to log sleep interaction' });
  }
});

router.get('/night-check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const hour = new Date().getHours();
    const timePeriod = getTimePeriod(hour);
    let response;
    if (timePeriod === 'night') {
      response = await generateNightWakingResponse(userId);
      await logSleepInteraction(userId, 'night_waking', { hour });
    } else if (timePeriod === 'morning') {
      response = await generateMorningMessage(userId);
    } else if (timePeriod === 'evening' && hour >= 20) {
      response = await generateBedtimeMessage(userId);
    } else {
      response = { message: null, type: 'daytime' };
    }
    res.json({ success: true, timePeriod, isNight: isNightTime(hour), response });
  } catch (err) {
    console.error('Error in night check:', err);
    res.status(500).json({ error: 'Failed to process night check' });
  }
});

router.get('/bedtime/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const message = await generateBedtimeMessage(userId);
    if (message) await logSleepInteraction(userId, 'bedtime', {});
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Error generating bedtime message:', err);
    res.status(500).json({ error: 'Failed to generate bedtime message' });
  }
});

router.get('/morning/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const message = await generateMorningMessage(userId);
    if (message) await logSleepInteraction(userId, 'morning', {});
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Error generating morning message:', err);
    res.status(500).json({ error: 'Failed to generate morning message' });
  }
});

module.exports = router;
