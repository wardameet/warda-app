/**
 * Purpose Features Routes - P1 Item 11
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/recipe', async (req, res) => {
  try {
    const { userId, recipeName, content: recipeContent, detectedFrom } = req.body;
    if (!userId || !recipeContent) return res.status(400).json({ error: 'userId and content required' });
    const entry = await prisma.healthLog.create({
      data: {
        userId, type: 'RECIPE', value: recipeName || 'Untitled Recipe',
        notes: JSON.stringify({
          content: recipeContent.substring(0, 2000), recipeName: recipeName || 'Untitled Recipe',
          detectedFrom: detectedFrom || 'conversation', capturedAt: new Date().toISOString(), sharedWithFamily: false
        }),
        recordedBy: 'warda-ai'
      }
    });
    console.log('Recipe captured: ' + (recipeName || 'Untitled') + ' from ' + userId);
    res.json({ success: true, data: { id: entry.id, recipeName: recipeName || 'Untitled Recipe' } });
  } catch (err) {
    console.error('Error capturing recipe:', err);
    res.status(500).json({ error: 'Failed to capture recipe' });
  }
});

router.get('/recipes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const recipes = await prisma.healthLog.findMany({
      where: { userId, type: 'RECIPE' }, orderBy: { createdAt: 'desc' }
    });
    const formatted = recipes.map(r => {
      const notes = r.notes ? JSON.parse(r.notes) : {};
      return { id: r.id, name: r.value, content: notes.content, capturedAt: notes.capturedAt || r.createdAt, sharedWithFamily: notes.sharedWithFamily || false };
    });
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error getting recipes:', err);
    res.status(500).json({ error: 'Failed to get recipes' });
  }
});

router.post('/voice-message', async (req, res) => {
  try {
    const { userId, recipientName, transcription, s3Key, durationSeconds } = req.body;
    if (!userId || !transcription) return res.status(400).json({ error: 'userId and transcription required' });
    const entry = await prisma.healthLog.create({
      data: {
        userId, type: 'VOICE_MESSAGE', value: recipientName || 'Family',
        notes: JSON.stringify({
          recipientName: recipientName || 'Family', transcription: transcription.substring(0, 1000),
          s3Key: s3Key || null, durationSeconds: durationSeconds || null,
          createdAt: new Date().toISOString(), listened: false
        }),
        recordedBy: 'warda-ai'
      }
    });
    console.log('Voice message captured for ' + (recipientName || 'Family') + ' from ' + userId);
    res.json({ success: true, data: { id: entry.id } });
  } catch (err) {
    console.error('Error saving voice message:', err);
    res.status(500).json({ error: 'Failed to save voice message' });
  }
});

router.get('/voice-messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await prisma.healthLog.findMany({
      where: { userId, type: 'VOICE_MESSAGE' }, orderBy: { createdAt: 'desc' }, take: 50
    });
    const formatted = messages.map(m => {
      const notes = m.notes ? JSON.parse(m.notes) : {};
      return {
        id: m.id, recipientName: notes.recipientName, transcription: notes.transcription,
        s3Key: notes.s3Key, durationSeconds: notes.durationSeconds,
        listened: notes.listened || false, createdAt: notes.createdAt || m.createdAt
      };
    });
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error getting voice messages:', err);
    res.status(500).json({ error: 'Failed to get voice messages' });
  }
});

router.post('/teaching', async (req, res) => {
  try {
    const { userId, category, content: teachContent, wardaLearned } = req.body;
    if (!userId || !teachContent) return res.status(400).json({ error: 'userId and content required' });
    const entry = await prisma.healthLog.create({
      data: {
        userId, type: 'TEACHING', value: category || 'general',
        notes: JSON.stringify({
          category: category || 'general', residentTaught: teachContent.substring(0, 1000),
          wardaLearned: wardaLearned || null, capturedAt: new Date().toISOString()
        }),
        recordedBy: 'warda-ai'
      }
    });
    console.log('Teaching captured: ' + (category || 'general') + ' from ' + userId);
    res.json({ success: true, data: { id: entry.id } });
  } catch (err) {
    console.error('Error storing teaching:', err);
    res.status(500).json({ error: 'Failed to store teaching' });
  }
});

router.get('/teachings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const teachings = await prisma.healthLog.findMany({
      where: { userId, type: 'TEACHING' }, orderBy: { createdAt: 'desc' }, take: 50
    });
    const formatted = teachings.map(t => {
      const notes = t.notes ? JSON.parse(t.notes) : {};
      return { id: t.id, category: notes.category, content: notes.residentTaught, wardaLearned: notes.wardaLearned, capturedAt: notes.capturedAt || t.createdAt };
    });
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error getting teachings:', err);
    res.status(500).json({ error: 'Failed to get teachings' });
  }
});

module.exports = router;
