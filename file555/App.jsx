import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// 🌹 WARDA TABLET — Premium Design + Full API Wiring
// Claude AI, Polly Voice, Speech Recognition, Family Messages
// ═══════════════════════════════════════════════════════════════

const API_BASE = "https://api.meetwarda.com";
const TABLET_CONFIG = { residentId: "0bc59f43-44d4-4e50-bbd5-dafcad6f3bba" };

const LANGUAGES = {
  English: { hello: "Hello", howAreYou: "How are you today?", talkTo: "Talk to Warda", typeToWarda: "Type to Warda", family: "Family", music: "Music", photos: "Photos", faith: "Spiritual", myDay: "My Day", sendLove: "Send Love", help: "I Need Help", postOffice: "Your Post Office", postOfficeEmpty: "No post today \u2014 but your family is thinking of you", dir: "ltr" },
  Arabic: { hello: "\u0645\u0631\u062d\u0628\u0627", howAreYou: "\u0643\u064a\u0641 \u062d\u0627\u0644\u0643 \u0627\u0644\u064a\u0648\u0645\u061f", talkTo: "\u062a\u062d\u062f\u062b \u0625\u0644\u0649 \u0648\u0631\u062f\u0629", typeToWarda: "\u0627\u0643\u062a\u0628 \u0644\u0648\u0631\u062f\u0629", family: "\u0627\u0644\u0639\u0627\u0626\u0644\u0629", music: "\u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649", photos: "\u0627\u0644\u0635\u0648\u0631", faith: "\u0625\u064a\u0645\u0627\u0646\u064a", myDay: "\u064a\u0648\u0645\u064a", sendLove: "\u0623\u0631\u0633\u0644 \u062d\u0628\u0627\u064b", help: "\u0623\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629", postOffice: "\u0628\u0631\u064a\u062f\u0643", postOfficeEmpty: "\u0644\u0627 \u0628\u0631\u064a\u062f \u0627\u0644\u064a\u0648\u0645", dir: "rtl" },
  French: { hello: "Bonjour", howAreYou: "Comment allez-vous?", talkTo: "Parler \u00e0 Warda", typeToWarda: "\u00c9crire \u00e0 Warda", family: "Famille", music: "Musique", photos: "Photos", faith: "Ma Foi", myDay: "Ma Journ\u00e9e", sendLove: "Envoyer Amour", help: "J'ai besoin d'aide", postOffice: "Votre Courrier", postOfficeEmpty: "Pas de courrier", dir: "ltr" },
  Spanish: { hello: "Hola", howAreYou: "\u00bfC\u00f3mo est\u00e1s hoy?", talkTo: "Hablar con Warda", typeToWarda: "Escribir a Warda", family: "Familia", music: "M\u00fasica", photos: "Fotos", faith: "Mi Fe", myDay: "Mi D\u00eda", sendLove: "Enviar Amor", help: "Necesito ayuda", postOffice: "Tu Correo", postOfficeEmpty: "Sin correo hoy", dir: "ltr" },
  Urdu: { hello: "\u0633\u0644\u0627\u0645", howAreYou: "\u0622\u062c \u0622\u067e \u06a9\u06cc\u0633\u06d2 \u06c1\u06cc\u06ba\u061f", talkTo: "\u0648\u0631\u062f\u06c1 \u0633\u06d2 \u0628\u0627\u062a \u06a9\u0631\u06cc\u06ba", typeToWarda: "\u0648\u0631\u062f\u06c1 \u06a9\u0648 \u0644\u06a9\u06be\u06cc\u06ba", family: "\u062e\u0627\u0646\u062f\u0627\u0646", music: "\u0645\u0648\u0633\u06cc\u0642\u06cc", photos: "\u062a\u0635\u0627\u0648\u06cc\u0631", faith: "\u0645\u06cc\u0631\u0627 \u0627\u06cc\u0645\u0627\u0646", myDay: "\u0645\u06cc\u0631\u0627 \u062f\u0646", sendLove: "\u0645\u062d\u0628\u062a \u0628\u06be\u06cc\u062c\u06cc\u06ba", help: "\u0645\u062c\u06be\u06d2 \u0645\u062f\u062f \u0686\u0627\u06c1\u06cc\u06d2", postOffice: "\u0622\u067e \u06a9\u0627 \u0688\u0627\u06a9 \u062e\u0627\u0646\u06c1", postOfficeEmpty: "\u0622\u062c \u06a9\u0648\u0626\u06cc \u0688\u0627\u06a9 \u0646\u06c1\u06cc\u06ba", dir: "rtl" },
  Hindi: { hello: "\u0928\u092e\u0938\u094d\u0924\u0947", howAreYou: "\u0906\u091c \u0906\u092a \u0915\u0948\u0938\u0947 \u0939\u0948\u0902?", talkTo: "\u0935\u0930\u094d\u0926\u0927 \u0938\u0947 \u092c\u0927\u0924 \u0915\u0930\u0947\u0902", typeToWarda: "\u0935\u0930\u094d\u0926\u0927 \u0915\u094b \u0932\u093f\u0916\u0947\u0902", family: "\u092a\u0930\u093f\u0935\u093e\u0930", music: "\u0938\u0902\u0917\u0940\u0924", photos: "\u0924\u0938\u094d\u0935\u0940\u0930\u0947\u0902", faith: "\u092e\u0947\u0930\u093e \u0935\u093f\u0936\u094d\u0935\u093e\u0938", myDay: "\u092e\u0947\u0930\u093e \u0926\u093f\u0928", sendLove: "\u092a\u094d\u092f\u093e\u0930 \u092d\u0947\u091c\u0947\u0902", help: "\u092e\u0941\u091d\u0947 \u092e\u0926\u0926 \u091a\u093e\u0939\u093f\u090f", postOffice: "\u0906\u092a\u0915\u093e \u0921\u093e\u0915\u0918\u0930", postOfficeEmpty: "\u0906\u091c \u0915\u094b\u0908 \u0921\u093e\u0915 \u0928\u0939\u0940\u0902", dir: "ltr" },
  Welsh: { hello: "Bore da", howAreYou: "Sut ydych chi heddiw?", talkTo: "Siarad \u00e2 Warda", typeToWarda: "Teipio i Warda", family: "Teulu", music: "Cerddoriaeth", photos: "Lluniau", faith: "Fy Ffydd", myDay: "Fy Niwrnod", sendLove: "Anfon Cariad", help: "Angen cymorth", postOffice: "Eich Swyddfa Bost", postOfficeEmpty: "Dim post heddiw", dir: "ltr" },
  "Scottish Gaelic": { hello: "Madainn mhath", howAreYou: "Ciamar a tha thu?", talkTo: "Bruidhinn ri Warda", typeToWarda: "Sgr\u00ecobh gu Warda", family: "Teaghlach", music: "Ce\u00f2l", photos: "Dealbhan", faith: "Mo Chreideamh", myDay: "Mo Latha", sendLove: "Cuir Gaol", help: "Tha mi feumach air cuideachadh", postOffice: "Oifis a' Phuist Agad", postOfficeEmpty: "Gun phost an-diugh", dir: "ltr" },
};

const P = {
  bg:"#FAF8F5",bgDeep:"#F0ECE6",surface:"#FFFFFF",glass:"rgba(255,255,255,0.72)",glassBorder:"rgba(255,255,255,0.35)",
  teal:"#2D9B83",tealDeep:"#1E7A66",tealSoft:"#E8F5F1",tealGlow:"rgba(45,155,131,0.15)",
  gold:"#C4A265",goldSoft:"#FBF6ED",text:"#1A1814",textSoft:"#5C564E",textMuted:"#9B948C",
  rose:"#C75B7A",roseSoft:"#FDF2F5",blue:"#4A7FB5",blueSoft:"#EFF5FB",
  purple:"#7B6BAA",purpleSoft:"#F3F0FA",amber:"#D4943A",amberSoft:"#FDF8EE",
  red:"#D45B5B",redSoft:"#FEF2F2",
  shadow:"0 8px 40px rgba(26,24,20,0.06)",shadowLg:"0 16px 64px rgba(26,24,20,0.1)",shadowGlow:"0 0 40px rgba(45,155,131,0.2)",
};
const fonts = { display:"'Fraunces', Georgia, serif", body:"'DM Sans', -apple-system, sans-serif" };

function useWardaVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const speakPolly = useCallback(async (b64, onEnd) => {
    try {
      const bytes = atob(b64); const ab = new ArrayBuffer(bytes.length); const v = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i++) v[i] = bytes.charCodeAt(i);
      const audio = new Audio(URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" })));
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); onEnd?.(); };
      audio.onerror = () => { setIsSpeaking(false); onEnd?.(); };
      await audio.play();
    } catch { setIsSpeaking(false); onEnd?.(); }
  }, []);
  const speakBrowser = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; u.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => v.lang.includes("en-GB") && v.name.toLowerCase().includes("female")) || voices.find(v => v.lang.includes("en-GB")) || voices[0];
    if (pref) u.voice = pref;
    u.onstart = () => setIsSpeaking(true); u.onend = () => { setIsSpeaking(false); onEnd?.(); }; u.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    window.speechSynthesis.speak(u);
  }, []);
  const speak = useCallback(async (text, b64, onEnd) => { if (b64) await speakPolly(b64, onEnd); else speakBrowser(text, onEnd); }, [speakPolly, speakBrowser]);
  const stop = useCallback(() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } window.speechSynthesis?.cancel(); setIsSpeaking(false); }, []);
  return { speak, stop, isSpeaking };
}

