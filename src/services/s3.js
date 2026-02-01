/**
 * S3 Service
 * Handles photo and media storage
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.S3_BUCKET;

// Upload file to S3
async function uploadToS3(file, folder = 'uploads') {
  const key = `${folder}/${uuidv4()}-${file.originalname || 'file'}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });

  await s3Client.send(command);
  
  return {
    key,
    bucket: BUCKET_NAME,
    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  };
}

// Get signed URL for private access
async function getSignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  const url = await getS3SignedUrl(s3Client, command, { expiresIn });
  return url;
}

// Upload base64 image (for photos from family app)
async function uploadBase64Image(base64Data, folder = 'photos') {
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  
  // Detect image type
  let contentType = 'image/jpeg';
  if (base64Data.includes('data:image/png')) {
    contentType = 'image/png';
  } else if (base64Data.includes('data:image/gif')) {
    contentType = 'image/gif';
  }

  const key = `${folder}/${uuidv4()}.${contentType.split('/')[1]}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3Client.send(command);

  return {
    key,
    bucket: BUCKET_NAME
  };
}

// Delete file from S3
async function deleteFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  await s3Client.send(command);
  return true;
}

// Upload voice message
async function uploadVoiceMessage(audioBuffer, senderId) {
  const key = `voice-messages/${senderId}/${uuidv4()}.webm`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: audioBuffer,
    ContentType: 'audio/webm'
  });

  await s3Client.send(command);

  return {
    key,
    bucket: BUCKET_NAME
  };
}

module.exports = {
  uploadToS3,
  getSignedUrl,
  uploadBase64Image,
  deleteFromS3,
  uploadVoiceMessage
};
