/**
 * Admin Care Home Routes
 * CRUD operations for care home management
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient
} = require('@aws-sdk/client-cognito-identity-provider');
const { adminAuth, requireRole, logAudit } = require('../../middleware/adminAuth');

const prisma = new PrismaClient();

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'eu-west-2_sozTMWhUG';
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

router.use(adminAuth);

// GET /api/admin/care-homes
router.get('/', async (req, res) => {
  try {
    let where = {};
    if (req.adminRole !== 'SUPER_ADMIN') {
      where.id = req.careHomeId;
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { city: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    const careHomes = await prisma.careHome.findMany({
      where,
      include: {
        _count: {
          select: {
            users: { where: { status: 'ACTIVE' } },
            staff: { where: { isActive: true } },
            tablets: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const enriched = careHomes.map(ch => ({
      ...ch,
      activeResidents: ch._count.users,
      activeStaff: ch._count.staff,
      totalTablets: ch._count.tablets,
      _count: undefined
    }));

    res.json({ success: true, careHomes: enriched });
  } catch (error) {
    console.error('List care homes error:', error);
    res.status(500).json({ success: false, error: 'Failed to list care homes' });
  }
});

// GET /api/admin/care-homes/:id
router.get('/:id', async (req, res) => {
  try {
    if (req.adminRole !== 'SUPER_ADMIN' && req.careHomeId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const careHome = await prisma.careHome.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          where: { status: 'ACTIVE' },
          select: {
            id: true, firstName: true, lastName: true, preferredName: true,
            roomNumber: true, status: true, photoUrl: true, tabletId: true,
            createdAt: true,
            profile: { select: { questionnaireComplete: true, wardaBackstory: true } },
            _count: { select: { conversations: true, familyContacts: true } }
          },
          orderBy: { firstName: 'asc' }
        },
        staff: {
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' }
        },
        tablets: {
          select: { id: true, serialNumber: true, status: true, lastOnline: true },
          orderBy: { serialNumber: 'asc' }
        },
        _count: { select: { users: true, staff: true, tablets: true } }
      }
    });

    if (!careHome) {
      return res.status(404).json({ success: false, error: 'Care home not found' });
    }

    res.json({ success: true, careHome });
  } catch (error) {
    console.error('Get care home error:', error);
    res.status(500).json({ success: false, error: 'Failed to get care home' });
  }
});

// POST /api/admin/care-homes
router.post('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const {
      name, address, city, postcode, country,
      phone, managerName, managerEmail,
      subscriptionTier, maxResidents, cqcNumber, notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Care home name is required' });
    }
    if (!managerEmail) {
      return res.status(400).json({ success: false, error: 'Manager email is required' });
    }

    const careHome = await prisma.careHome.create({
      data: {
        name,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        country: country || 'UK',
        phone: phone || null,
        managerName: managerName || null,
        managerEmail: managerEmail.toLowerCase(),
        subscriptionTier: subscriptionTier || 'PILOT',
        status: subscriptionTier === 'PILOT' ? 'PILOT' : 'ACTIVE',
        maxResidents: maxResidents || 50,
        cqcNumber: cqcNumber || null,
        notes: notes || null
      }
    });

    let cognitoSub = null;
    const tempPassword = 'Warda2026!' + Math.random().toString(36).substring(2, 6);

    try {
      const createUserCmd = new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: managerEmail.toLowerCase(),
        UserAttributes: [
          { Name: 'email', Value: managerEmail.toLowerCase() },
          { Name: 'email_verified', Value: 'true' }
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS'
      });
      const cognitoResult = await cognitoClient.send(createUserCmd);
      cognitoSub = cognitoResult.User?.Attributes?.find(a => a.Name === 'sub')?.Value;
    } catch (err) {
      console.warn('Cognito create user warning:', err.message);
    }

    const adminUser = await prisma.adminUser.create({
      data: {
        email: managerEmail.toLowerCase(),
        name: managerName || name + ' Manager',
        role: 'MANAGER',
        careHomeId: careHome.id,
        cognitoSub,
        isActive: true
      }
    });

    await logAudit(req.adminUser.id, 'CREATE_CARE_HOME', 'CareHome', careHome.id,
      { name, managerEmail, subscriptionTier }, req.ip);

    res.status(201).json({
      success: true,
      careHome,
      manager: {
        id: adminUser.id,
        email: adminUser.email,
        temporaryPassword: tempPassword
      },
      message: `Care home "${name}" created. Manager account created for ${managerEmail}.`
    });
  } catch (error) {
    console.error('Create care home error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Duplicate care home or manager email' });
    }
    res.status(500).json({ success: false, error: 'Failed to create care home' });
  }
});

// PUT /api/admin/care-homes/:id
router.put('/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    if (req.adminRole === 'MANAGER' && req.careHomeId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const {
      name, address, city, postcode, country,
      phone, managerName, maxResidents, cqcNumber,
      notes, subscriptionTier, status
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (postcode !== undefined) updateData.postcode = postcode;
    if (country !== undefined) updateData.country = country;
    if (phone !== undefined) updateData.phone = phone;
    if (managerName !== undefined) updateData.managerName = managerName;
    if (maxResidents !== undefined) updateData.maxResidents = maxResidents;
    if (cqcNumber !== undefined) updateData.cqcNumber = cqcNumber;
    if (notes !== undefined) updateData.notes = notes;

    if (req.adminRole === 'SUPER_ADMIN') {
      if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier;
      if (status !== undefined) updateData.status = status;
    }

    const careHome = await prisma.careHome.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(req.adminUser.id, 'UPDATE_CARE_HOME', 'CareHome', careHome.id, updateData, req.ip);

    res.json({ success: true, careHome });
  } catch (error) {
    console.error('Update care home error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Care home not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to update care home' });
  }
});

// DELETE /api/admin/care-homes/:id
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const careHome = await prisma.careHome.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });

    await logAudit(req.adminUser.id, 'DELETE_CARE_HOME', 'CareHome', careHome.id, null, req.ip);

    res.json({ success: true, message: `Care home "${careHome.name}" deactivated` });
  } catch (error) {
    console.error('Delete care home error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete care home' });
  }
});

// GET /api/admin/care-homes/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    if (req.adminRole !== 'SUPER_ADMIN' && req.careHomeId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalResidents, activeResidents, totalStaff, totalConversationsToday, unresolvedAlerts] = await Promise.all([
      prisma.user.count({ where: { careHomeId: req.params.id } }),
      prisma.user.count({ where: { careHomeId: req.params.id, status: 'ACTIVE' } }),
      prisma.staffMember.count({ where: { careHomeId: req.params.id, isActive: true } }),
      prisma.conversation.count({ where: { user: { careHomeId: req.params.id }, startedAt: { gte: today } } }),
      prisma.alert.count({ where: { user: { careHomeId: req.params.id }, isResolved: false } })
    ]);

    res.json({
      success: true,
      stats: {
        totalResidents, activeResidents, totalStaff,
        totalConversationsToday, unresolvedAlerts,
        engagementRate: activeResidents > 0
          ? Math.round((totalConversationsToday / activeResidents) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Care home stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

module.exports = router;
