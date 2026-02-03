/**
 * Admin Staff Routes
 * CRUD for staff member management
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

// GET /api/admin/staff
router.get('/', async (req, res) => {
  try {
    let where = {};
    if (req.adminRole !== 'SUPER_ADMIN') {
      where.careHomeId = req.careHomeId;
    } else if (req.query.careHomeId) {
      where.careHomeId = req.query.careHomeId;
    }
    if (req.query.role) where.role = req.query.role;
    if (req.query.active !== undefined) where.isActive = req.query.active === 'true';

    const staff = await prisma.staffMember.findMany({
      where,
      include: { careHome: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, staff });
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ success: false, error: 'Failed to list staff' });
  }
});

// POST /api/admin/staff
router.post('/', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, email, phone, role, careHomeId, assignedResidents } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    const targetCareHomeId = req.adminRole === 'SUPER_ADMIN'
      ? (careHomeId || req.careHomeId)
      : req.careHomeId;

    if (!targetCareHomeId) {
      return res.status(400).json({ success: false, error: 'Care home is required' });
    }

    let cognitoSub = null;
    const tempPassword = 'Warda2026!' + Math.random().toString(36).substring(2, 6);

    try {
      const cmd = new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: email.toLowerCase(),
        UserAttributes: [
          { Name: 'email', Value: email.toLowerCase() },
          { Name: 'email_verified', Value: 'true' }
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS'
      });
      const result = await cognitoClient.send(cmd);
      cognitoSub = result.User?.Attributes?.find(a => a.Name === 'sub')?.Value;
    } catch (err) {
      console.warn('Cognito create staff warning:', err.message);
    }

    const staff = await prisma.staffMember.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        role: role || 'CARER',
        careHomeId: targetCareHomeId,
        cognitoSub,
        assignedResidents: assignedResidents || [],
        isActive: true
      }
    });

    await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: 'STAFF',
        careHomeId: targetCareHomeId,
        cognitoSub,
        isActive: true
      }
    });

    await logAudit(req.adminUser.id, 'CREATE_STAFF', 'StaffMember', staff.id,
      { name, email, role }, req.ip);

    res.status(201).json({
      success: true,
      staff,
      temporaryPassword: tempPassword,
      message: `Staff member "${name}" created with role ${role || 'CARER'}.`
    });
  } catch (error) {
    console.error('Create staff error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A staff member with that email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create staff member' });
  }
});

// PUT /api/admin/staff/:id
router.put('/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, phone, role, assignedResidents, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (assignedResidents !== undefined) updateData.assignedResidents = assignedResidents;
    if (isActive !== undefined) updateData.isActive = isActive;

    const staff = await prisma.staffMember.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(req.adminUser.id, 'UPDATE_STAFF', 'StaffMember', staff.id, updateData, req.ip);

    res.json({ success: true, staff });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ success: false, error: 'Failed to update staff member' });
  }
});

// DELETE /api/admin/staff/:id
router.delete('/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const staff = await prisma.staffMember.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    await prisma.adminUser.updateMany({
      where: { email: staff.email },
      data: { isActive: false }
    });

    await logAudit(req.adminUser.id, 'DEACTIVATE_STAFF', 'StaffMember', staff.id, null, req.ip);

    res.json({ success: true, message: `${staff.name} has been deactivated` });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate staff' });
  }
});

module.exports = router;
