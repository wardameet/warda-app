/**
 * Redis/Valkey Service
 * Handles caching, pub/sub, and session management
 */

const Redis = require('ioredis');

let redisClient = null;
let redisSubscriber = null;

async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('⚠️ REDIS_URL not set, running without Redis');
    return null;
  }

  try {
    // Main client for commands
    redisClient = new Redis(redisUrl, {
      tls: {},
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    await redisClient.connect();

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    // Subscriber client for pub/sub
    redisSubscriber = redisClient.duplicate();
    await redisSubscriber.connect();

    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error);
    // Don't throw - app can work without Redis for MVP
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

function getRedisSubscriber() {
  return redisSubscriber;
}

// Cache helpers
async function cacheSet(key, value, expirySeconds = 3600) {
  if (!redisClient) return null;
  try {
    await redisClient.setex(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

async function cacheGet(key) {
  if (!redisClient) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

async function cacheDelete(key) {
  if (!redisClient) return null;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

// Pub/Sub helpers
async function publish(channel, message) {
  if (!redisClient) return null;
  try {
    await redisClient.publish(channel, JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Publish error:', error);
    return false;
  }
}

async function subscribe(channel, callback) {
  if (!redisSubscriber) return null;
  try {
    await redisSubscriber.subscribe(channel);
    redisSubscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(JSON.parse(message));
      }
    });
    return true;
  } catch (error) {
    console.error('Subscribe error:', error);
    return false;
  }
}

module.exports = {
  initializeRedis,
  getRedisClient,
  getRedisSubscriber,
  cacheSet,
  cacheGet,
  cacheDelete,
  publish,
  subscribe
};
