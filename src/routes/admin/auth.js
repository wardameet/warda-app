/**
 * Admin Auth Routes
 * Login, logout, token refresh, profile
 */

const express = require('express');
const router = express.Router();
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { PrismaClient } = require('@prisma/client');
const { adminAuth, logAudit } = require('../../middleware/adminAuth');

const prisma = require('../../lib/prisma');

const COGNITO_REGION = process.env.AWS_REGION || 'eu-west-2';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'eu-west-2_sozTMWhUG';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '6ktpvr06ac5dfig41s6394l25';

const cognitoClient = new CognitoIdentityProviderClient({
  region: COGNITO_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    let authResult;
    try {
      authResult = await cognitoClient.send(authCommand);
    } catch (err) {
      if (err.name === 'UserNotFoundException' || err.name === 'NotAuthorizedException') {
        // P1: Fallback to database auth for GP users not in Cognito
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const dbUser = await prisma.adminUser.findFirst({ where: { email: email.toLowerCase() }, include: { careHome: true } });
        if (dbUser && dbUser.tempPassword) {
          const match = await bcrypt.compare(password, dbUser.tempPassword);
          if (match) {
            const token = jwt.sign({ id: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name }, process.env.JWT_SECRET || 'warda-gp-secret-2026', { expiresIn: '8h' });
            await prisma.adminUser.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
            return res.json({ success: true, tokens: { accessToken: token, refreshToken: token }, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, careHome: dbUser.careHome } });
          }
        }
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
      if (err.name === 'UserNotConfirmedException') {
        return res.status(401).json({ success: false, error: 'Account not confirmed' });
      }
      if (err.name === 'PasswordResetRequiredException') {
        return res.status(401).json({ success: false, error: 'Password reset required', code: 'RESET_REQUIRED' });
      }
      throw err;
    }

    if (authResult.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.status(200).json({
        success: true,
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: authResult.Session,
        message: 'Please set a new password'
      });
    }

    const tokens = authResult.AuthenticationResult;

    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: email
    });
    const cognitoUser = await cognitoClient.send(getUserCommand);
    const sub = cognitoUser.UserAttributes.find(a => a.Name === 'sub')?.Value;

    let adminUser = await prisma.adminUser.findUnique({
      where: { cognitoSub: sub },
      include: { careHome: true }
    });

    if (!adminUser) {
      adminUser = await prisma.adminUser.findUnique({
        where: { email: email.toLowerCase() },
        include: { careHome: true }
      });

      if (adminUser && !adminUser.cognitoSub) {
        adminUser = await prisma.adminUser.update({
          where: { id: adminUser.id },
          data: { cognitoSub: sub },
          include: { careHome: true }
        });
      }
    }

    if (!adminUser) {
      return res.status(403).json({ success: false, error: 'No admin account found for this email' });
    }

    if (!adminUser.isActive) {
      return res.status(403).json({ success: false, error: 'Account is deactivated' });
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() }
    });

    await logAudit(adminUser.id, 'LOGIN', 'AdminUser', adminUser.id, null, req.ip);

    res.json({
      success: true,
      tokens: {
        accessToken: tokens.AccessToken,
        idToken: tokens.IdToken,
        refreshToken: tokens.RefreshToken,
        expiresIn: tokens.ExpiresIn
      },
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        careHomeId: adminUser.careHomeId,
        careHomeName: adminUser.careHome?.name || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/admin/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    });

    const result = await cognitoClient.send(command);
    const tokens = result.AuthenticationResult;

    res.json({
      success: true,
      tokens: {
        accessToken: tokens.AccessToken,
        idToken: tokens.IdToken,
        expiresIn: tokens.ExpiresIn
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ success: false, error: 'Token refresh failed' });
  }
});

// POST /api/admin/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email
    });

    await cognitoClient.send(command);

    res.json({ success: true, message: 'If an account exists, a reset code has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ success: true, message: 'If an account exists, a reset code has been sent' });
  }
});

// POST /api/admin/auth/confirm-reset
router.post('/confirm-reset', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, code, and new password are required' });
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword
    });

    await cognitoClient.send(command);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Confirm reset error:', error);
    res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
  }
});

// GET /api/admin/auth/me
router.get('/me', adminAuth, async (req, res) => {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: req.adminUser.id },
      include: { careHome: true }
    });

    res.json({
      success: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        careHomeId: adminUser.careHomeId,
        careHomeName: adminUser.careHome?.name || null,
        phone: adminUser.phone,
        lastLoginAt: adminUser.lastLoginAt,
        createdAt: adminUser.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// POST /api/admin/auth/logout
router.post('/logout', adminAuth, async (req, res) => {
  try {
    await logAudit(req.adminUser.id, 'LOGOUT', 'AdminUser', req.adminUser.id, null, req.ip);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.json({ success: true, message: 'Logged out' });
  }
});

module.exports = router;
