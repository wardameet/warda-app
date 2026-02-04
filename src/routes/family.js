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

var prisma = new PrismaClient();
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
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token' });
    var token = authHeader.replace('Bearer ', '');
    var decoded = jwt.decode(token, { complete: true });
    if (!decoded) return res.status(401).json({ success: false, error: 'Invalid token' });
    var key = await jwks.getSigningKey(decoded.header.kid);
    var verified = jwt.verify(token, key.getPublicKey());
    var email = verified.email || verified['cognito:username'];
    var familyContact = await prisma.familyContact.findFirst({
      where: { email: email },
      include: { resident: true }
    });
    if (!familyContact) return res.status(403).json({ success: false, error: 'Not a registered family member' });
    req.family = familyContact;
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
    var cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password }
    });
    var result = await cognito.send(cmd);

    if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.json({ success: true, challenge: 'NEW_PASSWORD_REQUIRED', session: result.Session });
    }

    // Find family contact
    var familyContact = await prisma.familyContact.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        resident: {
          include: { careHome: true }
        }
      }
    });

    res.json({
      success: true,
      tokens: {
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        idToken: result.AuthenticationResult.IdToken
      },
      family: {
        id: familyContact ? familyContact.id : null,
        name: familyContact ? familyContact.name : null,
        relationship: familyContact ? familyContact.relationship : null,
        residentName: familyContact ? (familyContact.resident.preferredName || familyContact.resident.firstName) + ' ' + familyContact.resident.lastName : null,
        residentId: familyContact ? familyContact.residentId : null,
        careHomeName: familyContact && familyContact.resident.careHome ? familyContact.resident.careHome.name : null
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
      where: { userId: req.family.residentId },
      include: {
        resident: {
          select: {
            firstName: true, lastName: true, preferredName: true,
            dateOfBirth: true, roomNumber: true, status: true
          }
        }
      }
    });
    res.json({ success: true, profile: profile });
  } catch (err) {
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
