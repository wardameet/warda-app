// ============================================================
// WARDA - Invoice Management Routes
// Handles invoice generation and tracking
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/admin/invoices - Get all invoices
router.get('/', async (req, res) => {
  try {
    const { status, careHomeId, startDate, endDate } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (careHomeId) where.careHomeId = careHomeId;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
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

// POST /api/admin/invoices/generate - Generate invoices for care homes
router.post('/generate', async (req, res) => {
  try {
    const { period } = req.body; // Format: "2026-02"
    
    // Get all care homes with active residents where care home pays
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
      const amount = ch.users.length * pricePerResident * 100; // In pence
      
      // Generate invoice number
      const count = await prisma.invoice.count({ where: { careHomeId: ch.id } });
      const invoiceNumber = `INV-${ch.name.substring(0, 3).toUpperCase()}-${year}${month}-${(count + 1).toString().padStart(3, '0')}`;
      
      const invoice = await prisma.invoice.create({
        data: {
          careHomeId: ch.id,
          invoiceNumber,
          amount,
          status: 'DRAFT',
          lineItems: {
            items: [{
              description: `Warda Service - ${ch.users.length} residents`,
              quantity: ch.users.length,
              unitPrice: pricePerResident * 100,
              total: amount
            }]
          },
          dueDate: new Date(parseInt(year), parseInt(month), 15) // 15th of next month
        }
      });
      
      invoices.push(invoice);
    }
    
    res.json({ success: true, invoices, count: invoices.length });
  } catch (error) {
    console.error('Generate invoices error:', error);
    res.status(500).json({ error: 'Failed to generate invoices' });
  }
});

// POST /api/admin/invoices/:id/send - Send invoice
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' }
    });
    
    // TODO: Send email with invoice PDF
    
    res.json({ success: true, invoice, message: 'Invoice sent' });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// POST /api/admin/invoices/:id/mark-paid - Mark invoice as paid
router.post('/:id/mark-paid', async (req, res) => {
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
    
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('Mark invoice paid error:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
});

// POST /api/admin/invoices/check-overdue - Check and mark overdue invoices
router.post('/check-overdue', async (req, res) => {
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
