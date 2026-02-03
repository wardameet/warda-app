/**
 * WARDA - Production WebSocket Service
 * =====================================
 * Real-time layer for alerts, messaging, presence tracking
 * 
 * Room Structure:
 *   user:{userId}           - Personal room (1 user)
 *   care_home:{careHomeId}  - All staff in a care home
 *   family:{residentId}     - All family members watching a resident
 *   tablet:{residentId}     - The resident's tablet connection
 *   staff:{careHomeId}      - Staff-only channel (alerts)
 * 
 * Events Emitted:
 *   alert:new               - New alert (mood, health, help)
 *   alert:resolved          - Alert marked resolved
 *   message:new             - New message delivered
 *   message:read            - Message read confirmation
 *   presence:update         - User online/offline status
 *   presence:list           - Current online users in a room
 *   tablet:status           - Tablet connection status
 *   typing:start            - User started typing
 *   typing:stop             - User stopped typing
 *   call:incoming           - Incoming video call
 *   call:accepted           - Call accepted
 *   call:rejected           - Call rejected
 *   call:ended              - Call ended
 *   help:pressed            - Help button pressed (urgent)
 *   warda:speaking          - Warda is speaking to resident
 *   warda:listening         - Warda is listening to resident
 *   photo:new               - New photo shared
 */

const { PrismaClient } = require('@prisma/client');
const { cacheSet, cacheGet, cacheDelete, publish } = require('./redis');

const prisma = new PrismaClient();

// In-memory presence tracking (backed by Redis when available)
const connectedUsers = new Map(); // socketId -> { userId, role, careHomeId, residentId }
const userSockets = new Map();    // `${role}:${userId}` -> Set<socketId>

/**
 * Get the socket key for a user
 */
function socketKey(role, userId) {
  return `${role}:${userId}`;
}

/**
 * Track a user connection
 */
function trackConnection(socketId, userData) {
  connectedUsers.set(socketId, userData);
  const key = socketKey(userData.role, userData.userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  userSockets.get(key).add(socketId);
  
  // Also cache in Redis for distributed presence
  cacheSet(`presence:${key}`, {
    online: true,
    lastSeen: new Date().toISOString(),
    socketCount: userSockets.get(key).size
  }, 3600);
}

/**
 * Remove a user connection
 */
function removeConnection(socketId) {
  const userData = connectedUsers.get(socketId);
  if (!userData) return null;
  
  connectedUsers.delete(socketId);
  const key = socketKey(userData.role, userData.userId);
  const sockets = userSockets.get(key);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(key);
      // Mark offline in Redis
      cacheSet(`presence:${key}`, {
        online: false,
        lastSeen: new Date().toISOString(),
        socketCount: 0
      }, 86400); // Keep offline status for 24h
    }
  }
  return userData;
}

/**
 * Check if a user is online
 */
function isUserOnline(role, userId) {
  const key = socketKey(role, userId);
  return userSockets.has(key) && userSockets.get(key).size > 0;
}

/**
 * Get online users for a care home
 */
