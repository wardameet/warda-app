const express = require('express');
const router = express.Router();
const { adminAuth, requireRole } = require('../../middleware/adminAuth');
const { verifyEmail, verifyEmails, getVerificationStatus, isEmailVerified } = require('../../services/sesVerifier');
const prisma = require('../../lib/prisma');

// GET /api/admin/ses/status — Get SES verification status
router.get('/status', adminAuth, async (req, res) => {
  try {
    const status = await getVerificationStatus();
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/ses/verify — Verify a single email
router.post('/verify', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await verifyEmail(email);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/ses/verify-all — Verify ALL user emails in the system
router.post('/verify-all', adminAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    // Collect all unique emails from the system
    const emails = new Set();
    
    // Admin users (staff, managers, super admins)
    const admins = await prisma.adminUser.findMany({ where: { isActive: true }, select: { email: true } });
    admins.forEach(a => { if (a.email) emails.add(a.email.toLowerCase()); });
    
    // Family contacts
    const families = await prisma.familyContact.findMany({ select: { email: true } });
    families.forEach(f => { if (f.email) emails.add(f.email.toLowerCase()); });
    
    // Residents with email
    const residents = await prisma.user.findMany({ where: { email: { not: null } }, select: { email: true } });
    residents.forEach(r => { if (r.email) emails.add(r.email.toLowerCase()); });
    
    // Care home manager/billing emails
    const careHomes = await prisma.careHome.findMany({ select: { managerEmail: true, billingEmail: true } });
    careHomes.forEach(ch => {
      if (ch.managerEmail) emails.add(ch.managerEmail.toLowerCase());
      if (ch.billingEmail) emails.add(ch.billingEmail.toLowerCase());
    });
    
    const uniqueEmails = [...emails].filter(Boolean);
    console.log(`[SES] Verifying ${uniqueEmails.length} emails...`);
    
    const results = await verifyEmails(uniqueEmails);
    const verified = results.filter(r => r.alreadyVerified).length;
    const sent = results.filter(r => r.success && !r.alreadyVerified).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({ success: true, total: uniqueEmails.length, alreadyVerified: verified, verificationSent: sent, failed, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/ses/check — Check if email is verified
router.post('/check', adminAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const verified = await isEmailVerified(email);
    res.json({ success: true, email, verified });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
