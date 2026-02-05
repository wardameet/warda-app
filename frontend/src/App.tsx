import { useWarda } from './useWarda';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_URL = 'https://api.meetwarda.com/api';

// ============ TYPES ============
type Screen = 'home' | 'talk' | 'voice' | 'family' | 'contact' | 'activities' | 'health' | 'myday' | 'browse' | 'faith' | 'music' | 'games' | 'exercises';
type AuthScreen = 'setup' | 'login' | 'change-pin' | 'authenticated';

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  photoUrl?: string;
  careHomeId: string;
  careHomeName?: string;
}

interface CareHome {
  id: string;
  name: string;
  logoUrl?: string;
}

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

// ============ LOCAL STORAGE HELPERS ============
const storage = {
  getActivationCode: () => localStorage.getItem('warda_activation_code'),
  setActivationCode: (code: string) => localStorage.setItem('warda_activation_code', code),
  clearActivationCode: () => localStorage.removeItem('warda_activation_code'),
  getResident: () => {
    const data = localStorage.getItem('warda_resident');
    return data ? JSON.parse(data) : null;
  },
  setResident: (resident: Resident) => localStorage.setItem('warda_resident', JSON.stringify(resident)),
  clearResident: () => localStorage.removeItem('warda_resident'),
  getCareHome: () => {
    const data = localStorage.getItem('warda_care_home');
    return data ? JSON.parse(data) : null;
  },
  setCareHome: (careHome: CareHome) => localStorage.setItem('warda_care_home', JSON.stringify(careHome)),
  getToken: () => localStorage.getItem('warda_token'),
  setToken: (token: string) => localStorage.setItem('warda_token', token),
  clearAll: () => {
    localStorage.removeItem('warda_activation_code');
    localStorage.removeItem('warda_resident');
    localStorage.removeItem('warda_care_home');
    localStorage.removeItem('warda_token');
  }
};

