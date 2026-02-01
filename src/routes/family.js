/**
 * Family Routes
 * Handles family member connections and contacts
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all family contacts for a resident
router.get('/contacts/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;

    const contacts = await prisma.familyContact.findMany({
      where: { residentId },
      orderBy: { isPrimary: 'desc' }
    });

    res.json({
      success: true,
      contacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

// Add family contact
router.post('/contacts', async (req, res) => {
  try {
    const { residentId, name, relationship, email, phone, isPrimary } = req.body;

    const contact = await prisma.familyContact.create({
      data: {
        residentId,
        name,
        relationship,
        email,
        phone,
        isPrimary: isPrimary || false
      }
    });

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add contact'
    });
  }
});

// Update family contact
router.put('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { name, relationship, email, phone, isPrimary, isBlocked } = req.body;

    const contact = await prisma.familyContact.update({
      where: { id: contactId },
      data: {
        name,
        relationship,
        email,
        phone,
        isPrimary,
        isBlocked
      }
    });

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact'
    });
  }
});

// Delete family contact
router.delete('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    await prisma.familyContact.delete({
      where: { id: contactId }
    });

    res.json({
      success: true,
      message: 'Contact deleted'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact'
    });
  }
});

module.exports = router;
