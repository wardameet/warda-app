const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  ChimeSDKMeetingsClient,
  CreateMeetingWithAttendeesCommand,
  DeleteMeetingCommand,
  GetMeetingCommand,
  CreateAttendeeCommand
} = require('@aws-sdk/client-chime-sdk-meetings');

const chime = new ChimeSDKMeetingsClient({ region: 'eu-west-2' });

// Active calls stored in memory (residentId -> meetingData)
const activeCalls = new Map();

// POST /api/video/call - Family initiates call to resident
router.post('/call', async (req, res) => {
  try {
    const { residentId, callerId, callerName, callerType } = req.body;
    if (!residentId || !callerId) return res.status(400).json({ error: 'Missing residentId or callerId' });

    // Check for existing active call
    if (activeCalls.has(residentId)) {
      const existing = activeCalls.get(residentId);
      // Check if meeting still exists
      try {
        await chime.send(new GetMeetingCommand({ MeetingId: existing.meetingId }));
        return res.status(409).json({ error: 'Resident already in a call' });
      } catch (e) {
        activeCalls.delete(residentId); // Stale meeting, clean up
      }
    }

    // Get resident info
    const resident = await prisma.user.findUnique({ where: { id: residentId }, select: { firstName: true, lastName: true, preferredName: true } });
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // Create meeting with both attendees
    const meetingResponse = await chime.send(new CreateMeetingWithAttendeesCommand({
      ClientRequestToken: `warda-${residentId}-${Date.now()}`,
      MediaRegion: 'eu-west-2',
      ExternalMeetingId: `warda-call-${residentId}-${Date.now()}`,
      Attendees: [
        { ExternalUserId: `caller-${callerId}` },
        { ExternalUserId: `resident-${residentId}` }
      ]
    }));

    const meeting = meetingResponse.Meeting;
    const [callerAttendee, residentAttendee] = meetingResponse.Attendees;

    const callData = {
      meetingId: meeting.MeetingId,
      meeting,
      callerAttendee,
      residentAttendee,
      residentId,
      callerId,
      callerName: callerName || 'Family',
      callerType: callerType || 'family',
      startedAt: new Date().toISOString()
    };

    activeCalls.set(residentId, callData);

    // Notify tablet via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`tablet:${residentId}`).emit('call:incoming', {
        meetingId: meeting.MeetingId,
        callerName: callerName || 'Family',
        callerType: callerType || 'family',
        meeting,
        attendee: residentAttendee
      });
    }

    res.json({
      success: true,
      meeting,
      attendee: callerAttendee,
      residentName: resident.preferredName || resident.firstName
    });
  } catch (err) {
    console.error('Create call error:', err);
    res.status(500).json({ error: 'Failed to create call' });
  }
});

// POST /api/video/answer - Resident answers the call
router.post('/answer', async (req, res) => {
  try {
    const { residentId } = req.body;
    const callData = activeCalls.get(residentId);
    if (!callData) return res.status(404).json({ error: 'No active call' });

    res.json({
      success: true,
      meeting: callData.meeting,
      attendee: callData.residentAttendee
    });
  } catch (err) {
    console.error('Answer call error:', err);
    res.status(500).json({ error: 'Failed to answer' });
  }
});

// POST /api/video/end - End a call
router.post('/end', async (req, res) => {
  try {
    const { residentId, meetingId } = req.body;
    const mid = meetingId || activeCalls.get(residentId)?.meetingId;
    if (mid) {
      try { await chime.send(new DeleteMeetingCommand({ MeetingId: mid })); } catch (e) {}
    }
    activeCalls.delete(residentId);

    // Notify both sides
    const io = req.app.get('io');
    if (io) {
      io.to(`tablet:${residentId}`).emit('call:ended', { residentId });
      io.to(`family:${residentId}`).emit('call:ended', { residentId });
    }

    res.json({ success: true, message: 'Call ended' });
  } catch (err) {
    console.error('End call error:', err);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// GET /api/video/status/:residentId - Check if resident has active call
router.get('/status/:residentId', async (req, res) => {
  const callData = activeCalls.get(req.params.residentId);
  res.json({ active: !!callData, callerName: callData?.callerName, startedAt: callData?.startedAt });
});

module.exports = router;
