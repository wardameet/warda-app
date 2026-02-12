/**
 * Zod Input Validation Schemas
 * Validates all user input before it reaches route handlers
 */
const { z } = require('zod');

// ─── Auth Schemas ──────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(6, 'Password too short').max(128),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(8, 'Min 8 characters').max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
});

const pinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  deviceId: z.string().max(255).optional(),
  activationCode: z.string().max(50).optional(),
});

// ─── Resident/User Schemas ─────────────────────────
const residentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255).optional().nullable(),
  dateOfBirth: z.string().optional(),
  roomNumber: z.string().max(20).optional(),
  careHomeId: z.string().uuid().optional(),
});

// ─── Message Schemas ───────────────────────────────
const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000),
  recipientId: z.string().uuid().optional(),
  type: z.enum(['TEXT', 'PHOTO', 'VOICE', 'VIDEO', 'SYSTEM']).optional(),
});

// ─── Conversation Schemas ──────────────────────────
const conversationSchema = z.object({
  message: z.string().min(1).max(10000),
  userId: z.string().uuid(),
  type: z.enum(['text', 'voice']).optional(),
});

// ─── Medication Schemas ────────────────────────────
const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  timeOfDay: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
  userId: z.string().uuid(),
});

// ─── Alert Schemas ─────────────────────────────────
const alertSchema = z.object({
  type: z.enum(['MOOD', 'HEALTH', 'MEDICATION', 'HELP', 'FALL', 'SYSTEM']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  message: z.string().min(1).max(1000),
  userId: z.string().uuid().optional(),
  residentId: z.string().uuid().optional(),
});

// ─── Health Log Schemas ────────────────────────────
const healthLogSchema = z.object({
  type: z.string().min(1).max(50),
  value: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  userId: z.string().uuid(),
});

// ─── Family Contact Schemas ────────────────────────
const familyContactSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  relationship: z.string().max(50).optional(),
  residentId: z.string().uuid(),
});

// ─── Care Home Schemas ─────────────────────────────
const careHomeSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  managerEmail: z.string().email().max(255).optional(),
  billingEmail: z.string().email().max(255).optional(),
});

// ─── B2C Signup ────────────────────────────────────
const b2cSignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  elderlyName: z.string().min(1).max(200),
});

// ─── UUID param validator ──────────────────────────
const uuidParam = z.string().uuid('Invalid ID format');

// ─── Pagination ────────────────────────────────────
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Express middleware factory — validates req.body against a Zod schema
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Validates req.params.id as UUID
 */
function validateId(paramName = 'id') {
  return (req, res, next) => {
    try {
      uuidParam.parse(req.params[paramName]);
      next();
    } catch (error) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
  };
}

/**
 * Validates query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      next(error);
    }
  };
}

module.exports = {
  loginSchema, registerSchema, pinLoginSchema,
  residentSchema, messageSchema, conversationSchema,
  medicationSchema, alertSchema, healthLogSchema,
  familyContactSchema, careHomeSchema, b2cSignupSchema,
  paginationSchema, uuidParam,
  validate, validateId, validateQuery,
  z
};
