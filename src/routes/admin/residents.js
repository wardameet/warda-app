/**
 * Admin Resident Routes
 * CRUD for residents + therapeutic questionnaire/profile
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { adminAuth, requireRole, scopeToCareHome, logAudit } = require('../../middleware/adminAuth');

const prisma = new PrismaClient();

router.use(adminAuth);

// GET /api/admin/residents
router.get('/', scopeToCareHome, async (req, res) => {
  try {
    let where = {};
    if (req.scopedCareHomeId) {
      where.careHomeId = req.scopedCareHomeId;
    } else if (req.adminRole !== 'SUPER_ADMIN') {
      where.careHomeId = req.careHomeId;
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      where.OR = [
        { firstName: { contains: req.query.search, mode: 'insensitive' } },
        { lastName: { contains: req.query.search, mode: 'insensitive' } },
        { preferredName: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    const residents = await prisma.user.findMany({
      where,
      include: {
        careHome: { select: { id: true, name: true } },
        profile: {
          select: {
            questionnaireComplete: true,
            questionnaireStep: true,
            wardaBackstory: true,
            dementiaStage: true,
            communicationStyle: true
          }
        },
        _count: {
          select: {
            familyContacts: true,
            conversations: true,
            alerts: { where: { isResolved: false } }
          }
        }
      },
      orderBy: { firstName: 'asc' }
    });

    const enriched = residents.map(r => ({
      ...r,
      familyCount: r._count.familyContacts,
      totalConversations: r._count.conversations,
      unresolvedAlerts: r._count.alerts,
      profileComplete: r.profile?.questionnaireComplete || false,
      _count: undefined
    }));

    res.json({ success: true, residents: enriched });
  } catch (error) {
    console.error('List residents error:', error);
    res.status(500).json({ success: false, error: 'Failed to list residents' });
  }
});

// GET /api/admin/residents/:id
router.get('/:id', async (req, res) => {
  try {
    const resident = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        careHome: { select: { id: true, name: true } },
        profile: true,
        familyContacts: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
        },
        tablet: { select: { id: true, serialNumber: true, status: true } },
        _count: { select: { conversations: true, messages: true, alerts: true } }
      }
    });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    if (req.adminRole !== 'SUPER_ADMIN' && resident.careHomeId !== req.careHomeId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, resident });
  } catch (error) {
    console.error('Get resident error:', error);
    res.status(500).json({ success: false, error: 'Failed to get resident' });
  }
});

// POST /api/admin/residents
router.post('/', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      firstName, lastName, preferredName, dateOfBirth,
      roomNumber, pin, careHomeId, accountType
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'First name and last name are required' });
    }

    const targetCareHomeId = req.adminRole === 'SUPER_ADMIN'
      ? (careHomeId || req.careHomeId)
      : req.careHomeId;

    if (!targetCareHomeId && accountType !== 'B2C') {
      return res.status(400).json({ success: false, error: 'Care home is required for B2B residents' });
    }

    const resident = await prisma.user.create({
      data: {
        firstName,
        lastName,
        preferredName: preferredName || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        roomNumber: roomNumber || null,
        pin: pin || null,
        careHomeId: targetCareHomeId,
        accountType: accountType || 'B2B',
        status: 'ACTIVE'
      }
    });

    await prisma.residentProfile.create({
      data: {
        residentId: resident.id,
        questionnaireStep: 1,
        questionnaireComplete: false
      }
    });

    await logAudit(req.adminUser.id, 'CREATE_RESIDENT', 'User', resident.id,
      { firstName, lastName, careHomeId: targetCareHomeId }, req.ip);

    res.status(201).json({
      success: true,
      resident,
      message: `Resident "${firstName} ${lastName}" created. Please complete the questionnaire.`
    });
  } catch (error) {
    console.error('Create resident error:', error);
    res.status(500).json({ success: false, error: 'Failed to create resident' });
  }
});

// PUT /api/admin/residents/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Resident not found' });

    if (req.adminRole !== 'SUPER_ADMIN' && existing.careHomeId !== req.careHomeId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const {
      firstName, lastName, preferredName, dateOfBirth,
      roomNumber, pin, status, photoUrl, moveInDate
    } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (preferredName !== undefined) updateData.preferredName = preferredName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
    if (pin !== undefined) updateData.pin = pin;
    if (status !== undefined) updateData.status = status;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (moveInDate !== undefined) updateData.moveInDate = moveInDate ? new Date(moveInDate) : null;

    const resident = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(req.adminUser.id, 'UPDATE_RESIDENT', 'User', resident.id, updateData, req.ip);

    res.json({ success: true, resident });
  } catch (error) {
    console.error('Update resident error:', error);
    res.status(500).json({ success: false, error: 'Failed to update resident' });
  }
});

// DELETE /api/admin/residents/:id
router.delete('/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const resident = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'DISCHARGED' }
    });

    await logAudit(req.adminUser.id, 'DISCHARGE_RESIDENT', 'User', resident.id, null, req.ip);

    res.json({
      success: true,
      message: `${resident.firstName} ${resident.lastName} has been discharged`
    });
  } catch (error) {
    console.error('Delete resident error:', error);
    res.status(500).json({ success: false, error: 'Failed to discharge resident' });
  }
});

// =============== THERAPEUTIC QUESTIONNAIRE ===============

// GET /api/admin/residents/:id/profile
router.get('/:id/profile', async (req, res) => {
  try {
    const profile = await prisma.residentProfile.findUnique({
      where: { residentId: req.params.id },
      include: {
        resident: {
          select: {
            firstName: true, lastName: true, preferredName: true,
            dateOfBirth: true, roomNumber: true, pin: true,
            photoUrl: true, careHomeId: true, moveInDate: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// PUT /api/admin/residents/:id/profile
router.put('/:id/profile', async (req, res) => {
  try {
    const { step, data } = req.body;
    let updateData = {};

    if (step === 1 || data.firstName) {
      const userUpdate = {};
      if (data.firstName) userUpdate.firstName = data.firstName;
      if (data.lastName) userUpdate.lastName = data.lastName;
      if (data.preferredName !== undefined) userUpdate.preferredName = data.preferredName;
      if (data.dateOfBirth) userUpdate.dateOfBirth = new Date(data.dateOfBirth);
      if (data.roomNumber !== undefined) userUpdate.roomNumber = data.roomNumber;
      if (data.pin !== undefined) userUpdate.pin = data.pin;
      if (data.photoUrl !== undefined) userUpdate.photoUrl = data.photoUrl;
      if (data.moveInDate) userUpdate.moveInDate = new Date(data.moveInDate);

      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: req.params.id },
          data: userUpdate
        });
      }
      updateData.questionnaireStep = Math.max(step || 1, 1);
    }

    if (step === 2 || data.maritalStatus) {
      if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus;
      if (data.spouseName !== undefined) updateData.spouseName = data.spouseName;
      if (data.spouseDetails !== undefined) updateData.spouseDetails = data.spouseDetails;
      if (data.children !== undefined) updateData.children = data.children;
      if (data.grandchildren !== undefined) updateData.grandchildren = data.grandchildren;
      if (data.previousCareer !== undefined) updateData.previousCareer = data.previousCareer;
      if (data.grewUpIn !== undefined) updateData.grewUpIn = data.grewUpIn;
      if (data.keyMemories !== undefined) updateData.keyMemories = data.keyMemories;
      if (data.pets !== undefined) updateData.pets = data.pets;
      updateData.questionnaireStep = Math.max(step || 2, 2);
    }

    if (step === 3 || data.avoidTopics) {
      if (data.avoidTopics !== undefined) updateData.avoidTopics = data.avoidTopics;
      if (data.sensitiveTopics !== undefined) updateData.sensitiveTopics = data.sensitiveTopics;
      if (data.traumaNotes !== undefined) updateData.traumaNotes = data.traumaNotes;
      if (data.knownTriggers !== undefined) updateData.knownTriggers = data.knownTriggers;
      if (data.bereavementStatus !== undefined) updateData.bereavementStatus = data.bereavementStatus;
      updateData.questionnaireStep = Math.max(step || 3, 3);
    }

    if (step === 4 || data.hobbies) {
      if (data.joyTopics !== undefined) updateData.joyTopics = data.joyTopics;
      if (data.hobbies !== undefined) updateData.hobbies = data.hobbies;
      if (data.favouriteMusic !== undefined) updateData.favouriteMusic = data.favouriteMusic;
      if (data.favouriteTv !== undefined) updateData.favouriteTv = data.favouriteTv;
      if (data.joyTriggers !== undefined) updateData.joyTriggers = data.joyTriggers;
      if (data.favouriteMemories !== undefined) updateData.favouriteMemories = data.favouriteMemories;
      if (data.favouriteFoods !== undefined) updateData.favouriteFoods = data.favouriteFoods;
      if (data.sportsTeams !== undefined) updateData.sportsTeams = data.sportsTeams;
      if (data.memories !== undefined) updateData.memories = data.memories;
      updateData.questionnaireStep = Math.max(step || 4, 4);
    }

    if (step === 5 || data.faithType) {
      if (data.faithType !== undefined) updateData.faithType = data.faithType;
      if (data.denomination !== undefined) updateData.denomination = data.denomination;
      if (data.faithComfort !== undefined) updateData.faithComfort = data.faithComfort;
      if (data.prayerReminders !== undefined) updateData.prayerReminders = data.prayerReminders;
      if (data.prayerTimes !== undefined) updateData.prayerTimes = data.prayerTimes;
      if (data.favouriteScriptures !== undefined) updateData.favouriteScriptures = data.favouriteScriptures;
      if (data.culturalBackground !== undefined) updateData.culturalBackground = data.culturalBackground;
      if (data.useGaelic !== undefined) updateData.useGaelic = data.useGaelic;
      if (data.languagePreference !== undefined) updateData.languagePreference = data.languagePreference;
      if (data.useReligious !== undefined) updateData.useReligious = data.useReligious;
      if (data.useScottish !== undefined) updateData.useScottish = data.useScottish;
      if (data.useWelsh !== undefined) updateData.useWelsh = data.useWelsh;
      if (data.useIrish !== undefined) updateData.useIrish = data.useIrish;
      if (data.faithPhrases !== undefined) updateData.faithPhrases = data.faithPhrases;
      updateData.questionnaireStep = Math.max(step || 5, 5);
    }

    if (step === 6 || data.dementiaStage) {
      if (data.dementiaStage !== undefined) updateData.dementiaStage = data.dementiaStage;
      if (data.mobilityLevel !== undefined) updateData.mobilityLevel = data.mobilityLevel;
      if (data.hearing !== undefined) updateData.hearing = data.hearing;
      if (data.vision !== undefined) updateData.vision = data.vision;
      if (data.communicationStyle !== undefined) updateData.communicationStyle = data.communicationStyle;
      if (data.bestTimeOfDay !== undefined) updateData.bestTimeOfDay = data.bestTimeOfDay;
      if (data.dietaryNeeds !== undefined) updateData.dietaryNeeds = data.dietaryNeeds;
      updateData.questionnaireStep = Math.max(step || 6, 6);
    }

    if (step === 7 || data.wardaBackstory) {
      if (data.wardaBackstory !== undefined) updateData.wardaBackstory = data.wardaBackstory;
      if (data.wardaAge !== undefined) updateData.wardaAge = data.wardaAge;
      if (data.wardaTraits !== undefined) updateData.wardaTraits = data.wardaTraits;
      if (data.greetingStyle !== undefined) updateData.greetingStyle = data.greetingStyle;
      if (data.conversationTopics !== undefined) updateData.conversationTopics = data.conversationTopics;
      if (data.hardBoundaries !== undefined) updateData.hardBoundaries = data.hardBoundaries;
      if (data.therapyGoals !== undefined) updateData.therapyGoals = data.therapyGoals;
      if (data.familyDetails !== undefined) updateData.familyDetails = data.familyDetails;
      updateData.questionnaireStep = 7;
      updateData.questionnaireComplete = true;
    }

    const profile = await prisma.residentProfile.update({
      where: { residentId: req.params.id },
      data: updateData
    });

    await logAudit(req.adminUser.id, 'UPDATE_PROFILE', 'ResidentProfile', profile.id,
      { step, fields: Object.keys(updateData) }, req.ip);

    res.json({
      success: true,
      profile,
      message: step === 7 ? 'Profile complete! Warda is ready.' : `Step ${step} saved.`
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// POST /api/admin/residents/:id/profile/generate-persona
router.post('/:id/profile/generate-persona', async (req, res) => {
  try {
    const profile = await prisma.residentProfile.findUnique({
      where: { residentId: req.params.id },
      include: {
        resident: {
          select: { firstName: true, lastName: true, preferredName: true, dateOfBirth: true }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const name = profile.resident.preferredName || profile.resident.firstName;
    const age = profile.resident.dateOfBirth
      ? Math.floor((Date.now() - new Date(profile.resident.dateOfBirth).getTime()) / 31557600000)
      : null;

    let backstory = "I'm Warda, your companion.";
    let traits = [];
    let greeting = `Hello ${name}, it's Warda!`;

    if (profile.maritalStatus === 'Widowed' && profile.spouseName) {
      backstory += ` I understand loss deeply.`;
      traits.push('widowed');
    } else if (profile.maritalStatus === 'Married') {
      backstory += ' I know how important family is.';
    }

    if (profile.previousCareer) {
      backstory += ` I have great respect for ${profile.previousCareer.toLowerCase()} work.`;
      traits.push(profile.previousCareer.toLowerCase());
    }

    if (profile.grewUpIn) {
      backstory += ` I have a soft spot for ${profile.grewUpIn}.`;
      traits.push(profile.grewUpIn);
    }

    if (profile.hobbies && profile.hobbies.length > 0) {
      const hobbyList = profile.hobbies.slice(0, 3).join(', ');
      backstory += ` I love ${hobbyList} too!`;
      traits.push(...profile.hobbies.slice(0, 3));
    }

    if (profile.faithType && profile.faithType !== 'None') {
      traits.push(profile.faithType);
      if (profile.faithComfort) {
        backstory += ` Faith gives me great comfort too.`;
      }
    }

    if (profile.useGaelic || profile.culturalBackground === 'Scottish') {
      greeting = `Madainn mhath, ${name}! It's Warda.`;
      traits.push('Scottish');
    } else if (profile.culturalBackground === 'Welsh') {
      greeting = `Bore da, ${name}! It's Warda.`;
      traits.push('Welsh');
    } else if (profile.culturalBackground === 'Irish') {
      greeting = `Dia duit, ${name}! It's Warda.`;
      traits.push('Irish');
    }

    let wardaAge = 'in her 60s';
    if (age) {
      if (age >= 90) wardaAge = 'in her 70s';
      else if (age >= 80) wardaAge = 'in her late 60s';
      else if (age >= 70) wardaAge = 'in her early 60s';
      else wardaAge = 'in her late 50s';
    }

    const conversationTopics = [
      ...(profile.joyTopics || []),
      ...(profile.hobbies || []),
      ...(profile.memories || [])
    ].slice(0, 10);

    const hardBoundaries = [...(profile.avoidTopics || [])];

    const updated = await prisma.residentProfile.update({
      where: { residentId: req.params.id },
      data: { wardaBackstory: backstory, wardaAge, wardaTraits: traits, greetingStyle: greeting, conversationTopics, hardBoundaries }
    });

    await logAudit(req.adminUser.id, 'GENERATE_PERSONA', 'ResidentProfile', updated.id, null, req.ip);

    res.json({
      success: true,
      persona: {
        backstory, age: wardaAge, traits, greeting, conversationTopics, hardBoundaries,
        previewMessage: `${greeting} Did you sleep well, dear?`
      }
    });
  } catch (error) {
    console.error('Generate persona error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate persona' });
  }
});

// GET /api/admin/residents/:id/profile/preview
router.get('/:id/profile/preview', async (req, res) => {
  try {
    const profile = await prisma.residentProfile.findUnique({
      where: { residentId: req.params.id },
      include: { resident: { select: { firstName: true, preferredName: true } } }
    });

    if (!profile || !profile.wardaBackstory) {
      return res.status(400).json({ success: false, error: 'Generate the persona first' });
    }

    const name = profile.resident.preferredName || profile.resident.firstName;
    const greeting = profile.greetingStyle || `Hello ${name}, it's Warda!`;

    const preview = [
      { sender: 'warda', text: greeting },
      { sender: 'warda', text: 'Did you sleep well, dear? I was thinking about you.' },
      { sender: 'resident', text: 'Hello Warda, I slept okay.' }
    ];

    if (profile.conversationTopics && profile.conversationTopics.length > 0) {
      preview.push({
        sender: 'warda',
        text: `That is good! Have you been doing any ${profile.conversationTopics[0]} lately?`
      });
    }

    res.json({
      success: true,
      preview,
      persona: {
        backstory: profile.wardaBackstory,
        age: profile.wardaAge,
        traits: profile.wardaTraits,
        hardBoundaries: profile.hardBoundaries
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

module.exports = router;

// POST /api/admin/residents/:id/reset-pin - Reset resident's PIN to 1234
router.post('/:id/reset-pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id } });
    
    if (!user) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    
    // Check access for non-super admins
    if (req.adminUser.role !== 'SUPER_ADMIN' && user.careHomeId !== req.careHomeId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.user.update({
      where: { id },
      data: {
        pin: '1234',
        pinResetAt: new Date(),
        pinResetBy: req.adminUser.id,
        pinChangedAt: null // Force PIN change on next login
      }
    });
    
    await logAudit(req.adminUser.id, 'RESET_PIN', 'User', id, { reason }, req.ip);
    
    res.json({ success: true, message: 'PIN reset to 1234. User will be prompted to change it on next login.' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});
