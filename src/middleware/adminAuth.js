/**
 * Admin Authentication Middleware
 * Verifies Cognito JWT tokens and enforces role-based access
 */

const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const prisma = require('../lib/prisma');

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

// JWKS client for token verification
const jwks = jwksClient({
  jwksUri: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    let adminUser;
    try {
      decoded = await verifyToken(token);
      adminUser = await prisma.adminUser.findUnique({
        where: { cognitoSub: decoded.sub },
        include: { careHome: true }
      });
    } catch (err) {
      // P1: Fallback to plain JWT for GP users
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'warda-gp-secret-2026');
        adminUser = await prisma.adminUser.findUnique({
          where: { id: decoded.id },
          include: { careHome: true }
        });
      } catch (jwtErr) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
      }
    }

    if (!adminUser) {
      return res.status(403).json({ success: false, error: 'Admin account not found' });
    }

    if (!adminUser.isActive) {
      return res.status(403).json({ success: false, error: 'Account is deactivated' });
    }

    req.adminUser = adminUser;
    req.adminRole = adminUser.role;
    req.careHomeId = adminUser.careHomeId;

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() }
    });

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!roles.includes(req.adminRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
}

function scopeToCareHome(req, res, next) {
  if (req.adminRole === 'SUPER_ADMIN') {
    req.scopedCareHomeId = req.query.careHomeId || req.body.careHomeId || null;
  } else {
    req.scopedCareHomeId = req.careHomeId;
  }
  next();
}

async function logAudit(adminUserId, action, entityType, entityId, details, ipAddress) {
  try {
    await prisma.auditLog.create({
      data: { adminUserId, action, entityType, entityId, details, ipAddress }
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

module.exports = {
  adminAuth,
  requireRole,
  scopeToCareHome,
  logAudit,
  cognitoClient,
  verifyToken
};
