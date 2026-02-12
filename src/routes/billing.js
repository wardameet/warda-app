const { requireAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Stripe would be initialized with: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// For now, we build the full integration-ready structure

// ─── Pricing Plans ──────────────────────────────────────────
const PLANS = {
  b2b_standard: { id: 'b2b_standard', name: 'Care Home Standard', price: 2500, currency: 'gbp', interval: 'month', perResident: true, description: '£25/resident/month', features: ['AI companion for each resident', 'Staff dashboard', 'Family app access', 'Health monitoring', 'GP reports'] },
  b2b_premium: { id: 'b2b_premium', name: 'Care Home Premium', price: 3500, currency: 'gbp', interval: 'month', perResident: true, description: '£35/resident/month', features: ['Everything in Standard', 'Video calling', 'Advanced analytics', 'CQC compliance reports', 'Priority support', 'Custom branding'] },
  b2c_basic: { id: 'b2c_basic', name: 'Family Basic', price: 1999, currency: 'gbp', interval: 'month', perResident: false, description: '£19.99/month', features: ['AI companion', 'Family app', 'Basic health tracking', 'Medication reminders'] },
  b2c_plus: { id: 'b2c_plus', name: 'Family Plus', price: 2999, currency: 'gbp', interval: 'month', perResident: false, description: '£29.99/month', features: ['Everything in Basic', 'Video calling', 'GP health reports', 'Activities & games', 'Priority support'] },
  b2c_premium: { id: 'b2c_premium', name: 'Family Premium', price: 3999, currency: 'gbp', interval: 'month', perResident: false, description: '£39.99/month', features: ['Everything in Plus', 'Tablet included (lease)', 'Setup assistance', 'Dedicated support line'] },
};

// GET /api/billing/plans - List available plans
router.get('/plans', (req, res) => {
  const { type } = req.query;
  let plans = Object.values(PLANS);
  if (type === 'b2b') plans = plans.filter(p => p.id.startsWith('b2b'));
  if (type === 'b2c') plans = plans.filter(p => p.id.startsWith('b2c'));
  res.json({ success: true, plans });
});

// GET /api/billing/plan/:planId - Get plan details
router.get('/plan/:planId', (req, res) => {
  const plan = PLANS[req.params.planId];
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ success: true, plan });
});

// POST /api/billing/subscribe - Create subscription (Stripe-ready)
router.post('/subscribe', async (req, res) => {
  try {
    const { planId, careHomeId, email, name, residentCount } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    // Calculate total
    const total = plan.perResident ? plan.price * (residentCount || 1) : plan.price;

    // In production: create Stripe customer + subscription
    // const customer = await stripe.customers.create({ email, name, metadata: { careHomeId, planId } });
    // const subscription = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: stripePriceId }], quantity: residentCount });

    // Store subscription record
    const subscription = await prisma.subscription.create({
      data: {
        careHomeId: careHomeId || null,
        email,
        name,
        planId,
        planName: plan.name,
        amount: total,
        currency: plan.currency,
        interval: plan.interval,
        residentCount: residentCount || 1,
        status: 'active',
        stripeCustomerId: null, // Will be set when Stripe is connected
        stripeSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });

    res.json({ success: true, subscription, message: 'Subscription created. Stripe payment integration pending.' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ success: false, error: 'Subscription failed' });
  }
});

// GET /api/billing/subscriptions - List subscriptions (admin)
router.get('/subscriptions', async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type === 'b2b') where.careHomeId = { not: null };
    if (type === 'b2c') where.careHomeId = null;

    const subscriptions = await prisma.subscription.findMany({ where, orderBy: { createdAt: 'desc' } });

    const totalMRR = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0);

    res.json({ success: true, subscriptions, totalMRR, totalMRRFormatted: '£' + (totalMRR / 100).toFixed(2) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list subscriptions' });
  }
});

// PUT /api/billing/subscriptions/:id - Update subscription
router.put('/subscriptions/:id', async (req, res) => {
  try {
    const sub = await prisma.subscription.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// POST /api/billing/webhook - Stripe webhook handler (ready for production)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // In production:
  // const sig = req.headers['stripe-signature'];
  // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  // Handle events:
  // payment_intent.succeeded -> activate subscription
  // invoice.paid -> extend period
  // invoice.payment_failed -> notify admin
  // customer.subscription.deleted -> deactivate

  res.json({ received: true });
});

// GET /api/billing/invoices/:subscriptionId - Get invoice history
router.get('/invoices/:subscriptionId', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: req.params.subscriptionId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

module.exports = router;
