/**
 * Public Questionnaire Routes
 * No auth required — accessed via unique token
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

// POST /api/questionnaire/generate-link — Generate shareable link (admin only)
router.post('/generate-link', async (req, res) => {
  try {
    const { residentId } = req.body;
    if (!residentId) return res.status(400).json({ error: 'residentId required' });
    
    // Check if token already exists
    const existing = await prisma.residentProfile.findUnique({ where: { residentId } });
    if (!existing) return res.status(404).json({ error: 'Profile not found' });
    
    let token = existing.questionnaireToken;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await prisma.residentProfile.update({ where: { residentId }, data: { questionnaireToken: token } });
    }
    
    const link = `https://admin.meetwarda.com/q/${token}`;
    res.json({ success: true, token, link });
  } catch (err) {
    console.error('Generate link error:', err);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// GET /api/questionnaire/:token — Load questionnaire by token (public)
router.get('/:token', async (req, res) => {
  try {
    const profile = await prisma.residentProfile.findUnique({
      where: { questionnaireToken: req.params.token },
      include: { resident: { select: { id: true, firstName: true, lastName: true, preferredName: true, dateOfBirth: true, roomNumber: true, careHome: { select: { name: true } } } } }
    });
    if (!profile) return res.status(404).json({ error: 'Invalid or expired link' });
    
    res.json({ success: true, profile, residentName: profile.resident?.preferredName || profile.resident?.firstName || 'Resident' });
  } catch (err) {
    console.error('Load questionnaire error:', err);
    res.status(500).json({ error: 'Failed to load' });
  }
});

// PUT /api/questionnaire/:token — Save questionnaire step (public)
router.put('/:token', async (req, res) => {
  try {
    const { step, data } = req.body;
    const profile = await prisma.residentProfile.findUnique({ where: { questionnaireToken: req.params.token } });
    if (!profile) return res.status(404).json({ error: 'Invalid or expired link' });
    
    // Map step data to profile fields (same logic as admin route)
    const updateData = {};
    
    // Step 1: Identity
    if (step === 1) {
      const userUpdate = {};
      if (data.firstName) userUpdate.firstName = data.firstName;
      if (data.lastName) userUpdate.lastName = data.lastName;
      if (data.preferredName) userUpdate.preferredName = data.preferredName;
      if (data.dateOfBirth) userUpdate.dateOfBirth = new Date(data.dateOfBirth);
      if (data.roomNumber) userUpdate.roomNumber = data.roomNumber;
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({ where: { id: profile.residentId }, data: userUpdate });
      }
      if (data.gender) updateData.gender = data.gender;
      if (data.nationality) updateData.nationality = data.nationality;
      if (data.emergencyContact) updateData.emergencyContact = data.emergencyContact;
      if (data.emergencyPhone) updateData.emergencyPhone = data.emergencyPhone;
    }
    
    // Steps 2-9: Direct profile field mapping
    if (step >= 2) {
      const directFields = [
        'maritalStatus','spouseName','previousCareer','grewUpIn','education','proudestAchievement',
        'spouseDetails','keyMemories','pets','primaryFamilyContact','favouriteFamilyMember',
        'familyDynamicsNotes','familyDetails','bereavementStatus','traumaNotes',
        'favouriteMusic','favouriteTv','favouriteFoods','sportsTeams','favouriteBooks','favouriteRadio',
        'faithType','denomination','culturalBackground','languagePreference','faithComfort','prayerReminders',
        'useGaelic','useScottish','useWelsh','useIrish','favouriteScriptures',
        'dementiaStage','mobilityLevel','hearing','vision','communicationStyle','dietaryNeeds',
        'gpName','gpPractice','sleepPattern','fallRisk',
        'voicePreference','responseLengthPref','humourStyle','formalityLevel','discomfortSigns',
        'happinessExpressions','conversationPace','repetitionHandling',
        'wakeUpTime','bedTime','newsPreference','weatherInterest',
        'wardaBackstory','wardaAge','greetingStyle'
      ];
      const arrayFields = [
        'avoidTopics','sensitiveTopics','knownTriggers','safeRedirectTopics',
        'hobbies','joyTriggers','memories','conversationStarters','thingsThatMakeLaugh',
        'allergies','checkInTimes','wardaTraits','hardBoundaries','proactiveTopics'
      ];
      directFields.forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });
      arrayFields.forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });
    }
    
    updateData.questionnaireStep = step;
    if (step >= 10) updateData.questionnaireComplete = true;
    
    await prisma.residentProfile.update({ where: { questionnaireToken: req.params.token }, data: updateData });
    
    res.json({ success: true, step });
  } catch (err) {
    console.error('Save questionnaire error:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

module.exports = router;
