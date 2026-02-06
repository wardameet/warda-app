// ============================================================
// WARDA — Photo Routes
// Upload, view, manage photos for residents
// Family uploads → S3 → Warda shows on tablet
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadPhoto, getSignedPhotoUrl, listResidentPhotos, deletePhoto, getUploadSignedUrl } = require('../services/s3');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

// POST /api/photos/upload — Family uploads a photo for resident
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { residentId, caption, uploadedBy } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo provided' });
    }
    if (!residentId) {
      return res.status(400).json({ success: false, error: 'residentId required' });
    }

    // Get resident's care home
    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { id: true, careHomeId: true, preferredName: true, firstName: true }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    // Upload to S3
    const result = await uploadPhoto({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      careHomeId: resident.careHomeId,
      residentId: resident.id,
      uploadedBy: uploadedBy || 'family',
      caption: caption || ''
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Store photo record in database
    const photoRecord = await prisma.message.create({
      data: {
        senderId: uploadedBy || 'family',
        recipientId: residentId,
        content: caption || 'A photo was sent to you',
        type: 'PHOTO',
        senderType: 'FAMILY',
        mediaUrl: result.fullKey,
        thumbnailUrl: result.thumbKey,
        isDelivered: false  // Warda will deliver it conversationally
      }
    });

    // Notify tablet via WebSocket if connected
    const io = req.app.get('io');
    if (io) {
      io.to(`resident-${residentId}`).emit('new-photo', {
        photoId: photoRecord.id,
        caption,
        from: uploadedBy || 'Your family',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      photo: {
        id: photoRecord.id,
        key: result.fullKey,
        thumbKey: result.thumbKey,
        caption,
        createdAt: photoRecord.createdAt
      }
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// GET /api/photos/:residentId — Get all photos for resident
router.get('/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { id: true, careHomeId: true }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    // Get photos from DB with signed URLs
    const photos = await prisma.message.findMany({
      where: {
        recipientId: residentId,
        type: 'PHOTO'
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Generate signed URLs for each photo
    const photosWithUrls = await Promise.all(photos.map(async (photo) => {
      const fullUrl = photo.mediaUrl ? await getSignedPhotoUrl(photo.mediaUrl) : null;
      const thumbUrl = photo.thumbnailUrl ? await getSignedPhotoUrl(photo.thumbnailUrl) : null;
      
      return {
        id: photo.id,
        caption: photo.content,
        fullUrl: fullUrl?.url || null,
        thumbUrl: thumbUrl?.url || null,
        from: photo.senderId,
        isDelivered: photo.isDelivered,
        createdAt: photo.createdAt
      };
    }));

    res.json({ success: true, photos: photosWithUrls });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ success: false, error: 'Failed to get photos' });
  }
});

// GET /api/photos/:residentId/latest — Get latest undelivered photo
// Used by tablet to show next photo Warda should talk about
router.get('/:residentId/latest', async (req, res) => {
  try {
    const { residentId } = req.params;

    const photo = await prisma.message.findFirst({
      where: {
        recipientId: residentId,
        type: 'PHOTO',
        isDelivered: false
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!photo) {
      return res.json({ success: true, photo: null });
    }

    const fullUrl = photo.mediaUrl ? await getSignedPhotoUrl(photo.mediaUrl) : null;

    res.json({
      success: true,
      photo: {
        id: photo.id,
        caption: photo.content,
        fullUrl: fullUrl?.url || null,
        from: photo.senderId,
        createdAt: photo.createdAt
      }
    });
  } catch (error) {
    console.error('Get latest photo error:', error);
    res.status(500).json({ success: false, error: 'Failed to get latest photo' });
  }
});

// POST /api/photos/:photoId/delivered — Mark photo as delivered by Warda
router.post('/:photoId/delivered', async (req, res) => {
  try {
    await prisma.message.update({
      where: { id: req.params.photoId },
      data: { isDelivered: true, deliveredAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark delivered' });
  }
});

// GET /api/photos/signed-upload-url — Get pre-signed URL for direct upload
router.get('/signed-upload-url', async (req, res) => {
  try {
    const { careHomeId, residentId, filename, contentType } = req.query;
    
    if (!careHomeId || !residentId) {
      return res.status(400).json({ success: false, error: 'careHomeId and residentId required' });
    }

    const key = `${careHomeId}/${residentId}/photos/${Date.now()}_${filename || 'photo.jpg'}`;
    const result = await getUploadSignedUrl(key, contentType || 'image/jpeg');
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
  }
});

module.exports = router;
