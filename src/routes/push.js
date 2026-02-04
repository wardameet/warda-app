const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/push/vapid-key - Public key for client
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe - Save push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId, userType } = req.body;
    if (!subscription || !subscription.endpoint || !userId) {
      return res.status(400).json({ error: 'Missing subscription or userId' });
    }
    const keys = subscription.keys || {};
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    });
    if (existing) {
      await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: { userId, userType: userType || 'family', p256dh: keys.p256dh, auth: keys.auth }
      });
    } else {
      await prisma.pushSubscription.create({
        data: {
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh || '',
          auth: keys.auth || '',
          userId,
          userType: userType || 'family',
        }
      });
    }
    res.json({ success: true, message: 'Push subscription saved' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/push/unsubscribe - Remove push subscription
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// POST /api/push/test - Send test notification
router.post('/test', async (req, res) => {
  try {
    const { userId } = req.body;
    const { sendPushToUser } = require('../services/pushNotification');
    const result = await sendPushToUser(userId, {
      title: 'Warda Test',
      body: 'Push notifications are working!',
      tag: 'test',
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Push test error:', err);
    res.status(500).json({ error: 'Failed to send test' });
  }
});

module.exports = router;
