/**
 * Admin Resident Routes
 * CRUD for residents + 10-step therapeutic questionnaire/profile
 * Updated: Feb 2026 — Enhanced questionnaire with Claude AI persona generation
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { adminAuth, requireRole, scopeToCareHome, logAudit } = require('../../middleware/adminAuth');

const prisma = require('../../lib/prisma');

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
      firstName, lastName, preferredName, dateOfBirth, languagePreference,
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
        languagePreference: languagePreference || "English",
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
      firstName, lastName, preferredName, dateOfBirth, languagePreference,
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

// =============== 10-STEP THERAPEUTIC QUESTIONNAIRE ===============

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

// PUT /api/admin/residents/:id/profile — 10-STEP QUESTIONNAIRE SAVE
router.put('/:id/profile', async (req, res) => {
  try {
    const { step, data } = req.body;
    let updateData = {};

    // Step 1: Identity & Basics
    if (step === 1 || data.firstName) {
      const userUpdate = {};
      if (data.firstName) userUpdate.firstName = data.firstName;
      if (data.lastName) userUpdate.lastName = data.lastName;
      if (data.preferredName !== undefined) userUpdate.preferredName = data.preferredName;
      if (data.dateOfBirth) userUpdate.dateOfBirth = new Date(data.dateOfBirth);
      if (data.roomNumber !== undefined) userUpdate.roomNumber = data.roomNumber;
      if (data.photoUrl !== undefined) userUpdate.photoUrl = data.photoUrl;
      if (data.moveInDate) userUpdate.moveInDate = new Date(data.moveInDate);
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({ where: { id: req.params.id }, data: userUpdate });
      }
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.nationality !== undefined) updateData.nationality = data.nationality;
      if (data.languagesSpoken !== undefined) updateData.languagesSpoken = data.languagesSpoken;
      if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;
      if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone;
      updateData.questionnaireStep = Math.max(step || 1, 1);
    }

    // Step 2: Life Story
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
      if (data.education !== undefined) updateData.education = data.education;
      if (data.militaryService !== undefined) updateData.militaryService = data.militaryService;
      if (data.militaryBranch !== undefined) updateData.militaryBranch = data.militaryBranch;
      if (data.importantDates !== undefined) updateData.importantDates = data.importantDates;
      if (data.proudestAchievement !== undefined) updateData.proudestAchievement = data.proudestAchievement;
      if (data.missesAboutOldLife !== undefined) updateData.missesAboutOldLife = data.missesAboutOldLife;
      if (data.placesLived !== undefined) updateData.placesLived = data.placesLived;
      updateData.questionnaireStep = Math.max(step || 2, 2);
    }

    // Step 3: Family Connections
    if (step === 3) {
      if (data.familyTree !== undefined) updateData.familyTree = data.familyTree;
      if (data.primaryFamilyContact !== undefined) updateData.primaryFamilyContact = data.primaryFamilyContact;
      if (data.familyDynamicsNotes !== undefined) updateData.familyDynamicsNotes = data.familyDynamicsNotes;
      if (data.favouriteFamilyMember !== undefined) updateData.favouriteFamilyMember = data.favouriteFamilyMember;
      if (data.familyNicknames !== undefined) updateData.familyNicknames = data.familyNicknames;
      if (data.familyDetails !== undefined) updateData.familyDetails = data.familyDetails;
      updateData.questionnaireStep = Math.max(step, 3);
    }

    // Step 4: Sensitive Topics & Boundaries
    if (step === 4 || data.avoidTopics) {
      if (data.avoidTopics !== undefined) updateData.avoidTopics = data.avoidTopics;
      if (data.sensitiveTopics !== undefined) updateData.sensitiveTopics = data.sensitiveTopics;
      if (data.traumaNotes !== undefined) updateData.traumaNotes = data.traumaNotes;
      if (data.knownTriggers !== undefined) updateData.knownTriggers = data.knownTriggers;
      if (data.bereavementStatus !== undefined) updateData.bereavementStatus = data.bereavementStatus;
      if (data.lossTimeline !== undefined) updateData.lossTimeline = data.lossTimeline;
      if (data.confusionTriggers !== undefined) updateData.confusionTriggers = data.confusionTriggers;
      if (data.anxietyTriggers !== undefined) updateData.anxietyTriggers = data.anxietyTriggers;
      if (data.sundowningPatterns !== undefined) updateData.sundowningPatterns = data.sundowningPatterns;
      if (data.redirectionStrategies !== undefined) updateData.redirectionStrategies = data.redirectionStrategies;
      if (data.safeRedirectTopics !== undefined) updateData.safeRedirectTopics = data.safeRedirectTopics;
      updateData.questionnaireStep = Math.max(step || 4, 4);
    }

    // Step 5: Joy & Interests
    if (step === 5 || data.hobbies) {
      if (data.joyTopics !== undefined) updateData.joyTopics = data.joyTopics;
      if (data.hobbies !== undefined) updateData.hobbies = data.hobbies;
      if (data.favouriteMusic !== undefined) updateData.favouriteMusic = data.favouriteMusic;
      if (data.favouriteTv !== undefined) updateData.favouriteTv = data.favouriteTv;
      if (data.joyTriggers !== undefined) updateData.joyTriggers = data.joyTriggers;
      if (data.favouriteMemories !== undefined) updateData.favouriteMemories = data.favouriteMemories;
      if (data.favouriteFoods !== undefined) updateData.favouriteFoods = data.favouriteFoods;
      if (data.sportsTeams !== undefined) updateData.sportsTeams = data.sportsTeams;
      if (data.memories !== undefined) updateData.memories = data.memories;
      if (data.favouriteRadio !== undefined) updateData.favouriteRadio = data.favouriteRadio;
      if (data.favouriteBooks !== undefined) updateData.favouriteBooks = data.favouriteBooks;
      if (data.favouriteGames !== undefined) updateData.favouriteGames = data.favouriteGames;
      if (data.dailyRoutines !== undefined) updateData.dailyRoutines = data.dailyRoutines;
      if (data.socialPreference !== undefined) updateData.socialPreference = data.socialPreference;
      if (data.conversationStarters !== undefined) updateData.conversationStarters = data.conversationStarters;
      if (data.thingsThatMakeLaugh !== undefined) updateData.thingsThatMakeLaugh = data.thingsThatMakeLaugh;
      if (data.favouritePlaces !== undefined) updateData.favouritePlaces = data.favouritePlaces;
      if (data.bucketList !== undefined) updateData.bucketList = data.bucketList;
      updateData.questionnaireStep = Math.max(step || 5, 5);
    }

    // Step 6: Faith, Culture & Identity
    if (step === 6 || data.faithType) {
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
      if (data.religiousCelebrations !== undefined) updateData.religiousCelebrations = data.religiousCelebrations;
      if (data.culturalFoods !== undefined) updateData.culturalFoods = data.culturalFoods;
      if (data.traditionalSongs !== undefined) updateData.traditionalSongs = data.traditionalSongs;
      if (data.culturalPractices !== undefined) updateData.culturalPractices = data.culturalPractices;
      if (data.politicalGuidance !== undefined) updateData.politicalGuidance = data.politicalGuidance;
      if (data.historicalEvents !== undefined) updateData.historicalEvents = data.historicalEvents;
      if (data.dialectWords !== undefined) updateData.dialectWords = data.dialectWords;
      updateData.questionnaireStep = Math.max(step || 6, 6);
    }

    // Step 7: Health & Wellbeing
    if (step === 7 || data.dementiaStage) {
      if (data.dementiaStage !== undefined) updateData.dementiaStage = data.dementiaStage;
      if (data.mobilityLevel !== undefined) updateData.mobilityLevel = data.mobilityLevel;
      if (data.hearing !== undefined) updateData.hearing = data.hearing;
      if (data.vision !== undefined) updateData.vision = data.vision;
      if (data.communicationStyle !== undefined) updateData.communicationStyle = data.communicationStyle;
      if (data.bestTimeOfDay !== undefined) updateData.bestTimeOfDay = data.bestTimeOfDay;
      if (data.dietaryNeeds !== undefined) updateData.dietaryNeeds = data.dietaryNeeds;
      if (data.medications !== undefined) updateData.medications = data.medications;
      if (data.sleepPattern !== undefined) updateData.sleepPattern = data.sleepPattern;
      if (data.painManagement !== undefined) updateData.painManagement = data.painManagement;
      if (data.moodPatterns !== undefined) updateData.moodPatterns = data.moodPatterns;
      if (data.appetite !== undefined) updateData.appetite = data.appetite;
      if (data.fallRisk !== undefined) updateData.fallRisk = data.fallRisk;
      if (data.allergies !== undefined) updateData.allergies = data.allergies;
      if (data.gpName !== undefined) updateData.gpName = data.gpName;
      if (data.gpPractice !== undefined) updateData.gpPractice = data.gpPractice;
      updateData.questionnaireStep = Math.max(step || 7, 7);
    }

    // Step 8: Communication Profile
    if (step === 8) {
      if (data.voicePreference !== undefined) updateData.voicePreference = data.voicePreference;
      if (data.responseLengthPref !== undefined) updateData.responseLengthPref = data.responseLengthPref;
      if (data.humourStyle !== undefined) updateData.humourStyle = data.humourStyle;
      if (data.formalityLevel !== undefined) updateData.formalityLevel = data.formalityLevel;
      if (data.discomfortSigns !== undefined) updateData.discomfortSigns = data.discomfortSigns;
      if (data.happinessExpressions !== undefined) updateData.happinessExpressions = data.happinessExpressions;
      if (data.conversationPace !== undefined) updateData.conversationPace = data.conversationPace;
      if (data.repetitionHandling !== undefined) updateData.repetitionHandling = data.repetitionHandling;
      if (data.conversationEnding !== undefined) updateData.conversationEnding = data.conversationEnding;
      updateData.questionnaireStep = Math.max(step, 8);
    }

    // Step 9: Daily Life & Routines
    if (step === 9) {
      if (data.wakeUpTime !== undefined) updateData.wakeUpTime = data.wakeUpTime;
      if (data.bedTime !== undefined) updateData.bedTime = data.bedTime;
      if (data.mealTimes !== undefined) updateData.mealTimes = data.mealTimes;
      if (data.medicationSchedule !== undefined) updateData.medicationSchedule = data.medicationSchedule;
      if (data.tvSchedule !== undefined) updateData.tvSchedule = data.tvSchedule;
      if (data.activitySchedule !== undefined) updateData.activitySchedule = data.activitySchedule;
      if (data.visitorPatterns !== undefined) updateData.visitorPatterns = data.visitorPatterns;
      if (data.checkInTimes !== undefined) updateData.checkInTimes = data.checkInTimes;
      if (data.weatherInterest !== undefined) updateData.weatherInterest = data.weatherInterest;
      if (data.newsPreference !== undefined) updateData.newsPreference = data.newsPreference;
      updateData.questionnaireStep = Math.max(step, 9);
    }

    // Step 10: Warda's Persona (AI-generated)
    if (step === 10 || data.wardaBackstory) {
      if (data.wardaBackstory !== undefined) updateData.wardaBackstory = data.wardaBackstory;
      if (data.wardaAge !== undefined) updateData.wardaAge = data.wardaAge;
      if (data.wardaTraits !== undefined) updateData.wardaTraits = data.wardaTraits;
      if (data.greetingStyle !== undefined) updateData.greetingStyle = data.greetingStyle;
      if (data.conversationTopics !== undefined) updateData.conversationTopics = data.conversationTopics;
      if (data.hardBoundaries !== undefined) updateData.hardBoundaries = data.hardBoundaries;
      if (data.therapyGoals !== undefined) updateData.therapyGoals = data.therapyGoals;
      if (data.familyDetails !== undefined) updateData.familyDetails = data.familyDetails;
      if (data.morningGreetings !== undefined) updateData.morningGreetings = data.morningGreetings;
      if (data.afternoonGreetings !== undefined) updateData.afternoonGreetings = data.afternoonGreetings;
      if (data.eveningGreetings !== undefined) updateData.eveningGreetings = data.eveningGreetings;
      if (data.nightGreetings !== undefined) updateData.nightGreetings = data.nightGreetings;
      if (data.comfortPhrases !== undefined) updateData.comfortPhrases = data.comfortPhrases;
      if (data.proactiveTopics !== undefined) updateData.proactiveTopics = data.proactiveTopics;
      if (data.healthConcernResponses !== undefined) updateData.healthConcernResponses = data.healthConcernResponses;
      updateData.questionnaireStep = 10;
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
      message: step === 10 ? 'Profile complete! Warda is now personalised.' : `Step ${step} saved.`
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// POST /api/admin/residents/:id/profile/generate-persona — CLAUDE AI POWERED
router.post('/:id/profile/generate-persona', async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const profile = await prisma.residentProfile.findUnique({
      where: { residentId: req.params.id },
      include: {
        resident: {

          include: { familyContacts: true, careHome: true }
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

    // Build comprehensive profile summary for Claude
    const profileSummary = {
      name, age,
      fullName: profile.resident.firstName + ' ' + profile.resident.lastName,
      gender: profile.gender,
      roomNumber: profile.resident.roomNumber,
      careHome: profile.resident.careHome?.name,
      nationality: profile.nationality,
      culturalBackground: profile.culturalBackground,
      maritalStatus: profile.maritalStatus,
      spouseName: profile.spouseName,
      spouseDetails: profile.spouseDetails,
      previousCareer: profile.previousCareer,
      education: profile.education,
      grewUpIn: profile.grewUpIn,
      militaryService: profile.militaryService,
      placesLived: profile.placesLived,
      proudestAchievement: profile.proudestAchievement,
      missesAboutOldLife: profile.missesAboutOldLife,
      children: profile.children,
      grandchildren: profile.grandchildren,
      familyTree: profile.familyTree,
      favouriteFamilyMember: profile.favouriteFamilyMember,
      familyContacts: profile.resident.familyContacts?.map(function(fc) { return fc.name + ' (' + fc.relationship + ')'; }),
      pets: profile.pets,
      keyMemories: profile.keyMemories,
      avoidTopics: profile.avoidTopics,
      sensitiveTopics: profile.sensitiveTopics,
      knownTriggers: profile.knownTriggers,
      bereavementStatus: profile.bereavementStatus,
      safeRedirectTopics: profile.safeRedirectTopics,
      hobbies: profile.hobbies,
      favouriteMusic: profile.favouriteMusic,
      favouriteTv: profile.favouriteTv,
      favouriteFoods: profile.favouriteFoods,
      sportsTeams: profile.sportsTeams,
      favouriteBooks: profile.favouriteBooks,
      favouriteGames: profile.favouriteGames,
      conversationStarters: profile.conversationStarters,
      thingsThatMakeLaugh: profile.thingsThatMakeLaugh,
      favouritePlaces: profile.favouritePlaces,
      faithType: profile.faithType,
      denomination: profile.denomination,
      faithComfort: profile.faithComfort,
      useGaelic: profile.useGaelic,
      useScottish: profile.useScottish,
      culturalFoods: profile.culturalFoods,
      traditionalSongs: profile.traditionalSongs,
      historicalEvents: profile.historicalEvents,
      dementiaStage: profile.dementiaStage,
      hearing: profile.hearing,
      communicationStyle: profile.communicationStyle,
      humourStyle: profile.humourStyle,
      formalityLevel: profile.formalityLevel,
      responseLengthPref: profile.responseLengthPref,
      conversationPace: profile.conversationPace,
      sleepPattern: profile.sleepPattern,
      wakeUpTime: profile.wakeUpTime,
      bedTime: profile.bedTime
    };

    // Remove null/empty values
    Object.keys(profileSummary).forEach(function(k) {
      if (profileSummary[k] === null || profileSummary[k] === undefined || profileSummary[k] === '' ||
          (Array.isArray(profileSummary[k]) && profileSummary[k].length === 0)) {
        delete profileSummary[k];
      }
    });

    var claudePrompt = 'Generate Warda\'s persona for this resident:\n\n' + JSON.stringify(profileSummary, null, 2);
    claudePrompt += '\n\nReturn JSON with these exact keys:\n';
    claudePrompt += '{\n';
    claudePrompt += '  "backstory": "A 2-3 paragraph backstory for Warda that shares relatable experiences with the resident. If widowed, Warda understands loss. If Scottish, Warda has Scottish connections. Make it warm and specific.",\n';
    claudePrompt += '  "age": "Warda\'s presented age (e.g. \'in her late 60s\')",\n';
    claudePrompt += '  "traits": ["list", "of", "5-8", "personality", "traits"],\n';
    claudePrompt += '  "morningGreetings": ["3 personalised morning greetings using their name"],\n';
    claudePrompt += '  "afternoonGreetings": ["3 personalised afternoon greetings"],\n';
    claudePrompt += '  "eveningGreetings": ["3 personalised evening greetings"],\n';
    claudePrompt += '  "nightGreetings": ["3 personalised late night greetings - gentle, not alarmed"],\n';
    claudePrompt += '  "comfortPhrases": ["5 phrases to use when the resident is sad or distressed"],\n';
    claudePrompt += '  "proactiveTopics": ["8-10 topics Warda should bring up when conversation is quiet"],\n';
    claudePrompt += '  "healthConcernResponses": ["3 gentle ways to respond if resident mentions pain or feeling unwell"],\n';
    claudePrompt += '  "conversationTopics": ["10 specific conversation starters based on their life"],\n';
    claudePrompt += '  "hardBoundaries": ["topics to NEVER bring up - from avoidTopics and sensitiveTopics"]\n';
    claudePrompt += '}';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are a persona designer for Warda, an AI companion for elderly care home residents. Based on the resident profile provided, generate a rich, personalised persona for Warda to adopt when speaking with this resident. Respond ONLY in valid JSON format with no markdown or extra text.',
      messages: [{ role: 'user', content: claudePrompt }]
    });

    var persona;
    try {
      var text = response.content[0].text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      persona = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse Claude persona response:', parseErr);
      console.error('Raw response:', response.content[0].text);
      return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
    }

    // Save generated persona
    var updated = await prisma.residentProfile.update({
      where: { residentId: req.params.id },
      data: {
        wardaBackstory: persona.backstory,
        wardaAge: persona.age,
        wardaTraits: persona.traits || [],
        greetingStyle: (persona.morningGreetings && persona.morningGreetings[0]) || ('Good morning, ' + name + '! It\'s Warda here.'),
        morningGreetings: persona.morningGreetings || [],
        afternoonGreetings: persona.afternoonGreetings || [],
        eveningGreetings: persona.eveningGreetings || [],
        nightGreetings: persona.nightGreetings || [],
        comfortPhrases: persona.comfortPhrases || [],
        proactiveTopics: persona.proactiveTopics || [],
        healthConcernResponses: persona.healthConcernResponses || [],
        conversationTopics: persona.conversationTopics || [],
        hardBoundaries: persona.hardBoundaries || []
      }
    });

    await logAudit(req.adminUser.id, 'GENERATE_PERSONA', 'ResidentProfile', updated.id, null, req.ip);

    res.json({ success: true, persona: persona });
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
    const hour = new Date().getHours();
    var greetings = profile.morningGreetings;
    if (hour >= 12 && hour < 17) greetings = profile.afternoonGreetings;
    else if (hour >= 17 && hour < 21) greetings = profile.eveningGreetings;
    else if (hour >= 21 || hour < 6) greetings = profile.nightGreetings;

    var greeting = (greetings && greetings.length > 0)
      ? greetings[Math.floor(Math.random() * greetings.length)]
      : (profile.greetingStyle || ('Hello ' + name + ', it\'s Warda!'));

    const preview = [
      { sender: 'warda', text: greeting },
      { sender: 'warda', text: 'Did you sleep well, dear? I was thinking about you.' },
      { sender: 'resident', text: 'Hello Warda, I slept okay.' }
    ];

    if (profile.conversationTopics && profile.conversationTopics.length > 0) {
      preview.push({
        sender: 'warda',
        text: 'That is good! ' + profile.conversationTopics[Math.floor(Math.random() * profile.conversationTopics.length)]
      });
    }

    res.json({
      success: true,
      preview: preview,
      persona: {
        backstory: profile.wardaBackstory,
        age: profile.wardaAge,
        traits: profile.wardaTraits,
        hardBoundaries: profile.hardBoundaries,
        morningGreetings: profile.morningGreetings,
        afternoonGreetings: profile.afternoonGreetings,
        eveningGreetings: profile.eveningGreetings,
        nightGreetings: profile.nightGreetings,
        comfortPhrases: profile.comfortPhrases,
        proactiveTopics: profile.proactiveTopics
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

// POST /api/admin/residents/:id/reset-pin
router.post('/:id/reset-pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    if (req.adminUser.role !== 'SUPER_ADMIN' && user.careHomeId !== req.careHomeId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.user.update({
      where: { id },
      data: {
        pin: '1234',
        pinResetAt: new Date(),
        pinResetBy: req.adminUser.id,
        pinChangedAt: null
      }
    });

    await logAudit(req.adminUser.id, 'RESET_PIN', 'User', id, { reason }, req.ip);

    res.json({ success: true, message: 'PIN reset to 1234. User will be prompted to change it on next login.' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

module.exports = router;
