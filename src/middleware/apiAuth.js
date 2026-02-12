/**
 * Universal API Auth Middleware
 * Protects all non-public endpoints
 * Supports: Cognito JWT, tablet PIN token, family JWT, GP JWT, care home JWT
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cognito JWKS client
const cognitoClient = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'eu-west-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true, cacheMaxAge: 600000
});

// Rate limiting for PIN attempts
const pinAttempts = new Map(); // ip -> { count, lastAttempt }
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout

function cleanupPinAttempts() {
  const now = Date.now();
  for (const [ip, data] of pinAttempts.entries()) {
    if (now - data.lastAttempt > PIN_LOCKOUT_MS) pinAttempts.delete(ip);
  }
}
setInterval(cleanupPinAttempts, 60000);

/**
 * Check PIN rate limit
 */
function checkPinRateLimit(ip) {
  const data = pinAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  if (now - data.lastAttempt > PIN_LOCKOUT_MS) {
    data.count = 0;
  }
  if (data.count >= MAX_PIN_ATTEMPTS) {
    return false; // Locked out
  }
  return true;
}

function recordPinAttempt(ip, success) {
  if (success) { pinAttempts.delete(ip); return; }
  const data = pinAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  data.count++;
  data.lastAttempt = Date.now();
  pinAttempts.set(ip, data);
}

/**
 * Verify any JWT token (Cognito or app-issued)
 */
async function verifyToken(token) {
  // Try Cognito first
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded?.header?.kid && decoded?.payload?.iss?.includes('cognito')) {
      const key = await new Promise((resolve, reject) => {
        cognitoClient.getSigningKey(decoded.header.kid, (err, k) => {
          if (err) reject(err); else resolve(k.getPublicKey());
        });
      });
      return jwt.verify(token, key);
    }
  } catch (e) { /* Not a Cognito token */ }

  // Try app-issued JWT secrets
  const secrets = [
    process.env.JWT_SECRET,
    process.env.FAMILY_JWT_SECRET,
    process.env.GP_JWT_SECRET,
    process.env.CAREHOME_JWT_SECRET,
  ].filter(Boolean);

  for (const secret of secrets) {
    try { return jwt.verify(token, secret); } catch (e) { continue; }
  }
  return null;
}

/**
 * Main auth middleware — attaches req.user if valid
 * Does NOT block if no token (use requireAuth for that)
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { next(); return; }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.userId = decoded.sub || decoded.userId || decoded.id;
    }
  } catch (e) { /* Invalid token, continue without auth */ }
  next();
}

/**
 * Strict auth middleware — blocks if no valid token
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    req.userId = decoded.sub || decoded.userId || decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/**
 * Tablet auth — accepts either JWT or device activation code
 * Tablet routes need to work for elderly users with PIN-based login
 */
async function tabletAuth(req, res, next) {
  // Check for Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = await verifyToken(token);
      if (decoded) { req.user = decoded; req.userId = decoded.sub || decoded.userId || decoded.id; return next(); }
    } catch (e) { /* Fall through */ }
  }

  // Check for tablet device header
  const deviceId = req.headers['x-device-id'] || req.headers['x-tablet-id'];
  if (deviceId) {
    try {
      const tablet = await prisma.tablet.findFirst({ where: { OR: [{ id: deviceId }, { activationCode: deviceId }] }, include: { user: true } });
      if (tablet?.user) { req.user = tablet.user; req.userId = tablet.user.id; return next(); }
    } catch (e) { /* Fall through */ }
  }

  // Check for residentId in params or query (for tablet-specific routes)
  const residentId = req.params.userId || req.params.residentId || req.query.residentId;
  if (residentId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: residentId }, select: { id: true, status: true } });
      if (user && user.status === 'ACTIVE') { req.user = user; req.userId = user.id; return next(); }
    } catch (e) { /* Fall through */ }
  }

  return res.status(401).json({ error: 'Tablet authentication required' });
}

module.exports = { optionalAuth, requireAuth, tabletAuth, verifyToken, checkPinRateLimit, recordPinAttempt };
