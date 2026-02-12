const { verifyEmail } = require("../services/sesVerifier");
/**
 * Family Routes
 * Public-facing API for family members
 * Separate from admin routes - uses family auth
 */
var express = require('express');
var router = express.Router();
var PrismaClient = require('@prisma/client').PrismaClient;
var CognitoIdentityProviderClient = require('@aws-sdk/client-cognito-identity-provider').CognitoIdentityProviderClient;
var InitiateAuthCommand = require('@aws-sdk/client-cognito-identity-provider').InitiateAuthCommand;
var SignUpCommand = require('@aws-sdk/client-cognito-identity-provider').SignUpCommand;
var ConfirmSignUpCommand = require('@aws-sdk/client-cognito-identity-provider').ConfirmSignUpCommand;
var jwt = require('jsonwebtoken');
var jwksClient = require('jwks-rsa');

var prisma = require('../lib/prisma');
var cognito = new CognitoIdentityProviderClient({ region: 'eu-west-2' });
var USER_POOL_ID = 'eu-west-2_sozTMWhUG';
var CLIENT_ID = '6ktpvr06ac5dfig41s6394l25';

// JWKS client for token verification
var jwks = jwksClient({
  jwksUri: 'https://cognito-idp.eu-west-2.amazonaws.com/' + USER_POOL_ID + '/.well-known/jwks.json',
  cache: true
});

// Family auth middleware
async function familyAuth(req, res, next) {
  try {
    var authHeader = req.headers.authorization;
    if (authHeader === undefined || authHeader === null || authHeader === '') {
      return res.status(401).json({ success: false, error: 'No token' });
    }
    var token = authHeader.replace('Bearer ', '');
    var decoded = jwt.decode(token, { complete: true });
    if (decoded === null || decoded === undefined) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    var email = null;

    // Try Cognito JWKS verification first
    if (decoded.header && decoded.header.kid) {
      try {
        var key = await jwks.getSigningKey(decoded.header.kid);
        var verified = jwt.verify(token, key.getPublicKey());
        email = verified.email || verified['cognito:username'];
      } catch (jwksErr) {
        console.log('JWKS verify failed, trying local JWT...');
      }
    }

    // Fallback: local JWT (from bcrypt login)
    if (email === null || email === undefined) {
      try {
        var localVerified = jwt.verify(token, process.env.JWT_SECRET || 'warda-family-secret-2026');
        email = localVerified.email;
      } catch (localErr) {
        return res.status(401).json({ success: false, error: 'Authentication failed' });
      }
    }

    if (email === null || email === undefined) {
      return res.status(401).json({ success: false, error: 'No email in token' });
    }

    var familyContact = await prisma.familyContact.findFirst({
      where: { email: email.toLowerCase() },
      include: { user: { include: { careHome: true } } }
    });
    if (familyContact === null || familyContact === undefined) {
      return res.status(403).json({ success: false, error: 'Not a registered family member' });
    }
    req.family = familyContact;
    req.family.resident = familyContact.user;
    req.family.residentId = familyContact.userId;
    req.familyEmail = email;
    next();
  } catch (err) {
    console.error('Family auth error:', err.message);
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

// ─── Registration ──────────────────────────────────────────────

// Register family member (Cognito signup)
router.post('/register', async function(req, res) {
  try {
    var email = req.body.email;
    var password = req.body.password;
    var name = req.body.name;
    var inviteCode = req.body.inviteCode;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password and name required' });
    }

    // Check if this email has a family contact invitation
    var familyContact = await prisma.familyContact.findFirst({
      where: { email: email.toLowerCase() }
    });
    if (!familyContact) {
      return res.status(404).json({ success: false, error: 'No invitation found for this email. Please ask the care home to invite you first.' });
    }

    // Create Cognito account
    var signUpCmd = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name }
      ]
    });
    var result = await cognito.send(signUpCmd);

    // Update family contact with cognito sub
    await prisma.familyContact.update({
      where: { id: familyContact.id },
      data: {
        cognitoSub: result.UserSub,
        inviteStatus: 'ACCEPTED',
        name: name
      }
    });

    res.json({
      success: true,
      message: 'Account created. Please check your email for verification code.',
      needsVerification: !result.UserConfirmed
    });
  } catch (err) {
    console.error('Family registration error:', err);
    if (err.name === 'UsernameExistsException') {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please login.' });
    }
    res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
});

