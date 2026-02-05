// ============================================================
// WARDA - Order Management Routes
// Handles order queue, dispatch, credentials generation
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { adminAuth, requireRole, scopeToCareHome, logAudit } = require('../../middleware/adminAuth');

// Apply auth middleware to all routes
router.use(adminAuth);

// GET /api/admin/orders - Get all orders with filters
router.get('/', async (req, res) => {
  try {
    const { status, billingType, accountType } = req.query;
    
    const where = {};
    if (status) where.orderStatus = status;
    if (billingType) where.billingType = billingType;
    if (accountType) where.accountType = accountType;
    
    // DATA SEPARATION: Non-SUPER_ADMIN only sees their care home
    if (req.adminRole !== 'SUPER_ADMIN') {
      where.careHomeId = req.careHomeId;
    } else if (req.query.careHomeId) {
      where.careHomeId = req.query.careHomeId;
    }
    
    const orders = await prisma.user.findMany({
      where,
      include: {
        careHome: { select: { id: true, name: true } },
        profile: { select: { questionnaireComplete: true, questionnaireStep: true } },
        familyContacts: { where: { isPrimary: true }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Group by status for dashboard
    const grouped = {
      WAITING_QUESTIONNAIRE: orders.filter(o => o.orderStatus === 'WAITING_QUESTIONNAIRE'),
      WAITING_PAYMENT: orders.filter(o => o.orderStatus === 'WAITING_PAYMENT'),
      PENDING_DISPATCH: orders.filter(o => o.orderStatus === 'PENDING_DISPATCH'),
      CREDENTIALS_SENT: orders.filter(o => o.orderStatus === 'CREDENTIALS_SENT'),
      SHIPPED: orders.filter(o => o.orderStatus === 'SHIPPED'),
      ACTIVE: orders.filter(o => o.orderStatus === 'ACTIVE'),
    };
    
    res.json({ orders, grouped, total: orders.length });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/queue - Get actionable orders (Super Admin only)
router.get('/queue', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const waitingPayment = await prisma.user.findMany({
      where: { orderStatus: 'WAITING_PAYMENT' },
      include: {
        careHome: { select: { id: true, name: true } },
        familyContacts: { where: { isPrimary: true }, take: 1 }
      },
      orderBy: { paymentLinkSentAt: 'asc' }
    });
    
    const pendingDispatch = await prisma.user.findMany({
      where: { orderStatus: 'PENDING_DISPATCH' },
      include: {
        careHome: { select: { id: true, name: true } },
        profile: { select: { questionnaireComplete: true } },
        familyContacts: { where: { isPrimary: true }, take: 1 }
      },
      orderBy: { paymentConfirmedAt: 'asc' }
    });
    
    const credentialsSent = await prisma.user.findMany({
      where: { orderStatus: 'CREDENTIALS_SENT' },
      include: {
        careHome: { select: { id: true, name: true } },
        tablet: { select: { id: true, serialNumber: true, status: true } }
      },
      orderBy: { credentialsSentAt: 'asc' }
    });
    
    res.json({
      waitingPayment,
      pendingDispatch,
      credentialsSent,
      counts: {
        waitingPayment: waitingPayment.length,
        pendingDispatch: pendingDispatch.length,
        credentialsSent: credentialsSent.length
      }
    });
  } catch (error) {
    console.error('Get order queue error:', error);
    res.status(500).json({ error: 'Failed to fetch order queue' });
  }
});

// POST /api/admin/orders/:id/generate-credentials - Generate PIN and temp password (Super Admin only)
router.post('/:id/generate-credentials', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate 4-digit PIN
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Generate temp password
    const tempPassword = 'Warda' + new Date().getFullYear() + '!' + Math.floor(Math.random() * 100);
    
    const user = await prisma.user.update({
      where: { id },
      data: { pin },
      include: { familyContacts: { where: { isPrimary: true }, take: 1 } }
    });
    
    // If there's a primary family contact, create/update their AdminUser with temp password
    if (user.familyContacts[0] && user.familyContacts[0].email) {
      const family = user.familyContacts[0];
      await prisma.adminUser.upsert({
        where: { email: family.email },
        update: { 
          tempPassword,
          mustChangePassword: true,
          linkedResidentId: id
        },
        create: {
          email: family.email,
          name: family.name,
          role: user.accountType === 'B2C' ? 'FAMILY_B2C' : 'FAMILY_B2B',
          tempPassword,
          mustChangePassword: true,
          linkedResidentId: id,
          careHomeId: user.careHomeId
        }
      });
    }
    
    await logAudit(req.adminUser.id, 'GENERATE_CREDENTIALS', 'User', id, { pin: '****' }, req.ip);
    
    res.json({ 
      success: true, 
      pin, 
      tempPassword,
      message: 'Credentials generated successfully'
    });
  } catch (error) {
    console.error('Generate credentials error:', error);
    res.status(500).json({ error: 'Failed to generate credentials' });
  }
});

// POST /api/admin/orders/:id/send-welcome-email - Send welcome email (Super Admin only)
router.post('/:id/send-welcome-email', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmail, pin, tempPassword } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        careHome: true,
        familyContacts: { where: { isPrimary: true }, take: 1 }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // TODO: Integrate with actual email service (SES, SendGrid, etc.)
    
    await prisma.user.update({
      where: { id },
      data: {
        orderStatus: 'CREDENTIALS_SENT',
        credentialsSentAt: new Date()
      }
    });
    
    await logAudit(req.adminUser.id, 'SEND_WELCOME_EMAIL', 'User', id, { recipientEmail }, req.ip);
    
    res.json({ 
      success: true, 
      message: 'Welcome email would be sent to ' + recipientEmail,
      debug: { pin, tempPassword, residentName: user.firstName + ' ' + user.lastName }
    });
  } catch (error) {
    console.error('Send welcome email error:', error);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

// POST /api/admin/orders/:id/send-payment-link - Send Stripe payment link (Super Admin only)
router.post('/:id/send-payment-link', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmail, amount, planName } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: { careHome: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // TODO: Create Stripe payment link
    
    await prisma.user.update({
      where: { id },
      data: {
        orderStatus: 'WAITING_PAYMENT',
        billingEmail: recipientEmail,
        paymentLinkSentAt: new Date()
      }
    });
    
    await logAudit(req.adminUser.id, 'SEND_PAYMENT_LINK', 'User', id, { recipientEmail, amount }, req.ip);
    
    res.json({ 
      success: true, 
      message: 'Payment link would be sent to ' + recipientEmail,
      paymentLink: 'https://checkout.stripe.com/placeholder'
    });
  } catch (error) {
    console.error('Send payment link error:', error);
    res.status(500).json({ error: 'Failed to send payment link' });
  }
});

// POST /api/admin/orders/:id/mark-paid - Mark order as paid (Super Admin only)
router.post('/:id/mark-paid', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;
    
    await prisma.user.update({
      where: { id },
      data: {
        orderStatus: 'PENDING_DISPATCH',
        paymentConfirmedAt: new Date()
      }
    });
    
    await logAudit(req.adminUser.id, 'MARK_ORDER_PAID', 'User', id, { reference }, req.ip);
    
    res.json({ success: true, message: 'Order marked as paid' });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
});

