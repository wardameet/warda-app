const { requireAuth } = require("../middleware/apiAuth");
/**
 * Messages Routes
 * Handles two-way messaging between residents, family, GP, and staff
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { uploadToS3, getSignedUrl } = require('../services/s3');

const prisma = require('../lib/prisma');

// Get messages for a conversation
router.get('/:residentId/:contactId', async (req, res) => {
  try {
    const { residentId, contactId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: residentId, recipientId: contactId },
          { senderId: contactId, recipientId: residentId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Add signed URLs for media
    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        if (msg.mediaKey) {
          msg.mediaUrl = await getSignedUrl(msg.mediaKey);
        }
        return msg;
      })
    );

    res.json({
      success: true,
      messages: messagesWithUrls.reverse()
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Send text message
router.post('/send', async (req, res) => {
  try {
    const { senderId, recipientId, content, messageType } = req.body;

    const message = await prisma.message.create({
      data: {
        senderId,
        recipientId,
        content,
        type: messageType || 'text',
      }
    });

    // Emit to recipient via Socket.io
    const io = req.app.get('io');
    io.to(`user_${recipientId}`).emit('new_message', message);

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Send message via Warda (resident speaks, Warda sends)
router.post('/send-via-warda', async (req, res) => {
  try {
    const { residentId, recipientId, spokenText, transcribedContent } = req.body;

    const message = await prisma.message.create({
      data: {
        senderId: residentId,
        recipientId,
        content: transcribedContent || spokenText,
        messageType: 'text',
        sentViaWarda: true
      }
    });

    // Emit to recipient
    const io = req.app.get('io');
    io.to(`user_${recipientId}`).emit('new_message', {
      ...message,
      fromResident: true,
      residentName: req.body.residentName
    });

    res.json({
      success: true,
      message,
      wardaConfirmation: `I've sent that message to ${req.body.recipientName}. They'll get it right away!`
    });
  } catch (error) {
    console.error('Send via Warda error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Mark message as read
router.put('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'read',
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark as read'
    });
  }
});

// Get unread count
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const count = await prisma.message.count({
      where: {
        recipientId: userId,
        status: { not: 'read' }
      }
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

module.exports = router;