// ============ DEVICE SETUP SCREEN ============
const DeviceSetupScreen: React.FC<{ onActivated: (careHome: CareHome) => void }> = ({ onActivated }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleActivate = async () => {
    if (!code.trim()) {
      setError('Please enter an activation code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/tablet/activate`, { code: code.trim() });
      
      if (response.data.success) {
        storage.setActivationCode(code.trim().toUpperCase());
        storage.setCareHome(response.data.careHome);
        onActivated(response.data.careHome);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.reason || 'Invalid activation code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center">
        
        <div className="text-7xl mb-6">🌹</div>
        <h1 className="text-4xl font-bold text-teal-700 mb-2">Meet Warda</h1>
        <p className="text-xl text-gray-500 mb-8">Device Setup</p>
        
        <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-6 mb-6">
          <p className="text-teal-700 text-lg mb-4">
            Enter your activation code to connect this tablet to your care home.
          </p>
          
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXX-XXXX-XXXX-XXXX"
            className="w-full text-center text-2xl font-mono tracking-wider p-4 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:outline-none"
            style={{ letterSpacing: '0.1em' }}
          />
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-4 mb-6">
            {error}
          </motion.div>
        )}
        
        <motion.button
          onClick={handleActivate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white text-2xl font-bold py-5 rounded-2xl shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          {loading ? '⏳ Activating...' : '✅ Activate Device'}
        </motion.button>
        
        <p className="text-gray-400 text-sm mt-6">
          Contact your care home manager for an activation code
        </p>
      </motion.div>
    </div>
  );
};

// ============ PIN LOGIN SCREEN ============
const PinLoginScreen: React.FC<{ 
  careHome: CareHome; 
  activationCode: string;
  onLogin: (resident: Resident, requirePinChange: boolean, token: string) => void;
  onDeviceInvalid: () => void;
}> = ({ careHome, activationCode, onLogin, onDeviceInvalid }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/tablet/pin-login`, { 
        pin, 
        activationCode 
      });
      
      if (response.data.success) {
        storage.setToken(response.data.token);
        storage.setResident(response.data.resident);
        onLogin(response.data.resident, response.data.requirePinChange, response.data.token);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      
      if (errorCode === 'DEVICE_SUSPENDED' || errorCode === 'INVALID_CODE' || errorCode?.startsWith('CODE_')) {
        setError(err.response?.data?.reason || 'Device deactivated. Please contact support.');
        onDeviceInvalid();
      } else {
        setError('Invalid PIN. Please try again.');
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleLogin();
    }
  }, [pin]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        
        <div className="text-6xl mb-4">🌹</div>
        <h1 className="text-3xl font-bold text-teal-700 mb-1">{careHome.name}</h1>
        <p className="text-gray-500 mb-6">Enter your PIN to continue</p>
        
        {/* Grayed out activation code */}
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-3 mb-6">
          <p className="text-xs text-gray-400 mb-1">Device Code</p>
          <p className="text-sm font-mono text-gray-500">{activationCode}</p>
        </div>
        
        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-16 h-20 rounded-xl flex items-center justify-center text-4xl font-bold border-3 ${
                pin.length > i 
                  ? 'bg-teal-100 border-teal-400 text-teal-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-300'
              }`}>
              {pin.length > i ? '●' : '○'}
            </div>
          ))}
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
            {error}
          </motion.div>
        )}
        
        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <motion.button
              key={num}
              onClick={() => handlePinPress(num.toString())}
              disabled={loading || pin.length >= 4}
              className="bg-gradient-to-br from-gray-50 to-gray-100 text-3xl font-bold text-gray-700 py-5 rounded-xl border-2 border-gray-200 shadow-sm"
              whileHover={{ scale: 1.05, backgroundColor: '#E0F2F1' }}
              whileTap={{ scale: 0.95 }}>
              {num}
            </motion.button>
          ))}
          <motion.button
            onClick={() => {/* Forgot PIN */}}
            className="bg-amber-50 text-amber-600 text-sm font-bold py-5 rounded-xl border-2 border-amber-200"
            whileTap={{ scale: 0.95 }}>
            Forgot PIN?
          </motion.button>
          <motion.button
            onClick={() => handlePinPress('0')}
            disabled={loading || pin.length >= 4}
            className="bg-gradient-to-br from-gray-50 to-gray-100 text-3xl font-bold text-gray-700 py-5 rounded-xl border-2 border-gray-200 shadow-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}>
            0
          </motion.button>
          <motion.button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="bg-red-50 text-red-500 text-2xl font-bold py-5 rounded-xl border-2 border-red-200"
            whileTap={{ scale: 0.95 }}>
            ⌫
          </motion.button>
        </div>
        
        {loading && (
          <div className="text-teal-600 text-lg">
            ⏳ Signing in...
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ============ CHANGE PIN SCREEN ============
const ChangePinScreen: React.FC<{ 
  resident: Resident; 
  onPinChanged: () => void;
}> = ({ resident, onPinChanged }) => {
  const [step, setStep] = useState<'new' | 'confirm'>('new');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentPin = step === 'new' ? newPin : confirmPin;
  const setCurrentPin = step === 'new' ? setNewPin : setConfirmPin;

  const handlePinPress = (digit: string) => {
    if (currentPin.length < 4) {
      setCurrentPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setCurrentPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (step === 'new' && newPin.length === 4) {
      setStep('confirm');
    } else if (step === 'confirm' && confirmPin.length === 4) {
      handleChangePin();
    }
  }, [newPin, confirmPin]);

  const handleChangePin = async () => {
    if (newPin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setNewPin('');
      setConfirmPin('');
      setStep('new');
      return;
    }
    
    if (newPin === '1234') {
      setError('Please choose a different PIN');
      setNewPin('');
      setConfirmPin('');
      setStep('new');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await axios.post(`${API_URL}/tablet/change-pin`, {
        userId: resident.id,
        newPin: newPin
      });
      onPinChanged();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change PIN');
      setNewPin('');
      setConfirmPin('');
      setStep('new');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FCD34D 100%)' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-3xl font-bold text-amber-700 mb-2">
          Welcome, {resident.preferredName || resident.firstName}!
        </h1>
        <p className="text-gray-600 mb-6">
          {step === 'new' 
            ? 'Please set your personal PIN (4 digits)'
            : 'Confirm your new PIN'}
        </p>
        
        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-16 h-20 rounded-xl flex items-center justify-center text-4xl font-bold border-3 ${
                currentPin.length > i 
                  ? 'bg-amber-100 border-amber-400 text-amber-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-300'
              }`}>
              {currentPin.length > i ? '●' : '○'}
            </div>
          ))}
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
            {error}
          </motion.div>
        )}
        
        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <motion.button
              key={num}
              onClick={() => handlePinPress(num.toString())}
              disabled={loading || currentPin.length >= 4}
              className="bg-gradient-to-br from-gray-50 to-gray-100 text-3xl font-bold text-gray-700 py-5 rounded-xl border-2 border-gray-200 shadow-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}>
              {num}
            </motion.button>
          ))}
          <div></div>
          <motion.button
            onClick={() => handlePinPress('0')}
            disabled={loading || currentPin.length >= 4}
            className="bg-gradient-to-br from-gray-50 to-gray-100 text-3xl font-bold text-gray-700 py-5 rounded-xl border-2 border-gray-200 shadow-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}>
            0
          </motion.button>
          <motion.button
            onClick={handleBackspace}
            disabled={loading || currentPin.length === 0}
            className="bg-red-50 text-red-500 text-2xl font-bold py-5 rounded-xl border-2 border-red-200"
            whileTap={{ scale: 0.95 }}>
            ⌫
          </motion.button>
        </div>
        
        {loading && (
          <div className="text-amber-600 text-lg">
            ⏳ Saving...
          </div>
        )}
        
        <p className="text-gray-400 text-sm">
          Choose a PIN you'll remember. Don't use 1234.
        </p>
      </motion.div>
    </div>
  );
};


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
const HomeScreen: React.FC<{ onNavigate: (screen: Screen) => void; time: string; residentName?: string }> = ({ onNavigate, time, residentName = "Friend" }) => (
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
          Good afternoon, {residentName}!
        </motion.h1>
        <motion.p className="text-xl text-gray-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Sarah sent you a photo. Tap me to chat!
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
    </motion.div>
    <BottomBar onBack={() => {}} onHome={() => {}} backDisabled homeDisabled />
  </motion.div>
);

// TALK SCREEN
const TalkScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string; residentId?: string }> = ({ onNavigate, residentName = "Friend", residentId = "guest" }) => {
  const [mode, setMode] = useState<"voice" | "type">("type");
  const [inputText, setInputText] = useState("");
  const { messages, sendMessage, isLoading } = useWarda(residentId, residentName);
  const handleSend = () => { if (inputText.trim() && !isLoading) { sendMessage(inputText.trim()); setInputText(""); } };
  return (
    <motion.div key="talk" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700">Talk to Warda</h1>
        <HelpButton />
      </div>
      <div className="flex-1 bg-white/80 backdrop-blur-md rounded-3xl p-6 mb-6 border-2 border-white/50 shadow-xl overflow-y-auto" style={{ zIndex: 10 }}>
        <div className="space-y-4">
          {messages.length === 0 && <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5"><p className="text-lg text-gray-700">Hello {residentName}! Type a message below to talk to me. 😊</p></div>}
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
const ActivitiesScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string }> = ({ onNavigate, residentName = "Friend" }) => (
  <motion.div key="activities" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🎯 Activities</h1>
      <HelpButton />
    </div>
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ zIndex: 10 }}>
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-2xl">😊</div>
      <p className="text-lg text-teal-800">It's a lovely afternoon, {residentName}. How about some gentle stretches or your favourite music?</p>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
      <motion.button onClick={() => onNavigate('music')} className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-purple-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🎵</span>
        <span className="text-2xl font-bold text-purple-800">Music</span>
        <span className="text-purple-600">Songs, radio, decades</span>
      </motion.button>
      <motion.button onClick={() => onNavigate('games')} className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-orange-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🧩</span>
        <span className="text-2xl font-bold text-orange-800">Games</span>
        <span className="text-orange-600">Puzzles, trivia, memory</span>
      </motion.button>
      <motion.button onClick={() => onNavigate('exercises')} className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-green-300"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">🧘</span>
        <span className="text-2xl font-bold text-green-800">Exercises</span>
        <span className="text-green-600">Chair yoga, stretches</span>
      </motion.button>
    </div>
    <BottomBar onBack={() => onNavigate('home')} onHome={() => onNavigate('home')} />
  </motion.div>
);


// ============ MUSIC SCREEN ============
const MusicScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string }> = ({ onNavigate, residentName = "Friend" }) => {
  const [currentTrack, setCurrentTrack] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  
  const playlists = [
    { id: 1, name: "Golden Oldies", icon: "🎷", color: "from-amber-100 to-amber-200", border: "border-amber-300", tracks: ["Frank Sinatra - My Way", "Nat King Cole - Unforgettable", "Dean Martin - That's Amore"] },
    { id: 2, name: "Classical Calm", icon: "🎻", color: "from-blue-100 to-blue-200", border: "border-blue-300", tracks: ["Mozart - Eine kleine Nachtmusik", "Beethoven - Moonlight Sonata", "Bach - Air on G String"] },
    { id: 3, name: "Scottish Folk", icon: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", color: "from-purple-100 to-purple-200", border: "border-purple-300", tracks: ["Loch Lomond", "Flower of Scotland", "Auld Lang Syne"] },
    { id: 4, name: "Hymns & Faith", icon: "⛪", color: "from-green-100 to-green-200", border: "border-green-300", tracks: ["Amazing Grace", "How Great Thou Art", "Be Still My Soul"] },
    { id: 5, name: "Relaxing Nature", icon: "🌿", color: "from-teal-100 to-teal-200", border: "border-teal-300", tracks: ["Rainfall", "Ocean Waves", "Forest Birds"] },
    { id: 6, name: "Big Band Era", icon: "🎺", color: "from-red-100 to-red-200", border: "border-red-300", tracks: ["Glenn Miller - In The Mood", "Benny Goodman - Sing Sing Sing", "Duke Ellington - Take the A Train"] },
  ];

  return (
    <motion.div key="music" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🎵 Music</h1>
        <HelpButton />
      </div>
      {!selectedPlaylist ? (
        <>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-2xl">🎵</div>
            <p className="text-lg text-purple-800">Pick a playlist that suits your mood, {residentName}. Music is good for the soul!</p>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 mb-6" style={{ zIndex: 10 }}>
            {playlists.map((playlist) => (
              <motion.button key={playlist.id} onClick={() => setSelectedPlaylist(playlist)} className={`bg-gradient-to-br ${playlist.color} rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg border-2 ${playlist.border}`} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
                <span className="text-5xl">{playlist.icon}</span>
                <span className="text-xl font-bold text-gray-800">{playlist.name}</span>
                <span className="text-sm text-gray-600">{playlist.tracks.length} songs</span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <motion.button onClick={() => { setSelectedPlaylist(null); setCurrentTrack(null); setIsPlaying(false); }} className="mb-4 flex items-center gap-2 text-teal-600 text-xl" whileHover={{ x: -5 }}>← Back to Playlists</motion.button>
          <div className={`bg-gradient-to-br ${selectedPlaylist.color} rounded-2xl p-6 mb-6 border-2 ${selectedPlaylist.border}`}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl">{selectedPlaylist.icon}</span>
              <div><h2 className="text-2xl font-bold text-gray-800">{selectedPlaylist.name}</h2><p className="text-gray-600">{selectedPlaylist.tracks.length} songs</p></div>
            </div>
            <div className="space-y-3">
              {selectedPlaylist.tracks.map((track: string, index: number) => (
                <motion.button key={index} onClick={() => { setCurrentTrack(index); setIsPlaying(true); }} className={`w-full p-4 rounded-xl flex items-center gap-4 ${currentTrack === index ? 'bg-white shadow-lg' : 'bg-white/50 hover:bg-white/80'}`} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${currentTrack === index && isPlaying ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>{currentTrack === index && isPlaying ? '⏸' : '▶'}</div>
                  <span className="text-lg font-medium text-gray-800">{track}</span>
                </motion.button>
              ))}
            </div>
          </div>
          {currentTrack !== null && (
            <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4"><span className="text-4xl">{selectedPlaylist.icon}</span><div><p className="font-bold text-gray-800">{selectedPlaylist.tracks[currentTrack]}</p><p className="text-sm text-gray-500">{selectedPlaylist.name}</p></div></div>
              <div className="flex items-center gap-4">
                <motion.button className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl" whileTap={{ scale: 0.9 }}>⏮</motion.button>
                <motion.button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-teal-500 text-white flex items-center justify-center text-3xl shadow-lg" whileTap={{ scale: 0.9 }}>{isPlaying ? '⏸' : '▶'}</motion.button>
                <motion.button className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl" whileTap={{ scale: 0.9 }}>⏭</motion.button>
              </div>
            </div>
          )}
        </>
      )}
      <BottomBar onBack={() => onNavigate('activities')} onHome={() => onNavigate('home')} />
    </motion.div>
  );
};

// ============ GAMES SCREEN ============
const GamesScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string }> = ({ onNavigate, residentName = "Friend" }) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [memoryCards, setMemoryCards] = useState<{id: number, emoji: string, flipped: boolean, matched: boolean}[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [triviaQuestion, setTriviaQuestion] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  
  const games = [
    { id: 'memory', name: "Memory Match", icon: "🧠", color: "from-pink-100 to-pink-200", border: "border-pink-300", desc: "Match the pairs" },
    { id: 'trivia', name: "Trivia Quiz", icon: "❓", color: "from-blue-100 to-blue-200", border: "border-blue-300", desc: "Test your knowledge" },
  ];
  
  const triviaQuestions = [
    { q: "What year did World War II end?", options: ["1943", "1945", "1947", "1950"], correct: 1 },
    { q: "Which Scottish city is known as the Granite City?", options: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"], correct: 2 },
    { q: "What is the capital of France?", options: ["London", "Berlin", "Madrid", "Paris"], correct: 3 },
    { q: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"], correct: 2 },
    { q: "What is the longest river in the world?", options: ["Amazon", "Nile", "Mississippi", "Thames"], correct: 1 },
  ];
  
  const initMemoryGame = () => {
    const emojis = ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5).map((emoji, index) => ({ id: index, emoji, flipped: false, matched: false }));
    setMemoryCards(cards); setFlippedCards([]); setMoves(0);
  };
  
  const handleCardClick = (id: number) => {
    if (flippedCards.length === 2 || memoryCards[id].flipped || memoryCards[id].matched) return;
    const newCards = [...memoryCards]; newCards[id].flipped = true; setMemoryCards(newCards);
    const newFlipped = [...flippedCards, id]; setFlippedCards(newFlipped);
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (newCards[first].emoji === newCards[second].emoji) { newCards[first].matched = true; newCards[second].matched = true; setMemoryCards(newCards); setFlippedCards([]); }
      else { setTimeout(() => { newCards[first].flipped = false; newCards[second].flipped = false; setMemoryCards([...newCards]); setFlippedCards([]); }, 1000); }
    }
  };
  
  const handleTriviaAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    if (answerIndex === triviaQuestions[triviaQuestion].correct) setTriviaScore(s => s + 1);
    setTimeout(() => { if (triviaQuestion < triviaQuestions.length - 1) { setTriviaQuestion(q => q + 1); setSelectedAnswer(null); } }, 1500);
  };

  return (
    <motion.div key="games" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🧩 Games</h1>
        <HelpButton />
      </div>
      {!selectedGame ? (
        <>
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-2xl">🎮</div>
            <p className="text-lg text-orange-800">Ready for some fun, {residentName}? Games keep the mind sharp!</p>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-6 mb-6" style={{ zIndex: 10 }}>
            {games.map((game) => (
              <motion.button key={game.id} onClick={() => { setSelectedGame(game.id); if (game.id === 'memory') initMemoryGame(); }} className={`bg-gradient-to-br ${game.color} rounded-2xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 ${game.border}`} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
                <span className="text-6xl">{game.icon}</span>
                <span className="text-2xl font-bold text-gray-800">{game.name}</span>
                <span className="text-gray-600">{game.desc}</span>
              </motion.button>
            ))}
          </div>
        </>
      ) : selectedGame === 'memory' ? (
        <>
          <motion.button onClick={() => setSelectedGame(null)} className="mb-4 flex items-center gap-2 text-teal-600 text-xl" whileHover={{ x: -5 }}>← Back to Games</motion.button>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-pink-700">🧠 Memory Match</h2>
            <div className="flex gap-4"><span className="bg-pink-100 px-4 py-2 rounded-full text-pink-700 font-bold">Moves: {moves}</span><motion.button onClick={initMemoryGame} className="bg-pink-500 text-white px-4 py-2 rounded-full font-bold" whileTap={{ scale: 0.95 }}>New Game</motion.button></div>
          </div>
          <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            {memoryCards.map((card) => (
              <motion.button key={card.id} onClick={() => handleCardClick(card.id)} className={`aspect-square rounded-2xl text-5xl flex items-center justify-center shadow-lg ${card.flipped || card.matched ? 'bg-white' : 'bg-gradient-to-br from-pink-400 to-pink-600'}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{card.flipped || card.matched ? card.emoji : '❓'}</motion.button>
            ))}
          </div>
          {memoryCards.length > 0 && memoryCards.every(c => c.matched) && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-6 text-center"><p className="text-3xl font-bold text-green-600">🎉 Wonderful! You did it in {moves} moves!</p></motion.div>)}
        </>
      ) : selectedGame === 'trivia' ? (
        <>
          <motion.button onClick={() => { setSelectedGame(null); setTriviaQuestion(0); setTriviaScore(0); setSelectedAnswer(null); }} className="mb-4 flex items-center gap-2 text-teal-600 text-xl" whileHover={{ x: -5 }}>← Back to Games</motion.button>
          <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-blue-700">❓ Trivia Quiz</h2><span className="bg-blue-100 px-4 py-2 rounded-full text-blue-700 font-bold">Score: {triviaScore}/{triviaQuestions.length}</span></div>
          {triviaQuestion < triviaQuestions.length ? (
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-blue-200">
              <p className="text-sm text-blue-500 mb-2">Question {triviaQuestion + 1} of {triviaQuestions.length}</p>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">{triviaQuestions[triviaQuestion].q}</h3>
              <div className="grid grid-cols-2 gap-4">
                {triviaQuestions[triviaQuestion].options.map((option, index) => (
                  <motion.button key={index} onClick={() => selectedAnswer === null && handleTriviaAnswer(index)} className={`p-6 rounded-xl text-xl font-medium ${selectedAnswer === null ? 'bg-blue-50 hover:bg-blue-100 text-gray-800' : index === triviaQuestions[triviaQuestion].correct ? 'bg-green-500 text-white' : selectedAnswer === index ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`} whileHover={selectedAnswer === null ? { scale: 1.02 } : {}} whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}>{option}</motion.button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-8 shadow-lg border-2 border-blue-200 text-center">
              <p className="text-6xl mb-4">🏆</p><p className="text-3xl font-bold text-blue-700">Quiz Complete!</p><p className="text-2xl text-gray-600 mt-2">You scored {triviaScore} out of {triviaQuestions.length}</p>
              <motion.button onClick={() => { setTriviaQuestion(0); setTriviaScore(0); setSelectedAnswer(null); }} className="mt-6 bg-blue-500 text-white px-8 py-3 rounded-full text-xl font-bold" whileTap={{ scale: 0.95 }}>Play Again</motion.button>
            </motion.div>
          )}
        </>
      ) : null}
      <BottomBar onBack={() => onNavigate('activities')} onHome={() => onNavigate('home')} />
    </motion.div>
  );
};