// Verify email with code
router.post('/verify', async function(req, res) {
  try {
    var email = req.body.email;
    var code = req.body.code;
    var cmd = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    });
    await cognito.send(cmd);
    res.json({ success: true, message: 'Email verified. You can now login.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Verification failed' });
  }
});

// Login
router.post('/login', async function(req, res) {
  try {
    var email = req.body.email;
    var password = req.body.password;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

    var accessToken = null;
    var refreshToken = null;
    var idToken = null;

    // Try Cognito first
    try {
      var cmd = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password }
      });
      var result = await cognito.send(cmd);
      if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return res.json({ success: true, challenge: 'NEW_PASSWORD_REQUIRED', session: result.Session });
      }
      accessToken = result.AuthenticationResult.AccessToken;
      refreshToken = result.AuthenticationResult.RefreshToken;
      idToken = result.AuthenticationResult.IdToken;
    } catch (cognitoErr) {
      // Cognito failed — try local bcrypt fallback via AdminUser table
      console.log('Cognito failed for family, trying local fallback for:', email);
      var bcrypt = require('bcryptjs');
      var jwt = require('jsonwebtoken');
      var adminUser = await prisma.adminUser.findFirst({ where: { email: email.toLowerCase() } });
      if (adminUser && adminUser.tempPassword) {
        var match = await bcrypt.compare(password, adminUser.tempPassword);
        if (match) {
          accessToken = jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role }, process.env.JWT_SECRET || 'warda-family-secret-2026', { expiresIn: '7d' });
          refreshToken = accessToken;
          idToken = accessToken;
        } else {
          return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
      } else {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
    }

    // Find family contact — relation is "user" not "resident"
    var familyContact = await prisma.familyContact.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        user: {
          include: { careHome: true }
        }
      }
    });

    var residentData = familyContact ? familyContact.user : null;

    res.json({
      success: true,
      tokens: { accessToken, refreshToken, idToken },
      family: {
        id: familyContact ? familyContact.id : null,
        name: familyContact ? familyContact.name : null,
        email: email,
        relationship: familyContact ? familyContact.relationship : null,
        isPrimary: familyContact ? familyContact.isPrimary : false,
        residentName: residentData ? (residentData.preferredName || residentData.firstName) + ' ' + residentData.lastName : null,
        residentId: residentData ? residentData.id : null,
        careHomeName: residentData && residentData.careHome ? residentData.careHome.name : null
      }
    });
  } catch (err) {
    console.error('Family login error:', err);
    res.status(401).json({ success: false, error: 'Invalid email or password' });
  }
});


// ─── Dashboard Data (requires auth) ───────────────────────────

