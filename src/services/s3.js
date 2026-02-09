// ============================================================
// WARDA — S3 Media Service (Enhanced)
// Handles photo uploads, signed URLs, lifecycle management
// Structure: {careHomeId}/{residentId}/photos/
// ============================================================

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const crypto = require('crypto');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const MEDIA_BUCKET = process.env.S3_BUCKET || 'warda-media-production';

// ─── Upload Photo ───────────────────────────────────────────
// Processes image: resize, create thumbnail, store both
async function uploadPhoto({ buffer, originalName, careHomeId, residentId, uploadedBy, caption }) {
  const photoId = crypto.randomUUID();
  const timestamp = Date.now();
  const ext = originalName?.split('.').pop() || 'jpg';
  
  const basePath = `${careHomeId}/${residentId}/photos`;
  const fullKey = `${basePath}/${timestamp}_${photoId}.${ext}`;
  const thumbKey = `${basePath}/thumbs/${timestamp}_${photoId}_thumb.${ext}`;

  try {
    // Process images with Sharp, fallback to raw if it fails
    let fullImage, thumbImage;
    try {
      fullImage = await sharp(buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      thumbImage = await sharp(buffer)
        .resize(300, 300, { fit: "cover" })
        .jpeg({ quality: 75 })
        .toBuffer();
    } catch (sharpErr) {
      console.log("Sharp processing failed, uploading raw:", sharpErr.message);
      fullImage = buffer;
      thumbImage = buffer;
    }
    // Upload full image
    await s3.send(new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: fullKey,
      Body: fullImage,
      ContentType: 'image/jpeg',
      Metadata: {
        'resident-id': residentId,
        'care-home-id': careHomeId,
        'uploaded-by': uploadedBy || 'unknown',
        'caption': caption || '',
        'original-name': originalName || ''
      }
    }));

    // Upload thumbnail
    await s3.send(new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: thumbKey,
      Body: thumbImage,
      ContentType: 'image/jpeg'
    }));

    return {
      success: true,
      photoId,
      fullKey,
      thumbKey,
      fullSize: fullImage.length,
      thumbSize: thumbImage.length,
      caption
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return { success: false, error: error.message };
  }
}

// ─── Get Signed URL (temporary access) ──────────────────────
async function getSignedPhotoUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key
    });
    const url = await getSignedUrl(s3, command, { expiresIn });
    return { success: true, url, expiresIn };
  } catch (error) {
    console.error('Signed URL error:', error);
    return { success: false, error: error.message };
  }
}

// ─── Get Upload Signed URL (for direct browser upload) ──────
async function getUploadSignedUrl(key, contentType = 'image/jpeg', expiresIn = 300) {
  try {
    const command = new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      ContentType: contentType
    });
    const url = await getSignedUrl(s3, command, { expiresIn });
    return { success: true, url, key, expiresIn };
  } catch (error) {
    console.error('Upload signed URL error:', error);
    return { success: false, error: error.message };
  }
}

// ─── List Photos for Resident ───────────────────────────────
async function listResidentPhotos(careHomeId, residentId, maxPhotos = 50) {
  try {
    const prefix = `${careHomeId}/${residentId}/photos/`;
    
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: MEDIA_BUCKET,
      Prefix: prefix,
      MaxKeys: maxPhotos
    }));

    // Filter out thumbnails
    const photos = (result.Contents || [])
      .filter(obj => !obj.Key.includes('/thumbs/'))
      .map(obj => ({
        key: obj.Key,
        thumbKey: obj.Key.replace('/photos/', '/photos/thumbs/').replace(/(\.\w+)$/, '_thumb$1'),
        size: obj.Size,
        lastModified: obj.LastModified,
        photoId: obj.Key.split('_').pop()?.split('.')[0]
      }))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    return { success: true, photos, count: photos.length };
  } catch (error) {
    console.error('List photos error:', error);
    return { success: false, error: error.message, photos: [] };
  }
}

// ─── Delete Photo ───────────────────────────────────────────
async function deletePhoto(fullKey) {
  try {
    // Delete full image
    await s3.send(new DeleteObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: fullKey
    }));

    // Delete thumbnail
    const thumbKey = fullKey.replace('/photos/', '/photos/thumbs/').replace(/(\.\w+)$/, '_thumb$1');
    await s3.send(new DeleteObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: thumbKey
    })).catch(() => {}); // Ignore if thumb doesn't exist

    return { success: true };
  } catch (error) {
    console.error('Delete photo error:', error);
    return { success: false, error: error.message };
  }
}

// ─── Upload Voice Message to S3 ─────────────────────────────
async function uploadVoiceMessage({ buffer, careHomeId, residentId, senderId, contentType = 'audio/webm' }) {
  const msgId = crypto.randomUUID();
  const key = `${careHomeId}/${residentId}/voice-messages/${Date.now()}_${msgId}.webm`;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        'resident-id': residentId,
        'sender-id': senderId || 'unknown'
      }
    }));

    return { success: true, key, msgId };
  } catch (error) {
    console.error('Voice upload error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  s3Client: s3,
  uploadPhoto,
  getSignedPhotoUrl,
  getUploadSignedUrl,
  listResidentPhotos,
  deletePhoto,
  uploadVoiceMessage,
  MEDIA_BUCKET
};
