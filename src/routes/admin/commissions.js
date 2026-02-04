// ============================================================
// WARDA - Commission Management Routes
// Handles referral commission tracking and payouts
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Commission tier thresholds
const COMMISSION_TIERS = {
  BRONZE: { min: 1, max: 10, rate: 0.10 },
  SILVER: { min: 11, max: 25, rate: 0.15 },
  GOLD: { min: 26, max: 50, rate: 0.20 },
  PLATINUM: { min: 51, max: Infinity, rate: 0.25 }
};

const BASE_PRICE = 25; // £25 per resident

// Helper to determine tier from referral count
function getTierFromCount(count) {
  if (count >= 51) return 'PLATINUM';
  if (count >= 26) return 'GOLD';
  if (count >= 11) return 'SILVER';
  return 'BRONZE';
}

// GET /api/admin/commissions - Get all care homes with commission data
router.get('/', async (req, res) => {
  try {
    const careHomes = await prisma.careHome.findMany({
      where: { status: 'ACTIVE' },
      include: {
        users: {
          where: { 
            isCommissionEligible: true,
            orderStatus: 'ACTIVE',
            billingType: 'FAMILY_PAYS'
          }
        },
        commissionPayouts: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
    
    const result = careHomes.map(ch => {
      const referralCount = ch.users.length;
      const tier = getTierFromCount(referralCount);
      const rate = COMMISSION_TIERS[tier].rate;
      const monthlyCommission = referralCount * BASE_PRICE * rate;
      
      return {
        id: ch.id,
        name: ch.name,
        referralCount,
        tier,
        rate: rate * 100 + '%',
        monthlyCommission,
        totalEarned: ch.totalCommissionEarned,
        balance: ch.commissionBalance,
        recentPayouts: ch.commissionPayouts
      };
    });
    
    const totals = {
      totalReferrals: result.reduce((sum, ch) => sum + ch.referralCount, 0),
      totalMonthlyCommission: result.reduce((sum, ch) => sum + ch.monthlyCommission, 0),
      totalBalance: result.reduce((sum, ch) => sum + ch.balance, 0)
    };
    
    res.json({ careHomes: result, totals });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ error: 'Failed to fetch commission data' });
  }
});

// GET /api/admin/commissions/:careHomeId - Get commission details for a care home
router.get('/:careHomeId', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    
    const careHome = await prisma.careHome.findUnique({
      where: { id: careHomeId },
      include: {
        users: {
          where: { 
            isCommissionEligible: true,
            billingType: 'FAMILY_PAYS'
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            orderStatus: true,
            activatedAt: true
          }
        },
        commissionPayouts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!careHome) {
      return res.status(404).json({ error: 'Care home not found' });
    }
    
    const activeReferrals = careHome.users.filter(u => u.orderStatus === 'ACTIVE');
    const tier = getTierFromCount(activeReferrals.length);
    const rate = COMMISSION_TIERS[tier].rate;
    
    res.json({
      careHome: {
        id: careHome.id,
        name: careHome.name,
        bankAccountName: careHome.bankAccountName,
        bankAccountNumber: careHome.bankAccountNumber ? '****' + careHome.bankAccountNumber.slice(-4) : null,
        bankSortCode: careHome.bankSortCode
      },
      commission: {
        tier,
        rate: rate * 100 + '%',
        activeReferrals: activeReferrals.length,
        monthlyAmount: activeReferrals.length * BASE_PRICE * rate,
        totalEarned: careHome.totalCommissionEarned,
        balance: careHome.commissionBalance
      },
      referrals: careHome.users,
      payouts: careHome.commissionPayouts
    });
  } catch (error) {
    console.error('Get commission details error:', error);
    res.status(500).json({ error: 'Failed to fetch commission details' });
  }
});

// POST /api/admin/commissions/calculate - Calculate commissions for a period
router.post('/calculate', async (req, res) => {
  try {
    const { period } = req.body; // Format: "2026-02"
    
    const careHomes = await prisma.careHome.findMany({
      where: { status: 'ACTIVE' },
      include: {
        users: {
          where: { 
            isCommissionEligible: true,
            orderStatus: 'ACTIVE',
            billingType: 'FAMILY_PAYS'
          }
        }
      }
    });
    
    const calculations = [];
    
    for (const ch of careHomes) {
      const referralCount = ch.users.length;
      if (referralCount === 0) continue;
      
      const tier = getTierFromCount(referralCount);
      const rate = COMMISSION_TIERS[tier].rate;
      const amount = referralCount * BASE_PRICE * rate;
      
      calculations.push({
        careHomeId: ch.id,
        careHomeName: ch.name,
        referrals: referralCount,
        tier,
        rate,
        amount
      });
    }
    
    res.json({ 
      period, 
      calculations,
      total: calculations.reduce((sum, c) => sum + c.amount, 0)
    });
  } catch (error) {
    console.error('Calculate commissions error:', error);
    res.status(500).json({ error: 'Failed to calculate commissions' });
  }
});

// POST /api/admin/commissions/payout - Create payout records
router.post('/payout', async (req, res) => {
  try {
    const { period, payouts } = req.body; // payouts: [{careHomeId, amount, referrals, rate}]
    
    const created = [];
    
    for (const payout of payouts) {
      const record = await prisma.commissionPayout.create({
        data: {
          careHomeId: payout.careHomeId,
          amount: payout.amount,
          period,
          referrals: payout.referrals,
          rate: payout.rate,
          status: 'PENDING'
        }
      });
      
      // Update care home balance
      await prisma.careHome.update({
        where: { id: payout.careHomeId },
        data: {
          commissionBalance: { increment: payout.amount }
        }
      });
      
      created.push(record);
    }
    
    res.json({ success: true, payouts: created });
  } catch (error) {
    console.error('Create payouts error:', error);
    res.status(500).json({ error: 'Failed to create payouts' });
  }
});

// POST /api/admin/commissions/payout/:id/mark-paid - Mark payout as paid
router.post('/payout/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;
    
    const payout = await prisma.commissionPayout.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        reference
      }
    });
    
    // Update care home totals
    await prisma.careHome.update({
      where: { id: payout.careHomeId },
      data: {
        totalCommissionEarned: { increment: payout.amount },
        commissionBalance: { decrement: payout.amount }
      }
    });
    
    res.json({ success: true, payout });
  } catch (error) {
    console.error('Mark payout paid error:', error);
    res.status(500).json({ error: 'Failed to mark payout as paid' });
  }
});

// PUT /api/admin/commissions/:careHomeId/bank-details - Update bank details
router.put('/:careHomeId/bank-details', async (req, res) => {
  try {
    const { careHomeId } = req.params;
    const { bankAccountName, bankAccountNumber, bankSortCode } = req.body;
    
    await prisma.careHome.update({
      where: { id: careHomeId },
      data: { bankAccountName, bankAccountNumber, bankSortCode }
    });
    
    res.json({ success: true, message: 'Bank details updated' });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({ error: 'Failed to update bank details' });
  }
});

module.exports = router;