// Get resident status and summary
router.get('/dashboard', familyAuth, async function(req, res) {
  try {
    var resident = await prisma.user.findUnique({
      where: { id: req.family.residentId },
      include: {
        careHome: true,
        profile: true
      }
    });

    // Get recent conversations count
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get recent alerts
    var alerts = await prisma.alert.findMany({
      where: { userId: req.family.residentId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get family messages
    var messages = await prisma.familyMessage ? await prisma.familyMessage.findMany({
      where: { residentId: req.family.residentId },
      orderBy: { createdAt: 'desc' },
      take: 10
    }) : [];

    res.json({
      success: true,
      dashboard: {
        resident: {
          name: (resident.preferredName || resident.firstName) + ' ' + resident.lastName,
          roomNumber: resident.roomNumber,
          status: resident.status,
          careHomeName: resident.careHome ? resident.careHome.name : null,
          photoUrl: resident.photoUrl
        },
        profile: {
          complete: resident.profile ? resident.profile.questionnaireComplete : false,
          wardaBackstory: resident.profile ? resident.profile.wardaBackstory : null,
          greetingStyle: resident.profile ? resident.profile.greetingStyle : null
        },
        alerts: alerts.map(function(a) {
          return {
            id: a.id,
            type: a.type,
            severity: a.severity,
            title: a.title,
            status: a.status,
            createdAt: a.createdAt
          };
        }),
        messages: messages,
        family: {
          name: req.family.name,
          relationship: req.family.relationship,
          isPrimary: req.family.isPrimary
        }
      }
    });
  } catch (err) {
    console.error('Family dashboard error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

// Get conversation summaries (NOT full transcripts - privacy)
router.get('/conversations', familyAuth, async function(req, res) {
  try {
    var conversations = await prisma.conversation.findMany({
      where: { userId: req.family.residentId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        mood: true,
        summary: true,
        messageCount: true
      }
    });
    res.json({ success: true, conversations: conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load conversations' });
  }
});

// Send message to resident (Warda will read it out)
router.post('/messages', familyAuth, async function(req, res) {
  try {
    var messageText = req.body.message;
    var messageType = req.body.type || 'TEXT';

    if (!messageText) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Store in a simple way - we can create FamilyMessage table later
    // For now, store as an alert that Warda can read
    var msg = await prisma.alert.create({
      data: {
        userId: req.family.residentId,
        careHomeId: req.family.resident ? req.family.resident.careHomeId : null,
        type: 'FAMILY_MESSAGE',
        severity: 'LOW',
        title: 'Message from ' + req.family.name + ' (' + req.family.relationship + ')',
        description: messageText,
        status: 'ACTIVE'
      }
    });

    res.json({
      success: true,
      message: {
        id: msg.id,
        from: req.family.name,
        text: messageText,
        sentAt: msg.createdAt
      }
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Get resident profile (view only for family)
router.get('/profile', familyAuth, async function(req, res) {
  try {
    var profile = await prisma.residentProfile.findUnique({
      where: { residentId: req.family.residentId },
      include: {
        resident: {
          select: {
            firstName: true, lastName: true, preferredName: true,
            dateOfBirth: true, roomNumber: true, status: true
          }
        }
      }
    });
    if (profile) {
      profile.questionnaireComplete = true;
    }
    res.json({ success: true, profile: profile });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
});

// Get alerts for resident
router.get('/alerts', familyAuth, async function(req, res) {
  try {
    var alerts = await prisma.alert.findMany({
      where: {
        userId: req.family.residentId,
        type: { not: 'FAMILY_MESSAGE' }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, alerts: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load alerts' });
  }
});

// Get my info
router.get('/me', familyAuth, async function(req, res) {
  res.json({
    success: true,
    family: {
      id: req.family.id,
      name: req.family.name,
      email: req.family.email,
      relationship: req.family.relationship,
      isPrimary: req.family.isPrimary,
      residentId: req.family.residentId,
      residentName: req.family.resident ? (req.family.resident.preferredName || req.family.resident.firstName) + ' ' + req.family.resident.lastName : null
    }
  });
});

module.exports = router;

// Get family contacts for a resident (used by tablet)
router.get('/contacts/:residentId', async function(req, res) {
  try {
    var contacts = await prisma.familyContact.findMany({
      where: { userId: req.params.residentId },
      select: {
        id: true,
        name: true,
        relationship: true,
        phone: true,
        email: true,
        photoUrl: true,
        isPrimary: true
      }
    });
    
    // Map to tablet-friendly format
    var mapped = contacts.map(function(c) {
      var firstName = c.name.split(' ')[0];
      var avatarMap = {
        'Daughter': '👩', 'Son': '👨', 'Granddaughter': '👧',
        'Grandson': '👦', 'Wife': '👩', 'Husband': '👨',
        'Sister': '👩', 'Brother': '👴', 'Friend': '🧑',
        'Niece': '👧', 'Nephew': '👦'
      };
      return {
        id: c.id,
        name: firstName,
        fullName: c.name,
        relation: c.relationship,
        avatar: avatarMap[c.relationship] || '🧑',
        online: false,
        unreadCount: 0,
        lastMessage: ''
      };
    });
    
    res.json({ success: true, contacts: mapped });
  } catch (err) {
    console.error('Get family contacts error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

// ─── Mood Timeline (for family dashboard) ─────────────────────
router.get('/mood-timeline', familyAuth, async function(req, res) {
  try {
    var residentId = req.family.residentId;
    var days = parseInt(req.query.days) || 14;
    
    // Get conversations with mood data
    var conversations = await prisma.conversation.findMany({
      where: { userId: residentId, mood: { not: null } },
      select: { mood: true, summary: true, startedAt: true, duration: true },
      orderBy: { startedAt: 'desc' },
      take: days * 3
    });

    // Get health logs
    var healthLogs = await prisma.healthLog.findMany({
      where: { userId: residentId },
      orderBy: { createdAt: 'desc' },
      take: days * 5
    });

    // Build daily mood data
    var timeline = [];
    var now = new Date();
    
    if (conversations.length > 0) {
      // Real data - group by day
      var dayMap = {};
      conversations.forEach(function(c) {
        var day = c.startedAt.toISOString().split('T')[0];
        if (!dayMap[day]) dayMap[day] = { moods: [], summaries: [] };
        var score = parseMoodScore(c.mood);
        if (score) dayMap[day].moods.push(score);
        if (c.summary) dayMap[day].summaries.push(c.summary);
      });
      for (var d in dayMap) {
        var avg = dayMap[d].moods.reduce(function(a, b) { return a + b; }, 0) / dayMap[d].moods.length;
        timeline.push({ date: d, score: Math.round(avg * 10) / 10, label: moodLabel(avg), conversations: dayMap[d].moods.length, highlight: dayMap[d].summaries[0] || null });
      }
    } else {
      // Demo data for pilot presentation
      for (var i = days - 1; i >= 0; i--) {
        var date = new Date(now);
        date.setDate(date.getDate() - i);
        var dayStr = date.toISOString().split('T')[0];
        var base = 7;
        var variation = Math.sin(i * 0.8) * 1.5 + (Math.random() - 0.5) * 1;
        var score = Math.max(3, Math.min(10, Math.round((base + variation) * 10) / 10));
        var highlights = [
          'Talked about her grandchildren with joy',
          'Remembered baking msemen with her mother',
          'Enjoyed listening to Oum Kalthoum',
          'Shared memories of Essaouira coastline',
          'Spoke about Youssef with warmth',
          'Laughed about Omar learning to ride a bike',
          'Felt peaceful after evening prayers',
          'Enjoyed chatting about Scottish weather',
          'Talked about Fatima calling from Casablanca',
          'Reminisced about her bakery in Morocco',
          'Was happy about Abid visiting on weekend',
          'Enjoyed discussing her favourite TV show',
          'Felt grateful for Yasmine drawing her a picture',
          'Talked about trying new Scottish recipes'
        ];
        timeline.push({
          date: dayStr,
          score: score,
          label: moodLabel(score),
          conversations: Math.floor(Math.random() * 3) + 1,
          highlight: highlights[i % highlights.length]
        });
      }
    }

    // Get activity feed (recent health logs + conversations)
    var activities = [];
    healthLogs.slice(0, 10).forEach(function(h) {
      if (h.type !== 'PROACTIVE_INTERACTION') {
        activities.push({ type: h.type, value: h.value, note: h.notes, time: h.createdAt });
      }
    });

    res.json({
      success: true,
      timeline: timeline.sort(function(a, b) { return a.date.localeCompare(b.date); }),
      activities: activities,
      isDemo: conversations.length === 0
    });
  } catch (err) {
    console.error('Mood timeline error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load mood timeline' });
  }
});

function parseMoodScore(mood) {
  if (!mood) return null;
  var num = parseFloat(mood);
  if (!isNaN(num)) return num;
  var map = { happy: 8, content: 7, neutral: 5, calm: 6, anxious: 4, sad: 3, upset: 3, confused: 4, cheerful: 9, peaceful: 7 };
  return map[mood.toLowerCase()] || 5;
}

function moodLabel(score) {
  if (score >= 8) return 'Very Happy';
  if (score >= 6.5) return 'Happy';
  if (score >= 5) return 'Content';
  if (score >= 3.5) return 'Low';
  return 'Needs Attention';
}

// ─── Activity Feed (what Warda and resident talked about) ─────
router.get('/activity-feed', familyAuth, async function(req, res) {
  try {
    var residentId = req.family.residentId;
    var limit = parseInt(req.query.limit) || 20;
    
    // Get real data
    var wardaMessages = await prisma.message.findMany({
      where: { userId: residentId, isFromWarda: true },
      select: { content: true, mood: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: limit
    });

    var healthLogs = await prisma.healthLog.findMany({
      where: { userId: residentId },
      select: { type: true, value: true, notes: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: limit
    });

    var conversations = await prisma.conversation.findMany({
      where: { userId: residentId },
      select: { mood: true, summary: true, startedAt: true, duration: true },
      orderBy: { startedAt: 'desc' }, take: 10
    });

    var activities = [];
    var isDemo = false;

    // Add real conversation summaries
    conversations.forEach(function(c) {
      if (c.summary) {
        activities.push({ type: 'conversation', icon: '💬', text: c.summary, time: c.startedAt, mood: c.mood, duration: c.duration });
      }
    });

    // Add health logs (skip repetitive night companion)
    var seenTypes = {};
    healthLogs.forEach(function(h) {
      var key = h.type + '_' + h.value;
      if (seenTypes[key]) return;
      seenTypes[key] = true;
      if (h.type === 'PROACTIVE_INTERACTION') {
        var labels = { morning_greeting: 'Had a morning chat', bedtime_routine: 'Settled in for the night', night_companion: 'Night companionship active', afternoon_checkin: 'Afternoon check-in' };
        activities.push({ type: 'proactive', icon: '🌹', text: labels[h.value] || h.value, time: h.createdAt });
      } else {
        activities.push({ type: 'health', icon: '🏥', text: h.notes || h.value, time: h.createdAt });
      }
    });

    // If very few real activities, add demo data
    if (activities.length < 5) {
      isDemo = true;
      var now = new Date();
      var profile = await prisma.residentProfile.findUnique({ where: { residentId: residentId }, select: { grewUpIn: true, favouriteMusic: true, hobbies: true, keyMemories: true, spouseName: true } });
      var p = profile || {};
      var demoActivities = [
        { type: 'conversation', icon: '💬', text: 'Talked about ' + (p.grewUpIn || 'home') + ' with great fondness', hoursAgo: 2 },
        { type: 'music', icon: '🎵', text: 'Listened to ' + (p.favouriteMusic || 'favourite music') + ' together', hoursAgo: 4 },
        { type: 'memory', icon: '📖', text: 'Shared a memory: ' + (p.keyMemories ? p.keyMemories.split('.')[0] : 'a happy childhood moment'), hoursAgo: 6 },
        { type: 'proactive', icon: '🌹', text: 'Morning greeting — started the day with a warm chat', hoursAgo: 8 },
        { type: 'conversation', icon: '😊', text: 'Laughed together about a funny story from the past', hoursAgo: 12 },
        { type: 'hobby', icon: '🎨', text: 'Discussed ' + (p.hobbies ? (Array.isArray(p.hobbies) ? p.hobbies[0] : p.hobbies.split(',')[0]) : 'hobbies') + ' — really enjoyed it', hoursAgo: 18 },
        { type: 'family', icon: '👨‍👩‍👧', text: 'Talked about family — mentioned ' + (p.spouseName || 'loved ones') + ' with warmth', hoursAgo: 24 },
        { type: 'proactive', icon: '🌙', text: 'Bedtime routine — settled in peacefully', hoursAgo: 28 },
        { type: 'conversation', icon: '💬', text: 'Had a lovely afternoon chat about the weather and garden', hoursAgo: 32 },
        { type: 'prayer', icon: '🙏', text: 'Quiet time for reflection and prayer', hoursAgo: 36 },
      ];
      demoActivities.forEach(function(d) {
        var t = new Date(now);
        t.setHours(t.getHours() - d.hoursAgo);
        activities.push({ type: d.type, icon: d.icon, text: d.text, time: t.toISOString() });
      });
    }

    // Sort by time descending
    activities.sort(function(a, b) { return new Date(b.time).getTime() - new Date(a.time).getTime(); });

    res.json({ success: true, activities: activities.slice(0, limit), isDemo: isDemo });
  } catch (err) {
    console.error('Activity feed error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load activity feed' });
  }
});
