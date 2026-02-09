/**
 * useSocket - Tablet WebSocket Hook
 * ==================================
 * Connects tablet to Warda's real-time layer.
 * Handles: incoming messages, alerts, photos, presence, help button.
 * 
 * Usage:
 *   const { sendHelp, sendMessageToFamily, isConnected, incomingMessage } = useSocket(residentId, careHomeId);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.meetwarda.com';

// ============ TYPES ============

export interface IncomingMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  type: string;
  residentId: string;
  timestamp: string;
  readAloud: boolean;
}

export interface IncomingPhoto {
  id: string;
  residentId: string;
  senderId: string;
  senderName: string;
  photoUrl: string;
  caption?: string;
  timestamp: string;
}

export interface AlertData {
  id: string;
  type: string;
  severity: string;
  residentId: string;
  residentName: string;
  careHomeId: string;
  message: string;
  timestamp: string;
  isResolved: boolean;
}

export interface SocketState {
  isConnected: boolean;
  incomingMessage: IncomingMessage | null;
  incomingPhoto: IncomingPhoto | null;
  helpConfirmed: boolean;
  sendHelp: () => void;
  sendMessageToFamily: (familyContactId: string, content: string) => void;
  updateWardaStatus: (status: string) => void;
  dismissMessage: () => void;
  dismissPhoto: () => void;
  messageQueue: IncomingMessage[];
}

// ============ HOOK ============

export function useSocket(
  residentId: string,
  residentName: string,
  careHomeId: string
): SocketState {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState<IncomingMessage | null>(null);
  const [incomingPhoto, setIncomingPhoto] = useState<IncomingPhoto | null>(null);
  const [helpConfirmed, setHelpConfirmed] = useState(false);
  const [messageQueue, setMessageQueue] = useState<IncomingMessage[]>([]);
  const [incomingCall, setIncomingCall] = useState<any>(null);

  // Connect on mount
  useEffect(() => {
    if (!residentId || !careHomeId) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    // ---- Connection events ----
    socket.on('connect', () => {
      console.log('🔌 Tablet connected to Warda server');
      setIsConnected(true);

      // Authenticate as tablet
      socket.emit('auth', {
        userId: residentId,
        role: 'tablet',
        careHomeId,
        residentId,
        name: residentName,
      });
    });

    socket.on('auth:success', (data) => {
      console.log('✅ Tablet authenticated:', data.rooms);
    });

    socket.on('auth:error', (data) => {
      console.error('❌ Tablet auth failed:', data.message);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Tablet disconnected');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('🔌 Tablet reconnected');
      setIsConnected(true);
      // Re-authenticate on reconnect
      socket.emit('auth', {
        userId: residentId,
        role: 'tablet',
        careHomeId,
        residentId,
        name: residentName,
      });
    });

    // ---- Incoming messages ----
    socket.on('message:new', (message: IncomingMessage) => {
      console.log('💬 Incoming message:', message.senderName);
      // If there's already a message showing, queue it
      setIncomingMessage((current) => {
        if (current) {
          setMessageQueue((q) => [...q, message]);
          return current;
        }
        return message;
      });
    });

    // ---- Incoming photos ----
    socket.on('photo:new', (photo: IncomingPhoto) => {
      console.log('📸 Incoming photo from:', photo.senderName);
      setIncomingPhoto(photo);
    });

    // ---- Help confirmed ----
    socket.on('help:confirmed', (data) => {
      console.log('🆘 Help confirmed:', data.message);
      setHelpConfirmed(true);
      // Reset after 10 seconds
      setTimeout(() => setHelpConfirmed(false), 10000);
    });

    // ---- Incoming call ----
    socket.on('call:incoming', (data) => {
      console.log('📞 Incoming call from:', data.callerName); setIncomingCall(data);
    });

    // ---- Cleanup ----
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [residentId, residentName, careHomeId]);

  // ---- Send help alert ----
  const sendHelp = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('help:press', {
        residentId,
        residentName,
        careHomeId,
      });
    }
  }, [residentId, residentName, careHomeId]);

  // ---- Send message to family ----
  const sendMessageToFamily = useCallback(
    (familyContactId: string, content: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send_to_family', {
          residentId,
          residentName,
          familyContactId,
          content,
        });
      }
    },
    [residentId, residentName]
  );

  // ---- Update Warda status ----
  const updateWardaStatus = useCallback(
    (status: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('warda:status', {
          residentId,
          status,
          careHomeId,
        });
      }
    },
    [residentId, careHomeId]
  );

  // ---- Dismiss current message (show next in queue) ----
  const dismissMessage = useCallback(() => {
    setMessageQueue((queue) => {
      if (queue.length > 0) {
        const [next, ...rest] = queue;
        setIncomingMessage(next);
        return rest;
      }
      setIncomingMessage(null);
      return [];
    });
  }, []);

  // ---- Dismiss photo ----
  const dismissPhoto = useCallback(() => {
    setIncomingPhoto(null);
  }, []);

  return {
    isConnected,
    incomingMessage,
    incomingPhoto,
    helpConfirmed,
    sendHelp,
    sendMessageToFamily,
    updateWardaStatus,
    dismissMessage,
    dismissPhoto,
    messageQueue,
    incomingCall,
    dismissCall: () => setIncomingCall(null),
  };
}
