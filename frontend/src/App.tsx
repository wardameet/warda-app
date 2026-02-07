import React, { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// WARDA TABLET APP V2 — PRODUCTION
// Ambient AI Companion for Elderly Care
// Auth: Device Activation → PIN Login → Main App
// Main: Triangle Layout + Three.js 3D Rose + Staggered Icons
// ═══════════════════════════════════════════════════════════════════════

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://api.meetwarda.com';

// ─── HQ Setup: read device code from URL (?setup=SUNNY-XXXX-XXXX-XXXX) ──
const setupParams = new URLSearchParams(window.location.search);
const setupCode = setupParams.get('setup');
if (setupCode) {
  localStorage.setItem('warda_device_token', setupCode.toUpperCase());
  localStorage.removeItem('warda_last_status_check');
  localStorage.removeItem('warda_cancelled');
  window.history.replaceState({}, '', window.location.pathname);
}

// ─── Design Tokens ────────────────────────────────────────────────────
const P = {
  bg: '#F5F0EB', bgWarm: '#EDE7E0',
  surface: '#FFFFFF', surfaceGlass: 'rgba(255,255,255,0.82)',
  teal: '#3D8B7A', tealDeep: '#2D6B5E', tealLight: '#E6F2EF',
  tealMist: '#D0E8E2', tealGlow: 'rgba(61,139,122,0.12)',
  text: '#2C2824', textSoft: '#6B635B', textMuted: '#9B948C', textLight: '#C4BDB5',
  helpRed: '#D45B5B', helpRedBg: '#FEF2F2', helpRedBorder: '#FECACA',
  familyBlue: '#5B89B4', musicPurple: '#8B6BB5', photoAmber: '#B89B5B',
  faithGold: '#C4A265', daySlate: '#6B8B8B',
  shadow: '0 4px 20px rgba(44,40,36,0.07)',
  shadowMd: '0 6px 28px rgba(44,40,36,0.1)',
};

const fonts = {
  heading: "'Fraunces', 'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Nunito', -apple-system, sans-serif",
};

const ALL_FEATURES = [
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧', color: P.familyBlue, badge: 0 },
  { id: 'music',  label: 'Music',  icon: '🎵',    color: P.musicPurple },
  { id: 'photos', label: 'Photos', icon: '📷',    color: P.photoAmber },
  { id: 'faith',  label: 'My Faith', icon: '🙏',  color: P.faithGold },
  { id: 'myday',  label: 'My Day',   icon: '📅',  color: P.daySlate },
];


// ═══════════════════════════════════════════════════════════════════════
// DEVICE STATUS SCREENS
// Activation is done at HQ via Super Admin before dispatch.
// Tablet OS PIN handles device security.
// App only checks: is this device ACTIVE or SUSPENDED?
// ═══════════════════════════════════════════════════════════════════════

function NotActivatedScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(165deg, ${P.bg} 0%, ${P.bgWarm} 100%)`,
      fontFamily: fonts.body, padding: 40, textAlign: 'center',
    }}>
      <WardaRoseSVG size={80} />
      <h1 style={{
        fontSize: 28, fontFamily: fonts.heading, color: P.teal,
        margin: '20px 0 8px', fontWeight: 600,
      }}>Setting up Warda</h1>
      <p style={{ fontSize: 17, color: P.textSoft, maxWidth: 400, lineHeight: 1.6 }}>
        This tablet is being prepared for you. It will be ready soon.
      </p>
      <p style={{ fontSize: 14, color: P.textMuted, marginTop: 20 }}>
        If you need help, please contact your care home staff.
      </p>
    </div>
  );
}

function SuspendedScreen({ reason }: { reason?: string }) {
  const isCancelled = reason === 'CANCELLED';
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(165deg, ${P.bg} 0%, ${P.bgWarm} 100%)`,
      fontFamily: fonts.body, padding: 40, textAlign: 'center',
    }}>
      <WardaRoseSVG size={80} />
      <h1 style={{
        fontSize: 28, fontFamily: fonts.heading, color: P.textSoft,
        margin: '20px 0 8px', fontWeight: 600,
      }}>{isCancelled ? 'Goodbye for now' : 'Warda is resting'}</h1>
      <p style={{ fontSize: 17, color: P.textMuted, maxWidth: 420, lineHeight: 1.6 }}>
        {isCancelled
          ? "It's been lovely spending time with you. If you'd like Warda back, we'd love to hear from you."
          : 'Warda is taking a little break right now. She\'ll be back soon.'}
      </p>
      <p style={{ fontSize: 14, color: P.textMuted, marginTop: 20 }}>
        {isCancelled
          ? 'hello@meetwarda.com'
          : 'Please speak with your care home or contact hello@meetwarda.com'}
      </p>
    </div>
  );
}

function ConnectionErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(165deg, ${P.bg} 0%, ${P.bgWarm} 100%)`,
      fontFamily: fonts.body, padding: 40, textAlign: 'center',
    }}>
      <WardaRoseSVG size={80} />
      <h1 style={{
        fontSize: 28, fontFamily: fonts.heading, color: P.teal,
        margin: '20px 0 8px', fontWeight: 600,
      }}>Connecting to Warda...</h1>
      <p style={{ fontSize: 17, color: P.textSoft, maxWidth: 400, lineHeight: 1.6 }}>
        Having a wee bit of trouble reaching Warda. Let's try again.
      </p>
      <button onClick={onRetry} style={{
        marginTop: 24, padding: '14px 40px', borderRadius: 20,
        background: `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})`,
        border: 'none', color: '#fff', fontSize: 17, fontWeight: 600,
        fontFamily: fonts.body, cursor: 'pointer',
      }}>Try Again</button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function WardaRoseSVG({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path d="M60 78 L60 108" stroke="#5B8B6B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 93 Q50 88 44 82" stroke="#5B8B6B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M60 97 Q70 92 76 87" stroke="#5B8B6B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="42" cy="82" rx="7" ry="3.5" transform="rotate(-30 42 82)" fill="#7BAB6B" opacity="0.75" />
      <ellipse cx="78" cy="87" rx="7" ry="3.5" transform="rotate(25 78 87)" fill="#7BAB6B" opacity="0.75" />
      <ellipse cx="60" cy="38" rx="17" ry="21" fill="#E07060" opacity="0.65" />
      <ellipse cx="45" cy="48" rx="16" ry="19" transform="rotate(-35 45 48)" fill="#D46858" opacity="0.7" />
      <ellipse cx="75" cy="48" rx="16" ry="19" transform="rotate(35 75 48)" fill="#D46858" opacity="0.7" />
      <ellipse cx="49" cy="61" rx="14" ry="17" transform="rotate(-20 49 61)" fill="#C85850" opacity="0.55" />
      <ellipse cx="71" cy="61" rx="14" ry="17" transform="rotate(20 71 61)" fill="#C85850" opacity="0.55" />
      <ellipse cx="60" cy="46" rx="11" ry="15" fill="#E88078" opacity="0.8" />
      <ellipse cx="55" cy="52" rx="8" ry="10" transform="rotate(-10 55 52)" fill="#F0988F" opacity="0.7" />
      <ellipse cx="65" cy="52" rx="8" ry="10" transform="rotate(10 65 52)" fill="#F0988F" opacity="0.7" />
      <ellipse cx="60" cy="50" rx="5" ry="7" fill="#D05048" opacity="0.9" />
    </svg>
  );
}

// ─── Three.js 3D Rose ─────────────────────────────────────────────────
function WardaRose3D({ size = 120 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const threeRef = useRef<any>(null);

  // Load Three.js from CDN
  useEffect(() => {
    if ((window as any).THREE) {
      threeRef.current = (window as any).THREE;
      setThreeLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => {
      threeRef.current = (window as any).THREE;
      setThreeLoaded(true);
    };
    script.onerror = () => {
      console.warn('Three.js failed to load, falling back to SVG');
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!threeLoaded || !mountRef.current || !threeRef.current) return;
    const THREE = threeRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.8, 4.2);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff0f0, 0.7));
    const keyL = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyL.position.set(3, 5, 4); scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0xaaddcc, 0.5);
    rimL.position.set(-3, 2, -2); scene.add(rimL);
    const fillL = new THREE.PointLight(0xff9988, 0.4, 8);
    fillL.position.set(0, 1, 2); scene.add(fillL);

    const rose = new THREE.Group();
    scene.add(rose);

    const pMat = (c: number, o = 0.88) => new THREE.MeshPhongMaterial({
      color: c, transparent: true, opacity: o, side: THREE.DoubleSide,
      shininess: 40, specular: new THREE.Color(0x553333),
    });

    function mkPetal(rT: number, rB: number, h: number, cv: number) {
      const pts: any[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector2(rB + (rT - rB) * t + Math.sin(t * Math.PI) * cv, t * h));
      }
      return new THREE.LatheGeometry(pts, 16, 0, Math.PI * 0.65);
    }

    // Outer petals
    [0xD46858, 0xC85850, 0xD46858, 0xCC6058, 0xC85850].forEach((c, i) => {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(mkPetal(0.06, 0.45, 0.9, 0.12), pMat(c, 0.75));
      p.position.set(Math.cos(a) * 0.15, -0.1, Math.sin(a) * 0.15);
      p.rotation.set(-0.4 + Math.random() * 0.15, a + Math.PI, 0.2 * Math.sin(a));
      p.userData = { bx: p.rotation.x, ph: i * 1.2 };
      rose.add(p);
    });

    // Middle petals
    [0xE07060, 0xE88078, 0xE07060, 0xE88078, 0xE07060].forEach((c, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const p = new THREE.Mesh(mkPetal(0.05, 0.35, 0.75, 0.1), pMat(c, 0.82));
      p.position.set(Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08);
      p.rotation.set(-0.15 + Math.random() * 0.1, a + Math.PI, 0.1 * Math.sin(a));
      p.userData = { bx: p.rotation.x, ph: i * 1.5 + 2 };
      rose.add(p);
    });

    // Inner petals
    [0xE8706A, 0xE88078, 0xE8706A, 0xE88078].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const p = new THREE.Mesh(mkPetal(0.04, 0.25, 0.55, 0.08), pMat(c, 0.88));
      p.position.set(Math.cos(a) * 0.03, 0.35, Math.sin(a) * 0.03);
      p.rotation.set(0.1 + Math.random() * 0.08, a + Math.PI, 0);
      p.userData = { bx: p.rotation.x, ph: i * 1.8 + 4 };
      rose.add(p);
    });

    // Centre bud
    const bud = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      new THREE.MeshPhongMaterial({ color: 0xD05048, shininess: 50, specular: 0x662222 })
    );
    bud.position.set(0, 0.52, 0); bud.scale.set(1, 0.75, 1);
    rose.add(bud);

    // Stem
    const stemC = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.02, -0.6, 0.01),
      new THREE.Vector3(-0.01, -1.0, -0.01), new THREE.Vector3(0.01, -1.35, 0),
    ]);
    rose.add(new THREE.Mesh(
      new THREE.TubeGeometry(stemC, 12, 0.04, 8, false),
      new THREE.MeshPhongMaterial({ color: 0x5B8B6B, shininess: 20 })
    ));

    // Leaves
    const ls = new THREE.Shape();
    ls.moveTo(0, 0); ls.quadraticCurveTo(0.15, 0.15, 0.35, 0); ls.quadraticCurveTo(0.15, -0.12, 0, 0);
    const lg = new THREE.ExtrudeGeometry(ls, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    const lm = new THREE.MeshPhongMaterial({ color: 0x7BAB6B, side: THREE.DoubleSide, shininess: 15 });
    const l1 = new THREE.Mesh(lg, lm);
    l1.position.set(0.05, -0.75, 0); l1.rotation.set(0, 0, -0.3); l1.scale.set(0.8, 0.8, 0.8);
    rose.add(l1);
    const l2 = new THREE.Mesh(lg, lm.clone());
    l2.position.set(-0.1, -0.95, 0.02); l2.rotation.set(0, Math.PI, 0.3); l2.scale.set(0.7, 0.7, 0.7);
    rose.add(l2);

    rose.position.set(0, 0.2, 0);

    let t = 0;
    function loop() {
      frameRef.current = requestAnimationFrame(loop);
      t += 0.008;
      rose.rotation.y = Math.sin(t * 0.4) * 0.15;
      rose.children.forEach((ch: any) => {
        if (ch.userData?.bx !== undefined) {
          ch.rotation.x = ch.userData.bx + Math.sin(t + ch.userData.ph) * 0.04;
        }
      });
      renderer.render(scene, camera);
    }
    loop();

    const el = mountRef.current;
    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (el && renderer.domElement?.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [threeLoaded, size]);

  // Fallback to SVG if Three.js hasn't loaded
  if (!threeLoaded) {
    return <WardaRoseSVG size={size * 0.65} />;
  }

  return <div ref={mountRef} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }} />;
}


// ─── Time & Greeting ──────────────────────────────────────────────────
function useTimeGreeting(name = 'Friend') {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isNight = true; // Always dark mode — Warda's signature look

  let greeting: string;
  if (h < 6) greeting = `Rest well, ${name}`;
  else if (h < 12) greeting = `Good morning, ${name}`;
  else if (h < 17) greeting = `Good afternoon, ${name}`;
  else if (h < 21) greeting = `Good evening, ${name}`;
  else greeting = `Sweet dreams, ${name}`;

  return { time, date, greeting, isNight };
}


// ─── Help Button ──────────────────────────────────────────────────────
function HelpButton() {
  const [pressed, setPressed] = useState(false);

  const handleHelp = async () => {
    if (pressed) return; // Prevent double-tap
    setPressed(true);
    try {
      const residentId = localStorage.getItem('warda_resident_id');
      const residentData = localStorage.getItem('warda_resident');
      const resident = residentData ? JSON.parse(residentData) : null;
      const name = resident?.preferredName || resident?.firstName || 'Resident';

      await fetch(`${API_BASE}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId,
          type: 'HELP',
          severity: 'critical',
          message: `${name} (Room ${resident?.roomNumber || '?'}) pressed the Help button`,
          careHomeId: resident?.careHomeId,
        }),
      });
    } catch {}
    setTimeout(() => setPressed(false), 5000);
  };

  return (
    <button onClick={handleHelp} style={{
      padding: '12px 22px', borderRadius: 18,
      background: pressed
        ? P.helpRed
        : `linear-gradient(135deg, ${P.helpRedBg}, #FDE8E8)`,
      border: pressed ? 'none' : `2px solid ${P.helpRedBorder}`,
      color: pressed ? '#fff' : P.helpRed,
      fontSize: 16, fontWeight: 700, fontFamily: fonts.body,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: pressed ? '0 0 24px rgba(212,91,91,0.4)' : 'none',
      transition: 'all 0.2s ease',
    }}>
      <span style={{ fontSize: 20 }}>🆘</span>
      <span>{pressed ? '✓ Help is coming!' : 'Help'}</span>
    </button>
  );
}


