// ============================================================
// WARDA - Tablet Authentication API
// Device activation and PIN login for tablets
// ============================================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'warda-tablet-secret-key';

// POST /api/tablet/activate - Activate device with code
router.post('/activate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Activation code required' });
    }
    
    const deviceCode = await prisma.deviceCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { careHome: { select: { id: true, name: true, logoUrl: true } } }
    });
    
    if (!deviceCode) {
      return res.status(404).json({ error: 'Invalid activation code' });
    }
    
    // Check status
    if (deviceCode.status === 'SUSPENDED') {
      return res.status(403).json({ 
        error: 'DEVICE_SUSPENDED',
        reason: deviceCode.suspendReason || 'This device has been suspended'
      });
    }
    
    if (deviceCode.status === 'REVOKED') {
      return res.status(403).json({ error: 'This activation code has been revoked' });
    }
    
    if (deviceCode.status === 'EXPIRED' || (deviceCode.expiresAt && new Date() > deviceCode.expiresAt)) {
      return res.status(403).json({ error: 'This activation code has expired' });
    }
    
    // Mark as activated
    await prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { 
        activatedAt: deviceCode.activatedAt || new Date(),
        lastValidatedAt: new Date()
      }
    });
    
    res.json({ 
      success: true,
      careHome: deviceCode.careHome,
      deviceName: deviceCode.deviceName
    });
  } catch (error) {
    console.error('Device activation error:', error);
    res.status(500).json({ error: 'Failed to activate device' });
  }
});