// ============ EXERCISES SCREEN ============
const ExercisesScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string }> = ({ onNavigate, residentName = "Friend" }) => {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  const exercises = [
    { id: 'chair', name: "Chair Exercises", icon: "🪑", color: "from-blue-100 to-blue-200", border: "border-blue-300", duration: "10 min" },
    { id: 'stretches', name: "Gentle Stretches", icon: "🧘", color: "from-green-100 to-green-200", border: "border-green-300", duration: "8 min" },
    { id: 'breathing', name: "Breathing", icon: "🌬️", color: "from-purple-100 to-purple-200", border: "border-purple-300", duration: "5 min" },
    { id: 'hands', name: "Hand Exercises", icon: "✋", color: "from-orange-100 to-orange-200", border: "border-orange-300", duration: "5 min" },
  ];
  
  const exerciseSteps: Record<string, {title: string, instruction: string}[]> = {
    chair: [
      { title: "Seated March", instruction: "Sit tall. Lift one knee, then the other, like marching in place." },
      { title: "Ankle Circles", instruction: "Lift one foot slightly. Rotate your ankle in circles, 5 times each direction." },
      { title: "Arm Raises", instruction: "Raise both arms slowly overhead, then lower them. Keep breathing steadily." },
      { title: "Shoulder Rolls", instruction: "Roll your shoulders forward 5 times, then backward 5 times." },
    ],
    stretches: [
      { title: "Neck Stretch", instruction: "Slowly tilt your head to the right, hold 10 seconds. Repeat left." },
      { title: "Shoulder Stretch", instruction: "Bring one arm across your chest. Gently press it closer with your other hand." },
      { title: "Wrist Circles", instruction: "Extend your arms and rotate your wrists slowly in both directions." },
    ],
    breathing: [
      { title: "Deep Breath In", instruction: "Breathe in slowly through your nose for 4 counts." },
      { title: "Hold", instruction: "Hold your breath gently for 4 counts. Stay relaxed." },
      { title: "Slow Release", instruction: "Breathe out slowly through your mouth for 6 counts." },
    ],
    hands: [
      { title: "Finger Spread", instruction: "Spread your fingers wide apart, then make a fist. Repeat 10 times." },
      { title: "Thumb Touches", instruction: "Touch your thumb to each fingertip, one at a time." },
      { title: "Hand Squeeze", instruction: "Squeeze an imaginary ball, hold 3 seconds, release." },
    ],
  };
  
  const currentSteps = selectedExercise ? exerciseSteps[selectedExercise] || [] : [];

  return (
    <motion.div key="exercises" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🧘 Exercises</h1>
        <HelpButton />
      </div>
      {!selectedExercise ? (
        <>
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-2xl">💪</div>
            <p className="text-lg text-green-800">A little movement goes a long way, {residentName}!</p>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-6 mb-6" style={{ zIndex: 10 }}>
            {exercises.map((exercise) => (
              <motion.button key={exercise.id} onClick={() => { setSelectedExercise(exercise.id); setCurrentStep(0); }} className={`bg-gradient-to-br ${exercise.color} rounded-2xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 ${exercise.border}`} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
                <span className="text-6xl">{exercise.icon}</span>
                <span className="text-2xl font-bold text-gray-800">{exercise.name}</span>
                <span className="bg-white/60 px-4 py-1 rounded-full text-gray-600">{exercise.duration}</span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <motion.button onClick={() => { setSelectedExercise(null); setCurrentStep(0); }} className="mb-4 flex items-center gap-2 text-teal-600 text-xl" whileHover={{ x: -5 }}>← Back to Exercises</motion.button>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-green-700">{exercises.find(e => e.id === selectedExercise)?.icon} {exercises.find(e => e.id === selectedExercise)?.name}</h2>
            <span className="bg-green-100 px-4 py-2 rounded-full text-green-700 font-bold">Step {currentStep + 1} of {currentSteps.length}</span>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-8 shadow-lg border-2 border-green-200 flex flex-col items-center justify-center text-center">
            <motion.div key={currentStep} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl">
              <p className="text-4xl mb-6">{exercises.find(e => e.id === selectedExercise)?.icon}</p>
              <h3 className="text-3xl font-bold text-gray-800 mb-4">{currentSteps[currentStep]?.title}</h3>
              <p className="text-xl text-gray-600 leading-relaxed">{currentSteps[currentStep]?.instruction}</p>
            </motion.div>
          </div>
          <div className="flex justify-between items-center mt-6">
            <motion.button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className={`px-8 py-4 rounded-full text-xl font-bold ${currentStep === 0 ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-gray-700'}`} whileTap={currentStep > 0 ? { scale: 0.95 } : {}}>← Previous</motion.button>
            <div className="flex gap-2">{currentSteps.map((_, index) => (<div key={index} className={`w-3 h-3 rounded-full ${index === currentStep ? 'bg-green-500' : index < currentStep ? 'bg-green-300' : 'bg-gray-300'}`} />))}</div>
            {currentStep < currentSteps.length - 1 ? (
              <motion.button onClick={() => setCurrentStep(currentStep + 1)} className="px-8 py-4 rounded-full text-xl font-bold bg-green-500 text-white" whileTap={{ scale: 0.95 }}>Next →</motion.button>
            ) : (
              <motion.button onClick={() => { setSelectedExercise(null); setCurrentStep(0); }} className="px-8 py-4 rounded-full text-xl font-bold bg-teal-500 text-white" whileTap={{ scale: 0.95 }}>✓ Done!</motion.button>
            )}
          </div>
        </>
      )}
      <BottomBar onBack={() => onNavigate('activities')} onHome={() => onNavigate('home')} />
    </motion.div>
  );
};


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

// VOICE SCREEN
const VoiceScreen: React.FC<{ onNavigate: (screen: Screen) => void; residentName?: string; residentId?: string }> = ({ onNavigate, residentName = "Friend", residentId = "guest" }) => {
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
    if (!SpeechRecognition) {
      setStatus("Speech not supported. Try Chrome.");
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setStatus("Warda is responding...");
      setIsListening(false);
      try {
        const res = await fetch("http://13.40.187.182:3001/api/voice/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: residentId, message: text, context: { residentName } })
        });
        const data = await res.json();
        if (data.success && data.audio) {
          setStatus("Warda is speaking...");
          playAudio(data.audio);
        }
      } catch (err) { setStatus("Connection error. Tap to try again."); }
    };
    recognition.onerror = (e: any) => { console.log("Speech error:", e.error); setStatus("Error: " + e.error + ". Check microphone permission."); setIsListening(false); };
    recognition.start();
  };
  return (
    <motion.div key="voice" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: "Georgia, serif" }}>🎤 Talk to Warda</h1>
        <HelpButton />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8" style={{ zIndex: 10 }}>
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 text-center shadow-xl border-2 border-white/50">
          <p className="text-2xl text-gray-700 mb-4">{status}</p>
          {transcript && <p className="text-lg text-gray-500 italic">You said: "{transcript}"</p>}
        </div>
        <motion.button onClick={handleMicClick} disabled={isListening || isPlaying}
          className="w-40 h-40 rounded-full flex items-center justify-center text-7xl shadow-2xl"
          style={{ background: isListening ? "linear-gradient(135deg, #F87171 0%, #EF4444 100%)" : isPlaying ? "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)" : "linear-gradient(135deg, #5EEAD4 0%, #14B8A6 100%)" }}
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
const FaithScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => (
  <motion.div key="faith" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
    className="min-h-screen flex flex-col p-6 relative" style={{ zIndex: 5 }}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-teal-700" style={{ fontFamily: 'Georgia, serif' }}>🙏 My Faith</h1>
      <HelpButton />
    </div>
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-6" style={{ zIndex: 10 }}>
      <p className="text-lg text-amber-800 text-center">Find comfort, peace, and inspiration</p>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-6 mb-6" style={{ zIndex: 10 }}>
      <motion.button className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-blue-200"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">✝️</span>
        <span className="text-2xl font-bold text-blue-800">Christian</span>
        <span className="text-blue-600 text-center">Bible, Hymns, Prayers</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-green-50 to-green-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-green-200"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">☪️</span>
        <span className="text-2xl font-bold text-green-800">Muslim</span>
        <span className="text-green-600 text-center">Quran, Duas, Nasheeds</span>
      </motion.button>
      <motion.button className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg border-2 border-amber-200"
        whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
        <span className="text-6xl">✡️</span>
        <span className="text-2xl font-bold text-amber-800">Jewish</span>
        <span className="text-amber-600 text-center">Torah, Psalms, Prayers</span>
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

// ============ MAIN APP WITH AUTH ============
function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('setup');
  const [careHome, setCareHome] = useState<CareHome | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [activationCode, setActivationCode] = useState<string>('');
  
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check for existing activation on mount
  useEffect(() => {
    const savedCode = storage.getActivationCode();
    const savedCareHome = storage.getCareHome();
    const savedResident = storage.getResident();
    const savedToken = storage.getToken();
    
    if (savedCode && savedCareHome) {
      setActivationCode(savedCode);
      setCareHome(savedCareHome);
      
      if (savedResident && savedToken) {
        setResident(savedResident);
        setAuthScreen('authenticated');
      } else {
        setAuthScreen('login');
      }
    } else {
      setAuthScreen('setup');
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const handleDeviceActivated = (ch: CareHome) => {
    setCareHome(ch);
    setActivationCode(storage.getActivationCode() || '');
    setAuthScreen('login');
  };

  const handleLogin = (res: Resident, requirePinChange: boolean, token: string) => {
    setResident(res);
    if (requirePinChange) {
      setAuthScreen('change-pin');
    } else {
      setAuthScreen('authenticated');
    }
  };

  const handleDeviceInvalid = () => {
    storage.clearAll();
    setAuthScreen('setup');
    setCareHome(null);
    setActivationCode('');
    setResident(null);
  };

  const handlePinChanged = () => {
    setAuthScreen('authenticated');
  };

  const handleLogout = () => {
    storage.clearResident();
    localStorage.removeItem('warda_token');
    setResident(null);
    setAuthScreen('login');
    setCurrentScreen('home');
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
    if (screen !== 'contact') setSelectedContact(null);
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentScreen('contact');
  };

  // Generate bubbles
  const mainBubbles = Array.from({ length: 10 }, (_, i) => ({
    id: `main-${i}`, delay: (i % 12) * 1.2 + Math.random() * 3,
    originX: (i % 12) * (100 / 12) + Math.random() * (100 / 12 / 2),
    size: 15 + Math.random() * 35, duration: 11 + Math.random() * 5,
  }));
  const tinyBubbles = Array.from({ length: 10 }, (_, i) => ({
    id: `tiny-${i}`, delay: i * 0.6 + Math.random() * 2, originX: Math.random() * 100, duration: 13 + Math.random() * 5,
  }));
  const lightRays = [
    { left: 5, width: 100, opacity: 0.06, delay: 0 }, { left: 20, width: 80, opacity: 0.05, delay: 1 },
    { left: 38, width: 120, opacity: 0.07, delay: 2 }, { left: 55, width: 90, opacity: 0.05, delay: 1.5 },
    { left: 72, width: 110, opacity: 0.06, delay: 0.5 }, { left: 88, width: 85, opacity: 0.05, delay: 2.5 },
  ];

  // Auth screens
  if (authScreen === 'setup') {
    return <DeviceSetupScreen onActivated={handleDeviceActivated} />;
  }

  if (authScreen === 'login' && careHome && activationCode) {
    return (
      <PinLoginScreen 
        careHome={careHome} 
        activationCode={activationCode}
        onLogin={handleLogin}
        onDeviceInvalid={handleDeviceInvalid}
      />
    );
  }

  if (authScreen === 'change-pin' && resident) {
    return <ChangePinScreen resident={resident} onPinChanged={handlePinChanged} />;
  }

  // Main app (authenticated)
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FDF8F3 0%, #F9F5EF 30%, #F4EFE8 60%, #EBE6DE 100%)' }}>
      {lightRays.map((ray, i) => <LightRay key={i} {...ray} />)}
      {mainBubbles.map((b) => <AquariumBubble key={b.id} {...b} />)}
      {tinyBubbles.map((b) => <TinyBubble key={b.id} {...b} />)}

      {/* Logout button */}
      <motion.button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-white/80 backdrop-blur-md text-gray-600 px-4 py-2 rounded-xl text-sm font-medium shadow-lg z-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}>
        🚪 Sign Out
      </motion.button>

      {/* Welcome message with resident name */}
      {resident && currentScreen === 'home' && (
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg z-50">
          <span className="text-teal-700 font-medium">
            👋 Hello, {resident.preferredName || resident.firstName}!
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} time={timeString} residentName={resident?.preferredName || resident?.firstName || 'Friend'} />}
        {currentScreen === 'talk' && <TalkScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} residentId={resident?.id || 'guest'} />}
        {currentScreen === 'voice' && <VoiceScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} residentId={resident?.id || 'guest'} />}
        {currentScreen === 'family' && <FamilyScreen onNavigate={handleNavigate} onSelectContact={handleSelectContact} />}
        {currentScreen === 'contact' && selectedContact && <ContactScreen contact={selectedContact} onNavigate={handleNavigate} />}
        {currentScreen === 'activities' && <ActivitiesScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} />}
        {currentScreen === 'health' && <HealthScreen onNavigate={handleNavigate} />}
        {currentScreen === 'faith' && <FaithScreen onNavigate={handleNavigate} />}
        {currentScreen === 'myday' && <MyDayScreen onNavigate={handleNavigate} />}
        {currentScreen === 'browse' && <BrowseScreen onNavigate={handleNavigate} />}
        {currentScreen === 'music' && <MusicScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} />}
        {currentScreen === 'games' && <GamesScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} />}
        {currentScreen === 'exercises' && <ExercisesScreen onNavigate={handleNavigate} residentName={resident?.preferredName || resident?.firstName || 'Friend'} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