// POST /api/admin/orders/:id/mark-dispatched - Mark tablet as dispatched (Super Admin only)
router.post('/:id/mark-dispatched', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { trackingNumber, tabletId } = req.body;
    
    await prisma.user.update({
      where: { id },
      data: {
        orderStatus: 'SHIPPED',
        dispatchedAt: new Date(),
        tabletId
      }
    });
    
    if (tabletId) {
      await prisma.tablet.update({
        where: { id: tabletId },
        data: { 
          status: 'SHIPPING',
          trackingNumber
        }
      });
    }
    
    await logAudit(req.adminUser.id, 'MARK_DISPATCHED', 'User', id, { trackingNumber, tabletId }, req.ip);
    
    res.json({ success: true, message: 'Order marked as dispatched' });
  } catch (error) {
    console.error('Mark dispatched error:', error);
    res.status(500).json({ error: 'Failed to mark as dispatched' });
  }
});

// POST /api/admin/orders/:id/activate - Mark as active (Super Admin only)
router.post('/:id/activate', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.update({
      where: { id },
      data: {
        orderStatus: 'ACTIVE',
        status: 'ACTIVE',
        activatedAt: new Date()
      }
    });
    
    if (user.tabletId) {
      await prisma.tablet.update({
        where: { id: user.tabletId },
        data: { status: 'ACTIVE' }
      });
    }
    
    await logAudit(req.adminUser.id, 'ACTIVATE_USER', 'User', id, {}, req.ip);
    
    res.json({ success: true, message: 'User activated' });
  } catch (error) {
    console.error('Activate error:', error);
    res.status(500).json({ error: 'Failed to activate' });
  }
});

module.exports = router;
