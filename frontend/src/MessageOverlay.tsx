/**
 * MessageOverlay - Warda reads family messages aloud
 * ====================================================
 * When a family member or staff sends a message:
 * 1. Full-screen overlay appears with gentle animation
 * 2. Warda announces: "Margaret, Sarah sent you a message!"
 * 3. Warda reads the message aloud using Polly
 * 4. Resident can tap "Reply" or "Done"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IncomingMessage } from './useSocket';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.meetwarda.com';

interface MessageOverlayProps {
  message: IncomingMessage | null;
  residentName: string;
  onDismiss: () => void;
  onReply: (senderId: string, senderName: string) => void;
  queueCount: number;
}

const MessageOverlay: React.FC<MessageOverlayProps> = ({
  message,
  residentName,
  onDismiss,
  onReply,
  queueCount,
}) => {
  const [phase, setPhase] = useState<'announce' | 'reading' | 'done'>('announce');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Speak text using the API (Polly) with fallback to browser TTS
  // Strip emojis so Polly doesn't say "two hearts emoji" etc.
  const stripEmojis = (text: string): string => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols & pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols extended
      .replace(/[\u{200D}]/gu, '')             // Zero-width joiner
      .replace(/[\u{20E3}]/gu, '')             // Combining enclosing keycap
      .replace(/[\u{E0020}-\u{E007F}]/gu, '') // Tags
      .replace(/\s{2,}/g, ' ')                // Collapse multiple spaces
      .trim();
  };

  const speak = useCallback(async (text: string): Promise<void> => {
    // Clean emojis before speaking
    const cleanText = stripEmojis(text);
    if (!cleanText) return; // Nothing to say after stripping

    // Try Polly first
    try {
      const res = await fetch(API_URL + '/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });
      const data = await res.json();
      if (data.success && data.audio) {
        return new Promise((resolve) => {
          const audio = new Audio('data:audio/mpeg;base64,' + data.audio);
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      }
    } catch (err) {
      console.warn('Polly TTS failed, falling back to browser TTS');
    }

    // Fallback: browser speech synthesis
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-GB';
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        // No TTS available, just wait a moment
        setTimeout(resolve, 2000);
      }
    });
  }, []);

  // Auto-play sequence when message arrives
  useEffect(() => {
    if (!message) return;

    let cancelled = false;

    const playSequence = async () => {
      setPhase('announce');
      setIsSpeaking(true);

      // Step 1: Announce who sent it
      const firstName = residentName || 'dear';
      const senderName = message.senderName || 'someone';
      const roleLabel = message.senderRole === 'staff' ? 'A staff member' : senderName;
      const announcement = `${firstName}, ${roleLabel} sent you a message!`;

      await speak(announcement);
      if (cancelled) return;

      // Step 2: Read the actual message
      setPhase('reading');
      await speak(message.content);
      if (cancelled) return;

      // Step 3: Done
      setIsSpeaking(false);
      setPhase('done');
    };

    playSequence();

    return () => {
      cancelled = true;
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    };
  }, [message, residentName, speak]);

  if (!message) return null;

  const senderEmoji =
    message.senderRole === 'staff' ? '👩‍⚕️' :
    message.senderRole === 'family' ? '💕' : '💬';

  return (
    <AnimatePresence>
      <motion.div
        key={message.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'linear-gradient(180deg, rgba(20,184,166,0.95) 0%, rgba(13,148,136,0.97) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        {/* Warda face */}
        <motion.div
          animate={
            isSpeaking
              ? { scale: [1, 1.08, 1, 1.05, 1], rotate: [0, 1, -1, 0] }
              : { scale: [1, 1.03, 1] }
          }
          transition={
            isSpeaking
              ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #5EEAD4, #14B8A6, #0D9488)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
            boxShadow: '0 0 80px rgba(94,234,212,0.5), 0 20px 60px rgba(0,0,0,0.2)',
            marginBottom: 32,
          }}
        >
          {isSpeaking ? '🗣️' : '😊'}
        </motion.div>

        {/* Announcement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 24,
            padding: '24px 40px',
            marginBottom: 24,
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.3)',
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'white',
              margin: 0,
              fontFamily: 'Georgia, serif',
            }}
          >
            {senderEmoji} Message from {message.senderName}
          </p>
          <p
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.7)',
              margin: '8px 0 0',
            }}
          >
            {message.senderRole === 'staff' ? 'Care Staff' : 'Family'} •{' '}
            {new Date(message.timestamp).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </motion.div>

        {/* Message content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            background: 'white',
            borderRadius: 24,
            padding: '32px 40px',
            marginBottom: 40,
            maxWidth: 700,
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }}
        >
          <p
            style={{
              fontSize: 26,
              color: '#1E293B',
              margin: 0,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            "{message.content}"
          </p>
        </motion.div>

        {/* Status indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            marginBottom: 32,
            textAlign: 'center',
          }}
        >
          {phase === 'announce' && (
            <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>
              🔊 Warda is announcing...
            </p>
          )}
          {phase === 'reading' && (
            <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>
              🔊 Warda is reading the message...
            </p>
          )}
          {phase === 'done' && (
            <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.9)' }}>
              ✅ Message read
            </p>
          )}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {/* Reply button */}
          <motion.button
            onClick={() => onReply(message.senderId, message.senderName)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '18px 40px',
              fontSize: 22,
              fontWeight: 700,
              background: 'white',
              color: '#0D9488',
              border: 'none',
              borderRadius: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            ✉️ Reply to {message.senderName}
          </motion.button>

          {/* Read again button */}
          <motion.button
            onClick={() => {
              setPhase('reading');
              setIsSpeaking(true);
              speak(message.content).then(() => {
                setIsSpeaking(false);
                setPhase('done');
              });
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '18px 40px',
              fontSize: 22,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            🔊 Read Again
          </motion.button>

          {/* Done button */}
          <motion.button
            onClick={onDismiss}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '18px 40px',
              fontSize: 22,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            ✅ Done
          </motion.button>
        </motion.div>

        {/* Queue indicator */}
        {queueCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 20,
              fontSize: 16,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            +{queueCount} more message{queueCount > 1 ? 's' : ''} waiting
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MessageOverlay;