// ─── Suggestion Card ──────────────────────────────────────────────────
function SuggestionCard({ suggestion, isNight }: { suggestion: any; isNight: boolean }) {
  if (!suggestion) return null;
  return (
    <button onClick={suggestion.onTap} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 22px', borderRadius: 20,
      background: isNight ? 'rgba(255,255,255,0.05)' : P.surfaceGlass,
      border: `1.5px solid ${isNight ? 'rgba(255,255,255,0.06)' : P.tealMist}`,
      cursor: 'pointer', outline: 'none', maxWidth: 460,
      boxShadow: isNight ? 'none' : P.shadow,
      animation: 'fadeSlideIn 0.5s ease 0.9s backwards',
    }}>
      <span style={{ fontSize: 28 }}>{suggestion.icon}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, fontFamily: fonts.body,
          color: isNight ? '#E8E0D8' : P.text,
        }}>{suggestion.title}</div>
        <div style={{
          fontSize: 13, color: isNight ? 'rgba(232,224,216,0.5)' : P.textSoft, marginTop: 2,
        }}>{suggestion.subtitle}</div>
      </div>
      <span style={{
        fontSize: 18, color: isNight ? 'rgba(232,224,216,0.25)' : P.textLight,
        marginLeft: 'auto',
      }}>→</span>
    </button>
  );
}


