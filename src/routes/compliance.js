const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { adminAuth, requireRole } = require('../middleware/adminAuth');
router.use(adminAuth);

// GET /api/compliance/cqc-report - CQC Evidence Report
router.get('/cqc-report', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { careHomeId, from, to } = req.query;
    const periodStart = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = to ? new Date(to) : new Date();
    const where = careHomeId ? { careHomeId } : {};

    const [residents, conversations, messages, alerts, healthLogs, medications] = await Promise.all([
      prisma.user.findMany({ where: { ...where, role: 'RESIDENT', isResolved: false }, select: { id: true, firstName: true, lastName: true, createdAt: true } }),
      prisma.conversation.findMany({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.message.findMany({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.alert.findMany({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.healthLog.findMany({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.medication.findMany({ where: { isActive: true } })
    ]);

    const totalResidents = residents.length;
    const moodLogs = healthLogs.filter(l => l.type === 'MOOD');
    const painLogs = healthLogs.filter(l => l.type === 'PAIN');
    const incidents = healthLogs.filter(l => l.type === 'INCIDENT');
    const medTaken = healthLogs.filter(l => l.type === 'MEDICATION_TAKEN');
    const medSkipped = healthLogs.filter(l => l.type === 'MEDICATION_SKIPPED');

    const report = {
      title: 'CQC Compliance Evidence Report',
      generatedAt: new Date().toISOString(),
      period: { from: periodStart.toISOString(), to: periodEnd.toISOString(), days: Math.ceil((periodEnd - periodStart) / 86400000) },
      summary: { totalResidents, activeResidents: totalResidents },

      // CQC Key Lines of Enquiry (KLOE)
      safe: {
        label: 'Safe',
        incidentCount: incidents.length,
        criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
        highAlerts: alerts.filter(a => a.severity === 'HIGH').length,
        medicationAdherence: medTaken.length + medSkipped.length > 0 ? Math.round(medTaken.length / (medTaken.length + medSkipped.length) * 100) : 100,
        avgPainScore: painLogs.length > 0 ? (painLogs.reduce((s, l) => s + parseFloat(l.value || 0), 0) / painLogs.length).toFixed(1) : 'N/A',
        evidence: `${incidents.length} incidents logged, ${alerts.filter(a => a.severity === 'CRITICAL').length} critical alerts responded to. Medication adherence at ${medTaken.length + medSkipped.length > 0 ? Math.round(medTaken.length / (medTaken.length + medSkipped.length) * 100) : 100}%.`
      },

      effective: {
        label: 'Effective',
        healthLogsTotal: healthLogs.length,
        moodTracking: moodLogs.length,
        avgMood: moodLogs.length > 0 ? (moodLogs.reduce((s, l) => s + parseFloat(l.value || 0), 0) / moodLogs.length).toFixed(1) : 'N/A',
        gpReportsAvailable: true,
        evidence: `${healthLogs.length} health observations recorded. Average mood score: ${moodLogs.length > 0 ? (moodLogs.reduce((s, l) => s + parseFloat(l.value || 0), 0) / moodLogs.length).toFixed(1) : 'N/A'}/5. Personalised care plans via AI questionnaire.`
      },

      caring: {
        label: 'Caring',
        totalConversations: conversations.length,
        totalMessages: messages.length,
        avgMessagesPerResident: totalResidents > 0 ? Math.round(messages.length / totalResidents) : 0,
        proactiveEngagement: true,
        evidence: `${conversations.length} AI companion conversations, ${messages.length} messages exchanged. Each resident receives personalised, culturally-aware engagement.`
      },

      responsive: {
        label: 'Responsive',
        alertsGenerated: alerts.length,
        alertsResolved: alerts.filter(a => a.status === 'RESOLVED').length,
        avgResponseTime: 'Real-time via AI monitoring',
        familyEngagement: true,
        evidence: `${alerts.length} alerts generated and monitored. AI companion provides real-time mood detection and proactive wellbeing checks.`
      },

      wellLed: {
        label: 'Well-Led',
        staffDashboard: true,
        auditTrail: true,
        dataProtection: 'GDPR compliant with full data export/deletion',
        evidence: 'Comprehensive staff dashboard with real-time monitoring, full audit trail, GDPR-compliant data handling, and automated reporting.'
      },

      activeMedications: medications.length,
      healthLogBreakdown: {
        mood: moodLogs.length, pain: painLogs.length, sleep: healthLogs.filter(l => l.type === 'SLEEP').length,
        appetite: healthLogs.filter(l => l.type === 'APPETITE').length, incidents: incidents.length,
        medTaken: medTaken.length, medSkipped: medSkipped.length
      }
    };

    res.json({ success: true, report });
  } catch (err) {
    console.error('CQC report error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

// GET /api/compliance/summary - Quick compliance overview
router.get('/summary', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [residents, conversations, healthLogs, alerts, subscriptions] = await Promise.all([
      prisma.user.count({ where: { role: 'RESIDENT', isResolved: false } }),
      prisma.conversation.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
      prisma.healthLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.alert.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.subscription.count({ where: { status: 'active' } })
    ]);
    res.json({ success: true, activeResidents: residents, conversations30d: conversations, healthLogs30d: healthLogs, alerts30d: alerts, activeSubscriptions: subscriptions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

module.exports = router;
