/**
 * Socket.io Service
 * Handles real-time communication for messages and calls
 */

const { publish } = require('./redis');

function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user's personal room
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    });

    // Join care home room (for staff)
    socket.on('join_care_home', (careHomeId) => {
      socket.join(`care_home_${careHomeId}`);
      console.log(`🏠 Joined care home ${careHomeId}`);
    });

    // Handle typing indicator
    socket.on('typing', ({ senderId, recipientId }) => {
      io.to(`user_${recipientId}`).emit('user_typing', { userId: senderId });
    });

    // Handle stop typing
    socket.on('stop_typing', ({ senderId, recipientId }) => {
      io.to(`user_${recipientId}`).emit('user_stop_typing', { userId: senderId });
    });

    // Handle video call signaling
    socket.on('call_initiate', ({ callerId, recipientId, callerName }) => {
      io.to(`user_${recipientId}`).emit('incoming_call', {
        callerId,
        callerName,
        socketId: socket.id
      });
    });

    socket.on('call_accept', ({ callerId, recipientId }) => {
      io.to(`user_${callerId}`).emit('call_accepted', { recipientId });
    });

    socket.on('call_reject', ({ callerId, recipientId }) => {
      io.to(`user_${callerId}`).emit('call_rejected', { recipientId });
    });

    socket.on('call_end', ({ otherUserId }) => {
      io.to(`user_${otherUserId}`).emit('call_ended');
    });

    // Handle help button
    socket.on('help_pressed', async ({ residentId, residentName, careHomeId }) => {
      console.log(`🆘 HELP pressed by ${residentName} (${residentId})`);
      
      // Notify all staff in the care home
      io.to(`care_home_${careHomeId}`).emit('help_alert', {
        residentId,
        residentName,
        timestamp: new Date().toISOString(),
        urgent: true
      });

      // Also publish to Redis for distributed systems
      await publish('help_alerts', {
        residentId,
        residentName,
        careHomeId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle Warda status updates
    socket.on('warda_status', ({ residentId, status }) => {
      // Broadcast to family members watching
      io.to(`watching_${residentId}`).emit('resident_status', {
        residentId,
        status, // 'active', 'chatting', 'idle'
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocket };
