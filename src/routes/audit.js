const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { adminAuth, requireRole } = require('../middleware/adminAuth');

router.use(adminAuth);

// GET /api/audit - List audit logs with filters
router.get('/', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { action, entityType, adminUserId, from, to, limit, offset } = req.query;
    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (adminUserId) where.adminUserId = adminUserId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit) || 50,
        skip: parseInt(offset) || 0
      }),
      prisma.auditLog.count({ where })
    ]);

    // Enrich with admin names
    const adminIds = [...new Set(logs.map(l => l.adminUserId))];
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    const adminMap = Object.fromEntries(admins.map(a => [a.id, `${a.firstName} ${a.lastName}`]));

    const enriched = logs.map(l => ({
      ...l,
      adminName: adminMap[l.adminUserId] || 'System'
    }));

    res.json({ success: true, logs: enriched, total, hasMore: (parseInt(offset) || 0) + enriched.length < total });
  } catch (err) {
    console.error('Audit list error:', err);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
});

// GET /api/audit/actions - List unique action types
router.get('/actions', async (req, res) => {
  try {
    const actions = await prisma.auditLog.findMany({ distinct: ['action'], select: { action: true } });
    res.json({ success: true, actions: actions.map(a => a.action) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// GET /api/audit/export - Export audit logs as CSV
router.get('/export', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' } });
    
    const csv = ['Timestamp,Admin User ID,Action,Entity Type,Entity ID,IP Address,Details'];
    for (const l of logs) {
      csv.push(`${l.createdAt.toISOString()},${l.adminUserId},${l.action},${l.entityType},${l.entityId || ''},${l.ipAddress || ''},${JSON.stringify(l.details || {}).replace(/,/g, ';')}`);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv.join('\n'));
  } catch (err) {
    console.error('Audit export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export' });
  }
});

// POST /api/audit/data-export - GDPR data export for a resident
router.post('/data-export', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { residentId } = req.body;
    if (!residentId) return res.status(400).json({ error: 'residentId required' });

    const [user, profile, conversations, messages, healthLogs, medications, alerts, familyContacts] = await Promise.all([
      prisma.user.findUnique({ where: { id: residentId }, select: { id: true, firstName: true, lastName: true, preferredName: true, dateOfBirth: true, roomNumber: true, status: true, createdAt: true } }),
      prisma.residentProfile.findUnique({ where: { residentId } }),
      prisma.conversation.findMany({ where: { userId: residentId }, select: { id: true, startedAt: true, endedAt: true, messageCount: true, moodSummary: true } }),
      prisma.message.findMany({ where: { OR: [{ senderId: residentId }, { recipientId: residentId }] }, select: { id: true, content: true, type: true, createdAt: true, senderId: true, recipientId: true } }),
      prisma.healthLog.findMany({ where: { userId: residentId } }),
      prisma.medication.findMany({ where: { userId: residentId } }),
      prisma.alert.findMany({ where: { userId: residentId } }),
      prisma.familyContact.findMany({ where: { userId: residentId }, select: { id: true, name: true, relationship: true, email: true, phone: true } })
    ]);

    if (!user) return res.status(404).json({ error: 'Resident not found' });

    // Log this export
    await prisma.auditLog.create({
      data: { adminUserId: req.adminUser.id, action: 'GDPR_DATA_EXPORT', entityType: 'User', entityId: residentId, details: { exportedAt: new Date().toISOString() }, ipAddress: req.ip }
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: `${req.adminUser.firstName} ${req.adminUser.lastName}`,
      dataSubject: user,
      profile: profile ? { ...profile, resident: undefined } : null,
      familyContacts,
      conversations: { total: conversations.length, records: conversations },
      messages: { total: messages.length, records: messages },
      healthLogs: { total: healthLogs.length, records: healthLogs },
      medications: { total: medications.length, records: medications },
      alerts: { total: alerts.length, records: alerts }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=gdpr_export_${user.firstName}_${user.lastName}_${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  } catch (err) {
    console.error('GDPR export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// DELETE /api/audit/data-delete - GDPR right to erasure
router.delete('/data-delete', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { residentId, confirmName } = req.body;
    if (!residentId || !confirmName) return res.status(400).json({ error: 'residentId and confirmName required' });

    const user = await prisma.user.findUnique({ where: { id: residentId }, select: { firstName: true, lastName: true } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (`${user.firstName} ${user.lastName}` !== confirmName) return res.status(400).json({ error: 'Name confirmation does not match' });

    // Log before deleting
    await prisma.auditLog.create({
      data: { adminUserId: req.adminUser.id, action: 'GDPR_DATA_DELETE', entityType: 'User', entityId: residentId, details: { deletedName: confirmName, deletedAt: new Date().toISOString() }, ipAddress: req.ip }
    });

    // Cascade delete handles related records
    await prisma.user.delete({ where: { id: residentId } });

    res.json({ success: true, message: `All data for ${confirmName} has been permanently deleted.` });
  } catch (err) {
    console.error('GDPR delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete data' });
  }
});

module.exports = router;
