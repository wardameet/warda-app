/**
 * Questionnaire Template Management
 * Super Admin can add/remove/edit/reorder questions per step
 * Templates stored in QuestionnaireTemplate table
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { adminAuth, requireRole } = require('../../middleware/adminAuth');
const prisma = new PrismaClient();

// Default template - matches current 10-step hardcoded questionnaire
const DEFAULT_TEMPLATE = {
  name: 'Warda Standard Questionnaire',
  version: 1,
  steps: [
    { step: 1, name: 'Identity & Basics', icon: '👤', fields: [
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'preferredName', label: 'Preferred Name', type: 'text', placeholder: 'What they like to be called' },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'roomNumber', label: 'Room Number', type: 'text' },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Female','Male','Other','Prefer not to say'] },
      { key: 'nationality', label: 'Nationality', type: 'text', placeholder: 'e.g. British, Scottish' },
      { key: 'emergencyContact', label: 'Emergency Contact', type: 'text' },
      { key: 'emergencyPhone', label: 'Emergency Phone', type: 'text' },
      { key: 'photoUrl', label: 'Photo URL', type: 'text' },
    ]},
    { step: 2, name: 'Life Background', icon: '📖', fields: [
      { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single','Married','Widowed','Divorced','Separated','Partner'] },
      { key: 'spouseName', label: 'Spouse/Partner Name', type: 'text' },
      { key: 'previousCareer', label: 'Previous Career', type: 'text', placeholder: 'e.g. Teacher, Nurse' },
      { key: 'grewUpIn', label: 'Grew Up In', type: 'text', placeholder: 'e.g. Glasgow, rural Wales' },
      { key: 'education', label: 'Education', type: 'text', placeholder: 'e.g. Left school at 15, university' },
      { key: 'proudestAchievement', label: 'Proudest Achievement', type: 'text' },
      { key: 'spouseDetails', label: 'Spouse Details', type: 'textarea', placeholder: 'Anything about their partner' },
      { key: 'keyMemories', label: 'Key Life Memories', type: 'textarea', placeholder: 'Important memories, stories they love to tell' },
      { key: 'pets', label: 'Pets', type: 'text', placeholder: 'Current or past pets' },
    ]},
    { step: 3, name: 'Family Connections', icon: '👨‍👩‍👧', fields: [
      { key: 'children', label: 'Children', type: 'json', placeholder: 'Names, ages, where they live' },
      { key: 'grandchildren', label: 'Grandchildren', type: 'json', placeholder: 'Names, ages' },
      { key: 'familyDynamics', label: 'Family Dynamics', type: 'textarea', placeholder: 'Relationships, who visits, who calls' },
      { key: 'familyTopics', label: 'Family Topics They Enjoy', type: 'tags', placeholder: 'e.g. grandchildren, son\'s job' },
      { key: 'familyAvoidTopics', label: 'Family Topics to Avoid', type: 'tags', placeholder: 'e.g. estranged daughter' },
    ]},
    { step: 4, name: 'Sensitive Topics', icon: '⚠️', fields: [
      { key: 'avoidTopics', label: 'Topics to Avoid', type: 'tags', placeholder: 'Topics that upset them' },
      { key: 'sensitiveTopics', label: 'Handle With Care', type: 'tags', placeholder: 'Topics needing gentle approach' },
      { key: 'traumaNotes', label: 'Trauma Notes', type: 'textarea', placeholder: 'Any known trauma (confidential)' },
      { key: 'knownTriggers', label: 'Known Triggers', type: 'tags', placeholder: 'Situations that cause distress' },
      { key: 'bereavementStatus', label: 'Bereavement Status', type: 'textarea', placeholder: 'Recent losses, grief stage' },
      { key: 'endOfLifeWishes', label: 'End of Life Wishes', type: 'textarea', placeholder: 'If they have shared any wishes' },
    ]},
    { step: 5, name: 'Joy & Interests', icon: '😊', fields: [
      { key: 'joyTopics', label: 'Topics That Bring Joy', type: 'tags' },
      { key: 'hobbies', label: 'Hobbies & Interests', type: 'tags' },
      { key: 'favouriteMusic', label: 'Favourite Music', type: 'text', placeholder: 'Genres, artists, songs' },
      { key: 'favouriteTv', label: 'Favourite TV/Films', type: 'text' },
      { key: 'joyTriggers', label: 'What Makes Them Smile', type: 'tags' },
      { key: 'favouriteMemories', label: 'Favourite Memories', type: 'json', placeholder: 'Stories they love to revisit' },
      { key: 'favouriteFoods', label: 'Favourite Foods', type: 'text' },
      { key: 'traditionalSongs', label: 'Traditional Songs', type: 'text', placeholder: 'Songs from their culture/childhood' },
      { key: 'sportInterests', label: 'Sport Interests', type: 'text' },
      { key: 'bookInterests', label: 'Books/Reading', type: 'text' },
    ]},
    { step: 6, name: 'Faith & Culture', icon: '🕊️', fields: [
      { key: 'faithType', label: 'Faith/Religion', type: 'select', options: ['None/Secular','Islam (Sunni)','Islam (Shia)','Christianity (Catholic)','Christianity (Protestant)','Christianity (Orthodox)','Judaism','Sikhism','Hinduism','Buddhism','Other'] },
      { key: 'culturalBackground', label: 'Cultural Background', type: 'text', placeholder: 'e.g. Moroccan, Scottish Highland' },
      { key: 'languages', label: 'Languages Spoken', type: 'tags', placeholder: 'e.g. English, Arabic, Gaelic' },
      { key: 'prayerTimes', label: 'Prayer Times', type: 'json', placeholder: 'If applicable' },
      { key: 'religiousPractices', label: 'Religious Practices', type: 'textarea', placeholder: 'Daily prayers, dietary requirements, observances' },
      { key: 'culturalPreferences', label: 'Cultural Preferences', type: 'textarea', placeholder: 'Greetings, customs, dietary needs' },
      { key: 'favouriteScriptures', label: 'Favourite Scriptures/Texts', type: 'tags' },
    ]},
    { step: 7, name: 'Health & Wellbeing', icon: '🩺', fields: [
      { key: 'mobilityLevel', label: 'Mobility Level', type: 'select', options: ['Fully mobile','Walks with aid','Wheelchair','Bed-bound'] },
      { key: 'visionLevel', label: 'Vision', type: 'select', options: ['Good','Glasses needed','Poor vision','Registered blind'] },
      { key: 'hearingLevel', label: 'Hearing', type: 'select', options: ['Good','Hard of hearing','Hearing aid','Deaf'] },
      { key: 'cognitiveStatus', label: 'Cognitive Status', type: 'select', options: ['Clear','Mild forgetfulness','Early dementia','Moderate dementia','Advanced dementia'] },
      { key: 'medications', label: 'Medications', type: 'json', placeholder: 'Name, time, notes' },
      { key: 'healthConditions', label: 'Health Conditions', type: 'tags' },
      { key: 'sleepPattern', label: 'Sleep Pattern', type: 'text', placeholder: 'e.g. Light sleeper, up at 5am' },
      { key: 'painLevel', label: 'Usual Pain Level', type: 'select', options: ['None','Mild','Moderate','Severe'] },
      { key: 'dietaryRequirements', label: 'Dietary Requirements', type: 'tags', placeholder: 'Halal, vegetarian, soft food, thickened fluids' },
      { key: 'allergies', label: 'Allergies', type: 'tags' },
    ]},
    { step: 8, name: 'Communication Profile', icon: '💬', fields: [
      { key: 'communicationStyle', label: 'Communication Style', type: 'select', options: ['Chatty and social','Quiet but engaged','Minimal verbal','Non-verbal'] },
      { key: 'preferredLanguage', label: 'Preferred Language', type: 'text', placeholder: 'Language for Warda to speak' },
      { key: 'voicePreference', label: 'Voice Preference', type: 'select', options: ['Warm female','Warm male','Neutral'] },
      { key: 'humourStyle', label: 'Humour Style', type: 'select', options: ['Loves jokes','Dry wit','Gentle humour','Serious'] },
      { key: 'talkingSpeed', label: 'Preferred Talking Speed', type: 'select', options: ['Slow and clear','Normal pace','Quick'] },
      { key: 'repetitionTolerance', label: 'Repetition Tolerance', type: 'select', options: ['Happy to repeat','Patient with some','Gets frustrated'] },
      { key: 'touchPreference', label: 'Touch Preference', type: 'select', options: ['Welcomes touch','Cautious','Does not like being touched'] },
      { key: 'bestTimeToChat', label: 'Best Time to Chat', type: 'text', placeholder: 'e.g. Mornings are best' },
    ]},
    { step: 9, name: 'Daily Routines', icon: '🕐', fields: [
      { key: 'wakeUpTime', label: 'Wake Up Time', type: 'time' },
      { key: 'bedTime', label: 'Bed Time', type: 'time' },
      { key: 'morningRoutine', label: 'Morning Routine', type: 'textarea', placeholder: 'What they like to do in the morning' },
      { key: 'afternoonRoutine', label: 'Afternoon Routine', type: 'textarea' },
      { key: 'eveningRoutine', label: 'Evening Routine', type: 'textarea' },
      { key: 'mealtimePreferences', label: 'Mealtime Preferences', type: 'textarea', placeholder: 'When, where, what they like' },
      { key: 'napTime', label: 'Nap Time', type: 'text' },
      { key: 'outdoorPreference', label: 'Outdoor Preference', type: 'text', placeholder: 'Garden, walks, fresh air' },
      { key: 'socialPreference', label: 'Social Preference', type: 'select', options: ['Loves company','Small groups','One-on-one','Prefers alone time'] },
    ]},
    { step: 10, name: "Warda's Persona", icon: '🌹', fields: [
      { key: 'wardaRelationship', label: 'How Warda Should Feel', type: 'select', options: ['Like a friend','Like a granddaughter','Like a carer','Like a companion','Like a nurse'] },
      { key: 'wardaTone', label: "Warda's Tone", type: 'select', options: ['Warm and motherly','Professional and caring','Cheerful and upbeat','Calm and soothing','Playful'] },
      { key: 'wardaGreeting', label: 'Custom Greeting', type: 'text', placeholder: 'How Warda should greet them' },
      { key: 'wardaNickname', label: 'What They Call Warda', type: 'text', placeholder: 'e.g. Warda, Rose, Dear' },
      { key: 'specialInstructions', label: 'Special Instructions', type: 'textarea', placeholder: 'Anything else Warda should know' },
      { key: 'staffNotes', label: 'Staff Notes', type: 'textarea', placeholder: 'Internal notes (not shown to Warda)' },
    ]},
  ]
};

// Store template in memory (will persist to DB when QuestionnaireTemplate model added)
let currentTemplate = null;

async function getTemplate(careHomeId = null) {
  // Try DB first (DynamoDB-style using Prisma JSON or dedicated table)
  try {
    const stored = await prisma.$queryRaw`
      SELECT value FROM "SystemConfig" WHERE key = ${careHomeId ? `questionnaire_template_${careHomeId}` : 'questionnaire_template_default'}
    `;
    if (stored?.[0]?.value) return JSON.parse(stored[0].value);
  } catch (e) {
    // SystemConfig table may not exist yet - use default
  }
  
  if (currentTemplate) return currentTemplate;
  return { ...DEFAULT_TEMPLATE };
}

async function saveTemplate(template, careHomeId = null) {
  currentTemplate = template;
  const key = careHomeId ? `questionnaire_template_${careHomeId}` : 'questionnaire_template_default';
  try {
    await prisma.$executeRaw`
      INSERT INTO "SystemConfig" (key, value, "updatedAt") 
      VALUES (${key}, ${JSON.stringify(template)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(template)}, "updatedAt" = NOW()
    `;
  } catch (e) {
    console.log('SystemConfig table not available, template stored in memory only');
  }
}

// GET /api/admin/questionnaire-template — Get current template
router.get('/', adminAuth, async (req, res) => {
  try {
    const careHomeId = req.query.careHomeId || null;
    const template = await getTemplate(careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ success: false, error: 'Failed to get template' });
  }
});

// PUT /api/admin/questionnaire-template — Update full template
router.put('/', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { template, careHomeId } = req.body;
    if (!template || !template.steps) {
      return res.status(400).json({ success: false, error: 'Invalid template' });
    }
    template.version = (template.version || 1) + 1;
    template.updatedAt = new Date().toISOString();
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// POST /api/admin/questionnaire-template/step — Add a new step
router.post('/step', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, icon, position, careHomeId } = req.body;
    const template = await getTemplate(careHomeId);
    const newStep = { step: position || template.steps.length + 1, name, icon: icon || '📝', fields: [] };
    if (position && position <= template.steps.length) {
      template.steps.splice(position - 1, 0, newStep);
      template.steps.forEach((s, i) => s.step = i + 1);
    } else {
      template.steps.push(newStep);
    }
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add step' });
  }
});

// DELETE /api/admin/questionnaire-template/step/:stepNumber — Remove a step
router.delete('/step/:stepNumber', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const stepNum = parseInt(req.params.stepNumber);
    const careHomeId = req.query.careHomeId || null;
    const template = await getTemplate(careHomeId);
    template.steps = template.steps.filter(s => s.step !== stepNum);
    template.steps.forEach((s, i) => s.step = i + 1);
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove step' });
  }
});

// POST /api/admin/questionnaire-template/step/:stepNumber/field — Add field to step
router.post('/step/:stepNumber/field', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const stepNum = parseInt(req.params.stepNumber);
    const { key, label, type, placeholder, required, options, careHomeId } = req.body;
    const template = await getTemplate(careHomeId);
    const step = template.steps.find(s => s.step === stepNum);
    if (!step) return res.status(404).json({ success: false, error: 'Step not found' });
    if (step.fields.some(f => f.key === key)) return res.status(409).json({ success: false, error: 'Field key already exists' });
    step.fields.push({ key, label, type: type || 'text', placeholder, required: required || false, options });
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add field' });
  }
});

// PUT /api/admin/questionnaire-template/step/:stepNumber/field/:fieldKey — Edit field
router.put('/step/:stepNumber/field/:fieldKey', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const stepNum = parseInt(req.params.stepNumber);
    const { fieldKey } = req.params;
    const { label, type, placeholder, required, options, careHomeId } = req.body;
    const template = await getTemplate(careHomeId);
    const step = template.steps.find(s => s.step === stepNum);
    if (!step) return res.status(404).json({ success: false, error: 'Step not found' });
    const field = step.fields.find(f => f.key === fieldKey);
    if (!field) return res.status(404).json({ success: false, error: 'Field not found' });
    if (label) field.label = label;
    if (type) field.type = type;
    if (placeholder !== undefined) field.placeholder = placeholder;
    if (required !== undefined) field.required = required;
    if (options) field.options = options;
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to edit field' });
  }
});

// DELETE /api/admin/questionnaire-template/step/:stepNumber/field/:fieldKey — Remove field
router.delete('/step/:stepNumber/field/:fieldKey', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const stepNum = parseInt(req.params.stepNumber);
    const { fieldKey } = req.params;
    const careHomeId = req.query.careHomeId || null;
    const template = await getTemplate(careHomeId);
    const step = template.steps.find(s => s.step === stepNum);
    if (!step) return res.status(404).json({ success: false, error: 'Step not found' });
    step.fields = step.fields.filter(f => f.key !== fieldKey);
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove field' });
  }
});

// PUT /api/admin/questionnaire-template/step/:stepNumber/reorder — Reorder fields
router.put('/step/:stepNumber/reorder', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const stepNum = parseInt(req.params.stepNumber);
    const { fieldKeys, careHomeId } = req.body;
    const template = await getTemplate(careHomeId);
    const step = template.steps.find(s => s.step === stepNum);
    if (!step) return res.status(404).json({ success: false, error: 'Step not found' });
    const reordered = fieldKeys.map(key => step.fields.find(f => f.key === key)).filter(Boolean);
    const remaining = step.fields.filter(f => !fieldKeys.includes(f.key));
    step.fields = [...reordered, ...remaining];
    await saveTemplate(template, careHomeId);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reorder fields' });
  }
});

// POST /api/admin/questionnaire-template/reset — Reset to default
router.post('/reset', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { careHomeId } = req.body;
    await saveTemplate({ ...DEFAULT_TEMPLATE }, careHomeId);
    res.json({ success: true, template: DEFAULT_TEMPLATE });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset template' });
  }
});

module.exports = router;
