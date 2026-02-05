// ============================================================
// WARDA - Email Routes
// API endpoints for sending transactional emails
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { adminAuth, requireRole, logAudit } = require('../../middleware/adminAuth');
const emailService = require('../../services/emailService');

// Apply auth middleware
router.use(adminAuth);

// POST /api/admin/emails/welcome - Send welcome email with credentials
router.post('/welcome', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { userId, pin, tempPassword } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        familyContacts: { where: { isPrimary: true }, take: 1 },
        careHome: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const primaryFamily = user.familyContacts[0];
    if (!primaryFamily?.email) {
      return res.status(400).json({ error: 'No primary family contact with email' });
    }
    
    const result = await emailService.sendWelcomeEmail({
      to: primaryFamily.email,
      residentName: `${user.preferredName || user.firstName} ${user.lastName}`,
      pin: pin || user.pin,
      tempPassword,
      familyName: primaryFamily.name
    });
    
    if (result.success) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          orderStatus: 'CREDENTIALS_SENT',
          credentialsSentAt: new Date()
        }
      });
      
      await logAudit(req.adminUser.id, 'SEND_WELCOME_EMAIL', 'User', userId, 
        { to: primaryFamily.email }, req.ip);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Send welcome email error:', error);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

// POST /api/admin/emails/payment-link - Send payment link email
router.post('/payment-link', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { userId, paymentUrl, amount } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { familyContacts: { where: { isPrimary: true }, take: 1 } }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const primaryFamily = user.familyContacts[0];
    if (!primaryFamily?.email) {
      return res.status(400).json({ error: 'No primary family contact with email' });
    }
    
    const result = await emailService.sendPaymentLinkEmail({
      to: primaryFamily.email,
      residentName: `${user.preferredName || user.firstName} ${user.lastName}`,
      familyName: primaryFamily.name,
      amount: amount || 2999,
      paymentUrl
    });
    
    if (result.success) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          orderStatus: 'WAITING_PAYMENT',
          paymentLinkSentAt: new Date()
        }
      });
      
      await logAudit(req.adminUser.id, 'SEND_PAYMENT_LINK', 'User', userId, 
        { to: primaryFamily.email, amount }, req.ip);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Send payment link error:', error);
    res.status(500).json({ error: 'Failed to send payment link email' });
  }
});

// POST /api/admin/emails/invoice - Send invoice email
router.post('/invoice', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { invoiceId } = req.body;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { careHome: true }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    if (!invoice.careHome?.billingEmail && !invoice.careHome?.email) {
      return res.status(400).json({ error: 'Care home has no billing email' });
    }
    
    const result = await emailService.sendInvoiceEmail({
      to: invoice.careHome.billingEmail || invoice.careHome.email,
      careHomeName: invoice.careHome.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      lineItems: invoice.lineItems?.items || [{ 
        description: 'Warda Service', 
        quantity: 1, 
        total: invoice.amount 
      }],
      invoiceUrl: `https://portal.meetwarda.com/invoices/${invoice.id}`
    });
    
    if (result.success) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'SENT' }
      });
      
      await logAudit(req.adminUser.id, 'SEND_INVOICE', 'Invoice', invoiceId, 
        { invoiceNumber: invoice.invoiceNumber }, req.ip);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

// POST /api/admin/emails/family-invite - Send family invitation
router.post('/family-invite', async (req, res) => {
  try {
    const { familyContactId, inviteUrl } = req.body;
    
    const familyContact = await prisma.familyContact.findUnique({
      where: { id: familyContactId },
      include: { 
        user: { include: { careHome: true } }
      }
    });
    
    if (!familyContact) {
      return res.status(404).json({ error: 'Family contact not found' });
    }
    
    if (!familyContact.email) {
      return res.status(400).json({ error: 'Family contact has no email' });
    }
    
    const result = await emailService.sendFamilyInvitationEmail({
      to: familyContact.email,
      inviterName: req.adminUser.name,
      residentName: `${familyContact.user.preferredName || familyContact.user.firstName} ${familyContact.user.lastName}`,
      careHomeName: familyContact.user.careHome?.name,
      inviteUrl: inviteUrl || `https://portal.meetwarda.com/#/invite/${familyContactId}`
    });
    
    if (result.success) {
      await prisma.familyContact.update({
        where: { id: familyContactId },
        data: { inviteSentAt: new Date() }
      });
      
      await logAudit(req.adminUser.id, 'SEND_FAMILY_INVITE', 'FamilyContact', familyContactId, 
        { to: familyContact.email }, req.ip);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Send family invite error:', error);
    res.status(500).json({ error: 'Failed to send family invitation' });
  }
});

// POST /api/admin/emails/dispatch - Send dispatch/tracking email
router.post('/dispatch', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { userId, trackingNumber, carrier, estimatedDelivery } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { familyContacts: { where: { isPrimary: true }, take: 1 } }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const primaryFamily = user.familyContacts[0];
    if (!primaryFamily?.email) {
      return res.status(400).json({ error: 'No primary family contact with email' });
    }
    
    const result = await emailService.sendDispatchEmail({
      to: primaryFamily.email,
      residentName: `${user.preferredName || user.firstName} ${user.lastName}`,
      familyName: primaryFamily.name,
      trackingNumber,
      carrier: carrier || 'Royal Mail',
      estimatedDelivery
    });
    
    if (result.success) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          orderStatus: 'SHIPPED',
          dispatchedAt: new Date()
        }
      });
      
      await logAudit(req.adminUser.id, 'SEND_DISPATCH_EMAIL', 'User', userId, 
        { trackingNumber, carrier }, req.ip);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Send dispatch email error:', error);
    res.status(500).json({ error: 'Failed to send dispatch email' });
  }
});

// POST /api/admin/emails/test - Test email sending (to verified email only)
router.post('/test', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { to, template } = req.body;
    
    let result;
    
    switch (template) {
      case 'welcome':
        result = await emailService.sendWelcomeEmail({
          to,
          residentName: 'Test Resident',
          pin: '1234',
          tempPassword: 'TempPass123!',
          familyName: 'Test Family'
        });
        break;
      case 'payment':
        result = await emailService.sendPaymentLinkEmail({
          to,
          residentName: 'Test Resident',
          familyName: 'Test Family',
          amount: 2999,
          paymentUrl: 'https://stripe.com/test'
        });
        break;
      case 'invoice':
        result = await emailService.sendInvoiceEmail({
          to,
          careHomeName: 'Test Care Home',
          invoiceNumber: 'INV-TEST-001',
          amount: 50000,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lineItems: [{ description: 'Warda Service - 20 residents', quantity: 20, total: 50000 }]
        });
        break;
      case 'invite':
        result = await emailService.sendFamilyInvitationEmail({
          to,
          inviterName: 'Test Inviter',
          residentName: 'Test Resident',
          careHomeName: 'Test Care Home',
          inviteUrl: 'https://portal.meetwarda.com/#/invite/test'
        });
        break;
      case 'dispatch':
        result = await emailService.sendDispatchEmail({
          to,
          residentName: 'Test Resident',
          familyName: 'Test Family',
          trackingNumber: 'RM123456789GB',
          carrier: 'Royal Mail',
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid template. Use: welcome, payment, invoice, invite, dispatch' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

module.exports = router;
