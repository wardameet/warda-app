const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/tablet/login — Username + PIN login
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) {
      return res.status(400).json({ success: false, error: 'Username and PIN are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: {
        profile: true,
        careHome: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Username not found' });
    }

    if (!user.pin) {
      return res.status(401).json({ success: false, error: 'PIN not set. Please contact your family or care team.' });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ success: false, error: 'Incorrect PIN' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, error: 'Account is not active' });
    }

    // Build resident data for tablet
    const resident = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredName: user.preferredName || user.firstName,
      username: user.username,
      roomNumber: user.roomNumber,
      careHomeId: user.careHomeId,
      careHomeName: user.careHome?.name,
      profile: user.profile ? {
        languagePreference: user.profile.languagePreference || 'English',
        joyTopics: user.profile.joyTopics || [],
        hobbies: user.profile.hobbies || [],
        faithBackground: user.profile.faithBackground,
      } : null,
    };

    res.json({ success: true, resident, message: `Welcome back, ${resident.preferredName}!` });
  } catch (error) {
    console.error('Tablet login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/tablet/verify — Check if saved session is still valid
router.get('/verify', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, careHome: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.json({ success: false, error: 'Session expired' });
    }

    const resident = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredName: user.preferredName || user.firstName,
      username: user.username,
      roomNumber: user.roomNumber,
      careHomeId: user.careHomeId,
      careHomeName: user.careHome?.name,
      profile: user.profile ? {
        languagePreference: user.profile.languagePreference || 'English',
        joyTopics: user.profile.joyTopics || [],
        hobbies: user.profile.hobbies || [],
        faithBackground: user.profile.faithBackground,
      } : null,
    };

    res.json({ success: true, resident });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

module.exports = router;
