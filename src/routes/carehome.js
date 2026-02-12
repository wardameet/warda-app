/**
 * Care Home Tablet App API
 * Simplified endpoints for: Alerts, Moods, Messages, Residents
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.CAREHOME_JWT_SECRET;

// ─── Auth Middleware ─────────────────────────────────────────
function carehomeAuth(req, res, next) {
  try {
    var authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    var token = authHeader.replace('Bearer ', '');
    var decoded = jwt.verify(token, JWT_SECRET);
    req.staff = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Login (staff/manager) ──────────────────────────────────
router.post('/login', async function(req, res) {
  try {
    var { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    var admin = await prisma.adminUser.findFirst({
      where: { email: email.toLowerCase(), role: { in: ['STAFF', 'MANAGER', 'SUPER_ADMIN'] } },
      include: { careHome: { select: { id: true, name: true } } }
    });
    
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Try bcrypt password
    var valid = false;
    if (admin.tempPassword) {
      valid = await bcrypt.compare(password, admin.tempPassword);
    }
    // Also try plain text match for initial setup
    if (!valid && admin.tempPassword === password) valid = true;
    
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    var token = jwt.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      careHomeId: admin.careHomeId,
      careHomeName: admin.careHome?.name
    }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token: token,
      staff: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        careHomeId: admin.careHomeId,
        careHomeName: admin.careHome?.name
      }
    });
  } catch (err) {
    console.error('Carehome login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── GET /residents — All residents in care home ────────────
router.get('/residents', carehomeAuth, async function(req, res) {
  try {
    var residents = await prisma.user.findMany({
      where: { careHomeId: req.staff.careHomeId, status: 'ACTIVE' },
      select: {
        id: true, firstName: true, lastName: true, preferredName: true,
        roomNumber: true, status: true, photoUrl: true,
        profile: { select: { questionnaireComplete: true } }
      },
      orderBy: { firstName: 'asc' }
    });
    
    // Get latest mood and last active for each
    var enriched = await Promise.all(residents.map(async function(r) {
      var lastConvo = await prisma.conversation.findFirst({
        where: { userId: r.id },
        orderBy: { startedAt: 'desc' },
        select: { mood: true, startedAt: true }
      });
      var lastHealth = await prisma.healthLog.findFirst({
        where: { userId: r.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });
      var lastActive = lastConvo?.startedAt || lastHealth?.createdAt || null;
      
      // Parse mood
      var moodScore = null;
      if (lastConvo?.mood) {
        var m = lastConvo.mood;
        if (!isNaN(parseFloat(m))) moodScore = parseFloat(m);
        else {
          var map = { happy: 8, content: 7, neutral: 6, sad: 4, anxious: 3, angry: 2 };
          moodScore = map[m.toLowerCase()] || 5;
        }
      }
      
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        preferredName: r.preferredName,
        roomNumber: r.roomNumber,
        photoUrl: r.photoUrl,
        mood: moodScore,
        lastActive: lastActive,
        
        questionnaireComplete: r.profile?.questionnaireComplete ?? false
      };
    }));
    
    res.json({ success: true, residents: enriched });
  } catch (err) {
    console.error('Residents error:', err.message);
    res.status(500).json({ error: 'Failed to load residents' });
  }
});

// ─── GET /alerts — Active alerts for care home ──────────────
router.get('/alerts', carehomeAuth, async function(req, res) {
  try {
    var alerts = await prisma.alert.findMany({
      where: {
        user: { careHomeId: req.staff.careHomeId },
        isResolved: false
      },
      include: {
        user: { select: { firstName: true, lastName: true, preferredName: true, roomNumber: true } }
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 50
    });
    
    // Also get resolved recent alerts (last 24h)
    var oneDayAgo = new Date(Date.now() - 86400000);
    var resolved = await prisma.alert.findMany({
      where: {
        user: { careHomeId: req.staff.careHomeId },
        isResolved: true,
        resolvedAt: { gte: oneDayAgo }
      },
      include: {
        user: { select: { firstName: true, lastName: true, preferredName: true, roomNumber: true } }
      },
      orderBy: { resolvedAt: 'desc' },
      take: 20
    });
    
    res.json({ success: true, active: alerts, resolved: resolved });
  } catch (err) {
    console.error('Alerts error:', err.message);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// ─── POST /alerts/:id/resolve — Dismiss an alert ───────────
router.post('/alerts/:id/resolve', carehomeAuth, async function(req, res) {
  try {
    await prisma.alert.update({
      where: { id: req.params.id },
      data: { isResolved: true, resolvedAt: new Date(), resolvedBy: req.staff.name }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// ─── GET /moods — Mood overview for all residents ───────────
router.get('/moods', carehomeAuth, async function(req, res) {
  try {
    var residents = await prisma.user.findMany({
      where: { careHomeId: req.staff.careHomeId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true }
    });
    
    var moods = await Promise.all(residents.map(async function(r) {
      // Get last 7 days of conversations with mood
      var sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      var convos = await prisma.conversation.findMany({
        where: { userId: r.id, startedAt: { gte: sevenDaysAgo } },
        select: { mood: true, startedAt: true, summary: true },
        orderBy: { startedAt: 'desc' }
      });
      
      var latestMood = null;
      var avgMood = null;
      var trend = 'stable';
      
      if (convos.length > 0) {
        // Parse moods
        var scores = convos.map(function(c) {
          if (!c.mood) return null;
          if (!isNaN(parseFloat(c.mood))) return parseFloat(c.mood);
          var map = { happy: 8, content: 7, neutral: 6, sad: 4, anxious: 3, angry: 2 };
          return map[c.mood.toLowerCase()] || 5;
        }).filter(function(s) { return s !== null; });
        
        if (scores.length > 0) {
          latestMood = scores[0];
          avgMood = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
          if (scores.length >= 2) {
            var recent = scores.slice(0, Math.ceil(scores.length / 2));
            var older = scores.slice(Math.ceil(scores.length / 2));
            var recentAvg = recent.reduce(function(a, b) { return a + b; }, 0) / recent.length;
            var olderAvg = older.reduce(function(a, b) { return a + b; }, 0) / older.length;
            trend = recentAvg > olderAvg + 0.5 ? 'up' : recentAvg < olderAvg - 0.5 ? 'down' : 'stable';
          }
        }
      }
      
      return {
        id: r.id,
        name: r.preferredName || r.firstName,
        fullName: r.firstName + ' ' + r.lastName,
        room: r.roomNumber,
        latestMood: latestMood,
        avgMood: avgMood,
        trend: trend,
        conversations: convos.length,
        lastSummary: convos[0]?.summary || null,
        lastTalked: convos[0]?.startedAt || null
      };
    }));
    
    res.json({ success: true, moods: moods });
  } catch (err) {
    console.error('Moods error:', err.message);
    res.status(500).json({ error: 'Failed to load moods' });
  }
});

// ─── GET /messages — Family↔Staff threads per resident ──────
router.get('/messages', carehomeAuth, async function(req, res) {
  try {
    var residents = await prisma.user.findMany({
      where: { careHomeId: req.staff.careHomeId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, preferredName: true, roomNumber: true }
    });
    
    var threads = await Promise.all(residents.map(async function(r) {
      // Get messages where senderType is FAMILY or STAFF and it's a staff thread
      var msgs = await prisma.message.findMany({
        where: {
          userId: r.id,
          type: 'STAFF_FAMILY',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, senderType: true, senderName: true, createdAt: true }
      });
      
      // Also count unread (messages from family not yet read by staff)
      var unread = await prisma.message.count({
        where: {
          userId: r.id,
          type: 'STAFF_FAMILY',
          senderType: 'FAMILY',
          isDelivered: false
        }
      });
      
      // Get family contacts for this resident
      var families = await prisma.familyContact.findMany({
        where: { userId: r.id },
        select: { name: true, relationship: true }
      });
      
      return {
        residentId: r.id,
        residentName: r.preferredName || r.firstName,
        fullName: r.firstName + ' ' + r.lastName,
        room: r.roomNumber,
        families: families,
        lastMessage: msgs[0] || null,
        unread: unread
      };
    }));
    
    // Sort: unread first, then by last message time
    threads.sort(function(a, b) {
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      var aTime = a.lastMessage?.createdAt || '1970';
      var bTime = b.lastMessage?.createdAt || '1970';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    
    res.json({ success: true, threads: threads });
  } catch (err) {
    console.error('Messages error:', err.message);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ─── GET /messages/:residentId — Thread for a resident ──────
router.get('/messages/:residentId', carehomeAuth, async function(req, res) {
  try {
    var msgs = await prisma.message.findMany({
      where: {
        userId: req.params.residentId,
        type: 'STAFF_FAMILY'
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, content: true, senderType: true, senderName: true, createdAt: true }
    });
    
    // Mark family messages as delivered (read by staff)
    await prisma.message.updateMany({
      where: {
        userId: req.params.residentId,
        type: 'STAFF_FAMILY',
        senderType: 'FAMILY',
        isDelivered: false
      },
      data: { isDelivered: true, deliveredAt: new Date() }
    });
    
    res.json({ success: true, messages: msgs });
  } catch (err) {
    console.error('Thread error:', err.message);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

// ─── POST /messages/:residentId — Staff sends message ───────
router.post('/messages/:residentId', carehomeAuth, async function(req, res) {
  try {
    var { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    
    var msg = await prisma.message.create({
      data: {
        content: message.trim(),
        sender: req.staff.name,
        senderId: req.staff.id,
        senderType: 'STAFF',
        senderName: req.staff.name,
        userId: req.params.residentId,
        recipientId: req.params.residentId,
        type: 'STAFF_FAMILY',
        isDelivered: false
      }
    });
    
    res.json({ success: true, message: msg });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
