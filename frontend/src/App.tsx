import { useSocket } from './useSocket';
import MessageOverlay from './MessageOverlay';
import { useWarda } from './useWarda';
import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

// ============ CONFIG ============
// Resident config - defaults overridden by PIN login in App()
let RESIDENT_ID = "";
let RESIDENT_NAME = "";
let CARE_HOME_ID = "";

// ============ TYPES ============
type Screen = 'pin' | 'home' | 'talk' | 'voice' | 'family' | 'contact' | 'activities' | 'health' | 'myday' | 'browse' | 'faith' | 'settings' | 'videocall';

interface Contact {
  id: string;
  name: string;
  relation: string;
  avatar: string;
  online: boolean;
  unreadCount: number;
  lastMessage?: string;
}

interface Event {
  id: string;
  title: string;
  time: string;
  type: 'family' | 'medical' | 'activity' | 'call' | 'medication';
}

interface Message {
  id: string;
  from: 'user' | 'contact';
  text: string;
  time: string;
}

// ============ MOCK DATA ============
// Family contacts loaded from API after PIN login
const mockContacts: Contact[] = [];

const mockEvents: Event[] = [
  { id: '1', title: 'Sarah visiting', time: '14:00', type: 'family' },
  { id: '2', title: 'Afternoon tablets', time: '14:30', type: 'medication' },
  { id: '3', title: 'Chair yoga', time: '15:30', type: 'activity' },
];

const mockMessages: Message[] = [
  { id: '1', from: 'contact', text: 'Hi Mum! The kids are so excited to see you today! 🎉', time: '10:30' },
  { id: '2', from: 'contact', text: "We'll bring some of that cake you like", time: '10:32' },
  { id: '3', from: 'user', text: "That sounds lovely dear! Can't wait to see the wee ones", time: '10:45' },
  { id: '4', from: 'contact', text: 'See you at 2! Love you 💕', time: '10:46' },
];

// ============ BUBBLE COMPONENTS ============
const AquariumBubble: React.FC<{ delay: number; originX: number; size: number; duration: number }> = ({ delay, originX, size, duration }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ 
      left: `${originX}%`, bottom: -20, width: size, height: size,
      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,${0.8 + size/100}), rgba(173,216,230,${0.4 + size/150}) 50%, rgba(135,206,235,${0.15 + size/200}))`,
      border: `${Math.max(1, size/20)}px solid rgba(255,255,255,0.5)`,
      boxShadow: `inset ${size/8}px ${size/8}px ${size/4}px rgba(255,255,255,0.6), 0 0 ${size/4}px rgba(135,206,235,0.15)`,
    }}
    initial={{ y: 0, opacity: 0, scale: 0.3 }}
    animate={{ y: '-105vh', opacity: [0, 0.95, 0.95, 0.85, 0], scale: [0.7, 1, 1.03, 1.06, 1.08], x: [0, 1.5, -1, 1, -1.5, 0.5, 0] }}
    transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
  />
);

const TinyBubble: React.FC<{ delay: number; originX: number; duration: number }> = ({ delay, originX, duration }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ left: `${originX}%`, bottom: -10, width: 4 + Math.random() * 8, height: 4 + Math.random() * 8,
      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(173,216,230,0.4))', border: '1px solid rgba(255,255,255,0.4)' }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: '-108vh', opacity: [0, 0.7, 0.7, 0.5, 0], x: [0, 0.5, -0.5, 0] }}
    transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
  />
);

const LightRay: React.FC<{ left: number; width: number; opacity: number; delay: number }> = ({ left, width, opacity, delay }) => (
  <motion.div className="absolute pointer-events-none"
    style={{ left: `${left}%`, top: 0, width: `${width}px`, height: '70%',
      background: `linear-gradient(180deg, rgba(255,255,255,${opacity}) 0%, rgba(255,255,255,${opacity * 0.3}) 40%, transparent 100%)`,
      transform: 'skewX(-3deg)', zIndex: 0 }}
    animate={{ opacity: [opacity * 0.6, opacity, opacity * 0.6] }}
    transition={{ duration: 5 + delay, delay: delay * 0.5, repeat: Infinity, ease: "easeInOut" }}
  />
);

// ============ SHARED COMPONENTS ============

// HELP BUTTON - Now wired to WebSocket!
const HelpButton: React.FC<{ onPress: () => void; confirmed: boolean }> = ({ onPress, confirmed }) => (
  <motion.button
    onClick={onPress}
    className={`${confirmed ? 'bg-gradient-to-r from-green-500 to-green-600 border-green-400' : 'bg-gradient-to-r from-red-500 to-red-600 border-red-400'} text-white px-8 py-4 rounded-2xl font-bold text-xl flex items-center gap-3 shadow-xl border-2`}
    style={{ boxShadow: confirmed ? '0 0 30px rgba(34, 197, 94, 0.4)' : '0 0 30px rgba(239, 68, 68, 0.4)', zIndex: 10 }}
    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
    {confirmed ? '✅ Help is coming!' : '🆘 Help'}
  </motion.button>
);

// CONNECTION INDICATOR
const ConnectionDot: React.FC<{ connected: boolean }> = ({ connected }) => (
  <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
    <motion.div
      animate={connected ? { scale: [1, 1.2, 1] } : { opacity: [1, 0.3, 1] }}
      transition={{ duration: connected ? 3 : 1, repeat: Infinity }}
      style={{
        width: 10, height: 10, borderRadius: '50%',
        background: connected ? '#22C55E' : '#EF4444',
        boxShadow: connected ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)',
      }}
    />
  </div>
);

const BackButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
  <motion.button onClick={onClick} disabled={disabled}
    className={`bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-xl border-2 border-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{ boxShadow: disabled ? 'none' : '0 4px 25px rgba(37, 99, 235, 0.4)' }}
    whileHover={disabled ? {} : { scale: 1.05 }} whileTap={disabled ? {} : { scale: 0.98 }}>
    ⬅️ Back
  </motion.button>
);

const HomeButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
  <motion.button onClick={onClick} disabled={disabled}
    className={`bg-gradient-to-r from-green-500 to-green-600 text-white px-10 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-xl border-2 border-green-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{ boxShadow: disabled ? 'none' : '0 4px 25px rgba(34, 197, 94, 0.4)' }}
    whileHover={disabled ? {} : { scale: 1.05 }} whileTap={disabled ? {} : { scale: 0.98 }}>
    🏠 Home
  </motion.button>
);

const BottomBar: React.FC<{ onBack: () => void; onHome: () => void; backDisabled?: boolean; homeDisabled?: boolean }> = ({ onBack, onHome, backDisabled, homeDisabled }) => (
  <div className="flex justify-between items-center pt-4 border-t-2 border-amber-100/50" style={{ zIndex: 10 }}>
    <BackButton onClick={onBack} disabled={backDisabled} />
    <HomeButton onClick={onHome} disabled={homeDisabled} />
  </div>
);

const NavCard: React.FC<{ icon: string; label: string; onClick: () => void; badge?: number }> = ({ icon, label, onClick, badge }) => (
  <motion.button onClick={onClick}
    className="relative bg-white/85 backdrop-blur-md border-2 border-white/50 rounded-2xl p-5 flex flex-col items-center gap-2 shadow-lg hover:shadow-2xl hover:border-teal-300 hover:bg-white/95 transition-all duration-200"
    style={{ zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
    whileHover={{ scale: 1.05, y: -6 }} whileTap={{ scale: 0.98 }}>
    <span className="text-4xl">{icon}</span>
    <span className="text-sm font-bold text-gray-700">{label}</span>
    {badge && badge > 0 && (
      <motion.div className="absolute -top-2 -right-2 w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>{badge}</motion.div>
    )}
  </motion.button>
);

const WardaFace: React.FC<{ onClick: () => void; hasNotification: boolean }> = ({ onClick, hasNotification }) => (
  <motion.button onClick={onClick}
    className={`relative w-48 h-48 rounded-full flex items-center justify-center text-8xl shadow-2xl cursor-pointer ${hasNotification ? 'ring-4 ring-teal-300 ring-offset-4' : ''}`}
    style={{ background: 'linear-gradient(135deg, #5EEAD4 0%, #14B8A6 50%, #0D9488 100%)',
      boxShadow: '0 0 60px rgba(20, 184, 166, 0.4), 0 10px 40px rgba(20, 184, 166, 0.3)', zIndex: 10 }}
    animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.98 }}>
    😊
    {hasNotification && (
      <motion.div className="absolute -top-1 -right-1 w-7 h-7 bg-rose-500 rounded-full shadow-lg"
        animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
    )}
  </motion.button>
);

// ============ SCREEN COMPONENTS ============

// ─── PIN Login Screen ───────────────────────────────────

const API_BASE = 'https://api.meetwarda.com/api';
const CARE_HOME_ID_DEFAULT = '8d02b20b-8fb2-4e78-a77f-f3ba2f37f833';

interface ResidentSession {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  roomNumber: string | null;
  careHomeId: string;
  careHomeName: string;
}

const PinLoginScreen: React.FC<{
  onLogin: (session: ResidentSession) => void;
}> = ({ onLogin }) => {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) submitPin(newPin);
    }
  };
  const handleDelete = () => { setPin(prev => prev.slice(0, -1)); setError(''); };

  const submitPin = async (pinCode: string) => {
    setIsLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode, careHomeId: CARE_HOME_ID_DEFAULT })
      });
      const data = await response.json();
      if (data.success && data.resident) { onLogin(data.resident); }
      else { setPin(''); setError(data.error || 'Wrong PIN. Please try again.'); }
    } catch (err) { setPin(''); setError('Cannot connect. Please try again.'); }
    setIsLoading(false);
  };

  const dots = [0, 1, 2, 3];
  const keys = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #E8F5F0 0%, #F0FAF7 30%, #F7FCFA 60%, #FFFFFF 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px', fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{ marginBottom: 12, fontSize: 56 }}>🌹</div>
      <h1 style={{ fontSize: 38, fontWeight: 700, color: '#1A5C4C', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Warda</h1>
      <p style={{ fontSize: 16, color: '#5B8A7D', margin: '0 0 32px', fontWeight: 500 }}>You're Never Alone</p>
      <p style={{ fontSize: 22, color: '#2D6A5A', marginBottom: 24, fontWeight: 600 }}>Enter your PIN to start</p>
      <div style={{ display: 'flex', gap: 18, marginBottom: 20, height: 36 }}>
        {dots.map(i => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `3px solid ${error ? '#DC2626' : '#2D9B83'}`,
            background: i < pin.length ? (error ? '#DC2626' : '#2D9B83') : 'transparent',
            transition: 'all 0.2s ease',
            transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
          }} />
        ))}
      </div>
      {error && <p style={{ color: '#DC2626', fontSize: 17, marginBottom: 12, fontWeight: 600, textAlign: 'center' }}>{error}</p>}
      {isLoading && <p style={{ color: '#2D9B83', fontSize: 17, marginBottom: 12, fontWeight: 600 }}>Signing in...</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340, marginTop: 8 }}>
        {keys.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {row.map((key, ki) => (
              <button key={ki}
                onClick={() => { if (key === '⌫') handleDelete(); else if (key !== '') handleDigit(key); }}
                disabled={isLoading || (key !== '⌫' && key !== '' && pin.length >= 4)}
                style={{
                  width: 90, height: 72, borderRadius: 16,
                  border: key === '' ? 'none' : '2px solid #D1E8E0',
                  background: key === '' ? 'transparent' : (key === '⌫' ? '#FEE2E2' : '#FFFFFF'),
                  fontSize: key === '⌫' ? 28 : 32, fontWeight: 700,
                  color: key === '⌫' ? '#DC2626' : '#1A5C4C',
                  cursor: key === '' ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: key === '' ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s ease', opacity: isLoading ? 0.5 : 1,
                }}
              >{key}</button>
            ))}
          </div>
        ))}
      </div>
      <p style={{ marginTop: 32, fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>Ask your carer if you've forgotten your PIN</p>
    </div>
  );
};

// HOME SCREEN
const HomeScreen: React.FC<{ onNavigate: (screen: Screen) => void; time: string; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, time, onHelp, helpConfirmed }) => (
  <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        <div className="bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl shadow-lg border border-white/50">
          <span className="text-3xl font-bold text-gray-800">{time}</span>
        </div>
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/50">
          <span className="text-2xl">☀️</span>
          <span className="text-lg font-semibold text-gray-700">12°C</span>
        </div>
      </div>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <WardaFace onClick={() => onNavigate('talk')} hasNotification={true} />
      <div className="text-center" style={{ zIndex: 10 }}>
        <motion.h1 className="text-5xl font-bold text-teal-700 mb-3" style={{ fontFamily: 'Georgia, serif' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          Good afternoon, {RESIDENT_NAME}!
        </motion.h1>
        <motion.p className="text-xl text-gray-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Tap me to chat!
        </motion.p>
      </div>
    </div>
    <motion.div className="grid grid-cols-6 gap-4 mb-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <NavCard icon="💬" label="Chat with Warda" onClick={() => onNavigate('talk')} />
      <NavCard icon="🎤" label="Talk to Warda" onClick={() => onNavigate('voice')} />
      <NavCard icon="👨‍👩‍👧" label="Family" onClick={() => onNavigate('family')} badge={3} />
      <NavCard icon="🙏" label="My Faith" onClick={() => onNavigate('faith')} />
      <NavCard icon="🎯" label="Activities" onClick={() => onNavigate('activities')} />
      <NavCard icon="❤️" label="My Health" onClick={() => onNavigate('health')} />
      <NavCard icon="📅" label="My Day" onClick={() => onNavigate('myday')} />
      <NavCard icon="🌐" label="Browse Web" onClick={() => onNavigate('browse')} />
      <NavCard icon="⚙️" label="Settings" onClick={() => onNavigate('settings')} />
    </motion.div>
    <BottomBar onBack={() => {}} onHome={() => {}} backDisabled homeDisabled />
  </motion.div>
);

// TALK SCREEN
const TalkScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [mode, setMode] = useState<"voice" | "type">("type");
  const [inputText, setInputText] = useState("");
  const { messages, sendMessage, isLoading } = useWarda("margaret123", "Margaret");
  const handleSend = () => { if (inputText.trim() && !isLoading) { sendMessage(inputText.trim()); setInputText(""); } };
  return (
    <motion.div key="talk" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700">Talk to Warda</h1>
        <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
      </div>
      <div className="flex-1 bg-white/80 backdrop-blur-md rounded-3xl p-6 mb-6 border-2 border-white/50 shadow-xl overflow-y-auto" style={{ zIndex: 10 }}>
        <div className="space-y-4">
          {messages.length === 0 && <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5"><p className="text-lg text-gray-700">Hello Margaret! Type a message below to talk to me. 😊</p></div>}
          {messages.map((msg) => (
            <div key={msg.id} className={msg.from === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={msg.from === "user" ? "bg-teal-500 text-white rounded-2xl p-4 max-w-2xl" : "bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 max-w-2xl"}>
                <p className="text-lg">{msg.text}</p>
                <p className="text-sm mt-1 opacity-70">{msg.time}</p>
              </div>
            </div>
          ))}
          {isLoading && <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4"><div className="flex gap-2 items-center"><span className="text-2xl">😊</span><div className="flex gap-1"><span className="w-3 h-3 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></span><span className="w-3 h-3 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></span><span className="w-3 h-3 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></span></div></div></div>}
        </div>
      </div>
      <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 mb-6 flex gap-4" style={{ zIndex: 10 }}>
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type your message..." className="flex-1 px-6 py-4 rounded-xl border-2 border-amber-200 text-lg" />
        <button onClick={handleSend} disabled={isLoading} className="px-8 py-4 bg-teal-500 text-white rounded-xl font-bold text-lg">{isLoading ? "..." : "Send ➤"}</button>
      </div>
      <BottomBar onBack={() => onNavigate("home")} onHome={() => onNavigate("home")} />
    </motion.div>
  );
};

// FAMILY SCREEN
const FamilyScreen: React.FC<{ onNavigate: (screen: Screen) => void; onSelectContact: (contact: Contact) => void; onHelp: () => void; helpConfirmed: boolean; contacts: Contact[] }> = ({ onNavigate, onSelectContact, onHelp, helpConfirmed, contacts }) => (
  <motion.div key="family" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>👨‍👩‍👧 Family</h1>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6 overflow-y-auto" style={{ zIndex: 10 }}>
      {contacts.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">👨‍👩‍👧</div>
            <p className="text-xl text-gray-500">No family contacts yet</p>
            <p className="text-gray-400 mt-2">Ask your care team to add your family</p>
          </div>
        ) : null}
        {contacts.map((contact) => (
        <motion.button key={contact.id} onClick={() => onSelectContact(contact)}
          className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-white/50 hover:border-teal-300 transition-all"
          whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-5xl shadow-inner">
              {contact.avatar}
            </div>
            {contact.online && <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white" />}
            {contact.unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                {contact.unreadCount}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-800">{contact.name}</div>
            <div className="text-gray-500">{contact.relation}</div>
          </div>
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-xl shadow-md">📞</div>
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-xl shadow-md">✉️</div>
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-xl shadow-md">📸</div>
          </div>
        </motion.button>
      ))}
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// CONTACT DETAIL SCREEN
const ContactScreen: React.FC<{ contact: Contact; onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ contact, onNavigate, onHelp, helpConfirmed }) => (
  <motion.div key="contact" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-3xl shadow-lg">
          {contact.avatar}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>{contact.name}</h1>
          <p className="text-gray-500">{contact.relation}</p>
        </div>
      </div>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>
    <div className="flex gap-4 mb-6" style={{ zIndex: 10 }}>
      <motion.button className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        📞 Video Call
      </motion.button>
      <motion.button className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        ✉️ Send Message
      </motion.button>
      <motion.button className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        📸 View Photos
      </motion.button>
    </div>
    <div className="flex-1 bg-white/80 backdrop-blur-md rounded-3xl p-6 mb-6 border-2 border-white/50 shadow-xl overflow-y-auto" style={{ zIndex: 10 }}>
      <h2 className="text-xl font-bold text-gray-700 mb-4">Recent Messages</h2>
      <div className="space-y-4">
        {mockMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md px-5 py-3 rounded-2xl ${msg.from === 'user' ? 'bg-teal-500 text-white rounded-br-md' : 'bg-amber-50 border-2 border-amber-200 rounded-bl-md'}`}>
              <p className="text-lg">{msg.text}</p>
              <p className={`text-sm mt-1 ${msg.from === 'user' ? 'text-teal-100' : 'text-gray-400'}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    <BottomBar onBack={() => onNavigate('family')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// ACTIVITIES SCREEN
const ActivitiesScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [tab, setTab] = useState<'menu'|'music'|'trivia'|'exercises'>('menu');
  const [tracks, setTracks] = useState<any[]>([]);
  const [genre, setGenre] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number|null>(null);
  const [feedback, setFeedback] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);
  const [activeExercise, setActiveExercise] = useState<any>(null);
  const [quizDone, setQuizDone] = useState(false);

  const loadMusic = async (g?: string) => {
    const params = g ? `?genre=${g}` : '';
    const r = await fetch(API_BASE + '/api/activities/music' + params);
    const d = await r.json();
    setTracks(d.tracks || []); setGenres(d.genres || []);
  };
  const loadTrivia = async () => {
    const r = await fetch(API_BASE + '/api/activities/trivia?count=5');
    const d = await r.json();
    setQuestions(d.questions || []); setQIdx(0); setScore(0); setAnswered(null); setFeedback(''); setQuizDone(false);
  };
  const loadExercises = async () => {
    const r = await fetch(API_BASE + '/api/activities/exercises');
    const d = await r.json();
    setExercises(d.exercises || []);
  };

  const checkAnswer = async (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    const q = questions[qIdx];
    const r = await fetch(API_BASE + '/api/activities/trivia/check', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: q.q, selected: idx }) });
    const d = await r.json();
    setFeedback(d.message);
    if (d.correct) setScore(s => s + 1);
    setTimeout(() => {
      if (qIdx + 1 < questions.length) { setQIdx(i => i + 1); setAnswered(null); setFeedback(''); }
      else { setQuizDone(true); }
    }, 2000);
  };

  return (
  <motion.div key="activities" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🎯 Activities</h1>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>

    {tab === 'menu' && (
      <>
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ zIndex: 10 }}>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-2xl">😊</div>
          <p className="text-lg text-teal-800">What would you like to do, {RESIDENT_NAME}?</p>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
          <motion.button onClick={() => { setTab('music'); loadMusic(); }} className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-purple-300"
            whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
            <span className="text-6xl">🎵</span><span className="text-2xl font-bold text-purple-800">Music</span><span className="text-purple-600">Songs & relaxation</span>
          </motion.button>
          <motion.button onClick={() => { setTab('trivia'); loadTrivia(); }} className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-orange-300"
            whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
            <span className="text-6xl">🧠</span><span className="text-2xl font-bold text-orange-800">Trivia Quiz</span><span className="text-orange-600">Test your knowledge</span>
          </motion.button>
          <motion.button onClick={() => { setTab('exercises'); loadExercises(); }} className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-green-300"
            whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
            <span className="text-6xl">🧘</span><span className="text-2xl font-bold text-green-800">Exercises</span><span className="text-green-600">Gentle stretches</span>
          </motion.button>
        </div>
      </>
    )}

    {tab === 'music' && (
      <div className="flex-1 flex flex-col" style={{ zIndex: 10 }}>
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => { setGenre(''); loadMusic(); }} className={`px-4 py-2 rounded-full text-sm font-bold ${!genre ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {genres.map(g => <button key={g} onClick={() => { setGenre(g); loadMusic(g); }} className={`px-4 py-2 rounded-full text-sm font-bold ${genre === g ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{g}</button>)}
        </div>
        <div className="flex-1 overflow-auto space-y-2">
          {tracks.map(t => (
            <motion.div key={t.id} whileHover={{ scale: 1.01 }} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow border border-gray-100 cursor-pointer">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl">🎵</div>
              <div className="flex-1">
                <div className="font-bold text-lg text-gray-800">{t.title}</div>
                <div className="text-gray-500">{t.artist} · {t.genre} · {t.duration}</div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">{t.mood}</span>
            </motion.div>
          ))}
        </div>
        <button onClick={() => setTab('menu')} className="mt-4 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back to Activities</button>
      </div>
    )}

    {tab === 'trivia' && (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ zIndex: 10 }}>
        {!quizDone && questions.length > 0 && (
          <>
            <div className="text-center mb-2"><span className="text-sm text-gray-500">Question {qIdx + 1} of {questions.length}</span> · <span className="font-bold text-teal-700">Score: {score}</span></div>
            <div className="bg-white rounded-3xl p-8 shadow-xl max-w-xl w-full border-2 border-teal-200">
              <div className="text-xs text-teal-600 font-bold mb-2">{questions[qIdx].category}</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">{questions[qIdx].q}</h2>
              <div className="grid grid-cols-2 gap-3">
                {questions[qIdx].options.map((opt: string, i: number) => (
                  <motion.button key={i} whileTap={{ scale: 0.95 }} onClick={() => checkAnswer(i)}
                    className={`p-4 rounded-xl text-lg font-bold border-2 transition-all ${answered === null ? 'bg-gray-50 border-gray-200 hover:bg-teal-50 hover:border-teal-300' : i === questions[qIdx].answer ? 'bg-green-100 border-green-400 text-green-800' : answered === i ? 'bg-red-100 border-red-400 text-red-800' : 'bg-gray-50 border-gray-200 opacity-50'}`}>{opt}</motion.button>
                ))}
              </div>
              {feedback && <div className={`mt-4 text-center text-lg font-bold ${feedback.includes('Well done') ? 'text-green-600' : 'text-orange-600'}`}>{feedback}</div>}
            </div>
          </>
        )}
        {quizDone && (
          <div className="bg-white rounded-3xl p-8 shadow-xl text-center max-w-md border-2 border-teal-200">
            <div className="text-6xl mb-4">{score >= 4 ? '🌟' : score >= 2 ? '👏' : '💪'}</div>
            <h2 className="text-3xl font-bold text-teal-700 mb-2">Quiz Complete!</h2>
            <p className="text-xl text-gray-600 mb-2">You scored {score} out of {questions.length}</p>
            <p className="text-3xl text-lg text-teal-600 mb-6">{score >= 4 ? "Brilliant, dear! You're so clever!" : score >= 2 ? "Well done, love! Great effort!" : "Good try, dear! Shall we play again?"}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => loadTrivia()} className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold text-lg">Play Again</button>
              <button onClick={() => setTab('menu')} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-lg">Back</button>
            </div>
          </div>
        )}
        {!quizDone && <button onClick={() => setTab('menu')} className="mt-6 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back</button>}
      </div>
    )}

    {tab === 'exercises' && (
      <div className="flex-1" style={{ zIndex: 10 }}>
        {!activeExercise ? (
          <div className="grid grid-cols-2 gap-4">
            {exercises.map(ex => (
              <motion.button key={ex.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveExercise(ex)}
                className="bg-white rounded-2xl p-5 text-left shadow border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🧘</span>
                  <div><div className="font-bold text-lg text-gray-800">{ex.name}</div><div className="text-sm text-gray-500">{ex.duration} · {ex.level}</div></div>
                </div>
                <p className="text-sm text-teal-700">{ex.benefit}</p>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="max-w-lg mx-auto bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
            <h2 className="text-2xl font-bold text-green-700 mb-1">{activeExercise.name}</h2>
            <div className="text-sm text-gray-500 mb-4">{activeExercise.duration} · {activeExercise.equipment} · {activeExercise.level}</div>
            <div className="bg-green-50 rounded-xl p-4 mb-4">
              <p className="text-green-800 font-medium">{activeExercise.benefit}</p>
            </div>
            <ol className="space-y-3">
              {activeExercise.steps.map((step: string, i: number) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold flex-shrink-0">{i+1}</span>
                  <span className="text-lg text-gray-700 pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => setActiveExercise(null)} className="mt-6 w-full py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back to Exercises</button>
          </div>
        )}
        {!activeExercise && <button onClick={() => setTab('menu')} className="mt-4 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back to Activities</button>}
      </div>
    )}

    <BottomBar onBack={() => tab === 'menu' ? onNavigate('home') : setTab('menu')} onHome={() => onNavigate('home')} />
  </motion.div>
  );
}

// HEALTH SCREEN
const HealthScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [tab, setTab] = useState<'menu'|'meds'|'mood'|'pain'>('menu');
  const [meds, setMeds] = useState<any[]>([]);
  const [activeMeds, setActiveMeds] = useState(0);
  const [nextDue, setNextDue] = useState('');
  const [moodVal, setMoodVal] = useState(3);
  const [painVal, setPainVal] = useState(0);
  const [logMsg, setLogMsg] = useState('');
  const userId = localStorage.getItem('wardaUserId') || '';

  const loadMeds = async () => {
    if (!userId) return;
    try { const r = await fetch(API_BASE + '/api/medications/' + userId); const d = await r.json(); setMeds(d.medications || []); setActiveMeds(d.activeCount || 0); setNextDue(d.nextDue || ''); } catch {}
  };

  const markTaken = async (medId: string) => {
    try { await fetch(API_BASE + '/api/medications/' + medId + '/taken', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ recordedBy: 'resident' }) }); loadMeds(); } catch {}
  };

  const logMood = async () => {
    if (!userId) return;
    try { await fetch(API_BASE + '/api/health-logs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, type: 'MOOD', value: String(moodVal), notes: 'Self-reported from tablet', recordedBy: 'resident' }) });
      setLogMsg('Thank you, dear. Your mood has been recorded. 💚'); setTimeout(() => { setLogMsg(''); setTab('menu'); }, 2500);
    } catch {}
  };

  const logPain = async () => {
    if (!userId) return;
    try { await fetch(API_BASE + '/api/health-logs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, type: 'PAIN', value: String(painVal), notes: 'Self-reported from tablet', recordedBy: 'resident' }) });
      setLogMsg('Thank you. Your care team has been notified. 💚'); setTimeout(() => { setLogMsg(''); setTab('menu'); }, 2500);
    } catch {}
  };

  const moods = [{v:1,e:'😢',l:'Very Low'},{v:2,e:'😕',l:'Low'},{v:3,e:'😐',l:'Okay'},{v:4,e:'🙂',l:'Good'},{v:5,e:'😊',l:'Great'}];

  return (
  <motion.div key="health" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>❤️ My Health</h1>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>

    {logMsg && <div className="bg-green-100 border-2 border-green-300 rounded-2xl p-4 mb-4 text-center text-lg text-green-800 font-bold">{logMsg}</div>}

    {tab === 'menu' && (
      <div className="flex-1 grid grid-cols-2 gap-6 mb-6" style={{ zIndex: 10 }}>
        <motion.button onClick={() => { setTab('meds'); loadMeds(); }} className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-purple-200" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <span className="text-5xl">💊</span><span className="text-xl font-bold text-gray-800">My Medications</span>
          <span className="text-purple-600 text-sm">View and mark as taken</span>
        </motion.button>
        <motion.button onClick={() => setTab('mood')} className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-green-200" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <span className="text-5xl">😊</span><span className="text-xl font-bold text-gray-800">How I Feel</span>
          <span className="text-green-600 text-sm">Log your mood today</span>
        </motion.button>
        <motion.button onClick={() => setTab('pain')} className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-red-200" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <span className="text-5xl">🩹</span><span className="text-xl font-bold text-gray-800">Pain Check</span>
          <span className="text-red-600 text-sm">Tell us if anything hurts</span>
        </motion.button>
        <motion.button className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-blue-200" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <span className="text-5xl">👨‍⚕️</span><span className="text-xl font-bold text-gray-800">GP Messages</span>
          <span className="text-blue-600 text-sm">Coming soon</span>
        </motion.button>
      </div>
    )}

    {tab === 'meds' && (
      <div className="flex-1 flex flex-col" style={{ zIndex: 10 }}>
        {activeMeds > 0 && <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 text-center text-purple-700 font-semibold">{activeMeds} active medications{nextDue ? ` · Next due: ${nextDue}` : ''}</div>}
        <div className="flex-1 overflow-auto space-y-3">
          {meds.filter(m => m.isActive).map(m => (
            <div key={m.id} className="bg-white rounded-2xl p-5 shadow border border-gray-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center text-3xl">💊</div>
              <div className="flex-1">
                <div className="font-bold text-lg text-gray-800">{m.name}</div>
                <div className="text-gray-500">{m.dosage} · {m.frequency}</div>
                <div className="flex gap-1 mt-1">{(m.timeOfDay || []).map((t: string) => <span key={t} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">{t}</span>)}</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => markTaken(m.id)} className="px-4 py-3 bg-green-500 text-white rounded-xl font-bold text-sm">✓ Taken</motion.button>
            </div>
          ))}
          {meds.filter(m => m.isActive).length === 0 && <div className="text-center py-10 text-gray-400 text-lg">No medications to show, dear.</div>}
        </div>
        <button onClick={() => setTab('menu')} className="mt-4 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back</button>
      </div>
    )}

    {tab === 'mood' && (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ zIndex: 10 }}>
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full border-2 border-green-200 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">How are you feeling, {RESIDENT_NAME}?</h2>
          <p className="text-gray-500 mb-6">Tap the face that matches your mood</p>
          <div className="flex justify-center gap-3 mb-6">
            {moods.map(m => (
              <motion.button key={m.v} whileTap={{ scale: 0.9 }} onClick={() => setMoodVal(m.v)}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all ${moodVal === m.v ? 'border-teal-500 bg-teal-50 scale-110' : 'border-gray-200 bg-gray-50'}`}>
                <span className="text-4xl">{m.e}</span>
                <span className={`text-xs font-bold mt-1 ${moodVal === m.v ? 'text-teal-700' : 'text-gray-500'}`}>{m.l}</span>
              </motion.button>
            ))}
          </div>
          <button onClick={logMood} className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-xl">Save My Mood</button>
        </div>
        <button onClick={() => setTab('menu')} className="mt-4 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back</button>
      </div>
    )}

    {tab === 'pain' && (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ zIndex: 10 }}>
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full border-2 border-red-200 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Are you in any pain, dear?</h2>
          <p className="text-gray-500 mb-4">Slide to show how much</p>
          <div className="text-6xl mb-2">{painVal === 0 ? '😊' : painVal <= 3 ? '😐' : painVal <= 6 ? '😣' : '😫'}</div>
          <div className="text-3xl font-bold mb-2" style={{ color: painVal <= 3 ? '#10b981' : painVal <= 6 ? '#f59e0b' : '#ef4444' }}>{painVal}/10</div>
          <input type="range" min="0" max="10" value={painVal} onChange={e => setPainVal(Number(e.target.value))} className="w-full h-3 mb-4 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)` }} />
          <div className="flex justify-between text-sm text-gray-500 mb-6"><span>No pain</span><span>Worst pain</span></div>
          <button onClick={logPain} className="w-full py-4 bg-red-500 text-white rounded-xl font-bold text-xl">{painVal === 0 ? "I'm Fine, Thank You" : "Report Pain"}</button>
        </div>
        <button onClick={() => setTab('menu')} className="mt-4 px-6 py-3 bg-gray-200 rounded-xl text-lg font-bold text-gray-700">← Back</button>
      </div>
    )}

    <BottomBar onBack={() => tab === 'menu' ? onNavigate('home') : setTab('menu')} onHome={() => onNavigate('home')} />
  </motion.div>
  );
};

