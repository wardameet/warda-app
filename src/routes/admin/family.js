/**
 * Admin Family Routes
 * Family member management and invitations
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { adminAuth, logAudit } = require('../../middleware/adminAuth');

const prisma = require('../../lib/prisma');

router.use(adminAuth);

// GET /api/admin/residents/:residentId/family
router.get('/residents/:residentId/family', async (req, res) => {
  try {
    const contacts = await prisma.familyContact.findMany({
      where: { userId: req.params.residentId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
    });

    res.json({ success: true, familyContacts: contacts });
  } catch (error) {
    console.error('List family error:', error);
    res.status(500).json({ success: false, error: 'Failed to list family contacts' });
  }
});

// POST /api/admin/residents/:residentId/family
router.post('/residents/:residentId/family', async (req, res) => {
  try {
    const { name, relationship, email, phone, isPrimary, accessLevel } = req.body;

    if (!name || !relationship) {
      return res.status(400).json({ success: false, error: 'Name and relationship are required' });
    }

    if (isPrimary) {
      await prisma.familyContact.updateMany({
        where: { userId: req.params.residentId, isPrimary: true },
        data: { isPrimary: false }
      });
    }

    const contact = await prisma.familyContact.create({
      data: {
        name,
        relationship,
        email: email ? email.toLowerCase() : null,
        phone: phone || null,
        isPrimary: isPrimary || false,
        accessLevel: accessLevel || 'FULL',
        inviteStatus: 'PENDING',
        userId: req.params.residentId
      }
    });

    await logAudit(req.adminUser.id, 'ADD_FAMILY', 'FamilyContact', contact.id,
      { name, relationship, residentId: req.params.residentId }, req.ip);

    res.status(201).json({
      success: true,
      familyContact: contact,
      message: email
        ? `Invitation sent to ${email}`
        : `${name} added. No email provided.`
    });
  } catch (error) {
    console.error('Add family error:', error);
    res.status(500).json({ success: false, error: 'Failed to add family contact' });
  }
});

// PUT /api/admin/family/:id
router.put('/family/:id', async (req, res) => {
  try {
    const { name, relationship, email, phone, isPrimary, accessLevel } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (relationship !== undefined) updateData.relationship = relationship;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone;
    if (accessLevel !== undefined) updateData.accessLevel = accessLevel;

    if (isPrimary !== undefined) {
      if (isPrimary) {
        const existing = await prisma.familyContact.findUnique({ where: { id: req.params.id } });
        await prisma.familyContact.updateMany({
          where: { userId: existing.userId, isPrimary: true },
          data: { isPrimary: false }
        });
      }
      updateData.isPrimary = isPrimary;
    }

    const contact = await prisma.familyContact.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(req.adminUser.id, 'UPDATE_FAMILY', 'FamilyContact', contact.id, updateData, req.ip);

    res.json({ success: true, familyContact: contact });
  } catch (error) {
    console.error('Update family error:', error);
    res.status(500).json({ success: false, error: 'Failed to update family contact' });
  }
});

// POST /api/admin/family/:id/resend-invite
router.post('/family/:id/resend-invite', async (req, res) => {
  try {
    const contact = await prisma.familyContact.findUnique({ where: { id: req.params.id } });

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    if (!contact.email) {
      return res.status(400).json({ success: false, error: 'No email address on file' });
    }

    await prisma.familyContact.update({
      where: { id: req.params.id },
      data: { inviteStatus: 'PENDING' }
    });

    await logAudit(req.adminUser.id, 'RESEND_INVITE', 'FamilyContact', contact.id, null, req.ip);

    res.json({ success: true, message: `Invitation resent to ${contact.email}` });
  } catch (error) {
    console.error('Resend invite error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend invitation' });
  }
});

// DELETE /api/admin/family/:id
router.delete('/family/:id', async (req, res) => {
  try {
    const contact = await prisma.familyContact.delete({
      where: { id: req.params.id }
    });

    await logAudit(req.adminUser.id, 'REMOVE_FAMILY', 'FamilyContact', req.params.id,
      { name: contact.name }, req.ip);

    res.json({ success: true, message: `${contact.name} removed` });
  } catch (error) {
    console.error('Delete family error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove family contact' });
  }
});

module.exports = router;

// GET /api/admin/family/my-relative - Get linked resident for family user
router.get('/family/my-relative', adminAuth, async (req, res) => {
  try {
    // Get the linked resident from adminUser
    if (!req.adminUser.linkedResidentId) {
      return res.status(404).json({ success: false, error: 'No linked resident' });
    }
    
    const resident = await prisma.user.findUnique({
      where: { id: req.adminUser.linkedResidentId },
      include: {
        careHome: true,
        profile: true,
        _count: {
          select: {
            conversations: true,
            familyContacts: true
          }
        }
      }
    });
    
    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }
    
    res.json({
      success: true,
      resident: {
        id: resident.id,
        firstName: resident.firstName,
        lastName: resident.lastName,
        preferredName: resident.preferredName,
        roomNumber: resident.roomNumber,
        status: resident.status,
        photoUrl: resident.photoUrl,
        careHome: resident.careHome,
        profile: resident.profile,
        _count: resident._count
      }
    });
  } catch (err) {
    console.error('Get my relative error:', err);
    res.status(500).json({ success: false, error: 'Failed to load relative' });
  }
});

// GET /api/admin/family/:residentId/messages - Get messages for a resident
router.get('/family/:residentId/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { userId: req.params.residentId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, messages: messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.json({ success: true, messages: [] });
  }
});
