// ============================================================
// WARDA - Invoice Management Routes
// Handles invoice generation and tracking
// SUPER_ADMIN for all, Care homes see only their own
// ============================================================

const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { adminAuth, requireRole, logAudit } = require('../../middleware/adminAuth');

// Apply auth middleware to all routes
router.use(adminAuth);

// GET /api/admin/invoices - Get all invoices
router.get('/', async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
    }
    
    // DATA SEPARATION: Non-SUPER_ADMIN only sees their care home's invoices
    if (req.adminRole !== 'SUPER_ADMIN') {
      where.careHomeId = req.careHomeId;
    } else if (req.query.careHomeId) {
      where.careHomeId = req.query.careHomeId;
    }
    
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' }
    });
    
    const summary = {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      paid: invoices.filter(inv => inv.status === 'PAID').length,
      pending: invoices.filter(inv => inv.status === 'SENT').length,
      overdue: invoices.filter(inv => inv.status === 'OVERDUE').length
    };
    
    res.json({ invoices, summary });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /api/admin/invoices/generate - Generate invoices for care homes (SUPER_ADMIN only)
router.post('/generate', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { period } = req.body;
    
    const careHomes = await prisma.careHome.findMany({
      where: { status: 'ACTIVE' },
      include: {
        users: {
          where: { 
            orderStatus: 'ACTIVE',
            billingType: { in: ['CARE_HOME_PAYS', 'CARE_HOME_COLLECTS'] }
          }
        }
      }
    });
    
    const invoices = [];
    const year = period.split('-')[0];
    const month = period.split('-')[1];
    
    for (const ch of careHomes) {
      if (ch.users.length === 0) continue;
      
      const pricePerResident = ch.subscriptionTier === 'PREMIUM' ? 35 : 25;
      const amount = ch.users.length * pricePerResident * 100;
      
      const count = await prisma.invoice.count({ where: { careHomeId: ch.id } });
      const invoiceNumber = 'INV-' + ch.name.substring(0, 3).toUpperCase() + '-' + year + month + '-' + (count + 1).toString().padStart(3, '0');
      
      const invoice = await prisma.invoice.create({
        data: {
          careHomeId: ch.id,
          invoiceNumber,
          amount,
          status: 'DRAFT',
          lineItems: {
            items: [{
              description: 'Warda Service - ' + ch.users.length + ' residents',
              quantity: ch.users.length,
              unitPrice: pricePerResident * 100,
              total: amount
            }]
          },
          dueDate: new Date(parseInt(year), parseInt(month), 15)
        }
      });
      
      invoices.push(invoice);
    }
    
    await logAudit(req.adminUser.id, 'GENERATE_INVOICES', 'Invoice', null, { period, count: invoices.length }, req.ip);
    
    res.json({ success: true, invoices, count: invoices.length });
  } catch (error) {
    console.error('Generate invoices error:', error);
    res.status(500).json({ error: 'Failed to generate invoices' });
  }
});

// POST /api/admin/invoices/:id/send - Send invoice (SUPER_ADMIN only)
router.post('/:id/send', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' }
    });
    
    // TODO: Send email with invoice PDF
    
    await logAudit(req.adminUser.id, 'SEND_INVOICE', 'Invoice', id, {}, req.ip);
    
    res.json({ success: true, invoice, message: 'Invoice sent' });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// POST /api/admin/invoices/:id/mark-paid - Mark invoice as paid (SUPER_ADMIN only)
router.post('/:id/mark-paid', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { 
        status: 'PAID',
        paidAt: new Date()
      }
    });
    
    await logAudit(req.adminUser.id, 'MARK_INVOICE_PAID', 'Invoice', id, { reference }, req.ip);
    
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('Mark invoice paid error:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
});

// POST /api/admin/invoices/check-overdue - Check and mark overdue invoices (SUPER_ADMIN only)
router.post('/check-overdue', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    
    const overdue = await prisma.invoice.updateMany({
      where: {
        status: 'SENT',
        dueDate: { lt: now }
      },
      data: { status: 'OVERDUE' }
    });
    
    res.json({ success: true, markedOverdue: overdue.count });
  } catch (error) {
    console.error('Check overdue error:', error);
    res.status(500).json({ error: 'Failed to check overdue invoices' });
  }
});

module.exports = router;
