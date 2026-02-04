const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/tablets - List all tablets for a care home
router.get('/', async (req, res) => {
  try {
    const { careHomeId } = req.query;
    const where = careHomeId ? { careHomeId } : {};
    const tablets = await prisma.tablet.findMany({
      where,
      include: { assignedUser: { select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true, status: true } }, careHome: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const summary = {
      total: tablets.length,
      assigned: tablets.filter(t => t.assignedUser).length,
      available: tablets.filter(t => t.status === 'AVAILABLE').length,
      online: tablets.filter(t => t.lastOnline && (Date.now() - new Date(t.lastOnline).getTime()) < 300000).length,
      lowBattery: tablets.filter(t => t.batteryLevel !== null && t.batteryLevel < 20).length,
    };
    res.json({ success: true, tablets, summary });
  } catch (err) {
    console.error('List tablets error:', err);
    res.status(500).json({ error: 'Failed to load tablets' });
  }
});

// POST /api/tablets - Register a new tablet
router.post('/', async (req, res) => {
  try {
    const { serialNumber, careHomeId } = req.body;
    if (!serialNumber) return res.status(400).json({ error: 'Serial number required' });
    const existing = await prisma.tablet.findUnique({ where: { serialNumber } });
    if (existing) return res.status(409).json({ error: 'Tablet already registered' });
    const tablet = await prisma.tablet.create({
      data: { serialNumber, careHomeId: careHomeId || null, status: 'AVAILABLE' }
    });
    res.json({ success: true, tablet });
  } catch (err) {
    console.error('Create tablet error:', err);
    res.status(500).json({ error: 'Failed to register tablet' });
  }
});

// PUT /api/tablets/:id - Update tablet
router.put('/:id', async (req, res) => {
  try {
    const { serialNumber, status, careHomeId, firmwareVersion, shippingStatus } = req.body;
    const tablet = await prisma.tablet.update({
      where: { id: req.params.id },
      data: { serialNumber, status, careHomeId, firmwareVersion, shippingStatus }
    });
    res.json({ success: true, tablet });
  } catch (err) {
    console.error('Update tablet error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// POST /api/tablets/:id/assign - Assign tablet to resident
router.post('/:id/assign', async (req, res) => {
  try {
    const { residentId } = req.body;
    // Unassign any existing tablet from this resident
    await prisma.user.update({ where: { id: residentId }, data: { tabletId: null } }).catch(() => {});
    // Assign new tablet
    await prisma.tablet.update({ where: { id: req.params.id }, data: { status: 'ASSIGNED' } });
    await prisma.user.update({ where: { id: residentId }, data: { tabletId: req.params.id } });
    const tablet = await prisma.tablet.findUnique({
      where: { id: req.params.id },
      include: { assignedUser: { select: { firstName: true, lastName: true, roomNumber: true } } }
    });
    res.json({ success: true, tablet, message: `Tablet assigned to ${tablet.assignedUser?.firstName}` });
  } catch (err) {
    console.error('Assign tablet error:', err);
    res.status(500).json({ error: 'Failed to assign' });
  }
});

// POST /api/tablets/:id/unassign - Unassign tablet from resident
router.post('/:id/unassign', async (req, res) => {
  try {
    const tablet = await prisma.tablet.findUnique({ where: { id: req.params.id }, include: { assignedUser: true } });
    if (tablet?.assignedUser) {
      await prisma.user.update({ where: { id: tablet.assignedUser.id }, data: { tabletId: null } });
    }
    await prisma.tablet.update({ where: { id: req.params.id }, data: { status: 'AVAILABLE' } });
    res.json({ success: true, message: 'Tablet unassigned' });
  } catch (err) {
    console.error('Unassign error:', err);
    res.status(500).json({ error: 'Failed to unassign' });
  }
});

// POST /api/tablets/:id/heartbeat - Tablet reports status
router.post('/:id/heartbeat', async (req, res) => {
  try {
    const { batteryLevel, firmwareVersion } = req.body;
    await prisma.tablet.update({
      where: { id: req.params.id },
      data: { lastOnline: new Date(), batteryLevel, firmwareVersion }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// DELETE /api/tablets/:id - Remove tablet
router.delete('/:id', async (req, res) => {
  try {
    const tablet = await prisma.tablet.findUnique({ where: { id: req.params.id }, include: { assignedUser: true } });
    if (tablet?.assignedUser) {
      await prisma.user.update({ where: { id: tablet.assignedUser.id }, data: { tabletId: null } });
    }
    await prisma.tablet.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Tablet removed' });
  } catch (err) {
    console.error('Delete tablet error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