// ─── Feature Icon (staggered entrance) ────────────────────────────────
function FeatureIcon({ feature, onTap, animDelay = 0 }: {
  feature: any; onTap: (id: string) => void; animDelay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  return (
    <button
      onClick={() => onTap(feature.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: 90, height: 90, borderRadius: 22,
        background: P.surface, border: `2px solid ${feature.color}18`,
        boxShadow: hovered
          ? `0 8px 28px ${feature.color}25, 0 0 20px ${feature.color}12`
          : `${P.shadow}, 0 0 16px ${feature.color}08`,
        cursor: 'pointer', outline: 'none', position: 'relative',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-4px) scale(1.06)' : 'translateY(0) scale(1)')
          : 'translateY(30px) scale(0.3) rotateZ(-8deg)',
        transition: visible
          ? 'transform 0.25s ease, box-shadow 0.25s ease'
          : `opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${animDelay}ms, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${animDelay}ms`,
      }}
    >
      <span style={{
        fontSize: 30, lineHeight: 1,
        transition: 'transform 0.3s ease',
        transform: hovered ? 'scale(1.15)' : 'scale(1)',
      }}>{feature.icon}</span>
      <span style={{
        fontSize: 13, fontFamily: fonts.body, fontWeight: 600,
        color: feature.color, marginTop: 5,
      }}>{feature.label}</span>
      {feature.badge > 0 && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 24, height: 24, borderRadius: '50%',
          background: P.helpRed, color: '#fff',
          fontSize: 12, fontWeight: 700, fontFamily: fonts.body,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2.5px solid ${P.surface}`,
        }}>{feature.badge}</div>
      )}
    </button>
  );
}


// ─── Chat Bubble ──────────────────────────────────────────────────────
function ChatBubble({ message, isWarda, isNight }: {
  message: string; isWarda: boolean; isNight: boolean;
}) {
  return (
    <div style={{
      alignSelf: isWarda ? 'flex-start' : 'flex-end',
      maxWidth: '78%', padding: '14px 20px',
      borderRadius: isWarda ? '22px 22px 22px 6px' : '22px 22px 6px 22px',
      background: isWarda ? (isNight ? 'rgba(61,139,122,0.15)' : P.tealLight)
        : (isNight ? 'rgba(255,255,255,0.08)' : P.surface),
      color: isNight ? '#E8E0D8' : P.text,
      fontSize: 18, fontFamily: fonts.body, lineHeight: 1.55,
      boxShadow: isWarda ? 'none' : P.shadow,
      border: isWarda ? `1px solid ${P.tealMist}` : '1px solid rgba(0,0,0,0.03)',
      animation: 'fadeSlideIn 0.35s ease',
    }}>
      {isWarda && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: P.teal,
          marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' as const,
        }}>Warda</div>
      )}
      {message}
    </div>
  );
}


// ─── Triangle Circle ──────────────────────────────────────────────────
const CIRCLE_SIZE = 120;

function TriangleCircle({ icon, label, onClick, variant = 'warda', animDelay = 0 }: {
  icon?: string; label: string; onClick: () => void;
  variant?: 'warda' | 'talk' | 'type'; animDelay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const isWarda = variant === 'warda';
  const isTalk = variant === 'talk';

  const bg = isWarda
    ? `linear-gradient(150deg, ${P.teal}, ${P.tealDeep})`
    : isTalk
      ? `linear-gradient(145deg, ${P.teal}, ${P.tealDeep})`
      : `linear-gradient(145deg, ${P.surface}, #F0EDE8)`;

  const border = isWarda ? 'none' : isTalk ? 'none' : `2.5px solid ${P.tealMist}`;
  const shadow = isWarda
    ? '0 6px 32px rgba(61,139,122,0.35)'
    : isTalk
      ? '0 6px 28px rgba(61,139,122,0.35)'
      : '0 4px 18px rgba(44,40,36,0.08)';
  const labelColor = isWarda ? P.teal : isTalk ? P.teal : P.textSoft;

  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      cursor: 'pointer', outline: 'none', background: 'none', border: 'none', padding: 0,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.92)',
      transition: 'all 0.5s ease',
    }}>
      <div style={{
        width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: '50%',
        background: bg, border,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxShadow: shadow,
        animation: isWarda ? 'breathe 4s ease-in-out infinite' : 'none',
      }}>
        {isWarda ? (
          <>
            <WardaRose3D size={85} />
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: fonts.heading,
              color: '#FFFFFF', marginTop: -8, letterSpacing: 1.8,
            }}>WARDA</span>
          </>
        ) : (
          <span style={{
            fontSize: 42,
            filter: isTalk ? 'brightness(1.8)' : 'none',
          }}>{icon}</span>
        )}
      </div>
      <span style={{
        fontSize: 14, fontWeight: 600, fontFamily: fonts.body,
        color: labelColor, letterSpacing: 0.2,
      }}>{label}</span>
    </button>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── Device Status ────────────────────────────────────────────
  // Device is pre-activated at HQ. App just checks status.
  const [deviceStatus, setDeviceStatus] = useState<'loading' | 'active' | 'suspended' | 'not_activated' | 'error'>('loading');
  const [suspendReason, setSuspendReason] = useState<string | undefined>(undefined);
  const [resident, setResident] = useState<any>(null);

  // ─── App State ────────────────────────────────────────────────
  const [mode, setMode] = useState<'ambient' | 'conversation' | 'feature'>('ambient');
  const [conversationMode, setConversationMode] = useState<'voice' | 'type'>('voice');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [weather, setWeather] = useState({ temp: '—°C', icon: '☁️', desc: '' });
  const [pendingFamilyMessages, setPendingFamilyMessages] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Device Status Check ──────────────────────────────────────
  const checkDeviceStatus = useCallback(async () => {
    try {
      const deviceToken = localStorage.getItem('warda_device_token');
      if (!deviceToken) {
        // No token = device not yet activated at HQ
        setDeviceStatus('not_activated');
        return;
      }

      const res = await fetch(`${API_BASE}/api/tablet/status`, {
        headers: {
          'Authorization': `Bearer ${deviceToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();

      if (data.success && data.status === 'ACTIVE') {
        setResident(data.resident);
        localStorage.setItem('warda_resident', JSON.stringify(data.resident));
        localStorage.setItem('warda_resident_id', data.resident.id);
        localStorage.setItem('warda_last_status_check', Date.now().toString());
        localStorage.removeItem('warda_cancelled'); // Clear any previous cancellation
        setDeviceStatus('active');
      } else if (data.status === 'SUSPENDED' || data.status === 'CANCELLED') {
        setSuspendReason(data.status);
        setDeviceStatus('suspended');
        if (data.status === 'CANCELLED') {
          // Stop all future checks — service ended
          localStorage.setItem('warda_cancelled', 'true');
          localStorage.removeItem('warda_last_status_check');
        }
      } else {
        setDeviceStatus('not_activated');
      }
    } catch {
      // If offline, check if we have cached resident data
      const cachedResident = localStorage.getItem('warda_resident');
      const lastCheck = localStorage.getItem('warda_last_status_check');
      if (cachedResident && lastCheck) {
        // Use cached data — allow offline use if last check was within 48 hours
        const hoursSinceCheck = (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60);
        if (hoursSinceCheck < 48) {
          setResident(JSON.parse(cachedResident));
          setDeviceStatus('active');
          return;
        }
      }
      setDeviceStatus('error');
    }
  }, []);

  // ─── Check on Mount ───────────────────────────────────────────
  useEffect(() => {
    // If service was cancelled, show goodbye screen immediately — no API calls
    const cancelled = localStorage.getItem('warda_cancelled');
    if (cancelled === 'true') {
      setSuspendReason('CANCELLED');
      setDeviceStatus('suspended');
      return;
    }

    const lastCheck = localStorage.getItem('warda_last_status_check');
    const cachedResident = localStorage.getItem('warda_resident');
    const hoursSinceCheck = lastCheck ? (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60) : 999;

    if (cachedResident && hoursSinceCheck < 24) {
      // Last check was less than 24 hours ago — use cached data, skip API call
      setResident(JSON.parse(cachedResident));
      setDeviceStatus('active');
    } else {
      // First launch or 24 hours passed — check with server
      checkDeviceStatus();
    }
  }, [checkDeviceStatus]);

  // ─── 24-hour Background Check ─────────────────────────────────
  useEffect(() => {
    if (deviceStatus !== 'active') return;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const interval = setInterval(() => {
      checkDeviceStatus();
    }, TWENTY_FOUR_HOURS);
    return () => clearInterval(interval);
  }, [deviceStatus, checkDeviceStatus]);

  // ─── Check for pending family messages ────────────────────────
  useEffect(() => {
    if (deviceStatus !== 'active' || !resident?.id) return;
    const checkMessages = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/pending/${resident.id}`);
        const data = await res.json();
        if (data.success) setPendingFamilyMessages(data.count || 0);
      } catch {}
    };
    checkMessages();
    const interval = setInterval(checkMessages, 60000);
    return () => clearInterval(interval);
  }, [deviceStatus, resident?.id]);

  // ─── Fetch Weather ──────────────────────────────────────────────
  useEffect(() => {
    if (deviceStatus !== 'active' || !resident?.id) return;
    const weatherIcons: Record<string, string> = {
      'Sunny': '☀️', 'Clear': '🌙', 'Partly cloudy': '⛅', 'Cloudy': '☁️',
      'Overcast': '☁️', 'Mist': '🌫️', 'Fog': '🌫️', 'Light rain': '🌧️',
      'Rain': '🌧️', 'Heavy rain': '🌧️', 'Light snow': '🌨️', 'Snow': '❄️',
      'Thunderstorm': '⛈️', 'Drizzle': '🌦️', 'Patchy rain possible': '🌦️',
    };
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orientation?residentId=${resident.id}`);
        const data = await res.json();
        if (data.success && data.weather) {
          setWeather({
            temp: `${data.weather.temperature}°C`,
            icon: weatherIcons[data.weather.description] || '🌤️',
            desc: data.weather.description,
          });
        }
      } catch {}
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000); // Every 30 mins
    return () => clearInterval(interval);
  }, [deviceStatus, resident?.id]);

  const residentName = resident?.preferredName || resident?.firstName || 'Friend';
  const { time, date, greeting, isNight } = useTimeGreeting(residentName);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (conversationMode === 'type' && mode === 'conversation')
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [conversationMode, mode]);

  // ─── Text-to-Speech (Polly) ───────────────────────────────────
  const isPlayingRef = useRef(false);
  const shouldAutoListenRef = useRef(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
  };

  const startRecognition = () => {
    if (isPlayingRef.current || isProcessing) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setConversationMode('type'); return; }

    const recognition = new SR();
    recognition.lang = 'en-GB';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    transcriptRef.current = '';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript = event.results[i][0].transcript;
        }
      }
      transcriptRef.current = finalTranscript.trim();
      const display = (finalTranscript + interimTranscript).trim();
      if (display) setInputText(display);
    };
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') console.log('Speech error:', e.error);
      setIsListening(false);
      isListeningRef.current = false;
    };
    recognition.onend = () => {
      if (isListeningRef.current && !isPlayingRef.current) {
        try { recognitionRef.current?.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    isListeningRef.current = true;
  };

  const speakText = useCallback(async (text: string) => {
    try {
      // Stop mic while Warda speaks
      stopRecognition();
      isPlayingRef.current = true;

      const res = await fetch(`${API_BASE}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success && data.audio) {
        const audio = new Audio(`data:${data.contentType};base64,${data.audio}`);
        audio.onended = () => {
          isPlayingRef.current = false;
          if (shouldAutoListenRef.current) {
            setTimeout(() => startRecognition(), 400);
          }
        };
        audio.onerror = () => { isPlayingRef.current = false; };
        audio.play().catch(() => { isPlayingRef.current = false; });
      } else {
        isPlayingRef.current = false;
      }
    } catch {
      isPlayingRef.current = false;
    }
  }, []);

  // ─── Conversation API ─────────────────────────────────────────
  const startConversation = useCallback(async () => {
    if (conversationId) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resident?.id, residentName: residentName }),
      });
      const data = await res.json();
      if (data.success) {
        setConversationId(data.sessionId);
        if (data.greeting) {
          setMessages([{ id: 'greet', text: data.greeting, isWarda: true }]);
          speakText(data.greeting);
        }
      }
    } catch {
      const fallback = `${greeting}. How are you today, dear?`;
      setMessages([{ id: 'greet', text: fallback, isWarda: true }]);
    }
  }, [conversationId, resident?.id, residentName, greeting, speakText]);

  const handleSend = async (text: string) => {
    if (!text?.trim() || isProcessing) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: text.trim(), isWarda: false }]);
    setInputText('');
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resident?.id, message: text.trim() }),
      });
      const data = await res.json();
      if (data.success && data.response?.text) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: data.response.text, isWarda: true }]);
        speakText(data.response.text);
      }
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "I'm sorry dear, could you say that again?", isWarda: true }]);
    } finally { setIsProcessing(false); }
  };

  const openConversation = (initial: 'voice' | 'type') => {
    setConversationMode(initial);
    setMode('conversation');
    shouldAutoListenRef.current = initial === 'voice';
    startConversation();
  };

  const toggleListening = () => {
    if (isListening) {
      // Stop and send
      const text = transcriptRef.current || inputText;
      stopRecognition();
      setInputText('');
      if (text?.trim()) handleSend(text.trim());
    } else {
      startRecognition();
    }
  };

  const handleBack = () => { setMode('ambient'); setActiveFeature(null); setIsListening(false); };

  // ─── Warda Tips (rotate when no real messages) ──────────────
  const wardaTips = [
    { icon: '🌹', title: "I'm here whenever you need me", subtitle: 'Just tap Talk to Warda, dear' },
    { icon: '☀️', title: 'Shall we have a wee chat?', subtitle: 'I\'d love to hear about your day' },
    { icon: '🎵', title: 'Fancy some music?', subtitle: 'Tap Music and I\'ll play your favourites' },
    { icon: '👨‍👩‍👧', title: 'Want to send a message?', subtitle: 'Just tell me and I\'ll pass it on to family' },
    { icon: '📖', title: 'Tell me a story', subtitle: 'I love hearing about your memories' },
    { icon: '🌙', title: 'Rest well tonight', subtitle: 'I\'ll be here if you need me' },
  ];
  const tipIndex = Math.floor(Date.now() / (5 * 60 * 1000)) % wardaTips.length; // Rotate every 5 mins
  const currentTip = wardaTips[isNight ? 5 : tipIndex];
  const [suggestion] = useState({
    ...currentTip,
    onTap: () => openConversation('voice'),
  });

  // ─── Status Screens ────────────────────────────────────────────
  if (deviceStatus === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: P.bg, fontFamily: fonts.body, gap: 16,
      }}>
        <WardaRoseSVG size={80} />
        <p style={{ fontSize: 16, color: P.textMuted, fontFamily: fonts.body }}>
          Waking up Warda...
        </p>
      </div>
    );
  }

  if (deviceStatus === 'not_activated') {
    return <NotActivatedScreen />;
  }

  if (deviceStatus === 'suspended') {
    return <SuspendedScreen reason={suspendReason} />;
  }

  if (deviceStatus === 'error') {
    return <ConnectionErrorScreen onRetry={checkDeviceStatus} />;
  }

  // ─── Main App ─────────────────────────────────────────────────
  const nightBg = 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)';
  const dayBg = `linear-gradient(165deg, ${P.bg} 0%, ${P.bgWarm} 45%, #E5DED6 100%)`;

  // Update family badge count
  const features = ALL_FEATURES.map(f =>
    f.id === 'family' ? { ...f, badge: pendingFamilyMessages } : f
  );

  return (
    <div style={{
      background: isNight ? nightBg : dayBg,
      minHeight: '100vh', fontFamily: fonts.body,
      position: 'relative', overflow: 'hidden', userSelect: 'none',
    }}>
      {/* Subtle texture */}
      {!isNight && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.025,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />
      )}

      {/* ─── TOP BAR (ambient + feature only) ──────────────────── */}
      {mode !== 'conversation' && (
        <div style={{
          position: 'relative', zIndex: 30,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '16px 24px 0',
        }}>
          <div>
            <div style={{
              fontSize: 36, fontWeight: 300, fontFamily: fonts.heading,
              color: isNight ? '#E8E0D8' : P.text, letterSpacing: -0.5, lineHeight: 1,
            }}>{time}</div>
            <div style={{
              fontSize: 14, color: isNight ? 'rgba(232,224,216,0.55)' : P.textSoft,
              fontWeight: 500, marginTop: 3,
            }}>{date}</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 6, padding: '4px 11px', borderRadius: 14,
              background: isNight ? 'rgba(255,255,255,0.06)' : P.surfaceGlass,
              fontSize: 13, color: isNight ? 'rgba(232,224,216,0.6)' : P.textSoft, fontWeight: 500,
            }}>
              <span>{weather.icon}</span>
              <span style={{ fontWeight: 600 }}>{weather.temp}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{weather.desc}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 600, textAlign: 'right' as const,
                color: isNight ? 'rgba(232,224,216,0.6)' : P.textSoft,
              }}>{resident?.careHomeName || 'Care Home'}</div>
              <div style={{
                fontSize: 12, color: isNight ? 'rgba(232,224,216,0.35)' : P.textMuted,
                marginTop: 1, textAlign: 'right' as const,
              }}>Room {resident?.roomNumber || ''}</div>
            </div>
            <HelpButton />
          </div>
        </div>
      )}

      {/* ═══ AMBIENT MODE ═══════════════════════════════════════ */}
      {mode === 'ambient' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'flex-start',
          minHeight: 'calc(100vh - 100px)',
          paddingTop: 4,
          zIndex: 5, position: 'relative',
        }}>
          {/* Warda + Greeting */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <TriangleCircle variant="warda" label="" onClick={() => {}} animDelay={0} />
            <h1 style={{
              fontSize: 22, fontFamily: fonts.heading, fontWeight: 400,
              color: isNight ? 'rgba(232,224,216,0.85)' : P.teal,
              fontStyle: 'italic', margin: '8px 0 0', textAlign: 'center',
              lineHeight: 1.2,
            }}>{greeting}</h1>
          </div>

          {/* Talk + Type */}
          <div style={{ display: 'flex', gap: 44, justifyContent: 'center', marginTop: 20 }}>
            <TriangleCircle variant="talk" icon="🎤" label="Talk to Warda" onClick={() => openConversation('voice')} animDelay={150} />
            <TriangleCircle variant="type" icon="⌨️" label="Type to Warda" onClick={() => openConversation('type')} animDelay={250} />
          </div>

          {/* Features */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 20px', marginTop: 24 }}>
            {features.map((f, i) => (
              <FeatureIcon key={f.id} feature={f} onTap={(id) => {
                setActiveFeature(id); setMode('feature');
              }} animDelay={500 + i * 150} />
            ))}
          </div>

          {/* Suggestion */}
          <div style={{ padding: '0 28px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <SuggestionCard suggestion={suggestion} isNight={isNight} />
          </div>

          {/* Footer */}
          <div style={{
            position: 'fixed', bottom: 8, left: 0, right: 0,
            textAlign: 'center',
            fontSize: 11, color: isNight ? 'rgba(232,224,216,0.25)' : P.textLight,
            fontFamily: fonts.body, zIndex: 5,
          }}>
            © {new Date().getFullYear()} Eletiser Ltd · Meet Warda™ · You're Never Alone
          </div>
        </div>
      )}

      {/* ═══ CONVERSATION MODE ══════════════════════════════════ */}
      {mode === 'conversation' && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          height: '100vh', zIndex: 10,
          animation: 'fadeIn 0.35s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `linear-gradient(150deg, ${P.teal}, ${P.tealDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(61,139,122,0.3)',
              }}><WardaRoseSVG size={28} /></div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.heading, color: P.teal }}>Warda</div>
                <div style={{ fontSize: 13, color: P.textMuted }}>
                  {isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Online'}
                </div>
              </div>
            </div>
            <button onClick={handleBack} style={{
              padding: '12px 24px', borderRadius: 20,
              background: P.surface, border: `1.5px solid ${P.tealMist}`,
              fontSize: 16, fontWeight: 600, color: P.teal,
              fontFamily: fonts.body, cursor: 'pointer', outline: 'none',
              boxShadow: P.shadow,
            }}>← Back to Warda</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px 24px 12px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map(msg => (
              <ChatBubble key={msg.id} message={msg.text} isWarda={msg.isWarda} isNight={isNight} />
            ))}
            {isProcessing && (
              <div style={{
                alignSelf: 'flex-start', padding: '14px 22px',
                borderRadius: '22px 22px 22px 6px',
                background: P.tealLight, fontSize: 17, color: P.teal,
                animation: 'pulse 1.4s ease infinite',
              }}>Warda is here . . .</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Voice input */}
          {conversationMode === 'voice' && (
            <div style={{
              padding: '14px 20px 22px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
              background: isNight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              borderTop: `1px solid ${isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <button onClick={toggleListening} style={{
                width: 76, height: 76, borderRadius: '50%',
                background: isListening
                  ? `linear-gradient(135deg, ${P.helpRed}, #C04040)`
                  : `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})`,
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 32,
                boxShadow: isListening ? '0 0 30px rgba(212,91,91,0.4)' : '0 6px 24px rgba(61,139,122,0.35)',
                animation: isListening ? 'listeningPulse 1.5s ease-in-out infinite' : 'none',
              }}>🎤</button>
              <span style={{
                fontSize: 16, fontWeight: 600,
                color: isListening ? P.helpRed : P.textSoft,
              }}>{isListening ? '🔴 Listening... tap to send' : '🎤 Tap to talk'}</span>
            </div>
          )}

          {/* Type input */}
          {conversationMode === 'type' && (
            <div style={{
              padding: '10px 20px 22px', display: 'flex', gap: 10, alignItems: 'center',
              background: isNight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              borderTop: `1px solid ${isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <input ref={inputRef} type="text" value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend(inputText)}
                placeholder="Type your message..." disabled={isProcessing}
                style={{
                  flex: 1, padding: '15px 22px', borderRadius: 24,
                  border: `2px solid ${P.tealMist}`,
                  background: isNight ? 'rgba(255,255,255,0.05)' : P.surface,
                  fontSize: 18, fontFamily: fonts.body,
                  color: isNight ? '#E8E0D8' : P.text, outline: 'none',
                }} />
              <button onClick={() => handleSend(inputText)}
                disabled={!inputText.trim() || isProcessing}
                style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: inputText.trim()
                    ? `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})` : '#E8E4DC',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: inputText.trim() ? 'pointer' : 'default', flexShrink: 0,
                  fontSize: 22, color: '#fff', opacity: inputText.trim() ? 1 : 0.4,
                }}>➤</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ FEATURE MODE ═══════════════════════════════════════ */}
      {mode === 'feature' && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          height: '100vh', zIndex: 10,
          animation: 'fadeIn 0.35s ease',
        }}>
          {/* Feature Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px',
            background: isNight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{ALL_FEATURES.find(f => f.id === activeFeature)?.icon}</span>
              <span style={{ fontSize: 20, fontWeight: 600, fontFamily: fonts.heading, color: P.teal }}>
                {ALL_FEATURES.find(f => f.id === activeFeature)?.label}
              </span>
            </div>
            <button onClick={handleBack} style={{
              padding: '10px 24px', borderRadius: 16,
              background: `linear-gradient(135deg, ${P.teal}, ${P.tealDeep})`,
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
              fontFamily: fonts.body, cursor: 'pointer',
            }}>← Back to Warda</button>
          </div>

          {/* Feature Content */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* ─── FAMILY ─── */}
            {activeFeature === 'family' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                {[
                  { name: 'Abid', relation: 'Son', detail: 'Lives in Newmachar · Visits every weekend', emoji: '👨' },
                  { name: 'Fatima', relation: 'Daughter', detail: 'Lives in Casablanca · Calls every Thursday', emoji: '👩' },
                  { name: 'Yasmine', relation: 'Granddaughter', detail: "Abid's daughter · Age 8", emoji: '👧' },
                  { name: 'Omar', relation: 'Grandson', detail: "Abid's son · Age 5", emoji: '👦' },
                  { name: 'Leila', relation: 'Granddaughter', detail: "Fatima's daughter · Age 12", emoji: '👧' },
                ].map((person, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 22px', borderRadius: 20,
                    background: isNight ? 'rgba(255,255,255,0.05)' : P.surfaceGlass,
                    border: `1.5px solid ${isNight ? 'rgba(255,255,255,0.06)' : P.tealMist}`,
                  }}>
                    <span style={{ fontSize: 38 }}>{person.emoji}</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: isNight ? '#E8E0D8' : P.text, fontFamily: fonts.heading }}>
                        {person.name} <span style={{ fontWeight: 400, fontSize: 14, color: P.textSoft }}>— {person.relation}</span>
                      </div>
                      <div style={{ fontSize: 14, color: P.textMuted, marginTop: 2 }}>{person.detail}</div>
                    </div>
                  </div>
                ))}
                <div style={{
                  padding: '16px 22px', borderRadius: 16, marginTop: 8,
                  background: isNight ? 'rgba(61,139,122,0.15)' : 'rgba(61,139,122,0.08)',
                  textAlign: 'center', fontSize: 15, color: P.teal, fontFamily: fonts.body,
                }}>
                  💬 Say "Tell Abid I love him" to send a message through Warda
                </div>
              </div>
            )}

            {/* ─── MUSIC ─── */}
            {activeFeature === 'music' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <p style={{ fontSize: 16, color: isNight ? '#E8E0D8' : P.textSoft, textAlign: 'center', fontFamily: fonts.body }}>
                  Hafsa's favourite music
                </p>
                {[
                  { title: 'Andalusian Classical', desc: 'Traditional music from Morocco and Al-Andalus', emoji: '🎵' },
                  { title: 'Fairuz', desc: 'The voice of Lebanon — timeless classics', emoji: '🎤' },
                  { title: 'Scottish Folk Songs', desc: 'Songs from the highlands and lowlands', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
                ].map((m, i) => (
                  <button key={i} onClick={() => { openConversation('type'); }} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 22px', borderRadius: 20, width: '100%',
                    background: isNight ? 'rgba(255,255,255,0.05)' : P.surfaceGlass,
                    border: `1.5px solid ${isNight ? 'rgba(255,255,255,0.06)' : P.tealMist}`,
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 36 }}>{m.emoji}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: isNight ? '#E8E0D8' : P.text, fontFamily: fonts.heading }}>{m.title}</div>
                      <div style={{ fontSize: 13, color: P.textMuted, marginTop: 2 }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
                <div style={{
                  padding: '16px 22px', borderRadius: 16, marginTop: 8,
                  background: isNight ? 'rgba(61,139,122,0.15)' : 'rgba(61,139,122,0.08)',
                  textAlign: 'center', fontSize: 15, color: P.teal, fontFamily: fonts.body,
                }}>
                  🎵 Say "Play me some music" to ask Warda for music
                </div>
              </div>
            )}

            {/* ─── PHOTOS ─── */}
            {activeFeature === 'photos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: 64 }}>📸</span>
                <h3 style={{ fontSize: 22, fontFamily: fonts.heading, color: P.teal }}>Family Photos</h3>
                <p style={{ fontSize: 15, color: P.textSoft, fontFamily: fonts.body, lineHeight: 1.6 }}>
                  When your family sends photos, they'll appear here for you to enjoy anytime.
                </p>
                <div style={{
                  padding: '16px 22px', borderRadius: 16, marginTop: 8,
                  background: isNight ? 'rgba(61,139,122,0.15)' : 'rgba(61,139,122,0.08)',
                  fontSize: 15, color: P.teal, fontFamily: fonts.body,
                }}>
                  📷 Family members can share photos through the Family App
                </div>
              </div>
            )}

            {/* ─── FAITH ─── */}
            {activeFeature === 'faith' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <div style={{
                  padding: '24px', borderRadius: 20, textAlign: 'center',
                  background: isNight ? 'rgba(255,255,255,0.05)' : P.surfaceGlass,
                  border: `1.5px solid ${isNight ? 'rgba(255,255,255,0.06)' : P.tealMist}`,
                }}>
                  <span style={{ fontSize: 42 }}>🕌</span>
                  <h3 style={{ fontSize: 20, fontFamily: fonts.heading, color: P.teal, margin: '8px 0' }}>Islam — Sunni</h3>
                  <p style={{ fontSize: 14, color: P.textSoft }}>Bismillah ar-Rahman ar-Raheem</p>
                </div>
                <h4 style={{ fontSize: 16, color: isNight ? '#E8E0D8' : P.text, fontFamily: fonts.heading }}>Prayer Times</h4>
                {[
                  { name: 'Fajr', time: '06:30', emoji: '🌅' },
                  { name: 'Dhuhr', time: '12:30', emoji: '☀️' },
                  { name: 'Asr', time: '15:00', emoji: '🌤️' },
                  { name: 'Maghrib', time: '17:00', emoji: '🌇' },
                  { name: 'Isha', time: '19:30', emoji: '🌙' },
                ].map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderRadius: 16,
                    background: isNight ? 'rgba(255,255,255,0.04)' : P.surfaceGlass,
                    border: `1px solid ${isNight ? 'rgba(255,255,255,0.04)' : P.tealMist}`,
                  }}>
                    <span style={{ fontSize: 15, color: isNight ? '#E8E0D8' : P.text }}>{p.emoji} {p.name}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: P.teal }}>{p.time}</span>
                  </div>
                ))}
                <h4 style={{ fontSize: 16, color: isNight ? '#E8E0D8' : P.text, fontFamily: fonts.heading, marginTop: 8 }}>Favourite Scriptures</h4>
                {['Ayat al-Kursi', 'Surah Al-Fatiha', 'Surah Ar-Rahman'].map((s, i) => (
                  <div key={i} style={{
                    padding: '12px 20px', borderRadius: 14,
                    background: isNight ? 'rgba(255,255,255,0.04)' : P.surfaceGlass,
                    border: `1px solid ${isNight ? 'rgba(255,255,255,0.04)' : P.tealMist}`,
                    fontSize: 15, color: isNight ? '#E8E0D8' : P.text,
                  }}>📖 {s}</div>
                ))}
                <div style={{
                  padding: '16px 22px', borderRadius: 16, marginTop: 8,
                  background: isNight ? 'rgba(61,139,122,0.15)' : 'rgba(61,139,122,0.08)',
                  textAlign: 'center', fontSize: 15, color: P.teal, fontFamily: fonts.body,
                }}>
                  🤲 Say "I'd like to pray" and Warda will help you
                </div>
              </div>
            )}

            {/* ─── MY DAY ─── */}
            {activeFeature === 'myday' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <div style={{
                  padding: '20px 24px', borderRadius: 20, textAlign: 'center',
                  background: isNight ? 'rgba(255,255,255,0.05)' : P.surfaceGlass,
                  border: `1.5px solid ${isNight ? 'rgba(255,255,255,0.06)' : P.tealMist}`,
                }}>
                  <div style={{ fontSize: 36 }}>📅</div>
                  <h3 style={{ fontSize: 20, fontFamily: fonts.heading, color: P.teal, margin: '8px 0' }}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                </div>
                <h4 style={{ fontSize: 16, color: isNight ? '#E8E0D8' : P.text, fontFamily: fonts.heading }}>Today's Schedule</h4>
                {[
                  { time: '06:30', activity: 'Fajr Prayer', emoji: '🌅' },
                  { time: '08:00', activity: 'Breakfast', emoji: '🍳' },
                  { time: '09:30', activity: 'Morning Activity', emoji: '🧶' },
                  { time: '12:30', activity: 'Dhuhr Prayer', emoji: '☀️' },
                  { time: '12:45', activity: 'Lunch', emoji: '🍽️' },
                  { time: '14:00', activity: 'Afternoon Rest', emoji: '😴' },
                  { time: '15:00', activity: 'Asr Prayer & Tea Time', emoji: '🫖' },
                  { time: '17:00', activity: 'Maghrib Prayer', emoji: '🌇' },
                  { time: '17:30', activity: 'Dinner', emoji: '🍲' },
                  { time: '19:30', activity: 'Isha Prayer', emoji: '🌙' },
                  { time: '20:00', activity: 'Relaxation & Warda Time', emoji: '🌹' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 18px', borderRadius: 14,
                    background: isNight ? 'rgba(255,255,255,0.04)' : P.surfaceGlass,
                    border: `1px solid ${isNight ? 'rgba(255,255,255,0.04)' : P.tealMist}`,
                  }}>
                    <span style={{ fontSize: 22 }}>{item.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: P.teal, minWidth: 50 }}>{item.time}</span>
                    <span style={{ fontSize: 15, color: isNight ? '#E8E0D8' : P.text }}>{item.activity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Global Styles ──────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 3px; }
        input::placeholder { color: ${P.textMuted}; }
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 30px ${P.tealGlow}; }
          50% { box-shadow: 0 0 50px rgba(61,139,122,0.2); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes listeningPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(212,91,91,0.3); transform: scale(1); }
          50% { box-shadow: 0 0 35px rgba(212,91,91,0.5); transform: scale(1.05); }
        }
        @keyframes badgeBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.85); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