// MY DAY SCREEN
const MyDayScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('');
  const [dayName, setDayName] = useState('');
  const [total, setTotal] = useState(0);
  const userId = localStorage.getItem('wardaUserId') || '';

  useEffect(() => {
    if (!userId) return;
    fetch(API_BASE + '/api/calendar/' + userId + '?date=' + new Date().toISOString().split('T')[0])
      .then(r => r.json()).then(d => {
        setEvents(d.events || []); setGreeting(d.greeting || ''); setDayName(d.dayName || ''); setTotal(d.total || 0);
      }).catch(() => {});
  }, [userId]);

  const eventColors: Record<string, string> = { family: 'border-l-green-500 bg-green-50', medical: 'border-l-red-500 bg-red-50', activity: 'border-l-orange-500 bg-orange-50', call: 'border-l-blue-500 bg-blue-50', medication: 'border-l-purple-500 bg-purple-50' };
  const eventIcons: Record<string, string> = { family: '👨‍👩‍👧', medical: '🏥', activity: '🎯', call: '📞', medication: '💊' };

  return (
    <motion.div key="myday" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
      className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>📅 My Day</h1>
        <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
      </div>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-6" style={{ zIndex: 10 }}>
        <h2 className="text-2xl font-bold text-amber-800 mb-1">{greeting}, {RESIDENT_NAME}! — {dayName}</h2>
        <p className="text-amber-600">{total > 0 ? `You have ${total} thing${total > 1 ? 's' : ''} planned today` : 'No events scheduled today, dear. Enjoy a relaxing day!'}</p>
      </div>
      <div className="flex-1 space-y-4 mb-6 overflow-y-auto" style={{ zIndex: 10 }}>
        {events.length > 0 ? events.map((event: any) => (
          <motion.div key={event.id} className={`bg-white/90 backdrop-blur-md rounded-2xl p-5 shadow-lg border-l-4 ${eventColors[event.type] || 'border-l-gray-300 bg-gray-50'}`} whileHover={{ scale: 1.01, x: 4 }}>
            <div className="flex items-center gap-4">
              <div className="text-4xl">{eventIcons[event.type] || '📌'}</div>
              <div className="flex-1"><div className="text-xl font-bold text-gray-800">{event.title}</div>{event.notes && <div className="text-gray-500 text-sm">{event.notes}</div>}</div>
              <div className="text-2xl font-bold text-gray-400">{event.time}</div>
            </div>
          </motion.div>
        )) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">☀️</div>
            <p className="text-xl text-gray-500">A peaceful day ahead, {RESIDENT_NAME}.</p>
            <p className="text-gray-400 mt-2">Your care team can add events for you.</p>
          </div>
        )}
      </div>
      <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
    </motion.div>
  );
};