function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const ref = useRef(null);
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const r = new SR(); r.lang = "en-GB"; r.continuous = false; r.interimResults = true;
    r.onstart = () => setIsListening(true);
    r.onresult = (e) => setTranscript(Array.from(e.results).map(x => x[0].transcript).join(""));
    r.onend = () => setIsListening(false); r.onerror = () => setIsListening(false);
    ref.current = r; r.start();
  }, []);
  const stopListening = useCallback(() => { ref.current?.stop(); setIsListening(false); }, []);
  return { startListening, stopListening, isListening, transcript, setTranscript };
}

function useTimeGreeting(name) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 30000); return () => clearInterval(i); }, []);
  const h = time.getHours();
  const timeStr = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isNightAuto = h >= 22 || h < 6;
  return { time, timeStr, dateStr, isNightAuto };
}

function getLocalResponse(text, name) {
  const l = text.toLowerCase();
  if (l.includes("hello") || l.includes("hi")) return "Hello, " + name + "! It's lovely to hear from you.";
  if (l.includes("music")) return "Shall I put on some music for you, " + name + "?";
  if (l.includes("family") || l.includes("sarah")) return "Your family is always thinking of you, " + name + ".";
  if (l.includes("prayer") || l.includes("bible") || l.includes("quran")) return "Of course, dear. Let me help you with that.";
  if (l.includes("tired") || l.includes("sleep")) return "You rest whenever you need to, " + name + ". I'll be right here.";
  if (l.includes("sad") || l.includes("lonely")) return "I'm sorry you're feeling that way, " + name + ". I'm right here with you.";
  if (l.includes("help")) return "I'm here to help, " + name + ". I'm letting the staff know right away.";
  return "I'm here for you, " + name + ". What would you like to do?";
}

// Animated rose SVG component
const WardaRose = ({ size = 120, glow = false, speaking = false }) => (
  <div style={{ position: "relative", width: size, height: size }}>
    {glow && <div style={{ position: "absolute", inset: -20, borderRadius: "50%", background: `radial-gradient(circle, ${P.tealGlow}, transparent 70%)`, animation: "pulse 3s ease-in-out infinite" }} />}
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ filter: "drop-shadow(0 4px 12px rgba(45,155,131,0.25))", animation: speaking ? "breathe 1.5s ease-in-out infinite" : "none" }}>
      <defs>
        <radialGradient id="roseGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#3DB89A" />
          <stop offset="100%" stopColor="#1E7A66" />
        </radialGradient>
        <filter id="softGlow"><feGaussianBlur stdDeviation="1.5" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#roseGrad)" filter="url(#softGlow)" />
      <text x="50" y="56" textAnchor="middle" fontSize="38" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>🌹</text>
    </svg>
  </div>
);

// Feature card component
const FeatureCard = ({ icon, label, color, colorSoft, onClick, delay = 0, badge = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "18px 12px", borderRadius: 22, cursor: "pointer",
      background: colorSoft, border: `1.5px solid ${color}22`,
      minWidth: 88, position: "relative",
      transform: visible ? "translateY(0)" : "translateY(20px)",
      opacity: visible ? 1 : 0,
      transition: `all 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
      boxShadow: `0 2px 12px ${color}15`,
    }}>
      {badge > 0 && <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, background: P.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(212,91,91,0.4)" }}>{badge}</div>}
      <div style={{ fontSize: 34, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color, fontFamily: fonts.body, letterSpacing: 0.3, textAlign: "center" }}>{label}</div>
    </div>
  );
};

// Action button (Talk / Type)
const ActionButton = ({ icon, label, variant = "primary", onClick, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const isPrimary = variant === "primary";
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "18px 28px",
      borderRadius: 22, cursor: "pointer", flex: 1,
      background: isPrimary ? `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})` : P.surface,
      border: isPrimary ? "none" : `2px solid ${P.teal}33`,
      boxShadow: isPrimary ? `0 8px 32px ${P.teal}40, inset 0 1px 0 rgba(255,255,255,0.2)` : P.shadow,
      transform: visible ? "translateY(0) scale(1)" : "translateY(15px) scale(0.95)",
      opacity: visible ? 1 : 0,
      transition: `all 0.7s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: isPrimary ? "rgba(255,255,255,0.2)" : P.tealSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
      }}>{icon}</div>
      <div style={{
        fontSize: 17, fontWeight: 700, fontFamily: fonts.body,
        color: isPrimary ? "#fff" : P.teal,
        letterSpacing: 0.3,
      }}>{label}</div>
    </div>
  );
};

// Conversation bubble
const ChatBubble = ({ text, isWarda, dir = "ltr" }) => (
  <div style={{
    display: "flex", justifyContent: isWarda ? "flex-start" : "flex-end",
    padding: "4px 0", direction: dir,
  }}>
    <div style={{
      maxWidth: "78%", padding: "16px 22px", borderRadius: isWarda ? "22px 22px 22px 6px" : "22px 22px 6px 22px",
      background: isWarda ? P.surface : `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})`,
      color: isWarda ? P.text : "#fff",
      fontSize: 17, lineHeight: 1.55, fontFamily: fonts.body,
      boxShadow: isWarda ? P.shadow : `0 4px 20px ${P.teal}30`,
      border: isWarda ? `1px solid rgba(0,0,0,0.04)` : "none",
      direction: dir, textAlign: dir === "rtl" ? "right" : "left",
    }}>
      {isWarda && <div style={{ fontSize: 11, fontWeight: 700, color: P.teal, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>Warda 🌹</div>}
      {text}
    </div>
  </div>
);

// Language selector pill
const LanguagePill = ({ lang, isActive, onClick, nativeName }) => (
  <div onClick={onClick} style={{
    padding: "8px 18px", borderRadius: 20, cursor: "pointer",
    background: isActive ? P.teal : "transparent",
    color: isActive ? "#fff" : P.textSoft,
    fontSize: 13, fontWeight: isActive ? 700 : 500,
    border: isActive ? "none" : `1.5px solid ${P.textMuted}33`,
    transition: "all 0.3s ease",
    whiteSpace: "nowrap",
  }}>{nativeName || lang}</div>
);

const ThinkingDots = () => (
  <div style={{display:"flex",justifyContent:"flex-start",padding:"4px 0"}}>
    <div style={{background:P.surface,padding:"16px 22px",borderRadius:"22px 22px 22px 6px",boxShadow:P.shadow,display:"flex",gap:6,alignItems:"center"}}>
      <div style={{fontSize:11,fontWeight:700,color:P.teal,marginRight:8,letterSpacing:0.5,textTransform:"uppercase"}}>Warda \u{1f339}</div>
      {[0,0.15,0.3].map((d,i) => <div key={i} style={{width:8,height:8,borderRadius:4,background:P.teal,animation:"bounce 1s ease-in-out infinite "+d+"s"}}/>)}
    </div>
  </div>
);

const nativeNames = { English: "English", Arabic: "العربية", French: "Français", Spanish: "Español", Urdu: "اردو", Hindi: "हिन्दी", Welsh: "Cymraeg", "Scottish Gaelic": "Gàidhlig" };

// Main App

export default function WardaApp() {
  const [screen, setScreen] = useState("home");
  const [lang, setLang] = useState("English");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isNight, setIsNight] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resident, setResident] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const chatEndRef = useRef(null);

  const { speak, stop: stopSpeaking, isSpeaking } = useWardaVoice();
  const { startListening, stopListening, isListening, transcript, setTranscript } = useVoiceInput();
  const { timeStr, dateStr, isNightAuto } = useTimeGreeting("Friend");

  const t = LANGUAGES[lang] || LANGUAGES.English;
  const dir = t.dir;
  const residentName = resident?.preferredName || resident?.firstName || "Friend";
  const nightBg = "linear-gradient(180deg, #1A1D2E 0%, #0D0F1A 100%)";

  useEffect(() => { if (isNightAuto) setIsNight(true); }, [isNightAuto]);
  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ═══ 1. LOAD RESIDENT ═══
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_BASE + "/api/admin/residents/" + TABLET_CONFIG.residentId);
        if (res.ok) { const d = await res.json(); const r = d.resident || d; setResident({ id: TABLET_CONFIG.residentId, firstName: r.firstName||"Friend", preferredName: r.preferredName||r.firstName||"Friend", isActive: r.isActive !== false }); }
        else setResident({ id: TABLET_CONFIG.residentId, firstName: "Friend", preferredName: "Friend", isActive: true });
      } catch { setResident({ id: TABLET_CONFIG.residentId, firstName: "Friend", preferredName: "Friend", isActive: true }); }
      setIsLoading(false);
    })();
  }, []);

  // ═══ 2. GREETING ON LOAD ═══
  useEffect(() => {
    if (!hasGreeted && resident && screen === "home") {
      const timer = setTimeout(async () => {
        let gt, ga;
        try {
          const r = await fetch(API_BASE + "/api/conversation/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resident.id, residentName }) });
          if (r.ok) { const d = await r.json(); gt = d.greeting; }
          if (gt) { const ar = await fetch(API_BASE + "/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: gt }) }); if (ar.ok) { const ad = await ar.json(); if (ad.success) ga = ad.audio; } }
        } catch {}
        if (gt) speak(gt, ga, () => {});
        setHasGreeted(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [hasGreeted, resident, residentName, speak, screen]);

  // ═══ 3. POST OFFICE ═══
  useEffect(() => {
    if (!resident) return;
    const f = async () => { try { const r = await fetch(API_BASE + "/api/family-comms/pending/" + resident.id); if (r.ok) { const d = await r.json(); if (d.success) setPendingMessages(d.messages || []); } } catch {} };
    f(); const i = setInterval(f, 30000); return () => clearInterval(i);
  }, [resident]);

  // ═══ 4. VOICE TRANSCRIPT ═══
  useEffect(() => { if (!isListening && transcript && transcript.trim().length > 0) { handleSendMessage(transcript.trim()); setTranscript(""); } }, [isListening]);

  // ═══ 5. SEND MESSAGE ═══
  const handleSendMessage = async (text) => {
    if (!text.trim() || isProcessing || !resident) return;
    setMessages(prev => [...prev, { id: Date.now(), text, isWarda: false }]);
    setInputText(""); setIsProcessing(true);
    let wt, wa;
    try {
      const r = await fetch(API_BASE + "/api/voice/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resident.id, message: text, context: { userId: resident.id } }) });
      if (r.ok) { const d = await r.json(); if (d.success) { wt = d.text; wa = d.audio; } }
    } catch {}
    if (!wt) { try { const r = await fetch(API_BASE + "/api/conversation/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resident.id, message: text }) }); if (r.ok) { const d = await r.json(); if (d.success && d.response) wt = d.response.text; } } catch {} }
    if (!wt) wt = getLocalResponse(text, residentName);
    setMessages(prev => [...prev, { id: Date.now() + 1, text: wt, isWarda: true }]);
    speak(wt, wa, () => {}); setIsProcessing(false);
  };

  // ═══ 6. HELP ═══
  const handleHelp = async () => {
    try { await fetch(API_BASE + "/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resident?.id, type: "HELP", severity: "high", message: residentName + " pressed the Help button" }) }); } catch {}
    speak("I'm getting help for you right now, dear. Don't worry.", null, () => {});
  };

  const startChat = async (mode) => {
    setScreen("chat"); setMessages([]);
    let gt, ga;
    try {
      const r = await fetch(API_BASE + "/api/conversation/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resident?.id, residentName }) });
      if (r.ok) { const d = await r.json(); gt = d.greeting; }
      if (gt) { const ar = await fetch(API_BASE + "/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: gt }) }); if (ar.ok) { const ad = await ar.json(); if (ad.success) ga = ad.audio; } }
    } catch {}
    if (!gt) gt = t.hello + ", " + residentName + "! " + t.howAreYou;
    setMessages([{ id: 1, text: gt, isWarda: true }]);
    speak(gt, ga, () => {});
    if (mode === "voice") setTimeout(() => startListening(), 1500);
  };

  const handleMicToggle = () => { if (isSpeaking) { stopSpeaking(); return; } if (isListening) { stopListening(); return; } startListening(); };
  const sendMsg = () => { if (inputText.trim()) handleSendMessage(inputText.trim()); };

  const features = [
    { id: "family", icon: "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}", label: t.family, color: P.blue, colorSoft: P.blueSoft, badge: pendingMessages.length },
    { id: "music", icon: "\u{1f3b5}", label: t.music, color: P.purple, colorSoft: P.purpleSoft },
    { id: "photos", icon: "\u{1f4f7}", label: t.photos, color: P.amber, colorSoft: P.amberSoft },
    { id: "faith", icon: "\u{1f64f}", label: t.faith, color: P.gold, colorSoft: P.goldSoft },
    { id: "myday", icon: "\u{1f4c5}", label: t.myDay, color: P.teal, colorSoft: P.tealSoft },
    { id: "sendlove", icon: "\u{1f48c}", label: t.sendLove, color: P.rose, colorSoft: P.roseSoft },
  ];


  // ═══ STYLES ═══
  const globalStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 1; } }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes breathe { 0%,100% { box-shadow: 0 0 30px rgba(45,155,131,0.15); } 50% { box-shadow: 0 0 50px rgba(45,155,131,0.35); } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes micPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45,155,131,0.4); } 50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(45,155,131,0); } }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-user-select: none; user-select: none; }
    input, textarea { -webkit-user-select: text; user-select: text; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
  `;

  // ═══ LOADING SCREEN ═══
  if (isLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(170deg, ${P.bg}, ${P.bgDeep})`, fontFamily: fonts.body }}>
        <style>{globalStyle}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ animation: "pulse 2s ease-in-out infinite" }}><WardaRose size={100} glow /></div>
          <p style={{ marginTop: 16, fontSize: 18, color: P.teal, fontFamily: fonts.display, fontStyle: "italic" }}>Warda is waking up...</p>
        </div>
      </div>
    );
  }

  // ═══ LOADING ═══
  if (isLoading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(170deg,"+P.bg+","+P.bgDeep+")",fontFamily:fonts.body}}>
      <style>{globalStyle}</style>
      <div style={{textAlign:"center"}}><div style={{animation:"pulse 2s ease-in-out infinite"}}><WardaRose size={100} glow/></div><p style={{marginTop:16,fontSize:18,color:P.teal,fontFamily:fonts.display,fontStyle:"italic"}}>Warda is waking up...</p></div>
    </div>
  );

  // ═══ HOME SCREEN ═══
  if (screen === "home") {
    const poText = pendingMessages.length > 0 ? pendingMessages.length + " message" + (pendingMessages.length > 1 ? "s" : "") + " from your family!" : t.postOfficeEmpty;
    return (
      <div style={{
        minHeight: "100vh",
        background: isNight ? nightBg : `linear-gradient(170deg, ${P.bg} 0%, ${P.bgDeep} 100%)`,
        fontFamily: fonts.body, direction: dir,
        overflow: "hidden", position: "relative",
      }}>
        <style>{globalStyle}</style>
        
        {/* Ambient background orbs */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${isNight ? "rgba(45,155,131,0.05)" : "rgba(45,155,131,0.08)"}, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${isNight ? "rgba(196,162,101,0.04)" : "rgba(196,162,101,0.06)"}, transparent 70%)`, pointerEvents: "none" }} />

        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: dir === "rtl" ? "flex-start" : "flex-start", padding: "20px 28px", position: "relative", zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 42, fontWeight: 300, fontFamily: fonts.display, color: isNight ? "#E8E0D8" : P.text, letterSpacing: -1, lineHeight: 1 }}>{timeStr}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: isNight ? "rgba(232,224,216,0.5)" : P.textSoft, marginTop: 4 }}>{dateStr}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 8, padding: "6px 14px", borderRadius: 16,
              background: isNight ? "rgba(255,255,255,0.06)" : P.glass,
              backdropFilter: "blur(12px)",
              border: `1px solid ${isNight ? "rgba(255,255,255,0.08)" : P.glassBorder}`,
              fontSize: 13, color: isNight ? "rgba(232,224,216,0.65)" : P.textSoft,
            }}>
              <span>☁️</span> <span style={{ fontWeight: 600 }}>12°C</span>
              <span style={{ opacity: 0.3 }}>·</span> <span>Partly Cloudy</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {/* Language + Night toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              <div onClick={() => setShowLangPicker(!showLangPicker)} style={{
                padding: "6px 14px", borderRadius: 16, cursor: "pointer",
                background: isNight ? "rgba(255,255,255,0.08)" : P.glass,
                backdropFilter: "blur(12px)",
                border: `1px solid ${isNight ? "rgba(255,255,255,0.1)" : P.glassBorder}`,
                fontSize: 12, fontWeight: 600, color: isNight ? "rgba(232,224,216,0.7)" : P.teal,
              }}>🌍 {nativeNames[lang]}</div>
              <div onClick={() => setIsNight(!isNight)} style={{
                width: 36, height: 36, borderRadius: 18, cursor: "pointer",
                background: isNight ? "rgba(255,255,255,0.08)" : P.glass,
                backdropFilter: "blur(12px)",
                border: `1px solid ${isNight ? "rgba(255,255,255,0.1)" : P.glassBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>{isNight ? "☀️" : "🌙"}</div>
            </div>
          </div>
        </div>

        {/* Language Picker Dropdown */}
        {showLangPicker && (
          <div style={{
            position: "absolute", top: 100, right: 28, zIndex: 100,
            background: P.surface, borderRadius: 20, padding: 16,
            boxShadow: P.shadowLg, border: `1px solid rgba(0,0,0,0.06)`,
            display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 400,
            animation: "fadeUp 0.3s ease",
          }}>
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700, color: P.textSoft, marginBottom: 4, paddingLeft: 4 }}>Choose Language</div>
            {Object.keys(LANGUAGES).map(l => (
              <LanguagePill key={l} lang={l} nativeName={nativeNames[l]} isActive={lang === l} onClick={() => { setLang(l); setShowLangPicker(false); }} />
            ))}
          </div>
        )}

        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, position: "relative", zIndex: 5 }}>
          
          {/* Warda Rose */}
          <div style={{ animation: "float 4s ease-in-out infinite", marginBottom: 6 }}>
            <WardaRose size={110} glow speaking={isSpeaking} />
          </div>

          {/* Greeting */}
          <h1 style={{
            fontSize: 32, fontFamily: fonts.display, fontWeight: 500, fontStyle: "italic",
            color: isNight ? "rgba(232,224,216,0.85)" : P.text,
            textAlign: "center", lineHeight: 1.3, margin: "0 0 4px",
            animation: "fadeUp 0.8s ease 0.2s both",
          }}>{t.hello}, {residentName}</h1>
          <p style={{
            fontSize: 18, color: isNight ? "rgba(232,224,216,0.45)" : P.textSoft,
            fontFamily: fonts.body, fontWeight: 500, animation: "fadeUp 0.8s ease 0.4s both",
          }}>{t.howAreYou}</p>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 16, padding: "0 28px", width: "100%", maxWidth: 600, marginTop: 24 }}>
            <ActionButton icon="🎤" label={t.talkTo} variant="primary" onClick={() => startChat("voice")} delay={300} />
            <ActionButton icon="⌨️" label={t.typeToWarda} variant="secondary" onClick={() => startChat("type")} delay={450} />
          </div>

          {/* Feature Cards */}
          <div style={{ display: "flex", gap: 10, padding: "0 28px", marginTop: 24, width: "100%", maxWidth: 700, justifyContent: "center" }}>
            {features.map((f, i) => (
              <FeatureCard key={f.id} {...f} onClick={() => setScreen("feature-" + f.id)} delay={600 + i * 100} />
            ))}
          </div>

          {/* Post Office Card */}
          <div style={{
            margin: "20px 28px 0", padding: "20px 24px", borderRadius: 22, maxWidth: 600, width: "calc(100% - 56px)",
            background: isNight ? "rgba(255,255,255,0.04)" : P.glass,
            backdropFilter: "blur(20px)",
            border: `1px solid ${isNight ? "rgba(255,255,255,0.06)" : P.glassBorder}`,
            display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
            animation: "fadeUp 0.8s ease 1.2s both",
            transition: "transform 0.3s ease",
          }} onClick={() => setScreen("feature-family")}>
            <div style={{ fontSize: 36 }}>📬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, color: isNight ? "#E8E0D8" : P.text }}>
                {t.postOffice}
              </div>
              <div style={{ fontSize: 13, color: pendingMessages.length > 0 ? P.teal : (isNight ? "rgba(232,224,216,0.45)" : P.textMuted), marginTop: 3, fontWeight: pendingMessages.length > 0 ? 600 : 400 }}>
                {poText}
              </div>
            </div>
            <div style={{ fontSize: 20, color: P.teal, opacity: 0.5 }}>→</div>
          </div>

          {/* Help Button */}
          <div onClick={handleHelp} style={{
            margin: "16px 28px 0", padding: "14px 24px", borderRadius: 18, maxWidth: 600, width: "calc(100% - 56px)",
            background: P.redSoft, border: `2px solid ${P.red}22`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            animation: "fadeUp 0.8s ease 1.4s both",
          }}>
            <span style={{ fontSize: 20 }}>🆘</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: P.red }}>{t.help}</span>
          </div>

          {/* Footer */}
          <div style={{
            padding: "20px 0 12px", textAlign: "center",
            fontSize: 11, color: isNight ? "rgba(232,224,216,0.2)" : P.textMuted,
            fontFamily: fonts.body,
          }}>
            © 2026 Eletiser Ltd · Meet Warda™ · You're Never Alone
          </div>
        </div>
      </div>
    );
  }

  // ═══ CHAT SCREEN ═══
  if (screen === "chat") {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        background: isNight ? nightBg : `linear-gradient(180deg, ${P.bg}, ${P.bgDeep})`,
        fontFamily: fonts.body, direction: dir,
      }}>
        <style>{globalStyle}</style>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: `1px solid rgba(0,0,0,0.04)`,
          background: isNight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.7)",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div onClick={() => { setScreen("home"); setMessages([]); stopSpeaking(); stopListening(); }} style={{
              width: 42, height: 42, borderRadius: 21, cursor: "pointer",
              background: isNight ? "rgba(255,255,255,0.06)" : P.bgDeep,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, transition: "background 0.2s",
            }}>{dir === "rtl" ? "→" : "←"}</div>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, boxShadow: P.shadowGlow, animation: "breathe 3s ease-in-out infinite",
            }}>🌹</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: fonts.display, color: isNight ? "#E8E0D8" : P.text }}>Warda</div>
              <div style={{ fontSize: 12, color: P.teal, fontWeight: 600 }}>
                {isSpeaking ? "♫ Speaking..." : isListening ? "● Listening..." : isProcessing ? "◌ Thinking..." : "● Online"}
              </div>
            </div>
          </div>
          <div onClick={() => setShowLangPicker(!showLangPicker)} style={{
            padding: "6px 14px", borderRadius: 16, cursor: "pointer",
            background: isNight ? "rgba(255,255,255,0.08)" : P.tealSoft,
            fontSize: 12, fontWeight: 600, color: P.teal,
          }}>🌍 {nativeNames[lang]}</div>
        </div>

        {/* Language Picker in Chat */}
        {showLangPicker && (
          <div style={{
            position: "absolute", top: 70, right: 24, zIndex: 100,
            background: P.surface, borderRadius: 20, padding: 16,
            boxShadow: P.shadowLg, display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 360,
            animation: "fadeUp 0.3s ease",
          }}>
            {Object.keys(LANGUAGES).map(l => (
              <LanguagePill key={l} lang={l} nativeName={nativeNames[l]} isActive={lang === l} onClick={() => { setLang(l); setShowLangPicker(false); }} />
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map(m => <ChatBubble key={m.id} text={m.text} isWarda={m.isWarda} dir={dir} />)}
          {isProcessing && <ThinkingDots />}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: "16px 24px 24px", borderTop: `1px solid rgba(0,0,0,0.04)`,
          background: isNight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
          backdropFilter: "blur(20px)", position: "relative",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Show live transcript */}
            {isListening && transcript && (
              <div style={{ position: "absolute", top: -40, left: 24, right: 24, textAlign: "center", fontSize: 15, color: P.teal, fontWeight: 600, fontStyle: "italic" }}>
                "{transcript}"
              </div>
            )}
            {/* Mic Button */}
            <div onClick={handleMicToggle} style={{
              width: 56, height: 56, borderRadius: 28, cursor: "pointer",
              background: isListening ? P.red : isSpeaking ? P.amber : (isNight ? "rgba(255,255,255,0.06)" : P.tealSoft),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, border: isListening ? "none" : `2px solid ${P.teal}33`,
              animation: isListening ? "micPulse 1.5s ease-in-out infinite" : "none",
              transition: "all 0.3s ease",
              boxShadow: isListening ? "0 0 20px rgba(212,91,91,0.3)" : "none",
            }}>{isListening ? "⏹" : isSpeaking ? "⏸" : "🎤"}</div>

            {/* Text Input */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 6px 6px 20px", borderRadius: 28, background: isNight ? "rgba(255,255,255,0.06)" : P.surface, border: `2px solid ${P.teal}22` }}>
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMsg()}
                placeholder={isListening ? "Listening..." : `${t.typeToWarda}...`}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 16, color: isNight ? "#E8E0D8" : P.text, fontFamily: fonts.body,
                  direction: dir,
                }}
              />
              <div onClick={sendMsg} style={{
                width: 44, height: 44, borderRadius: 22, cursor: "pointer",
                background: inputText.trim() ? `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})` : (isNight ? "rgba(255,255,255,0.04)" : P.bgDeep),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, transition: "all 0.3s ease",
              }}>{dir === "rtl" ? "←" : "→"}</div>
            </div>
          </div>
          {isListening && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: P.teal, fontWeight: 600, animation: "pulse 2s infinite" }}>
              ● Listening... Speak now
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ FEATURE SCREEN (placeholder) ═══
  return (
    <div style={{
      minHeight: "100vh", background: P.bg, fontFamily: fonts.body,
      display: "flex", flexDirection: "column", direction: dir,
    }}>
      <style>{globalStyle}</style>
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div onClick={() => setScreen("home")} style={{
          width: 42, height: 42, borderRadius: 21, cursor: "pointer",
          background: P.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>{dir === "rtl" ? "→" : "←"}</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: P.text }}>
          {features.find(f => "feature-" + f.id === screen)?.label || "Feature"}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 64 }}>{features.find(f => "feature-" + f.id === screen)?.icon || "🌹"}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: P.textSoft }}>Coming Soon</div>
        <div style={{ fontSize: 14, color: P.textMuted }}>This feature is being prepared for you</div>
      </div>
    </div>
  );
}