function getOnlineUsersForCareHome(careHomeId) {
  const online = [];
  for (const [, userData] of connectedUsers) {
    if (userData.careHomeId === careHomeId) {
      online.push({
        userId: userData.userId,
        role: userData.role,
        residentId: userData.residentId || null
      });
    }
  }
  // Deduplicate by userId
  const seen = new Set();
  return online.filter(u => {
    const key = `${u.role}:${u.userId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Initialize Socket.io handlers
 */
function initializeSocket(io) {
  
  // ============================================================
  // CONNECTION HANDLER
  // ============================================================
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ----------------------------------------------------------
    // AUTHENTICATE & JOIN ROOMS
    // ----------------------------------------------------------
    socket.on('auth', async (data) => {
      try {
        const { userId, role, careHomeId, residentId, name } = data;
        
        if (!userId || !role) {
          socket.emit('auth:error', { message: 'userId and role are required' });
          return;
        }

        // Validate role
        const validRoles = ['tablet', 'staff', 'family', 'admin', 'manager'];
        if (!validRoles.includes(role)) {
          socket.emit('auth:error', { message: 'Invalid role' });
          return;
        }

        // Store user data
        const userData = { userId, role, careHomeId, residentId, name: name || 'Unknown' };
        trackConnection(socket.id, userData);

        // Join personal room
        socket.join(`user:${userId}`);

        // Join role-specific rooms
        switch (role) {
          case 'tablet':
            // Tablet joins its resident room
            if (residentId) {
              socket.join(`tablet:${residentId}`);
            }
            if (careHomeId) {
              socket.join(`care_home:${careHomeId}`);
            }
            break;

          case 'staff':
          case 'manager':
            // Staff/manager joins care home room
            if (careHomeId) {
              socket.join(`care_home:${careHomeId}`);
              socket.join(`staff:${careHomeId}`);
            }
            break;

          case 'family':
            // Family joins their resident's family room
            if (residentId) {
              socket.join(`family:${residentId}`);
            }
            break;

          case 'admin':
            // Admin joins global admin room
            socket.join('admin:global');
            break;
        }

        // Confirm auth
        socket.emit('auth:success', { 
          userId, 
          role, 
          rooms: Array.from(socket.rooms) 
        });

        // Broadcast presence update to care home
        if (careHomeId) {
          io.to(`care_home:${careHomeId}`).emit('presence:update', {
            userId,
            role,
            name: userData.name,
            status: 'online',
            timestamp: new Date().toISOString()
          });
        }

        // If tablet connecting, notify staff
        if (role === 'tablet' && careHomeId) {
          io.to(`staff:${careHomeId}`).emit('tablet:status', {
            residentId,
            status: 'online',
            timestamp: new Date().toISOString()
          });
        }

        console.log(`✅ Auth: ${role} ${name || userId} joined ${Array.from(socket.rooms).join(', ')}`);

      } catch (error) {
        console.error('Auth error:', error);
        socket.emit('auth:error', { message: 'Authentication failed' });
      }
    });

    // ----------------------------------------------------------
    // HELP BUTTON (URGENT)
    // ----------------------------------------------------------
    socket.on('help:press', async (data) => {
      try {
        const { residentId, residentName, careHomeId } = data;
        console.log(`🆘 HELP pressed by ${residentName} (${residentId})`);

        // 1. Save alert to database
        let alert = null;
        try {
          alert = await prisma.alert.create({
            data: {
              type: 'HELP_BUTTON',
              severity: 'critical',
              message: `${residentName} pressed the help button`,
              userId: residentId,
            }
          });
        } catch (dbErr) {
          console.error('Failed to save help alert to DB:', dbErr);
        }

        const alertPayload = {
          id: alert?.id || `help_${Date.now()}`,
          type: 'HELP_BUTTON',
          severity: 'critical',
          residentId,
          residentName,
          careHomeId,
          message: `${residentName} pressed the help button`,
          timestamp: new Date().toISOString(),
          isResolved: false
        };

        // 2. Notify all staff in the care home (real-time)
        io.to(`staff:${careHomeId}`).emit('alert:new', alertPayload);

        // 3. Notify admin
        io.to('admin:global').emit('alert:new', alertPayload);

        // 4. Notify family members
        io.to(`family:${residentId}`).emit('alert:new', alertPayload);

        // 5. Publish to Redis for distributed systems
        await publish('alerts', alertPayload);

        // 6. Confirm to tablet
        socket.emit('help:confirmed', { 
          message: 'Help is on the way!',
          alertId: alert?.id 
        });

      } catch (error) {
        console.error('Help button error:', error);
        socket.emit('help:error', { message: 'Failed to send help alert' });
      }
    });

    // ----------------------------------------------------------
    // ALERT MANAGEMENT
    // ----------------------------------------------------------
    socket.on('alert:resolve', async (data) => {
      try {
        const { alertId, resolvedBy } = data;

        // Update in database
        const alert = await prisma.alert.update({
          where: { id: alertId },
          data: { 
            isResolved: true, 
            resolvedBy, 
            resolvedAt: new Date() 
          },
          include: { user: true }
        });

        const careHomeId = alert.user?.careHomeId;

        // Broadcast resolution
        const payload = {
          alertId,
          resolvedBy,
          resolvedAt: new Date().toISOString()
        };

        if (careHomeId) {
          io.to(`staff:${careHomeId}`).emit('alert:resolved', payload);
        }
        io.to('admin:global').emit('alert:resolved', payload);

        console.log(`✅ Alert ${alertId} resolved by ${resolvedBy}`);
      } catch (error) {
        console.error('Alert resolve error:', error);
      }
    });

    // ----------------------------------------------------------
    // MESSAGE DELIVERY
    // ----------------------------------------------------------
    
    // Family/Staff sends message TO resident (Warda reads aloud)
    socket.on('message:send_to_resident', async (data) => {
      try {
        const { residentId, senderId, senderName, senderRole, content, type } = data;
        
        // Save message to database
        let message = null;
        try {
          message = await prisma.message.create({
            data: {
              content,
              sender: senderId,
              type: type || 'text',
              userId: residentId,
              isFromWarda: false
            }
          });
        } catch (dbErr) {
          console.error('Failed to save message to DB:', dbErr);
        }

        const messagePayload = {
          id: message?.id || `msg_${Date.now()}`,
          content,
          senderId,
          senderName,
          senderRole,
          type: type || 'text',
          residentId,
          timestamp: new Date().toISOString(),
          readAloud: true // Signal tablet to have Warda read it
        };

        // 1. Deliver to tablet
        io.to(`tablet:${residentId}`).emit('message:new', messagePayload);

        // 2. Confirm delivery to sender
        socket.emit('message:delivered', {
          messageId: messagePayload.id,
          residentId,
          deliveredAt: new Date().toISOString()
        });

        // 3. Notify other family members
        if (senderRole === 'family') {
          socket.to(`family:${residentId}`).emit('message:new', {
            ...messagePayload,
            readAloud: false // Other family just see it, don't read aloud
          });
        }

        console.log(`💬 Message from ${senderRole} ${senderName} → resident ${residentId}`);
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    // Resident sends message TO family (via Warda)
    socket.on('message:send_to_family', async (data) => {
      try {
        const { residentId, residentName, familyContactId, content } = data;

        // Save message to database
        let message = null;
        try {
          message = await prisma.message.create({
            data: {
              content,
              sender: residentId,
              type: 'text',
              userId: residentId,
              isFromWarda: false
            }
          });
        } catch (dbErr) {
          console.error('Failed to save family message to DB:', dbErr);
        }

        const messagePayload = {
          id: message?.id || `msg_${Date.now()}`,
          content,
          residentId,
          residentName,
          familyContactId,
          type: 'text',
          timestamp: new Date().toISOString()
        };

        // 1. Deliver to specific family member
        if (familyContactId) {
          io.to(`user:${familyContactId}`).emit('message:from_resident', messagePayload);
        }

        // 2. Also broadcast to all family watching this resident
        io.to(`family:${residentId}`).emit('message:from_resident', messagePayload);

        // 3. Confirm to tablet
        socket.emit('message:sent', {
          messageId: messagePayload.id,
          sentTo: familyContactId || 'all_family',
          sentAt: new Date().toISOString()
        });

        console.log(`💬 Resident ${residentName} → family`);
      } catch (error) {
        console.error('Message to family error:', error);
        socket.emit('message:error', { message: 'Failed to send message to family' });
      }
    });

    // Staff sends message to resident
    socket.on('message:staff_to_resident', async (data) => {
      try {
        const { residentId, staffId, staffName, content } = data;

        const messagePayload = {
          id: `msg_${Date.now()}`,
          content,
          senderId: staffId,
          senderName: staffName,
          senderRole: 'staff',
          type: 'text',
          residentId,
          timestamp: new Date().toISOString(),
          readAloud: true
        };

        // Deliver to tablet
        io.to(`tablet:${residentId}`).emit('message:new', messagePayload);

        // Confirm to staff
        socket.emit('message:delivered', {
          messageId: messagePayload.id,
          residentId,
          deliveredAt: new Date().toISOString()
        });

        console.log(`💬 Staff ${staffName} → resident ${residentId}`);
      } catch (error) {
        console.error('Staff message error:', error);
      }
    });

    // ----------------------------------------------------------
    // MOOD / AI ALERTS (from conversation engine)
    // ----------------------------------------------------------
    socket.on('alert:mood', async (data) => {
      try {
        const { residentId, residentName, careHomeId, mood, severity, message } = data;

        // Save alert to database
        let alert = null;
        try {
          alert = await prisma.alert.create({
            data: {
              type: 'MOOD',
              severity: severity || 'medium',
              message: message || `${residentName} is feeling ${mood}`,
              userId: residentId
            }
          });
        } catch (dbErr) {
          console.error('Failed to save mood alert:', dbErr);
        }

        const alertPayload = {
          id: alert?.id || `mood_${Date.now()}`,
          type: 'MOOD',
          severity: severity || 'medium',
          residentId,
          residentName,
          careHomeId,
          mood,
          message: message || `${residentName} is feeling ${mood}`,
          timestamp: new Date().toISOString(),
          isResolved: false
        };

        // Notify staff
        io.to(`staff:${careHomeId}`).emit('alert:new', alertPayload);

        // Notify family (for medium+ severity)
        if (severity !== 'low') {
          io.to(`family:${residentId}`).emit('alert:new', alertPayload);
        }

        // Notify admin
        io.to('admin:global').emit('alert:new', alertPayload);

      } catch (error) {
        console.error('Mood alert error:', error);
      }
    });

    // ----------------------------------------------------------
    // PHOTO SHARING
    // ----------------------------------------------------------
    socket.on('photo:shared', (data) => {
      const { residentId, senderId, senderName, photoUrl, caption } = data;

      const photoPayload = {
        id: `photo_${Date.now()}`,
        residentId,
        senderId,
        senderName,
        photoUrl,
        caption,
        timestamp: new Date().toISOString()
      };

      // Deliver to tablet
      io.to(`tablet:${residentId}`).emit('photo:new', photoPayload);

      // Notify other family members
      socket.to(`family:${residentId}`).emit('photo:new', photoPayload);

      console.log(`📸 Photo from ${senderName} → resident ${residentId}`);
    });

    // ----------------------------------------------------------
    // TYPING INDICATORS
    // ----------------------------------------------------------
    socket.on('typing:start', (data) => {
      const { senderId, senderName, targetRoom } = data;
      socket.to(targetRoom).emit('typing:start', { senderId, senderName });
    });

    socket.on('typing:stop', (data) => {
      const { senderId, targetRoom } = data;
      socket.to(targetRoom).emit('typing:stop', { senderId });
    });

    // ----------------------------------------------------------
    // WARDA STATUS (what Warda is doing with resident)
    // ----------------------------------------------------------
    socket.on('warda:status', (data) => {
      const { residentId, status, careHomeId } = data;
      // status: 'idle', 'listening', 'speaking', 'chatting'

      const statusPayload = {
        residentId,
        status,
        timestamp: new Date().toISOString()
      };

      // Tell family members
      io.to(`family:${residentId}`).emit('warda:status', statusPayload);

      // Tell staff
      if (careHomeId) {
        io.to(`staff:${careHomeId}`).emit('warda:status', statusPayload);
      }
    });

    // ----------------------------------------------------------
    // VIDEO CALL SIGNALING
    // ----------------------------------------------------------
    socket.on('call:initiate', (data) => {
      const { callerId, callerName, recipientId, callerPhotoUrl } = data;
      io.to(`tablet:${recipientId}`).emit('call:incoming', {
        callerId,
        callerName,
        callerPhotoUrl,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('call:accept', (data) => {
      const { callerId, recipientId } = data;
      io.to(`user:${callerId}`).emit('call:accepted', { recipientId });
    });

    socket.on('call:reject', (data) => {
      const { callerId, recipientId } = data;
      io.to(`user:${callerId}`).emit('call:rejected', { recipientId });
    });

    socket.on('call:end', (data) => {
      const { otherUserId } = data;
      io.to(`user:${otherUserId}`).emit('call:ended');
    });

    // ----------------------------------------------------------
    // PRESENCE QUERIES
    // ----------------------------------------------------------
    socket.on('presence:who_online', (data) => {
      const { careHomeId } = data;
      const onlineUsers = getOnlineUsersForCareHome(careHomeId);
      socket.emit('presence:list', { 
        careHomeId, 
        users: onlineUsers,
        timestamp: new Date().toISOString() 
      });
    });

    socket.on('presence:is_online', (data) => {
      const { role, userId } = data;
      socket.emit('presence:status', {
        userId,
        role,
        online: isUserOnline(role, userId),
        timestamp: new Date().toISOString()
      });
    });

    // ----------------------------------------------------------
    // DISCONNECT
    // ----------------------------------------------------------
    socket.on('disconnect', () => {
      const userData = removeConnection(socket.id);
      
      if (userData) {
        // Broadcast offline status to care home
        if (userData.careHomeId) {
          io.to(`care_home:${userData.careHomeId}`).emit('presence:update', {
            userId: userData.userId,
            role: userData.role,
            name: userData.name,
            status: 'offline',
            timestamp: new Date().toISOString()
          });

          // If tablet went offline, alert staff
          if (userData.role === 'tablet') {
            io.to(`staff:${userData.careHomeId}`).emit('tablet:status', {
              residentId: userData.residentId,
              status: 'offline',
              timestamp: new Date().toISOString()
            });
          }
        }

        console.log(`🔌 Disconnected: ${userData.role} ${userData.name || userData.userId}`);
      } else {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      }
    });

    // ----------------------------------------------------------
    // ERROR HANDLER
    // ----------------------------------------------------------
    socket.on('error', (error) => {
      console.error(`Socket error (${socket.id}):`, error);
    });
  });

  console.log('✅ WebSocket service initialized with full event handling');
}

// ============================================================
// HELPER: Emit alert from HTTP routes (non-socket context)
// ============================================================

/**
 * Broadcast an alert from an API route
 * Usage in routes: const { broadcastAlert } = require('../services/socket');
 *                  broadcastAlert(req.app.get('io'), alertData);
 */
function broadcastAlert(io, { type, severity, message, residentId, residentName, careHomeId }) {
  const alertPayload = {
    id: `alert_${Date.now()}`,
    type,
    severity,
    residentId,
    residentName,
    careHomeId,
    message,
    timestamp: new Date().toISOString(),
    isResolved: false
  };

  io.to(`staff:${careHomeId}`).emit('alert:new', alertPayload);
  io.to('admin:global').emit('alert:new', alertPayload);

  if (severity !== 'low') {
    io.to(`family:${residentId}`).emit('alert:new', alertPayload);
  }

  return alertPayload;
}

/**
 * Deliver a message from an API route to a tablet
 * Usage: deliverMessageToTablet(req.app.get('io'), { residentId, content, ... });
 */
function deliverMessageToTablet(io, { residentId, senderId, senderName, senderRole, content, type }) {
  const messagePayload = {
    id: `msg_${Date.now()}`,
    content,
    senderId,
    senderName,
    senderRole,
    type: type || 'text',
    residentId,
    timestamp: new Date().toISOString(),
    readAloud: true
  };

  io.to(`tablet:${residentId}`).emit('message:new', messagePayload);
  return messagePayload;
}

/**
 * Get presence info for a care home from an API route
 */
function getPresence(careHomeId) {
  return getOnlineUsersForCareHome(careHomeId);
}

module.exports = { 
  initializeSocket,
  broadcastAlert,
  deliverMessageToTablet,
  getPresence,
  isUserOnline
};
