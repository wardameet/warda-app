const { validate, b2cSignupSchema } = require('../lib/validators');
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
// Auth via Cognito - bcrypt not needed here

// POST /api/b2c/register - Family self-registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, elderlyName, elderlyAge, elderlyRelationship, planId } = req.body;
    if (!email || !password || !firstName || !elderlyName) return res.status(400).json({ error: 'Email, password, first name, and elderly name required' });

    // Check existing
    const existing = await prisma.familyContact.findFirst({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Create user (the elderly person)
    const user = await prisma.user.create({
      data: {
        firstName: elderlyName.split(' ')[0],
        lastName: elderlyName.split(' ').slice(1).join(' ') || firstName,
        preferredName: elderlyName.split(' ')[0],
        status: 'ACTIVE', accountType: 'B2C',
        pin: Math.floor(1000 + Math.random() * 9000).toString(),
      }
    });

    // Create profile placeholder
    await prisma.residentProfile.create({ data: { residentId: user.id } });

    // Create family contact
    // Password auth handled via Cognito
    const family = await prisma.familyContact.create({
      data: {
        userId: user.id,
        name: `${firstName} ${lastName}`,
        relationship: elderlyRelationship || 'Family',
        email,
        phone: phone || null,
        
        isPrimary: true,
      }
    });

    // Create subscription if plan selected
    let subscription = null;
    if (planId) {
      const plans = { b2c_basic: { name: 'Family Basic', amount: 1999 }, b2c_plus: { name: 'Family Plus', amount: 2999 }, b2c_premium: { name: 'Family Premium', amount: 3999 } };
      const plan = plans[planId];
      if (plan) {
        subscription = await prisma.subscription.create({
          data: { email, name: `${firstName} ${lastName}`, planId, planName: plan.name, amount: plan.amount, status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        });
      }
    }

    res.json({
      success: true,
      message: 'Welcome to Warda! Your account is ready.',
      user: { id: user.id, name: elderlyName, pin: user.pin },
      family: { id: family.id, email },
      subscription,
      nextSteps: [
        'Complete the questionnaire about your loved one',
        'Set up their tablet with the PIN: ' + user.loginPin,
        'Download the Warda Family app'
      ]
    });
  } catch (err) {
    console.error('B2C register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// POST /api/b2c/questionnaire - Family fills questionnaire for elderly
router.post('/questionnaire', async (req, res) => {
  try {
    const { userId, email, step, data } = req.body;
    if (!userId || !data) return res.status(400).json({ error: 'userId and data required' });

    const profile = await prisma.residentProfile.update({
      where: { residentId: userId },
      data
    });

    res.json({ success: true, step, message: step === 7 ? 'Questionnaire complete! Warda is ready.' : `Step ${step} saved.` });
  } catch (err) {
    console.error('B2C questionnaire error:', err);
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

module.exports = router;
