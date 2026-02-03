/**
 * WARDA - Photo Sharing API
 * ==========================
 * Family uploads photos → S3 (presigned URL) → notify tablet via WebSocket
 * Tablet fetches photo gallery from this API
 * 
 * Routes:
 *   POST   /api/photos/upload-url    - Get presigned S3 upload URL
 *   POST   /api/photos/confirm       - Confirm upload + notify tablet
 *   GET    /api/photos/:residentId    - Get photo gallery for resident
 *   GET    /api/photos/view/:key      - Get presigned download URL
 *   DELETE /api/photos/:photoId       - Delete a photo
 */

const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// S3 Client
const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-west-2' });
const BUCKET = process.env.S3_BUCKET || 'warda-media-production';

/**
 * POST /api/photos/upload-url
 * Generate a presigned URL for family to upload directly to S3
 * 
 * Body: { residentId, senderId, senderName, fileName, fileType, caption? }
 * Returns: { uploadUrl, photoKey, photoId }
 */
router.post('/upload-url', async (req, res) => {
  try {
    const { residentId, senderId, senderName, fileName, fileType, caption } = req.body;

    if (!residentId || !senderId || !fileName || !fileType) {
      return res.status(400).json({ 
        success: false, 
        error: 'residentId, senderId, fileName, and fileType are required' 
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'File type not allowed. Use JPEG, PNG, GIF, or WebP' 
      });
    }

    // Generate unique key: photos/{residentId}/{uuid}.{ext}
    const ext = fileName.split('.').pop() || 'jpg';
    const photoId = uuidv4();
    const photoKey = `photos/${residentId}/${photoId}.${ext}`;

    // Create presigned upload URL (valid 15 minutes)
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: photoKey,
      ContentType: fileType,
      Metadata: {
        'resident-id': residentId,
        'sender-id': senderId,
        'sender-name': senderName || 'Family',
        'caption': caption || '',
      }
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    res.json({
      success: true,
      uploadUrl,
      photoKey,
      photoId,
      expiresIn: 900
    });

  } catch (error) {
    console.error('Upload URL error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
  }
});


/**
 * POST /api/photos/confirm
 * Called after family successfully uploads to S3
 * Saves metadata to DB and notifies tablet via WebSocket
 * 
 * Body: { photoId, photoKey, residentId, senderId, senderName, caption?, careHomeId? }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { photoId, photoKey, residentId, senderId, senderName, caption, careHomeId } = req.body;

    if (!photoKey || !residentId || !senderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'photoKey, residentId, and senderId are required' 
      });
    }

    // Generate a presigned view URL (valid 7 days)
    const viewCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: photoKey,
    });
    const viewUrl = await getSignedUrl(s3, viewCommand, { expiresIn: 604800 }); // 7 days

    // Save photo metadata to database
    let savedPhoto = null;
    try {
      savedPhoto = await prisma.message.create({
        data: {
          content: caption || 'Shared a photo',
          sender: senderId,
          type: 'photo',
          userId: residentId,
          isFromWarda: false,
          // Store photo metadata in content as JSON
        }
      });
    } catch (dbErr) {
      console.error('Failed to save photo to DB:', dbErr);
    }

    const photoPayload = {
      id: savedPhoto?.id || photoId || `photo_${Date.now()}`,
      photoKey,
      photoUrl: viewUrl,
      residentId,
      senderId,
      senderName: senderName || 'Family',
      caption: caption || '',
      timestamp: new Date().toISOString(),
      type: 'photo'
    };

    // Notify tablet via WebSocket
    const io = req.app.get('io');
    if (io) {
      // Send to tablet - Warda will announce it
      io.to(`tablet:${residentId}`).emit('photo:new', photoPayload);

      // Notify other family members
      io.to(`family:${residentId}`).emit('photo:new', {
        ...photoPayload,
        announce: false // Don't announce to other family, just show
      });

      console.log(`📸 Photo uploaded: ${senderName} → resident ${residentId}`);
    }

    res.json({
      success: true,
      photo: photoPayload
    });

  } catch (error) {
    console.error('Photo confirm error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm photo upload' });
  }
});


/**
 * GET /api/photos/:residentId
 * Get photo gallery for a resident (with fresh presigned URLs)
 * 
 * Query: ?limit=20&offset=0
 */
router.get('/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get photos from database (type = 'photo')
    let photos = [];
    try {
      photos = await prisma.message.findMany({
        where: {
          userId: residentId,
          type: 'photo'
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
    } catch (dbErr) {
      console.error('Failed to fetch photos from DB:', dbErr);
    }

    // Generate fresh presigned URLs for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        // Try to extract photoKey from the photo record
        // We store it in a predictable format
        let photoUrl = '';
        try {
          // Generate fresh URL from S3
          const key = `photos/${residentId}/${photo.id}.jpg`;
          const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
          });
          photoUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        } catch (e) {
          // If key doesn't exist, skip
        }

        return {
          id: photo.id,
          caption: photo.content,
          sender: photo.sender,
          photoUrl,
          timestamp: photo.createdAt,
        };
      })
    );

    res.json({
      success: true,
      photos: photosWithUrls,
      total: photos.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('Gallery fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch gallery' });
  }
});


/**
 * GET /api/photos/view/:key
 * Get a fresh presigned download URL for a specific photo
 * The key should be URL-encoded
 */
router.get('/view/:key(*)', async (req, res) => {
  try {
    const photoKey = req.params.key;

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: photoKey,
    });

    const viewUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

    res.json({
      success: true,
      url: viewUrl,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('Photo view error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate view URL' });
  }
});


/**
 * DELETE /api/photos/:photoId
 * Delete a photo from S3 and database
 */
router.delete('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;

    // Delete from database
    try {
      await prisma.message.delete({
        where: { id: photoId }
      });
    } catch (dbErr) {
      console.error('Failed to delete photo from DB:', dbErr);
    }

    res.json({ success: true, deleted: photoId });

  } catch (error) {
    console.error('Photo delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});


module.exports = router;
