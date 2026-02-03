/**
 * WARDA — Staff Alert Inbox
 * ==========================
 * Real-time alert view for staff dashboard (port 3003)
 * 
 * Connects to:
 *   WebSocket: staff:{careHomeId} room → alert:new, alert:resolved
 *   REST API:  GET /api/alerts/:careHomeId
 *              GET /api/alerts/unresolved/:careHomeId
 *              PATCH /api/alerts/:id/resolve
 *              GET /api/alerts/stats/:careHomeId
 * 
 * Features:
 *   - Live alert feed with auto-scroll
 *   - Sound + visual notification on new critical/help alerts
 *   - Severity badges (critical/high/medium/low)
 *   - Alert type icons (HELP_BUTTON, MOOD, HEALTH, SYSTEM)
 *   - One-click resolve with staff name
 *   - Filter by type, severity, resolved status
 *   - Stats summary bar (total, unresolved, critical)
 *   - Tablet online/offline status
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ============================================================
// TYPES
// ============================================================

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  residentId?: string;
  residentName?: string;
  careHomeId?: string;
  mood?: string;
  timestamp: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  isNew?: boolean; // local UI flag for animation
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string;
    roomNumber?: string;
  };
}

interface AlertStats {
  total: number;
  unresolved: number;
  critical: number;
  byType: Record<string, number>;
  period: string;
}

interface StaffAlertInboxProps {
  careHomeId: string;
  careHomeName?: string;
  staffId: string;
  staffName: string;
  apiBase?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string; priority: number }> = {
  critical: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '🚨', label: 'CRITICAL', priority: 4 },
  high:     { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', icon: '🔴', label: 'HIGH', priority: 3 },
  medium:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '🟡', label: 'MEDIUM', priority: 2 },
  low:      { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: '🟢', label: 'LOW', priority: 1 },
};

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  HELP_BUTTON: { icon: '🆘', label: 'Help Button', color: '#DC2626' },
  MOOD:        { icon: '💭', label: 'Mood Alert', color: '#7C3AED' },
  HEALTH:      { icon: '❤️', label: 'Health', color: '#EA580C' },
  SYSTEM:      { icon: '⚙️', label: 'System', color: '#6B7280' },
  BEHAVIOUR:   { icon: '👁️', label: 'Behaviour', color: '#0891B2' },
  SAFETY:      { icon: '🛡️', label: 'Safety', color: '#BE185D' },
};

// ============================================================
// COMPONENT
// ============================================================

const StaffAlertInbox: React.FC<StaffAlertInboxProps> = ({
  careHomeId,
  careHomeName = 'Care Home',
  staffId,
  staffName,
  apiBase = 'https://api.meetwarda.com',
}) => {
  // State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [filter, setFilter] = useState<{ type: string; severity: string; resolved: string }>({
    type: 'ALL', severity: 'ALL', resolved: 'unresolved',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [tabletStatus, setTabletStatus] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ============================================================
  // SOUND NOTIFICATION
  // ============================================================
  const playAlertSound = useCallback((severity: string) => {
    if (!soundEnabled) return;
    try {
      // Use Web Audio API for alert sounds
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      
      if (severity === 'critical') {
        // Urgent: two quick high beeps
        oscillator.frequency.value = 880;
        gain.gain.value = 0.3;
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.stop(ctx.currentTime + 0.15);
        // Second beep
        setTimeout(() => {
          const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx2.destination);
          osc2.frequency.value = 880;
          gain2.gain.value = 0.3;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.15);
          osc2.stop(ctx2.currentTime + 0.15);
        }, 200);
      } else {
        // Normal: single gentle tone
        oscillator.frequency.value = 520;
        gain.gain.value = 0.15;
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio not available — ignore
    }
  }, [soundEnabled]);

  // ============================================================
  // FETCH ALERTS (REST)
  // ============================================================
  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.type !== 'ALL') params.append('type', filter.type);
      if (filter.severity !== 'ALL') params.append('severity', filter.severity);
      if (filter.resolved !== 'all') params.append('resolved', filter.resolved === 'resolved' ? 'true' : 'false');
      params.append('limit', '100');

      const url = filter.resolved === 'unresolved'
        ? `${apiBase}/api/alerts/unresolved/${careHomeId}`
        : `${apiBase}/api/alerts/${careHomeId}?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setAlerts(data.alerts || []);
        setError(null);
      } else {
        setError('Failed to load alerts');
      }
    } catch (err) {
      setError('Cannot reach server');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, careHomeId, filter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/alerts/stats/${careHomeId}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      // Stats are non-critical
    }
  }, [apiBase, careHomeId]);

  // ============================================================
  // RESOLVE ALERT
  // ============================================================
  const resolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: staffName }),
      });
      const data = await res.json();

      if (data.success) {
        setAlerts(prev => prev.map(a =>
          a.id === alertId
            ? { ...a, isResolved: true, resolvedBy: staffName, resolvedAt: new Date().toISOString() }
            : a
        ));
        fetchStats(); // Refresh stats
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // ============================================================
  // WEBSOCKET CONNECTION
  // ============================================================
  useEffect(() => {
    const socket = io(apiBase, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Authenticate as staff
      socket.emit('auth', {
        userId: staffId,
        role: 'staff',
        careHomeId,
        name: staffName,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('auth:success', () => {
      console.log('✅ Staff alert inbox connected to WebSocket');
    });

    // ---- REAL-TIME ALERT ----
    socket.on('alert:new', (alertPayload: Alert) => {
      // Add to top of list with animation flag
      setAlerts(prev => {
        const exists = prev.some(a => a.id === alertPayload.id);
        if (exists) return prev;
        return [{ ...alertPayload, isNew: true }, ...prev];
      });

      setNewAlertCount(prev => prev + 1);
      playAlertSound(alertPayload.severity);

      // Clear "new" flag after animation
      setTimeout(() => {
        setAlerts(prev => prev.map(a =>
          a.id === alertPayload.id ? { ...a, isNew: false } : a
        ));
      }, 3000);

      // Refresh stats
      fetchStats();
    });

    // ---- ALERT RESOLVED (by another staff) ----
    socket.on('alert:resolved', (data: { alertId: string; resolvedBy: string; resolvedAt: string }) => {
      setAlerts(prev => prev.map(a =>
        a.id === data.alertId
          ? { ...a, isResolved: true, resolvedBy: data.resolvedBy, resolvedAt: data.resolvedAt }
          : a
      ));
      fetchStats();
    });

    // ---- TABLET STATUS ----
    socket.on('tablet:status', (data: { residentId: string; status: string }) => {
      setTabletStatus(prev => ({ ...prev, [data.residentId]: data.status }));
    });

    return () => {
      socket.disconnect();
    };
  }, [apiBase, careHomeId, staffId, staffName, playAlertSound, fetchStats]);

  // ============================================================
  // INITIAL LOAD + FILTER CHANGE
  // ============================================================
  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [fetchAlerts, fetchStats]);

  // ============================================================
  // TIME FORMATTING
  // ============================================================
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // ============================================================
  // FILTERED + SORTED ALERTS
  // ============================================================
  const filteredAlerts = alerts
    .filter(a => {
      if (filter.type !== 'ALL' && a.type !== filter.type) return false;
      if (filter.severity !== 'ALL' && a.severity !== filter.severity) return false;
      return true;
    })
    .sort((a, b) => {
      // Unresolved first, then by severity, then by time
      if (!a.isResolved && b.isResolved) return -1;
      if (a.isResolved && !b.isResolved) return 1;
      const aPriority = SEVERITY_CONFIG[a.severity]?.priority || 0;
      const bPriority = SEVERITY_CONFIG[b.severity]?.priority || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#F8FAFB',
      minHeight: '100vh',
      padding: '24px',
      color: '#1E293B',
    }}>

      {/* ---- HEADER ---- */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#0F172A' }}>
            🔔 Alert Inbox
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: '4px 0 0' }}>
            {careHomeName} — Real-time alerts from residents
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              background: soundEnabled ? '#ECFDF5' : '#F8FAFB',
              color: soundEnabled ? '#059669' : '#94A3B8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {soundEnabled ? '🔊' : '🔇'} Sound {soundEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Connection status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: isConnected ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${isConnected ? '#A7F3D0' : '#FECACA'}`,
            fontSize: 13,
            fontWeight: 600,
            color: isConnected ? '#059669' : '#DC2626',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#059669' : '#DC2626',
              display: 'inline-block',
              animation: isConnected ? 'pulse 2s infinite' : 'none',
            }} />
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* ---- STATS BAR ---- */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { label: 'Total (7 days)', value: stats.total, icon: '📊', color: '#3B82F6', bg: '#EFF6FF' },
            { label: 'Unresolved', value: stats.unresolved, icon: '⏳', color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Critical', value: stats.critical, icon: '🚨', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Help Requests', value: stats.byType?.HELP_BUTTON || 0, icon: '🆘', color: '#7C3AED', bg: '#F5F3FF' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: 12,
              padding: '16px 18px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: stat.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- FILTERS ---- */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Status filter */}
        <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: 8, padding: 3 }}>
          {[
            { key: 'unresolved', label: '⏳ Active' },
            { key: 'resolved', label: '✅ Resolved' },
            { key: 'all', label: '📋 All' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(prev => ({ ...prev, resolved: f.key }))}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: filter.resolved === f.key ? 'white' : 'transparent',
                color: filter.resolved === f.key ? '#0F172A' : '#64748B',
                fontWeight: filter.resolved === f.key ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: filter.resolved === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={filter.type}
          onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            fontSize: 13,
            color: '#1E293B',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.icon} {val.label}</option>
          ))}
        </select>

        {/* Severity filter */}
        <select
          value={filter.severity}
          onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            fontSize: 13,
            color: '#1E293B',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">All Severity</option>
          {Object.entries(SEVERITY_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.icon} {val.label}</option>
          ))}
        </select>

        {/* Alert count */}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748B' }}>
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
          {newAlertCount > 0 && (
            <span style={{
              marginLeft: 8,
              padding: '2px 8px',
              borderRadius: 10,
              background: '#DC2626',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
            }}>
              +{newAlertCount} new
            </span>
          )}
        </div>
      </div>

      {/* ---- ALERT FEED ---- */}
      <div
        ref={feedRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: '#94A3B8',
            fontSize: 15,
          }}>
            Loading alerts...
          </div>
        )}

        {!isLoading && error && (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: '#DC2626',
            fontSize: 15,
          }}>
            ⚠️ {error}
            <br />
            <button
              onClick={fetchAlerts}
              style={{
                marginTop: 12,
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && filteredAlerts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: '#94A3B8',
            fontSize: 15,
          }}>
            {filter.resolved === 'unresolved' ? (
              <>
                ✅ No active alerts — all clear!
                <br />
                <span style={{ fontSize: 13, color: '#CBD5E1' }}>
                  New alerts will appear here in real-time
                </span>
              </>
            ) : (
              <>No alerts match your filters.</>
            )}
          </div>
        )}

        {filteredAlerts.map((alert) => {
          const sevConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
          const typeConfig = TYPE_CONFIG[alert.type] || TYPE_CONFIG.SYSTEM;
          const residentName = alert.residentName
            || alert.user?.preferredName
            || (alert.user ? `${alert.user.firstName} ${alert.user.lastName}` : 'Unknown');
          const roomNumber = alert.user?.roomNumber;
          const isExpanded = expandedAlert === alert.id;

          return (
            <div
              key={alert.id}
              onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
              style={{
                background: alert.isNew ? sevConfig.bg : 'white',
                borderRadius: 12,
                padding: '16px 18px',
                border: `2px solid ${alert.isNew ? sevConfig.border : alert.isResolved ? '#E2E8F0' : sevConfig.border}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: alert.isResolved ? 0.6 : 1,
                animation: alert.isNew ? 'slideIn 0.4s ease-out' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* New alert pulse indicator */}
              {alert.isNew && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  background: sevConfig.color,
                  animation: 'pulse 1.5s infinite',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Type icon */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: sevConfig.bg,
                  border: `2px solid ${sevConfig.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}>
                  {typeConfig.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Top row: type + severity + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: typeConfig.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {typeConfig.label}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: sevConfig.color,
                      background: sevConfig.bg,
                      border: `1px solid ${sevConfig.border}`,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                    }}>
                      {sevConfig.icon} {sevConfig.label}
                    </span>
                    {alert.isResolved && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#059669',
                        background: '#ECFDF5',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        ✅ Resolved
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>

                  {/* Resident name + room */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                    {residentName}
                    {roomNumber && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>
                        Room {roomNumber}
                      </span>
                    )}
                  </div>

                  {/* Alert message */}
                  <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                    {alert.message}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 13,
                      color: '#64748B',
                    }}>
                      <div><strong>Alert ID:</strong> {alert.id}</div>
                      <div><strong>Time:</strong> {new Date(alert.timestamp).toLocaleString('en-GB')}</div>
                      {alert.mood && <div><strong>Detected mood:</strong> {alert.mood}</div>}
                      {alert.isResolved && (
                        <>
                          <div><strong>Resolved by:</strong> {alert.resolvedBy}</div>
                          <div><strong>Resolved at:</strong> {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString('en-GB') : 'Unknown'}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Resolve button */}
                {!alert.isResolved && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveAlert(alert.id);
                    }}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: '2px solid #A7F3D0',
                      background: '#ECFDF5',
                      color: '#059669',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.background = '#059669';
                      (e.target as HTMLButtonElement).style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.background = '#ECFDF5';
                      (e.target as HTMLButtonElement).style.color = '#059669';
                    }}
                  >
                    ✅ Resolve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- CSS ANIMATIONS ---- */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
};

export default StaffAlertInbox;
