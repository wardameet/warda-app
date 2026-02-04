/**
 * WARDA - AI Companion for Elderly Care Homes
 * Main Server Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversation');
const familyRoutes = require('./routes/family');
const messagesRoutes = require('./routes/messages');
const voiceRoutes = require('./routes/voice');

// Real-time Routes
const alertRoutes = require('./routes/alerts');
const presenceRoutes = require('./routes/presence');

// Photo Sharing
const photoRoutes = require('./routes/photos');
const analyticsRoutes = require('./routes/analytics');
const pushRoutes = require('./routes/push');
const tabletRoutes = require('./routes/tablets');
const videoRoutes = require('./routes/video');
const browseRoutes = require('./routes/browse');
const { startProactiveScheduler } = require('./services/proactive');

// Admin Portal Routes
const adminAuthRoutes = require('./routes/admin/auth');
const adminCareHomeRoutes = require('./routes/admin/careHomes');
const adminResidentRoutes = require('./routes/admin/residents');
const adminStaffRoutes = require('./routes/admin/staff');
const adminFamilyRoutes = require('./routes/admin/family');

// Import services
const { initializeRedis } = require('./services/redis');
const { initializeSocket } = require('./services/socket');

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: ['https://app.meetwarda.com', 'https://admin.meetwarda.com', 'https://staff.meetwarda.com', 'https://family.meetwarda.com', 'https://meetwarda.com', 'http://13.40.187.182:3000', 'http://13.40.187.182:3002', 'http://13.40.187.182:3003', 'http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(cors({
  origin: ['https://app.meetwarda.com', 'https://admin.meetwarda.com', 'https://staff.meetwarda.com', 'https://family.meetwarda.com', 'https://meetwarda.com', 'http://13.40.187.182:3000', 'http://13.40.187.182:3002', 'http://13.40.187.182:3003', 'http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/tablets', tabletRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/browse', browseRoutes);

// Admin Portal API
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/care-homes', adminCareHomeRoutes);
app.use('/api/admin/residents', adminResidentRoutes);
app.use('/api/admin/staff', adminStaffRoutes);
app.use('/api/admin', adminFamilyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Warda API',
    version: '1.0.0',
    status: 'running',
    message: "You're never alone 🌹"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize Redis connection
    await initializeRedis();
    console.log('✅ Redis connected');

    // Initialize Socket.io handlers
    initializeSocket(io);
    console.log('✅ Socket.io initialized');

    const PORT = process.env.PORT || 3001;
    startProactiveScheduler(io);
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🌹 WARDA API SERVER                     ║
║                                           ║
║   Status:  Running                        ║
║   Port:    ${PORT}                           ║
║   Env:     ${process.env.NODE_ENV || 'development'}                  ║
║                                           ║
║   "You're never alone"                    ║
║                                           ║
╚═══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
