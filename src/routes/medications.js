const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/medications/:userId - List medications for a resident
router.get('/:userId', tabletAuth, async (req, res) => {
  try {
    const meds = await prisma.medication.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    });
    const active = meds.filter(m => m.isActive);
    const nextDue = getNextDue(active);
    res.json({ success: true, medications: meds, active: active.length, nextDue });
  } catch (err) {
    console.error('Get meds error:', err);
    res.status(500).json({ success: false, error: 'Failed to get medications' });
  }
});

// POST /api/medications - Add medication
router.post('/', tabletAuth, async (req, res) => {
  try {
    const { userId, name, dosage, frequency, timeOfDay, notes } = req.body;
    if (!userId || !name) return res.status(400).json({ error: 'userId and name required' });
    const med = await prisma.medication.create({
      data: { userId, name, dosage: dosage || null, frequency: frequency || null, timeOfDay: timeOfDay || [], notes: notes || null }
    });
    res.json({ success: true, medication: med });
  } catch (err) {
    console.error('Create med error:', err);
    res.status(500).json({ success: false, error: 'Failed to create medication' });
  }
});

// PUT /api/medications/:id - Update medication
router.put('/:id', tabletAuth, async (req, res) => {
  try {
    const { name, dosage, frequency, timeOfDay, notes, isActive } = req.body;
    const med = await prisma.medication.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(dosage !== undefined && { dosage }), ...(frequency !== undefined && { frequency }), ...(timeOfDay && { timeOfDay }), ...(notes !== undefined && { notes }), ...(isActive !== undefined && { isActive }) }
    });
    res.json({ success: true, medication: med });
  } catch (err) {
    console.error('Update med error:', err);
    res.status(500).json({ success: false, error: 'Failed to update medication' });
  }
});

// DELETE /api/medications/:id - Remove medication
router.delete('/:id', tabletAuth, async (req, res) => {
  try {
    await prisma.medication.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete med error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete medication' });
  }
});

// POST /api/medications/:id/taken - Mark medication as taken (creates health log)
router.post('/:id/taken', async (req, res) => {
  try {
    const med = await prisma.medication.findUnique({ where: { id: req.params.id } });
    if (!med) return res.status(404).json({ error: 'Not found' });
    const log = await prisma.healthLog.create({
      data: { userId: med.userId, type: 'MEDICATION_TAKEN', value: med.name, notes: `${med.dosage || ''} taken at ${new Date().toLocaleTimeString('en-GB')}`, recordedBy: req.body.recordedBy || 'tablet' }
    });
    res.json({ success: true, log });
  } catch (err) {
    console.error('Med taken error:', err);
    res.status(500).json({ success: false, error: 'Failed to log' });
  }
});

// POST /api/medications/:id/skipped - Mark medication as skipped
router.post('/:id/skipped', async (req, res) => {
  try {
    const med = await prisma.medication.findUnique({ where: { id: req.params.id } });
    if (!med) return res.status(404).json({ error: 'Not found' });
    const log = await prisma.healthLog.create({
      data: { userId: med.userId, type: 'MEDICATION_SKIPPED', value: med.name, notes: req.body.reason || 'Skipped', recordedBy: req.body.recordedBy || 'tablet' }
    });
    // Alert staff
    await prisma.alert.create({
      data: { userId: med.userId, type: 'MEDICATION', severity: 'MEDIUM', message: `${med.name} was skipped. Reason: ${req.body.reason || 'Not given'}`, careHomeId: (await prisma.user.findUnique({ where: { id: med.userId }, select: { careHomeId: true } }))?.careHomeId }
    });
    res.json({ success: true, log });
  } catch (err) {
    console.error('Med skipped error:', err);
    res.status(500).json({ success: false, error: 'Failed to log' });
  }
});

function getNextDue(activeMeds) {
  const now = new Date();
  const currentHour = now.getHours();
  const timeMap = { 'Morning': 8, 'Noon': 12, 'Afternoon': 14, 'Evening': 18, 'Bedtime': 21 };
  let nextMed = null, nextTime = 24;
  for (const med of activeMeds) {
    for (const t of med.timeOfDay) {
      const hr = timeMap[t] || parseInt(t) || 8;
      if (hr > currentHour && hr < nextTime) { nextTime = hr; nextMed = { name: med.name, time: t, hour: hr }; }
    }
  }
  return nextMed;
}

module.exports = router;
