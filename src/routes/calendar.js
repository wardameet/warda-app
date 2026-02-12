const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/calendar/:userId - Get events for a date range
router.get('/:userId', tabletAuth, async (req, res) => {
  try {
    const { date, from, to } = req.query;
    const userId = req.params.userId;

    // Build date range
    let start, end;
    if (date) {
      start = new Date(date); start.setHours(0,0,0,0);
      end = new Date(date); end.setHours(23,59,59,999);
    } else {
      start = from ? new Date(from) : new Date(); start.setHours(0,0,0,0);
      end = to ? new Date(to) : new Date(); end.setHours(23,59,59,999);
    }

    // Get calendar events
    const events = await prisma.calendarEvent.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { time: 'asc' }
    });

    // Also pull medications due today as events
    const medications = await prisma.medication.findMany({
      where: { userId, isActive: true }
    });

    const medEvents = [];
    const timeMap = { Morning: '08:00', Noon: '12:00', Afternoon: '14:00', Evening: '18:00', Bedtime: '21:00' };
    for (const med of medications) {
      for (const slot of (med.timeOfDay || [])) {
        medEvents.push({
          id: `med-${med.id}-${slot}`,
          title: `${med.name} (${med.dosage || ''})`,
          time: timeMap[slot] || '09:00',
          type: 'medication',
          source: 'auto',
          notes: `${slot} medication`
        });
      }
    }

    // Combine and sort
    const all = [
      ...events.map(e => ({ id: e.id, title: e.title, time: e.time, type: e.type, notes: e.notes, source: 'calendar' })),
      ...medEvents
    ].sort((a, b) => a.time.localeCompare(b.time));

    // Time of day greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    res.json({ success: true, events: all, total: all.length, greeting, dayName, date: start.toISOString() });
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ success: false, error: 'Failed to load calendar' });
  }
});

// POST /api/calendar - Create event
router.post('/', tabletAuth, async (req, res) => {
  try {
    const { userId, title, time, type, date, notes, recurring } = req.body;
    if (!userId || !title || !time) return res.status(400).json({ error: 'userId, title, time required' });

    const event = await prisma.calendarEvent.create({
      data: {
        userId, title, time,
        type: type || 'activity',
        date: new Date(date || new Date()),
        notes: notes || null,
        recurring: recurring || null
      }
    });
    res.json({ success: true, event });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

// PUT /api/calendar/:id - Update event
router.put('/:id', tabletAuth, async (req, res) => {
  try {
    const event = await prisma.calendarEvent.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update' });
  }
});

// DELETE /api/calendar/:id - Delete event
router.delete('/:id', tabletAuth, async (req, res) => {
  try {
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

module.exports = router;
