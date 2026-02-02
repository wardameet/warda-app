import { useWarda } from './useWarda';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============ TYPES ============
type Screen = 'home' | 'talk' | 'family' | 'contact' | 'activities' | 'health' | 'myday' | 'browse';

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
const mockContacts: Contact[] = [
  { id: '1', name: 'Sarah', relation: 'Daughter', avatar: '👩', online: true, unreadCount: 2, lastMessage: 'The kids loved the park!' },
  { id: '2', name: 'James', relation: 'Son', avatar: '👨', online: false, unreadCount: 1, lastMessage: 'Call you tomorrow Mum' },
  { id: '3', name: 'Emma', relation: 'Granddaughter', avatar: '👧', online: true, unreadCount: 0, lastMessage: 'Love you Granny! 💕' },
  { id: '4', name: 'Oliver', relation: 'Grandson', avatar: '👦', online: false, unreadCount: 0, lastMessage: 'Thanks for the birthday card!' },
  { id: '5', name: 'Robert', relation: 'Brother', avatar: '👴', online: false, unreadCount: 0, lastMessage: 'See you Sunday' },
];

const mockEvents: Event[] = [
  { id: '1', title: 'Sarah visiting', time: '14:00', type: 'family' },
  { id: '2', title: 'Afternoon tablets', time: '14:30', type: 'medication' },
  { id: '3', title: 'Chair yoga', time: '15:30', type: 'activity' },
  { id: '4', title: 'Video call with James', time: '17:00', type: 'call' },
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
const HelpButton: React.FC = () => (
  <motion.button className="bg-gradient-to-r from-red-500 to-red-600 text-white px-8 py-4 rounded-2xl font-bold text-xl flex items-center gap-3 shadow-xl border-2 border-red-400"
    style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)', zIndex: 10 }}
    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
    🆘 Help
  </motion.button>
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

// HOME SCREEN
const HomeScreen: React.FC<{ onNavigate: (screen: Screen) => void; time: string }> = ({ onNavigate, time }) => (
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
      <HelpButton />
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <WardaFace onClick={() => onNavigate('talk')} hasNotification={true} />
      <div className="text-center" style={{ zIndex: 10 }}>
        <motion.h1 className="text-5xl font-bold text-teal-700 mb-3" style={{ fontFamily: 'Georgia, serif' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          Good afternoon, Margaret!
        </motion.h1>
        <motion.p className="text-xl text-gray-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Sarah sent you a photo. Tap me to chat!
        </motion.p>
      </div>
    </div>
    <motion.div className="grid grid-cols-6 gap-4 mb-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <NavCard icon="💬" label="Talk to Warda" onClick={() => onNavigate('talk')} />
      <NavCard icon="👨‍👩‍👧" label="Family" onClick={() => onNavigate('family')} badge={3} />
      <NavCard icon="🎯" label="Activities" onClick={() => onNavigate('activities')} />
      <NavCard icon="❤️" label="My Health" onClick={() => onNavigate('health')} />
      <NavCard icon="📅" label="My Day" onClick={() => onNavigate('myday')} />
      <NavCard icon="🌐" label="Browse Web" onClick={() => onNavigate('browse')} />
    </motion.div>
    <BottomBar onBack={() => {}} onHome={() => {}} backDisabled homeDisabled />
  </motion.div>
);

// TALK SCREEN
const TalkScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [mode, setMode] = useState<"voice" | "type">("type");
  const [inputText, setInputText] = useState("");
  const { messages, sendMessage, isLoading } = useWarda("margaret123", "Margaret");
  const handleSend = () => { if (inputText.trim() && !isLoading) { sendMessage(inputText.trim()); setInputText(""); } };
  return (
    <motion.div key="talk" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700">Talk to Warda</h1>
        <HelpButton />
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
          {isLoading && <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4"><p className="text-gray-500">One moment, dear...</p></div>}
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
const FamilyScreen: React.FC<{ onNavigate: (screen: Screen) => void; onSelectContact: (contact: Contact) => void }> = ({ onNavigate, onSelectContact }) => (
  <motion.div key="family" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>👨‍👩‍👧 Family</h1>
      <HelpButton />
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6 overflow-y-auto" style={{ zIndex: 10 }}>
      {mockContacts.map((contact) => (
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
const ContactScreen: React.FC<{ contact: Contact; onNavigate: (screen: Screen) => void }> = ({ contact, onNavigate }) => (
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
      <HelpButton />
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
const ActivitiesScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => (
  <motion.div key="activities" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🎯 Activities</h1>
      <HelpButton />
    </div>
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ zIndex: 10 }}>
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-2xl">😊</div>
      <p className="text-lg text-teal-800">It's a lovely afternoon, Margaret. How about some gentle stretches or your favourite music?</p>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
      <motion.button className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-purple-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🎵</span>
        <span className="text-2xl font-bold text-purple-800">Music</span>
        <span className="text-purple-600">Songs, radio, decades</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-orange-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🧩</span>
        <span className="text-2xl font-bold text-orange-800">Games</span>
        <span className="text-orange-600">Puzzles, trivia, memory</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-green-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🧘</span>
        <span className="text-2xl font-bold text-green-800">Exercises</span>
        <span className="text-green-600">Chair yoga, stretches</span>
      </motion.button>
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// HEALTH SCREEN
const HealthScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => (
  <motion.div key="health" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>❤️ My Health</h1>
      <HelpButton />
    </div>
    <div className="flex-1 grid grid-cols-2 gap-6 mb-6" style={{ zIndex: 10 }}>
      <motion.button className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-purple-200"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <span className="text-5xl">💊</span>
        <span className="text-xl font-bold text-gray-800">Medications</span>
        <div className="bg-purple-100 px-4 py-2 rounded-full">
          <span className="text-purple-700 font-semibold">Next: 2:30 PM</span>
        </div>
      </motion.button>
      <motion.button className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-red-200"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <span className="text-5xl">📊</span>
        <span className="text-xl font-bold text-gray-800">My Vitals</span>
        <div className="bg-red-100 px-4 py-2 rounded-full">
          <span className="text-red-700 font-semibold">Log reading</span>
        </div>
      </motion.button>
      <motion.button className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-blue-200"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <span className="text-5xl">👨‍⚕️</span>
        <span className="text-xl font-bold text-gray-800">GP Messages</span>
        <div className="bg-blue-100 px-4 py-2 rounded-full">
          <span className="text-blue-700 font-semibold">1 new message</span>
        </div>
      </motion.button>
      <motion.button className="bg-white/90 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg border-2 border-green-200"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <span className="text-5xl">📝</span>
        <span className="text-xl font-bold text-gray-800">How I Feel</span>
        <div className="bg-green-100 px-4 py-2 rounded-full">
          <span className="text-green-700 font-semibold">Log symptoms</span>
        </div>
      </motion.button>
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// MY DAY SCREEN
const MyDayScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const eventColors: Record<string, string> = {
    family: 'border-l-green-500 bg-green-50',
    medical: 'border-l-red-500 bg-red-50',
    activity: 'border-l-orange-500 bg-orange-50',
    call: 'border-l-blue-500 bg-blue-50',
    medication: 'border-l-purple-500 bg-purple-50',
  };
  const eventIcons: Record<string, string> = { family: '👨‍👩‍👧', medical: '🏥', activity: '🎯', call: '📞', medication: '💊' };
  
  return (
    <motion.div key="myday" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
      className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>📅 My Day</h1>
        <HelpButton />
      </div>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-6" style={{ zIndex: 10 }}>
        <h2 className="text-2xl font-bold text-amber-800 mb-1">Today - Sunday, 2nd February</h2>
        <p className="text-amber-600">You have 4 things planned today</p>
      </div>
      <div className="flex-1 space-y-4 mb-6 overflow-y-auto" style={{ zIndex: 10 }}>
        {mockEvents.map((event) => (
          <motion.div key={event.id}
            className={`bg-white/90 backdrop-blur-md rounded-2xl p-5 shadow-lg border-l-4 ${eventColors[event.type]}`}
            whileHover={{ scale: 1.01, x: 4 }}>
            <div className="flex items-center gap-4">
              <div className="text-4xl">{eventIcons[event.type]}</div>
              <div className="flex-1">
                <div className="text-xl font-bold text-gray-800">{event.title}</div>
                <div className="text-gray-500">at {event.time}</div>
              </div>
              <div className="text-2xl font-bold text-gray-400">{event.time}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
    </motion.div>
  );
};

// BROWSE WEB SCREEN
const BrowseScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => (
  <motion.div key="browse" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🌐 Browse Web</h1>
      <HelpButton />
    </div>
    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 mb-6 flex gap-4" style={{ zIndex: 10 }}>
      <input type="text" placeholder="Search Google or type a website..." 
        className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-200 text-lg focus:outline-none focus:border-teal-400" />
      <motion.button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg"
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
        🔍 Search
      </motion.button>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
      {[
        { icon: '📺', name: 'BBC News', color: 'from-red-100 to-red-200 border-red-300' },
        { icon: '🌤️', name: 'Weather', color: 'from-blue-100 to-blue-200 border-blue-300' },
        { icon: '📰', name: 'Daily Mail', color: 'from-gray-100 to-gray-200 border-gray-300' },
        { icon: '🎬', name: 'YouTube', color: 'from-red-100 to-pink-200 border-red-300' },
        { icon: '🛒', name: 'Amazon', color: 'from-orange-100 to-yellow-200 border-orange-300' },
        { icon: '⭐', name: 'Favourites', color: 'from-amber-100 to-amber-200 border-amber-300' },
      ].map((site) => (
        <motion.button key={site.name}
          className={`bg-gradient-to-br ${site.color} rounded-3xl p-6 flex flex-col items-center gap-3 shadow-lg border-2`}
          whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
          <span className="text-5xl">{site.icon}</span>
          <span className="text-xl font-bold text-gray-700">{site.name}</span>
        </motion.button>
      ))}
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);

// ============ MAIN APP ============
function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FDF8F3 0%, #F9F5EF 30%, #F4EFE8 60%, #EBE6DE 100%)' }}>
      {lightRays.map((ray, i) => <LightRay key={i} {...ray} />)}
      {mainBubbles.map((b) => <AquariumBubble key={b.id} {...b} />)}
      {tinyBubbles.map((b) => <TinyBubble key={b.id} {...b} />)}

      <AnimatePresence mode="wait">
        {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} time={timeString} />}
        {currentScreen === 'talk' && <TalkScreen onNavigate={handleNavigate} />}
        {currentScreen === 'family' && <FamilyScreen onNavigate={handleNavigate} onSelectContact={handleSelectContact} />}
        {currentScreen === 'contact' && selectedContact && <ContactScreen contact={selectedContact} onNavigate={handleNavigate} />}
        {currentScreen === 'activities' && <ActivitiesScreen onNavigate={handleNavigate} />}
        {currentScreen === 'health' && <HealthScreen onNavigate={handleNavigate} />}
        {currentScreen === 'myday' && <MyDayScreen onNavigate={handleNavigate} />}
        {currentScreen === 'browse' && <BrowseScreen onNavigate={handleNavigate} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
