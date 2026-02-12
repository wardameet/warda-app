// ============================================================
// WARDA - Device Codes API
// Manage tablet activation codes
// ============================================================

const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { adminAuth, requireRole, logAudit } = require('../../middleware/adminAuth');
const crypto = require('crypto');

// Apply auth middleware
router.use(adminAuth);

// Generate a unique device code like "SUNNY-ABCD-1234-EFGH"
function generateDeviceCode(prefix = 'WARDA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  const segment = () => Array(4).fill().map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix.substring(0, 5).toUpperCase()}-${segment()}-${segment()}-${segment()}`;
}

// GET /api/admin/device-codes - List all device codes
router.get('/', async (req, res) => {
  try {
    const { careHomeId, status } = req.query;
    
    const where = {};
    
    // Non-super admins can only see their care home's codes
    if (req.adminUser.role !== 'SUPER_ADMIN') {
      where.careHomeId = req.careHomeId;
    } else if (careHomeId) {
      where.careHomeId = careHomeId;
    }
    
    if (status) where.status = status;
    
    const codes = await prisma.deviceCode.findMany({
      where,
      include: { careHome: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, codes });
  } catch (error) {
    console.error('Get device codes error:', error);
    res.status(500).json({ error: 'Failed to get device codes' });
  }
});

// POST /api/admin/device-codes - Generate new device code
router.post('/', async (req, res) => {
  try {
    const { careHomeId, deviceName, expiresInDays = 30 } = req.body;
    
    // Determine which care home
    const targetCareHomeId = req.adminUser.role === 'SUPER_ADMIN' 
      ? careHomeId 
      : req.careHomeId;
    
    if (!targetCareHomeId) {
      return res.status(400).json({ error: 'Care home ID required' });
    }
    
    // Get care home for code prefix
    const careHome = await prisma.careHome.findUnique({
      where: { id: targetCareHomeId },
      select: { name: true }
    });
    
    if (!careHome) {
      return res.status(404).json({ error: 'Care home not found' });
    }
    
    // Generate unique code with care home prefix
    const prefix = careHome.name.replace(/[^A-Za-z]/g, '').substring(0, 5) || 'WARDA';
    let code = generateDeviceCode(prefix);
    
    // Ensure uniqueness
    let attempts = 0;
    while (await prisma.deviceCode.findUnique({ where: { code } })) {
      code = generateDeviceCode(prefix);
      if (++attempts > 10) throw new Error('Could not generate unique code');
    }
    
    const deviceCode = await prisma.deviceCode.create({
      data: {
        code,
        careHomeId: targetCareHomeId,
        deviceName: deviceName || null,
        status: 'ACTIVE',
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
        createdBy: req.adminUser.id
      },
      include: { careHome: { select: { id: true, name: true } } }
    });
    
    await logAudit(req.adminUser.id, 'CREATE_DEVICE_CODE', 'DeviceCode', deviceCode.id,
      { code, careHomeId: targetCareHomeId, deviceName }, req.ip);
    
    res.json({ success: true, deviceCode });
  } catch (error) {
    console.error('Create device code error:', error);
    res.status(500).json({ error: 'Failed to create device code' });
  }
});

// PATCH /api/admin/device-codes/:id/suspend - Suspend a device code
router.patch('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const deviceCode = await prisma.deviceCode.findUnique({ where: { id } });
    
    if (!deviceCode) {
      return res.status(404).json({ error: 'Device code not found' });
    }
    
    // Check access
    if (req.adminUser.role !== 'SUPER_ADMIN' && deviceCode.careHomeId !== req.careHomeId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updated = await prisma.deviceCode.update({
      where: { id },
      data: { 
        status: 'SUSPENDED',
        suspendReason: reason || 'Suspended by admin'
      }
    });
    
    await logAudit(req.adminUser.id, 'SUSPEND_DEVICE_CODE', 'DeviceCode', id,
      { reason }, req.ip);
    
    res.json({ success: true, deviceCode: updated });
  } catch (error) {
    console.error('Suspend device code error:', error);
    res.status(500).json({ error: 'Failed to suspend device code' });
  }
});

// PATCH /api/admin/device-codes/:id/reactivate - Reactivate a suspended code
router.patch('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deviceCode = await prisma.deviceCode.findUnique({ where: { id } });
    
    if (!deviceCode) {
      return res.status(404).json({ error: 'Device code not found' });
    }
    
    // Check access
    if (req.adminUser.role !== 'SUPER_ADMIN' && deviceCode.careHomeId !== req.careHomeId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updated = await prisma.deviceCode.update({
      where: { id },
      data: { 
        status: 'ACTIVE',
        suspendReason: null
      }
    });
    
    await logAudit(req.adminUser.id, 'REACTIVATE_DEVICE_CODE', 'DeviceCode', id, {}, req.ip);
    
    res.json({ success: true, deviceCode: updated });
  } catch (error) {
    console.error('Reactivate device code error:', error);
    res.status(500).json({ error: 'Failed to reactivate device code' });
  }
});

// DELETE /api/admin/device-codes/:id - Revoke/delete a device code
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.deviceCode.update({
      where: { id },
      data: { status: 'REVOKED' }
    });
    
    await logAudit(req.adminUser.id, 'REVOKE_DEVICE_CODE', 'DeviceCode', id, {}, req.ip);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke device code error:', error);
    res.status(500).json({ error: 'Failed to revoke device code' });
  }
});

module.exports = router;