// BROWSE WEB SCREEN
const BrowseScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [blocked, setBlocked] = useState('');
  const [loading, setLoading] = useState(false);

  const shortcuts = [
    { icon: '📺', name: 'BBC News', url: 'https://www.bbc.co.uk/news', bg: '#fef2f2' },
    { icon: '🌤️', name: 'Weather', url: 'https://www.bbc.co.uk/weather', bg: '#eff6ff' },
    { icon: '📰', name: 'Daily Mail', url: 'https://www.dailymail.co.uk', bg: '#f9fafb' },
    { icon: '🎬', name: 'YouTube', url: 'https://www.youtube.com', bg: '#fef2f2' },
    { icon: '🛒', name: 'Amazon', url: 'https://www.amazon.co.uk', bg: '#fffbeb' },
    { icon: '🏥', name: 'NHS', url: 'https://www.nhs.uk', bg: '#f0fdfa' },
    { icon: '📚', name: 'Wikipedia', url: 'https://en.wikipedia.org', bg: '#f9fafb' },
    { icon: '🏴\u200d', name: 'Scotsman', url: 'https://www.scotsman.com', bg: '#eff6ff' },
    { icon: '🌍', name: 'Nat Geo', url: 'https://www.nationalgeographic.com', bg: '#fefce8' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true); setBlocked('');
    try {
      const res = await fetch('https://api.meetwarda.com/api/browse/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      if (data.safe) { setCurrentUrl(data.url); }
      else { setBlocked('This search contains content that isn\u2019t suitable. Try something else, dear.'); setCurrentUrl(''); }
    } catch (err) { setBlocked('Could not search right now.'); }
    setLoading(false);
  };

  const handleShortcut = async (url: string) => {
    setLoading(true); setBlocked('');
    try {
      const res = await fetch('https://api.meetwarda.com/api/browse/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.safe) { setCurrentUrl(url); }
      else { setBlocked('This website isn\u2019t available right now.'); setCurrentUrl(''); }
    } catch (err) { setCurrentUrl(url); }
    setLoading(false);
  };

  if (currentUrl) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 50, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#f0fdfa', borderBottom: '2px solid #99f6e4', gap: 8 }}>
        <button onClick={() => setCurrentUrl('')} style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>← Back</button>
        <div style={{ flex: 1, padding: '8px 12px', background: '#fff', borderRadius: 8, fontSize: 14, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{currentUrl}</div>
        <button onClick={() => setCurrentUrl('')} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
      </div>
      <iframe src={currentUrl} style={{ flex: 1, border: 'none', width: '100%' }} title="Browse" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
    </div>
  );

  return (
    <div style={{ padding: 24, minHeight: '100vh', position: 'relative', zIndex: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f766e', fontFamily: 'Georgia, serif' }}>🌐 Browse Web</h1>
        <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
        <input
          type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search Google or type a website..."
          style={{ flex: 1, padding: '14px 20px', borderRadius: 12, border: '2px solid #e5e7eb', fontSize: 18, outline: 'none' }}
        />
        <button onClick={handleSearch} disabled={loading}
          style={{ padding: '14px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          🔍 Search
        </button>
      </div>

      {blocked && (
        <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🛡️</span>
          <div style={{ color: '#991b1b', fontSize: 16 }}>{blocked}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {shortcuts.map(s => (
          <button key={s.name} onClick={() => handleShortcut(s.url)}
            style={{ background: s.bg, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10, border: '2px solid #e5e7eb', cursor: 'pointer', transition: 'transform 0.1s' }}>
            <span style={{ fontSize: 44 }}>{s.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>{s.name}</span>
          </button>
        ))}
      </div>

      <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
    </div>
  );
};
// VOICE SCREEN
const VoiceScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("Tap the microphone to talk to Warda");
  const [transcript, setTranscript] = useState("");
  const playAudio = (base64Audio: string) => {
    const audio = new Audio("data:audio/mpeg;base64," + base64Audio);
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.play();
  };
  const handleMicClick = async () => {
    if (isListening || isPlaying) return;
    setIsListening(true);
    setStatus("Listening...");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setStatus("Speech not supported. Try Chrome."); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setStatus("Warda is responding...");
      setIsListening(false);
      try {
        const res = await fetch("https://api.meetwarda.com/api/voice/command", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "margaret123", message: text, context: { residentName: "Margaret" } })
        });
        const data = await res.json();
        if (data.success) {
            setStatus("Warda is speaking...");
            if (data.audio) playAudio(data.audio);
            // Handle navigation commands
            if (data.type === 'navigation' && data.screen) {
              setTimeout(() => {
                if (data.screen === 'help') { onHelp(); }
                else { onNavigate(data.screen as Screen); }
              }, 1500);
            }
            // Handle call commands
            if (data.type === 'call' && data.calleeName) {
              setStatus("Connecting call to " + data.calleeName + "...");
            }
          }
      } catch (err) { setStatus("Connection error. Tap to try again."); }
    };
    recognition.onerror = () => { setStatus("Could not hear you. Tap again."); setIsListening(false); };
    recognition.start();
  };
  return (
    <motion.div key="voice" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: "Georgia, serif" }}>🎤 Talk to Warda</h1>
        <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8" style={{ zIndex: 10 }}>
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 text-center shadow-xl border-2 border-white/50">
          <p className="text-2xl text-gray-700 mb-4">{status}</p>
          {transcript && <p className="text-lg text-gray-500 italic">You said: "{transcript}"</p>}
        </div>
        <motion.button onClick={handleMicClick} disabled={isListening || isPlaying}
          className="w-40 h-40 rounded-full flex items-center justify-center text-7xl shadow-2xl"
          style={{ background: isListening ? "linear-gradient(135deg, #F87171, #EF4444)" : isPlaying ? "linear-gradient(135deg, #A78BFA, #8B5CF6)" : "linear-gradient(135deg, #5EEAD4, #14B8A6)" }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          {isListening ? "👂" : isPlaying ? "🔊" : "🎤"}
        </motion.button>
        <p className="text-xl text-teal-700 font-semibold">{isListening ? "Listening..." : isPlaying ? "Warda is speaking..." : "Tap to speak"}</p>
      </div>
      <BottomBar onBack={() => onNavigate("home")} onHome={() => onNavigate("home")} />
    </motion.div>
  );
};

// FAITH SCREEN
const FaithScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => (
  <motion.div key="faith" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🙏 My Faith</h1>
      <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
    </div>
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-6" style={{ zIndex: 10 }}>
      <p className="text-lg text-amber-800 text-center">Find comfort, peace, and inspiration</p>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
      <motion.button className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-blue-200" whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">✝️</span><span className="text-2xl font-bold text-blue-800">Christian</span><span className="text-blue-600 text-center">Bible, Hymns, Prayers</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-green-50 to-green-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-green-200" whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">☪️</span><span className="text-2xl font-bold text-green-800">Muslim</span><span className="text-green-600 text-center">Quran, Duas, Nasheeds</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-amber-200" whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">✡️</span><span className="text-2xl font-bold text-amber-800">Jewish</span><span className="text-amber-600 text-center">Torah, Psalms, Prayers</span>
      </motion.button>
    </div>
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 mb-6 border-2 border-white/50 shadow-lg" style={{ zIndex: 10 }}>
      <h2 className="text-xl font-bold text-gray-700 mb-3">📖 Todays Verse</h2>
      <p className="text-lg text-gray-600 italic">"The Lord is my shepherd; I shall not want. He makes me lie down in green pastures."</p>
      <p className="text-gray-500 mt-2">- Psalm 23:1-2</p>
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// ============ MAIN APP ============


// ─── Video Call Screen (Chime SDK) ──────────────────────────
const VideoCallScreen: React.FC<{
  meeting: any; attendee: any; callerName: string;
  onEnd: () => void; onNavigate: (s: Screen) => void;
}> = ({ meeting, attendee, callerName, onEnd, onNavigate }) => {
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const meetingSessionRef = React.useRef<any>(null);

  React.useEffect(() => {
    let timer: any;
    const startCall = async () => {
      try {
        const ChimeSDK = await import('amazon-chime-sdk-js');
        const logger = new ChimeSDK.ConsoleLogger('WardaCall', ChimeSDK.LogLevel.WARN);
        const deviceController = new ChimeSDK.DefaultDeviceController(logger);
        const config = new ChimeSDK.MeetingSessionConfiguration(meeting, attendee);
        const session = new ChimeSDK.DefaultMeetingSession(config, logger, deviceController);
        meetingSessionRef.current = session;

        // Bind audio
        const audioEl = document.createElement('audio');
        audioEl.id = 'warda-call-audio';
        document.body.appendChild(audioEl);
        await session.audioVideo.bindAudioElement(audioEl);

        // Start local video
        const videoDevices = await session.audioVideo.listVideoInputDevices();
        if (videoDevices.length > 0) {
          await session.audioVideo.startVideoInput(videoDevices[0].deviceId);
        }
        const audioDevices = await session.audioVideo.listAudioInputDevices();
        if (audioDevices.length > 0) {
          await session.audioVideo.startAudioInput(audioDevices[0].deviceId);
        }

        // Observer for remote video
        const observer: any = {
          videoTileDidUpdate: (tileState: any) => {
            if (tileState.localTile && localVideoRef.current) {
              session.audioVideo.bindVideoElement(tileState.tileId, localVideoRef.current);
            } else if (!tileState.localTile && remoteVideoRef.current) {
              session.audioVideo.bindVideoElement(tileState.tileId, remoteVideoRef.current);
            }
          },
          audioVideoDidStart: () => { setConnected(true); },
          audioVideoDidStop: () => { handleEnd(); }
        };
        session.audioVideo.addObserver(observer);
        session.audioVideo.start();
        session.audioVideo.startLocalVideoTile();

        timer = setInterval(() => setElapsed(e => e + 1), 1000);
      } catch (err) {
        console.error('Video call error:', err);
      }
    };
    startCall();
    return () => {
      clearInterval(timer);
      const el = document.getElementById('warda-call-audio');
      if (el) el.remove();
    };
  }, []);

  const handleEnd = async () => {
    try {
      if (meetingSessionRef.current) {
        meetingSessionRef.current.audioVideo.stop();
      }
    } catch (e) {}
    onEnd();
  };

  const toggleMute = () => {
    if (!meetingSessionRef.current) return;
    if (muted) { meetingSessionRef.current.audioVideo.realtimeUnmuteLocalAudio(); }
    else { meetingSessionRef.current.audioVideo.realtimeMuteLocalAudio(); }
    setMuted(!muted);
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a2e', display: 'flex', flexDirection: 'column', zIndex: 9999 }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
        {!connected && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📹</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>Connecting to {callerName}...</div>
          </div>
        )}
        <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: 100, right: 20, width: 160, height: 120, borderRadius: 12, border: '2px solid #fff', objectFit: 'cover', background: '#333' }} />
        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>{callerName}</div>
          <div style={{ color: '#aaa', fontSize: 18 }}>{connected ? formatTime(elapsed) : 'Connecting...'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: 24, background: 'rgba(0,0,0,0.8)' }}>
        <button onClick={toggleMute} style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', fontSize: 28, cursor: 'pointer', background: muted ? '#f59e0b' : '#374151', color: '#fff' }}>
          {muted ? '🔇' : '🎤'}
        </button>
        <button onClick={handleEnd} style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', fontSize: 28, cursor: 'pointer', background: '#ef4444', color: '#fff' }}>
          📞
        </button>
      </div>
    </div>
  );
};

