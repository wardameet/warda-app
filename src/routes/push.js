const { requireAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/push/vapid-key - Public key for client
router.get('/vapid-key', requireAuth, (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe - Save push subscription
router.post('/subscribe', requireAuth, async (req, res) => {
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
router.post('/unsubscribe', requireAuth, async (req, res) => {
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
router.post('/test', requireAuth, async (req, res) => {
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

// ─── Family Management Endpoints (Admin) ─────────────────
// GET /api/push/families/:careHomeId - All family contacts for a care home
router.get('/families/:careHomeId', requireAuth, async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const families = await prisma.familyContact.findMany({
      where: { user: { careHomeId } },
      include: { user: { select: { firstName: true, lastName: true, preferredName: true, roomNumber: true, id: true } } },
      orderBy: { name: 'asc' }
    });
    const summary = {
      total: families.length,
      registered: families.filter(f => f.cognitoSub).length,
      pending: families.filter(f => f.inviteStatus === 'PENDING').length,
      primary: families.filter(f => f.isPrimary).length,
    };
    res.json({ success: true, families, summary });
  } catch (err) {
    console.error('List families error:', err);
    res.status(500).json({ error: 'Failed to load families' });
  }
});

// PUT /api/push/families/:id - Update family contact
router.put('/families/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relationship, email, phone, isPrimary, accessLevel } = req.body;
    const updated = await prisma.familyContact.update({
      where: { id },
      data: { name, relationship, email, phone, isPrimary, accessLevel }
    });
    res.json({ success: true, family: updated });
  } catch (err) {
    console.error('Update family error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// POST /api/push/families/:id/reinvite - Resend invitation
router.post('/families/:id/reinvite', requireAuth, async (req, res) => {
  try {
    const fc = await prisma.familyContact.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!fc) return res.status(404).json({ error: 'Not found' });
    await prisma.familyContact.update({ where: { id: fc.id }, data: { inviteStatus: 'PENDING' } });
    res.json({ success: true, message: `Invitation refreshed for ${fc.name}` });
  } catch (err) {
    console.error('Reinvite error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});
