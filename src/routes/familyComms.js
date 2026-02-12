const { requireAuth } = require("../middleware/apiAuth");
// ============================================================
// WARDA — Family Communication Flow
// End-to-end: Family → Message/Photo → Warda delivers → Resident replies
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const { uploadPhoto, uploadVoiceMessage, getSignedPhotoUrl } = require('../services/s3');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// ─── POST /api/family-comms/send-message ────────────────────
// Family member sends text message to resident (delivered by Warda)
router.post('/send-message', async (req, res) => {
  try {
    const { senderId, residentId, content, senderName } = req.body;

    if (!residentId || !content) {
      return res.status(400).json({ success: false, error: 'residentId and content required' });
    }

    // Store message
    const message = await prisma.message.create({
      data: {
        sender: senderName || 'family',
        senderId: senderId || 'family',
        userId: residentId,
        recipientId: residentId,
        content,
        type: 'TEXT',
        senderType: 'FAMILY',
        senderName: senderName || 'Your family',
        isDelivered: false
      }
    });

    // Notify tablet via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`resident-${residentId}`).emit('family-message', {
        messageId: message.id,
        from: senderName || 'Your family',
        preview: content.substring(0, 100),
        timestamp: new Date().toISOString()
      });
    }

    // Notify staff dashboard
    if (io) {
      const resident = await prisma.user.findUnique({
        where: { id: residentId },
        select: { careHomeId: true, preferredName: true, firstName: true }
      });
      if (resident) {
        io.to(`carehome-${resident.careHomeId}`).emit('activity-update', {
          type: 'family_message',
          residentName: resident.preferredName || resident.firstName,
          from: senderName,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        status: 'pending_delivery',
        note: 'Warda will deliver this message to the resident in conversation'
      }
    });
  } catch (error) {
    console.error('Send family message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ─── POST /api/family-comms/send-photo ──────────────────────
// Family sends photo with optional caption
router.post('/send-photo', upload.single('photo'), async (req, res) => {
  try {
    const { residentId, caption, senderId, senderName } = req.body;

    if (!req.file || !residentId) {
      return res.status(400).json({ success: false, error: 'Photo and residentId required' });
    }

    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { id: true, careHomeId: true }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    // Upload to S3
    const s3Result = await uploadPhoto({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      careHomeId: resident.careHomeId,
      residentId,
      uploadedBy: senderId || 'family',
      caption: caption || ''
    });

    if (!s3Result.success) {
      return res.status(500).json(s3Result);
    }

    // Store in DB
    const message = await prisma.message.create({
      data: {
        sender: senderName || 'family',
        senderId: senderId || 'family',
        recipientId: residentId,
        userId: residentId,
        content: caption || `${senderName || 'Your family'} sent you a lovely photo!`,
        type: 'PHOTO',
        senderType: 'FAMILY',
        senderName: senderName || 'Your family',
        mediaUrl: s3Result.fullKey,
        thumbnailUrl: s3Result.thumbKey,
        isDelivered: false
      }
    });

    // Notify tablet
    const io = req.app.get('io');
    if (io) {
      io.to(`resident-${residentId}`).emit('family-photo', {
        messageId: message.id,
        from: senderName || 'Your family',
        caption,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: {
        id: message.id,
        photoKey: s3Result.fullKey,
        caption,
        status: 'pending_delivery'
      }
    });
  } catch (error) {
    console.error('Send family photo error:', error);
    res.status(500).json({ success: false, error: 'Failed to send photo' });
  }
});

// ─── POST /api/family-comms/send-voice ──────────────────────
// Family sends voice message
router.post('/send-voice', upload.single('voice'), async (req, res) => {
  try {
    const { residentId, senderId, senderName } = req.body;

    if (!req.file || !residentId) {
      return res.status(400).json({ success: false, error: 'Voice file and residentId required' });
    }

    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { id: true, careHomeId: true }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    // Upload to S3
    const s3Result = await uploadVoiceMessage({
      buffer: req.file.buffer,
      careHomeId: resident.careHomeId,
      residentId,
      senderId: senderId || 'family',
      contentType: req.file.mimetype || 'audio/webm'
    });

    if (!s3Result.success) {
      return res.status(500).json(s3Result);
    }

    // Store in DB
    const message = await prisma.message.create({
      data: {
        sender: senderName || 'family',
        senderId: senderId || 'family',
        recipientId: residentId,
        userId: residentId,
        content: `${senderName || 'Your family'} sent you a voice message!`,
        type: 'VOICE',
        senderType: 'FAMILY',
        senderName: senderName || 'Your family',
        mediaUrl: s3Result.key,
        isDelivered: false
      }
    });

    // Notify tablet
    const io = req.app.get('io');
    if (io) {
      io.to(`resident-${residentId}`).emit('family-voice', {
        messageId: message.id,
        from: senderName || 'Your family',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: { id: message.id, status: 'pending_delivery' } });
  } catch (error) {
    console.error('Send family voice error:', error);
    res.status(500).json({ success: false, error: 'Failed to send voice message' });
  }
});

// ─── POST /api/family-comms/resident-reply ──────────────────
// Warda detected resident wants to reply to family
// Called by conversation engine when "tell Sarah I love her" detected
router.post('/resident-reply', async (req, res) => {
  try {
    const { residentId, recipientId, recipientName, content } = req.body;

    if (!residentId || !content) {
      return res.status(400).json({ success: false, error: 'residentId and content required' });
    }

    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { preferredName: true, firstName: true, careHomeId: true }
    });

    const residentName = resident?.preferredName || resident?.firstName || 'Your loved one';

    // Store the reply
    const reply = await prisma.message.create({
      data: {
        sender: residentName,
        senderId: residentId,
        userId: residentId,
        recipientId: recipientId || 'family',
        content,
        type: 'TEXT',
        senderType: 'RESIDENT',
        senderName: residentName,
        isDelivered: true
      }
    });

    // Notify family via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`family-${recipientId}`).emit('resident-message', {
        messageId: reply.id,
        from: residentName,
        content,
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Send push notification to family member
    // TODO: Send email notification if family has email alerts enabled

    res.json({
      success: true,
      reply: {
        id: reply.id,
        from: residentName,
        to: recipientName || 'Family',
        content,
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Resident reply error:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

// ─── GET /api/family-comms/pending/:residentId ──────────────
// Get all undelivered messages for a resident
// Proactive engine uses this to know what Warda should deliver
router.get('/pending/:residentId', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        recipientId: req.params.residentId,
        isDelivered: false,
        senderType: 'FAMILY'
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    // Add signed URLs for photos
    const enriched = await Promise.all(messages.map(async (msg) => {
      let photoUrl = null;
      if (msg.type === 'PHOTO' && msg.mediaUrl) {
        const urlResult = await getSignedPhotoUrl(msg.mediaUrl);
        photoUrl = urlResult?.url || null;
      }
      return { ...msg, photoUrl };
    }));

    res.json({ success: true, messages: enriched, count: enriched.length });
  } catch (error) {
    console.error('Get pending messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending messages' });
  }
});

// ─── GET /api/family-comms/thread/:residentId ───────────────
// Get full message thread for a resident (for family app)
router.get('/thread/:residentId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const contactName = req.query.contact || null;
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { recipientId: req.params.residentId, senderType: 'FAMILY' },
          { senderId: req.params.residentId, senderType: 'RESIDENT' },
          { recipientId: req.params.residentId },
          { senderId: req.params.residentId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    let filtered = messages;
    if (contactName) {
      const cn = contactName.toLowerCase();
      filtered = messages.filter(m =>
        (m.senderName && m.senderName.toLowerCase().includes(cn)) ||
        (m.senderId === req.params.residentId)
      );
      if (filtered.length === 0) filtered = messages;
    }
    res.json({ success: true, messages: filtered, count: filtered.length });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ success: false, error: 'Failed to get thread' });
  }
});

// ─── POST /api/family-comms/mark-delivered ──────────────────
// Mark message as delivered by Warda to resident
router.post('/mark-delivered', async (req, res) => {
  try {
    const { messageId } = req.body;
    
    await prisma.message.update({
      where: { id: messageId },
      data: { isDelivered: true, deliveredAt: new Date() }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark delivered' });
  }
});

module.exports = router;