// ─── Incoming Call Overlay ──────────────────────────────────
const IncomingCallOverlay: React.FC<{
  callerName: string; onAnswer: () => void; onDecline: () => void;
}> = ({ callerName, onAnswer, onDecline }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
    <div style={{ fontSize: 80, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📹</div>
    <div style={{ color: '#fff', fontSize: 36, fontWeight: 700, marginBottom: 8 }}>{callerName}</div>
    <div style={{ color: '#9ca3af', fontSize: 22, marginBottom: 48 }}>is calling you...</div>
    <div style={{ display: 'flex', gap: 48 }}>
      <button onClick={onDecline} style={{ width: 88, height: 88, borderRadius: '50%', border: 'none', fontSize: 36, cursor: 'pointer', background: '#ef4444', color: '#fff', boxShadow: '0 0 30px rgba(239,68,68,0.5)' }}>✕</button>
      <button onClick={onAnswer} style={{ width: 88, height: 88, borderRadius: '50%', border: 'none', fontSize: 36, cursor: 'pointer', background: '#22c55e', color: '#fff', boxShadow: '0 0 30px rgba(34,197,94,0.5)' }}>📞</button>
    </div>
    <style>{'@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }'}</style>
  </div>
);

// ─── Settings Screen ──────────────────────────────────────
const SettingsScreen: React.FC<{ onNavigate: (screen: Screen) => void; onHelp: () => void; helpConfirmed: boolean }> = ({ onNavigate, onHelp, helpConfirmed }) => {
  const [volume, setVolume] = useState(80);
  const [brightness, setBrightness] = useState(90);
  const [textSize, setTextSize] = useState(100);
  const [wardaSpeed, setWardaSpeed] = useState(50);

  const SliderControl: React.FC<{ label: string; emoji: string; value: number; onChange: (v: number) => void; lowLabel: string; highLabel: string }> = ({ label, emoji, value, onChange, lowLabel, highLabel }) => (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-white/50 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: 36 }}>{emoji}</span>
        <span className="text-2xl font-bold text-teal-700" style={{ fontFamily: "Georgia, serif" }}>{label}</span>
        <span className="ml-auto text-2xl font-bold text-teal-600">{value}%</span>
      </div>
      <input
        type="range" min="0" max="100" value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: '100%', height: 44, accentColor: '#0D9488', cursor: 'pointer' }}
      />
      <div className="flex justify-between mt-2">
        <span className="text-lg text-gray-500">{lowLabel}</span>
        <span className="text-lg text-gray-500">{highLabel}</span>
      </div>
    </div>
  );

  return (
    <motion.div key="settings" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
      className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: "Georgia, serif" }}>⚙️ Settings</h1>
        <HelpButton onPress={onHelp} confirmed={helpConfirmed} />
      </div>
      <div className="flex-1 overflow-y-auto" style={{ zIndex: 10 }}>
        <SliderControl emoji="🔊" label="Volume" value={volume} onChange={(v) => { setVolume(v); try { const u = new (window as any).AudioContext(); const g = u.createGain(); g.gain.value = v / 100; g.connect(u.destination); } catch(e){} }} lowLabel="Quiet" highLabel="Loud" />
        <SliderControl emoji="☀️" label="Brightness" value={brightness} onChange={(v) => { setBrightness(v); document.body.style.filter = `brightness(${v / 100})`; }} lowLabel="Dim" highLabel="Bright" />
        <SliderControl emoji="🔤" label="Text Size" value={textSize} onChange={(v) => { setTextSize(v); document.documentElement.style.fontSize = `${v}%`; }} lowLabel="Small" highLabel="Large" />
        <SliderControl emoji="🗣️" label="Warda's Speed" value={wardaSpeed} onChange={setWardaSpeed} lowLabel="Slower" highLabel="Faster" />
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-white/50 mb-5">
          <p className="text-xl text-gray-600 text-center" style={{ fontFamily: "Georgia, serif" }}>
            Need help? Press the <span className="text-red-500 font-bold">red help button</span> anytime.
          </p>
        </div>
      </div>
      <BottomBar onBack={() => onNavigate("home")} onHome={() => onNavigate("home")} />
    </motion.div>
  );
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('pin');
  const [residentSession, setResidentSession] = React.useState<ResidentSession | null>(null);
  const [familyContacts, setFamilyContacts] = React.useState<Contact[]>([]);
  RESIDENT_ID = residentSession?.id || '';
  RESIDENT_NAME = residentSession?.preferredName || '';
  CARE_HOME_ID = residentSession?.careHomeId || '';
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const socketRef = React.useRef<any>(null);
  const [proactiveMsg, setProactiveMsg] = useState<any>(null);
  const [medReminder, setMedReminder] = useState<any>(null);

  // 🔌 SOCKET CONNECTION - Real-time layer
  const {
    isConnected,
    incomingMessage,
    helpConfirmed,
    sendHelp,
    sendMessageToFamily,
    updateWardaStatus,
    dismissMessage,
    messageQueue,
  } = useSocket(RESIDENT_ID, RESIDENT_NAME, CARE_HOME_ID);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
    if (screen !== 'contact') setSelectedContact(null);
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentScreen('contact');
  };

  // Handle reply from message overlay
  const handleReplyFromOverlay = (senderId: string, senderName: string) => {
    dismissMessage();
    // Navigate to talk screen where resident can tell Warda to reply
    setCurrentScreen('talk');
  };

  // Help button handler
  const handleHelp = () => {
    sendHelp();
  };

  const handlePinLogin = (session: ResidentSession) => {
    setResidentSession(session);
    setCurrentScreen('home');
    // Connect socket for video calls
    import('socket.io-client').then(({ io }) => {
      const socket = io('https://api.meetwarda.com', { transports: ['websocket', 'polling'] });
      socketRef.current = socket;
      socket.on('connect', () => {
        console.log('Tablet socket connected');
        socket.emit('join:tablet', { residentId: session.id });
      });
      socket.on('call:incoming', (data: any) => {
        console.log('Incoming call:', data);
        setIncomingCall(data);
        setTimeout(() => setIncomingCall((prev: any) => prev?.meetingId === data.meetingId ? null : prev), 60000);
      });
      socket.on('medication:reminder', (data: any) => {
        console.log('Medication reminder:', data);
        setMedReminder(data);
        if (data.audio) {
          const audio = new Audio("data:audio/mpeg;base64," + data.audio);
          audio.play().catch(() => {});
        }
      });
      socket.on('proactive:message', (data: any) => {
        console.log('Proactive message:', data);
        setProactiveMsg(data);
        // Auto-play audio
        if (data.audio) {
          const audio = new Audio("data:audio/mpeg;base64," + data.audio);
          audio.play().catch(() => {});
        }
        // Auto-dismiss after 30s
        setTimeout(() => setProactiveMsg((p: any) => p?.text === data.text ? null : p), 30000);
      });
      socket.on('call:ended', () => {
        setIncomingCall(null); setActiveCall(null); setCurrentScreen('home');
      });
    });
    // Load family contacts from API
    fetch('https://api.meetwarda.com/api/family/contacts/' + session.id)
      .then(r => r.json())
      .then(data => { if (data.success) setFamilyContacts(data.contacts); })
      .catch(err => console.error('Failed to load family contacts:', err));
  };

  // Generate bubbles
  const mainBubbles = Array.from({ length: 40 }, (_, i) => ({
    id: `main-${i}`, delay: (i % 12) * 1.2 + Math.random() * 3,
    originX: (i % 12) * (100 / 12) + Math.random() * (100 / 12 / 2),
    size: 15 + Math.random() * 35, duration: 11 + Math.random() * 5,
  }));
  const tinyBubbles = Array.from({ length: 30 }, (_, i) => ({
    id: `tiny-${i}`, delay: i * 0.6 + Math.random() * 2, originX: Math.random() * 100, duration: 13 + Math.random() * 5,
  }));
  const lightRays = [
    { left: 5, width: 100, opacity: 0.06, delay: 0 }, { left: 20, width: 80, opacity: 0.05, delay: 1 },
    { left: 38, width: 120, opacity: 0.07, delay: 2 }, { left: 55, width: 90, opacity: 0.05, delay: 1.5 },
    { left: 72, width: 110, opacity: 0.06, delay: 0.5 }, { left: 88, width: 85, opacity: 0.05, delay: 2.5 },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 30%, #E0F2FE 70%, #F0FDFA 100%)' }}>
      {/* Connection indicator */}
      <ConnectionDot connected={isConnected} />

      {/* Background effects */}
      {lightRays.map((ray, i) => <LightRay key={i} {...ray} />)}
      {mainBubbles.map((b) => <AquariumBubble key={b.id} {...b} />)}
      {tinyBubbles.map((b) => <TinyBubble key={b.id} {...b} />)}

      {/* Message overlay - shows when family/staff sends a message */}
      <MessageOverlay
        message={incomingMessage}
        residentName={RESIDENT_NAME}
        onDismiss={dismissMessage}
        onReply={handleReplyFromOverlay}
        queueCount={messageQueue.length}
      />

      {/* Screens */}
      <AnimatePresence mode="wait">
        {currentScreen === 'pin' && <PinLoginScreen onLogin={handlePinLogin} />}
        {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} time={timeString} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'talk' && <TalkScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'voice' && <VoiceScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'family' && <FamilyScreen onNavigate={handleNavigate} onSelectContact={handleSelectContact} onHelp={handleHelp} helpConfirmed={helpConfirmed}  contacts={familyContacts} />}
        {currentScreen === 'contact' && selectedContact && <ContactScreen contact={selectedContact} onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'activities' && <ActivitiesScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'health' && <HealthScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'faith' && <FaithScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'myday' && <MyDayScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {currentScreen === 'browse' && <BrowseScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
        {activeCall && <VideoCallScreen meeting={activeCall.meeting} attendee={activeCall.attendee} callerName={activeCall.callerName} onEnd={() => { setActiveCall(null); setCurrentScreen('home'); fetch(API_BASE.replace('/api','') + '/api/video/end', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({residentId: residentSession?.id}) }); }} onNavigate={setCurrentScreen} />}
      {medReminder && !activeCall && !incomingCall && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 8500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>💊</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f766e', marginBottom: 8 }}>Medication Time</h2>
            <p style={{ fontSize: 20, color: '#374151', marginBottom: 4 }}>{medReminder.name}</p>
            {medReminder.dosage && <p style={{ fontSize: 16, color: '#6b7280' }}>{medReminder.dosage}</p>}
            <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 8 }}>{medReminder.timeSlot}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              <button onClick={async () => {
                try { await fetch('https://api.meetwarda.com/api/medications/' + medReminder.medicationId + '/taken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordedBy: 'tablet' }) }); } catch {}
                setMedReminder(null);
              }} style={{ padding: '14px 28px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>✓ Taken</button>
              <button onClick={async () => {
                try { await fetch('https://api.meetwarda.com/api/medications/' + medReminder.medicationId + '/skipped', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordedBy: 'tablet', reason: 'Declined' }) }); } catch {}
                setMedReminder(null);
              }} style={{ padding: '14px 28px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>Skip</button>
            </div>
          </div>
        </div>
      )}
      {proactiveMsg && !activeCall && !incomingCall && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, background: 'linear-gradient(135deg, #0d9488, #0891b2)', borderRadius: 16, padding: '20px 24px', color: '#fff', zIndex: 8000, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => { setProactiveMsg(null); setCurrentScreen('voice'); }}>
          <div style={{ fontSize: 40 }}>🌹</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Warda says...</div>
            <div style={{ fontSize: 16, opacity: 0.95 }}>{proactiveMsg.text}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setProactiveMsg(null); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {incomingCall && !activeCall && <IncomingCallOverlay callerName={incomingCall.callerName} onAnswer={() => { setActiveCall(incomingCall); setIncomingCall(null); }} onDecline={() => { setIncomingCall(null); fetch(API_BASE.replace('/api','') + '/api/video/end', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({residentId: residentSession?.id}) }); }} />}
      {currentScreen === 'settings' && <SettingsScreen onNavigate={handleNavigate} onHelp={handleHelp} helpConfirmed={helpConfirmed} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
