import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = 'https://api.meetwarda.com/api';

export interface IncomingCall {
  meetingId: string;
  callerName: string;
  callerType: string;
  meeting: any;
  attendee: any;
}

export interface ActiveCall {
  meeting: any;
  attendee: any;
  callerName: string;
}

export const useVideoCall = (residentId: string | undefined) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);

  // Initialize socket
  useEffect(() => {
    if (!residentId) return;

    const newSocket = io(API_URL.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      auth: { residentId }
    });

    newSocket.on('connect', () => {
      console.log('Video call socket connected:', newSocket.id);
      newSocket.emit('join', { tabletId: `tablet:${residentId}`, residentId });
    });

    newSocket.on('call:incoming', (data: IncomingCall) => {
      console.log('Incoming call:', data);
      setIncomingCall(data);
    });

    newSocket.on('call:ended', () => {
      console.log('Call ended by remote');
      setIncomingCall(null);
      setActiveCall(null);
      setIsInCall(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [residentId]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !residentId) return null;
    
    try {
      const response = await axios.post(`${API_URL}/video/answer`, { residentId });
      if (response.data.success) {
        const callData = {
          meeting: response.data.meeting,
          attendee: response.data.attendee,
          callerName: incomingCall.callerName
        };
        setActiveCall(callData);
        setIncomingCall(null);
        setIsInCall(true);
        return callData;
      }
    } catch (err) {
      console.error('Failed to answer call:', err);
    }
    return null;
  }, [incomingCall, residentId]);

  const declineCall = useCallback(async () => {
    if (!residentId) return;
    
    try {
      await axios.post(`${API_URL}/video/end`, { residentId });
    } catch (err) {
      console.error('Failed to decline call:', err);
    }
    setIncomingCall(null);
  }, [residentId]);

  const endCall = useCallback(async () => {
    if (!residentId) return;
    
    try {
      await axios.post(`${API_URL}/video/end`, { residentId });
    } catch (err) {
      console.error('Failed to end call:', err);
    }
    setActiveCall(null);
    setIsInCall(false);
  }, [residentId]);

  return {
    incomingCall,
    activeCall,
    isInCall,
    answerCall,
    declineCall,
    endCall
  };
};
