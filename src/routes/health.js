const { tabletAuth } = require("../middleware/apiAuth");
/**
 * Health Check Routes
 * Used for monitoring and load balancer checks
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getRedisClient } = require('../services/redis');

const prisma = new PrismaClient();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'warda-api'
  });
});

// Detailed health check (for monitoring)
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.postgresql = { status: 'connected' };
  } catch (error) {
    health.services.postgresql = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      health.services.redis = { status: 'connected' };
    } else {
      health.services.redis = { status: 'not initialized' };
    }
  } catch (error) {
    health.services.redis = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
