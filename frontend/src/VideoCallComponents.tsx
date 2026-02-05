import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Incoming Call Overlay - Shows when someone is calling
export const IncomingCallOverlay: React.FC<{
  callerName: string;
  callerType: string;
  onAnswer: () => void;
  onDecline: () => void;
}> = ({ callerName, callerType, onAnswer, onDecline }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-b from-teal-600 to-teal-800 flex flex-col items-center justify-center"
      style={{ zIndex: 200 }}
    >
      <motion.div 
        animate={{ scale: [1, 1.1, 1] }} 
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-6"
      >
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-5xl">
          {callerType === 'family' ? '👨‍👩‍👧' : '👤'}
        </div>
      </motion.div>
      
      <h1 className="text-white text-4xl font-bold mb-2">{callerName}</h1>
      <p className="text-white/80 text-xl mb-12">Incoming video call...</p>

      <div className="flex gap-2 mb-12">
        {[0, 1, 2].map(i => (
          <motion.div 
            key={i} 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
            className="w-4 h-4 rounded-full bg-white" 
          />
        ))}
      </div>

      <div className="flex gap-12">
        <motion.button 
          onClick={onDecline}
          className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }}
        >
          <span className="text-4xl">❌</span>
        </motion.button>
        <motion.button 
          onClick={onAnswer}
          className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <span className="text-4xl">📞</span>
        </motion.button>
      </div>

      <p className="text-white/60 mt-8 text-lg">Tap the green button to answer</p>
    </motion.div>
  );
};

// Simple Video Call Screen (without Chime SDK for now - placeholder)
export const VideoCallScreen: React.FC<{
  callerName: string;
  onEndCall: () => void;
}> = ({ callerName, onEndCall }) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-900 flex flex-col"
      style={{ zIndex: 100 }}
    >
      {/* Header */}
      <div className="bg-black/50 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center text-xl">👤</div>
          <div>
            <h2 className="text-white text-xl font-bold">{callerName}</h2>
            <p className="text-green-400 text-sm">● Connected • {formatDuration(callDuration)}</p>
          </div>
        </div>
      </div>

      {/* Video Area - Placeholder */}
      <div className="flex-1 relative bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 rounded-full bg-teal-600 flex items-center justify-center text-6xl mx-auto mb-4">
            👤
          </div>
          <p className="text-white text-2xl font-bold">{callerName}</p>
          <p className="text-gray-400">Video call in progress</p>
        </div>
        
        {/* Local video preview placeholder */}
        <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-700 rounded-xl overflow-hidden border-2 border-white shadow-lg flex items-center justify-center">
          <span className="text-3xl">😊</span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-6 flex justify-center gap-6">
        <motion.button 
          onClick={() => setIsMuted(!isMuted)}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${isMuted ? 'bg-red-500' : 'bg-gray-600'} text-white`}
          whileTap={{ scale: 0.9 }}
        >
          {isMuted ? '🔇' : '🎤'}
        </motion.button>
        <motion.button 
          onClick={() => setIsVideoOn(!isVideoOn)}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${!isVideoOn ? 'bg-red-500' : 'bg-gray-600'} text-white`}
          whileTap={{ scale: 0.9 }}
        >
          {isVideoOn ? '📹' : '📷'}
        </motion.button>
        <motion.button 
          onClick={onEndCall}
          className="w-20 h-16 rounded-full bg-red-600 flex items-center justify-center text-2xl text-white"
          whileTap={{ scale: 0.9 }}
        >
          📞
        </motion.button>
      </div>
    </motion.div>
  );
};