// POST /api/tablet/validate-code - Check if device code is still valid
router.post('/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Code required' });
    }
    
    const deviceCode = await prisma.deviceCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { careHome: { select: { id: true, name: true, logoUrl: true } } }
    });
    
    if (!deviceCode) {
      return res.json({ valid: false, error: 'INVALID_CODE' });
    }
    
    // Check expiry
    if (deviceCode.expiresAt && new Date() > deviceCode.expiresAt) {
      await prisma.deviceCode.update({
        where: { id: deviceCode.id },
        data: { status: 'EXPIRED' }
      });
      return res.json({ valid: false, error: 'CODE_EXPIRED' });
    }
    
    // Check status
    if (deviceCode.status === 'SUSPENDED') {
      return res.json({ 
        valid: false, 
        error: 'DEVICE_SUSPENDED',
        reason: deviceCode.suspendReason
      });
    }
    
    if (deviceCode.status !== 'ACTIVE') {
      return res.json({ valid: false, error: 'CODE_' + deviceCode.status });
    }
    
    // Update last validated
    await prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { lastValidatedAt: new Date() }
    });
    
    res.json({ 
      valid: true,
      careHome: deviceCode.careHome
    });
  } catch (error) {
    console.error('Validate code error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// POST /api/tablet/pin-login - Login with PIN (validates device code too)
router.post('/pin-login', async (req, res) => {
  try {
    const { pin, activationCode } = req.body;
    
    if (!pin || !activationCode) {
      return res.status(400).json({ error: 'PIN and activation code required' });
    }
    
    // First validate the device code
    const deviceCode = await prisma.deviceCode.findUnique({
      where: { code: activationCode.toUpperCase().trim() },
      include: { careHome: true }
    });
    
    if (!deviceCode) {
      return res.status(403).json({ error: 'INVALID_CODE', message: 'Invalid activation code' });
    }
    
    if (deviceCode.status === 'SUSPENDED') {
      return res.status(403).json({ 
        error: 'DEVICE_SUSPENDED',
        reason: deviceCode.suspendReason || 'Device suspended. Please contact support.'
      });
    }
    
    if (deviceCode.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'CODE_' + deviceCode.status });
    }
    
    if (deviceCode.expiresAt && new Date() > deviceCode.expiresAt) {
      return res.status(403).json({ error: 'CODE_EXPIRED' });
    }
    
    // Now find user by PIN within this care home
    const user = await prisma.user.findFirst({
      where: {
        pin: pin,
        careHomeId: deviceCode.careHomeId,
        status: 'ACTIVE'
      },
      include: {
        careHome: { select: { id: true, name: true } }
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    
    // Update device code last validated
    await prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { lastValidatedAt: new Date() }
    });
    
    // Check if PIN needs to be changed (first login or after reset)
    const requirePinChange = !user.pinChangedAt || user.pinResetAt;
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, careHomeId: user.careHomeId, type: 'tablet' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      token,
      requirePinChange,
      resident: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        preferredName: user.preferredName,
        photoUrl: user.photoUrl,
        careHomeId: user.careHomeId,
        careHomeName: user.careHome?.name
      }
    });
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/tablet/change-pin - Change PIN (after first login or voluntarily)
router.post('/change-pin', async (req, res) => {
  try {
    const { userId, currentPin, newPin } = req.body;
    
    if (!userId || !newPin) {
      return res.status(400).json({ error: 'User ID and new PIN required' });
    }
    
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be 4 digits' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If user has changed PIN before, require current PIN
    if (user.pinChangedAt && !user.pinResetAt) {
      if (!currentPin || currentPin !== user.pin) {
        return res.status(401).json({ error: 'Current PIN is incorrect' });
      }
    }
    
    // Check if new PIN is same as any other user in the care home
    const existingPin = await prisma.user.findFirst({
      where: {
        pin: newPin,
        careHomeId: user.careHomeId,
        id: { not: userId }
      }
    });
    
    if (existingPin) {
      return res.status(400).json({ error: 'This PIN is already in use. Please choose a different one.' });
    }
    
    // Update PIN
    await prisma.user.update({
      where: { id: userId },
      data: {
        pin: newPin,
        pinChangedAt: new Date(),
        pinResetAt: null, // Clear reset flag
        pinResetBy: null
      }
    });
    
    res.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});


// GET /api/tablet/status - Check device status (called every 24 hours by tablet)
router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, status: 'NOT_ACTIVATED' });
    }
    const code = authHeader.replace('Bearer ', '').trim().toUpperCase();
    const device = await prisma.deviceCode.findUnique({
      where: { code },
      include: {
        careHome: { select: { id: true, name: true, status: true } },
        assignedUser: {
          select: {
            id: true, firstName: true, lastName: true, preferredName: true,
            photoUrl: true, careHomeId: true, roomNumber: true,
            careHome: { select: { name: true } }
          }
        }
      }
    });
    if (!device) {
      return res.json({ success: false, status: 'NOT_ACTIVATED' });
    }
    if (device.careHome?.status === 'CANCELLED') {
      return res.json({ success: false, status: 'CANCELLED' });
    }
    if (device.careHome?.status === 'PAUSED') {
      return res.json({ success: false, status: 'SUSPENDED' });
    }
    if (device.status === 'REVOKED' || device.status === 'CANCELLED') {
      return res.json({ success: false, status: 'CANCELLED' });
    }
    if (device.status === 'SUSPENDED') {
      return res.json({ success: false, status: 'SUSPENDED' });
    }
    if (device.status === 'EXPIRED' || (device.expiresAt && new Date() > device.expiresAt)) {
      return res.json({ success: false, status: 'SUSPENDED' });
    }
    if (device.status !== 'ACTIVE') {
      return res.json({ success: false, status: 'NOT_ACTIVATED' });
    }
    if (!device.assignedUser) {
      return res.json({ success: false, status: 'NOT_ACTIVATED', message: 'No resident assigned' });
    }
    await prisma.deviceCode.update({
      where: { id: device.id },
      data: { lastValidatedAt: new Date() }
    });
    const r = device.assignedUser;
    res.json({
      success: true,
      status: 'ACTIVE',
      resident: {
        id: r.id, firstName: r.firstName, lastName: r.lastName,
        preferredName: r.preferredName, photoUrl: r.photoUrl,
        careHomeId: r.careHomeId, careHomeName: r.careHome?.name,
        roomNumber: r.roomNumber
      }
    });
  } catch (error) {
    console.error('Device status check error:', error);
    res.status(500).json({ success: false, error: 'Status check failed' });
  }
});
module.exports = router;
