/**
 * WARDA - Alerts API Routes
 * =========================
 * REST endpoints for alerts + WebSocket broadcasting
 * 
 * GET    /api/alerts/:careHomeId       - Get all alerts for a care home
 * GET    /api/alerts/resident/:id      - Get alerts for a resident
 * GET    /api/alerts/unresolved/:careHomeId - Get unresolved alerts
 * POST   /api/alerts                   - Create alert (+ broadcast via WebSocket)
 * PATCH  /api/alerts/:id/resolve       - Resolve an alert (+ broadcast)
 * GET    /api/alerts/stats/:careHomeId - Alert statistics
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { broadcastAlert } = require('../services/socket');

const prisma = new PrismaClient();

// GET /api/alerts/:careHomeId - All alerts for a care home
router.get('/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const { limit = 50, offset = 0, severity, type, resolved } = req.query;

    const where = {
      user: { careHomeId }
    };

    if (severity) where.severity = severity;
    if (type) where.type = type;
    if (resolved !== undefined) where.isResolved = resolved === 'true';

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.alert.count({ where });

    res.json({ 
      success: true, 
      alerts,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/resident/:residentId - Alerts for a specific resident
router.get('/resident/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const { limit = 20 } = req.query;

    const alerts = await prisma.alert.findMany({
      where: { userId: residentId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Get resident alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/unresolved/:careHomeId - Unresolved alerts only
router.get('/unresolved/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;

    const alerts = await prisma.alert.findMany({
      where: {
        isResolved: false,
        user: { careHomeId }
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ 
      success: true, 
      alerts,
      count: alerts.length 
    });
  } catch (error) {
    console.error('Get unresolved alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts - Create an alert and broadcast via WebSocket
router.post('/', async (req, res) => {
  try {
    const { type, severity, message, residentId, careHomeId } = req.body;

    if (!type || !message || !residentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'type, message, and residentId are required' 
      });
    }

    // Get resident name for the alert
    const resident = await prisma.user.findUnique({
      where: { id: residentId },
      select: { firstName: true, lastName: true, preferredName: true, careHomeId: true }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    const resolvedCareHomeId = careHomeId || resident.careHomeId;
    const residentName = resident.preferredName || resident.firstName;

    // Save to database
    const alert = await prisma.alert.create({
      data: {
        type,
        severity: severity || 'medium',
        message,
        userId: residentId
      }
    });

    // Broadcast via WebSocket
    const io = req.app.get('io');
    if (io && resolvedCareHomeId) {
      broadcastAlert(io, {
        type,
        severity: severity || 'medium',
        message,
        residentId,
        residentName,
        careHomeId: resolvedCareHomeId
      });
    }

    res.status(201).json({ 
      success: true, 
      alert,
      broadcasted: !!io
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

// PATCH /api/alerts/:id/resolve - Resolve an alert
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy } = req.body;

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedBy: resolvedBy || 'staff',
        resolvedAt: new Date()
      },
      include: {
        user: {
          select: { id: true, firstName: true, careHomeId: true }
        }
      }
    });

    // Broadcast resolution via WebSocket
    const io = req.app.get('io');
    if (io && alert.user?.careHomeId) {
      io.to(`staff:${alert.user.careHomeId}`).emit('alert:resolved', {
        alertId: id,
        resolvedBy: resolvedBy || 'staff',
        resolvedAt: new Date().toISOString()
      });
      io.to('admin:global').emit('alert:resolved', {
        alertId: id,
        resolvedBy: resolvedBy || 'staff',
        resolvedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, alert });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

// GET /api/alerts/stats/:careHomeId - Alert statistics
router.get('/stats/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const { days = 7 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const where = {
      user: { careHomeId },
      createdAt: { gte: since }
    };

    const [total, unresolved, critical, byType] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { ...where, isResolved: false } }),
      prisma.alert.count({ where: { ...where, severity: 'critical' } }),
      prisma.alert.groupBy({
        by: ['type'],
        where,
        _count: { type: true }
      })
    ]);

    res.json({
      success: true,
      stats: {
        total,
        unresolved,
        critical,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Alert stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

module.exports = router;
