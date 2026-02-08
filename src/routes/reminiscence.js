/**
 * Reminiscence & Life Story Routes - P1 Item 9
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  getLifeStories, generateReminiscencePrompt, getLifeStoryContext, storeLifeStory
} = require('../services/reminiscence');

router.get('/stories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tag, limit } = req.query;
    const stories = await getLifeStories(userId, { tag: tag || null, limit: parseInt(limit) || 50 });
    res.json({ success: true, data: { stories, total: stories.length } });
  } catch (err) {
    console.error('Error getting life stories:', err);
    res.status(500).json({ error: 'Failed to get life stories' });
  }
});

router.get('/prompt/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const promptData = await generateReminiscencePrompt(userId);
    if (!promptData) return res.status(404).json({ error: 'Could not generate prompt' });
    res.json({ success: true, data: promptData });
  } catch (err) {
    console.error('Error generating reminiscence prompt:', err);
    res.status(500).json({ error: 'Failed to generate prompt' });
  }
});

router.get('/context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const maxEntries = parseInt(req.query.max) || 5;
    const context = await getLifeStoryContext(userId, maxEntries);
    res.json({ success: true, context });
  } catch (err) {
    console.error('Error getting life story context:', err);
    res.status(500).json({ error: 'Failed to get context' });
  }
});

router.post('/stories', async (req, res) => {
  try {
    const { userId, story, wardaResponse } = req.body;
    if (!userId || !story) return res.status(400).json({ error: 'userId and story required' });
    const entry = await storeLifeStory(userId, story, wardaResponse || '');
    res.json({ success: true, data: entry ? { id: entry.id, stored: true } : { stored: false, reason: 'No story detected' } });
  } catch (err) {
    console.error('Error storing life story:', err);
    res.status(500).json({ error: 'Failed to store life story' });
  }
});

router.get('/tags/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stories = await getLifeStories(userId, { limit: 100 });
    const tagCounts = {};
    stories.forEach(s => {
      (s.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
    });
    const sortedTags = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    res.json({ success: true, data: { tags: sortedTags, totalStories: stories.length } });
  } catch (err) {
    console.error('Error getting story tags:', err);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

module.exports = router;
