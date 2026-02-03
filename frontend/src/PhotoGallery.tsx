/**
 * WARDA - Photo Gallery Component (Tablet)
 * ==========================================
 * Displays photos shared by family members
 * Warda announces new photos via Polly TTS
 * Large, elderly-friendly photo viewer with swipe/tap navigation
 * 
 * Receives 'photo:new' events from useSocket hook
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================
interface Photo {
  id: string;
  photoUrl: string;
  photoKey?: string;
  caption: string;
  senderName: string;
  senderId?: string;
  timestamp: string;
  type?: string;
}

interface PhotoGalleryProps {
  residentId: string;
  residentName: string;
  photos: Photo[];
  onClose: () => void;
  onPhotoAnnounce?: (text: string) => void; // Trigger Polly TTS
  apiBase?: string;
}

// ============================================================
// STYLES
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    background: 'rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 16,
    padding: '12px 24px',
    color: 'white',
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // Gallery grid view
  gridContainer: {
    flex: 1,
    overflow: 'auto',
    padding: 20,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    maxWidth: 1200,
    margin: '0 auto',
  },
  gridItem: {
    borderRadius: 16,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    border: '2px solid transparent',
  },
  gridImage: {
    width: '100%',
    height: 200,
    objectFit: 'cover' as const,
    display: 'block',
  },
  gridCaption: {
    padding: '10px 14px',
    color: 'white',
    fontSize: 14,
  },
  gridSender: {
    color: '#5EEAD4',
    fontSize: 12,
    fontWeight: 600,
  },
  gridDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  // Full photo viewer
  viewer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
  },
  viewerImage: {
    maxWidth: '90%',
    maxHeight: '65vh',
    borderRadius: 20,
    objectFit: 'contain' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  viewerCaption: {
    color: 'white',
    fontSize: 24,
    fontWeight: 600,
    textAlign: 'center' as const,
    marginTop: 20,
    maxWidth: 600,
    lineHeight: 1.4,
  },
  viewerSender: {
    color: '#5EEAD4',
    fontSize: 16,
    marginTop: 8,
  },
  viewerDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  navBtn: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: '50%',
    width: 70,
    height: 70,
    color: 'white',
    fontSize: 32,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnLeft: {
    left: 20,
  },
  navBtnRight: {
    right: 20,
  },
  bottomBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    padding: '16px 24px',
    background: 'rgba(255,255,255,0.05)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  bottomBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: '14px 28px',
    color: 'white',
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.5)',
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
  },
  // New photo notification
  newPhotoBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    background: '#EF4444',
    color: 'white',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 700,
    animation: 'pulse 2s infinite',
  },
  counter: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 12,
  },
};


// ============================================================
// COMPONENT
// ============================================================
const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  residentId,
  residentName,
  photos,
  onClose,
  onPhotoAnnounce,
  apiBase = '',
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'viewer'>('grid');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Format date for elderly - "Monday, 3 February" style
  const formatDate = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`;
      if (diffHours < 48) return 'Yesterday';

      return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return '';
    }
  }, []);

  // Open photo in viewer
  const openPhoto = (index: number) => {
    setCurrentIndex(index);
    setViewMode('viewer');
  };

  // Navigate photos
  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewMode === 'viewer') {
        if (e.key === 'ArrowLeft') prevPhoto();
        if (e.key === 'ArrowRight') nextPhoto();
        if (e.key === 'Escape') setViewMode('grid');
      }
      if (e.key === 'Escape' && viewMode === 'grid') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, photos.length]);

  // Handle image load error
  const handleImageError = (photoId: string) => {
    setImageErrors((prev) => new Set(prev).add(photoId));
  };

  // ============================================================
  // RENDER: Empty State
  // ============================================================
  if (photos.length === 0) {
    return (
      <div style={styles.overlay}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>📸</span>
            <span>My Photos</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <div style={styles.emptyState as any}>
          <div style={styles.emptyIcon}>📷</div>
          <div style={styles.emptyText}>No photos yet</div>
          <div style={styles.emptySubtext}>
            When your family sends photos, they'll appear here!
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Photo Viewer (full screen single photo)
  // ============================================================
  if (viewMode === 'viewer') {
    const photo = photos[currentIndex];
    if (!photo) {
      setViewMode('grid');
      return null;
    }

    return (
      <div style={styles.overlay}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>📸</span>
            <span>From {photo.senderName}</span>
          </div>
          <button
            style={styles.closeBtn}
            onClick={() => setViewMode('grid')}
          >
            ← Back to Gallery
          </button>
        </div>

        <div style={styles.viewer as any}>
          {/* Left arrow */}
          {photos.length > 1 && (
            <button
              style={{ ...styles.navBtn, ...styles.navBtnLeft } as any}
              onClick={prevPhoto}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          {/* Photo */}
          {!imageErrors.has(photo.id) ? (
            <img
              src={photo.photoUrl}
              alt={photo.caption || 'Family photo'}
              style={styles.viewerImage}
              onError={() => handleImageError(photo.id)}
            />
          ) : (
            <div
              style={{
                ...styles.viewerImage,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.08)',
                fontSize: 60,
                width: 400,
                height: 300,
              }}
            >
              📷
            </div>
          )}

          {/* Right arrow */}
          {photos.length > 1 && (
            <button
              style={{ ...styles.navBtn, ...styles.navBtnRight } as any}
              onClick={nextPhoto}
              aria-label="Next photo"
            >
              ›
            </button>
          )}

          {/* Caption */}
          {photo.caption && (
            <div style={styles.viewerCaption as any}>{photo.caption}</div>
          )}
          <div style={styles.viewerSender}>
            💝 From {photo.senderName}
          </div>
          <div style={styles.viewerDate}>{formatDate(photo.timestamp)}</div>
          <div style={styles.counter}>
            {currentIndex + 1} of {photos.length}
          </div>
        </div>

        <div style={styles.bottomBar}>
          {photos.length > 1 && (
            <>
              <button style={styles.bottomBtn} onClick={prevPhoto}>
                ← Previous
              </button>
              <button style={styles.bottomBtn} onClick={nextPhoto}>
                Next →
              </button>
            </>
          )}
          <button
            style={{ ...styles.bottomBtn, background: '#0D9488', borderColor: '#14B8A6' }}
            onClick={() => {
              if (onPhotoAnnounce && photo.caption) {
                onPhotoAnnounce(
                  `${photo.senderName} says: ${photo.caption}`
                );
              }
            }}
          >
            🔊 Read Caption
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Grid Gallery View
  // ============================================================
  return (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span>📸</span>
          <span>My Photos</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 400, marginLeft: 8 }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          ✕ Close
        </button>
      </div>

      <div style={styles.gridContainer}>
        <div style={styles.grid}>
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              style={styles.gridItem}
              onClick={() => openPhoto(index)}
              role="button"
              tabIndex={0}
              aria-label={`Photo from ${photo.senderName}`}
            >
              {!imageErrors.has(photo.id) ? (
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || 'Family photo'}
                  style={styles.gridImage}
                  onError={() => handleImageError(photo.id)}
                  loading="lazy"
                />
              ) : (
                <div
                  style={{
                    ...styles.gridImage,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    fontSize: 48,
                  }}
                >
                  📷
                </div>
              )}
              <div style={styles.gridCaption}>
                <div style={styles.gridSender}>
                  💝 {photo.senderName}
                </div>
                {photo.caption && (
                  <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    {photo.caption}
                  </div>
                )}
                <div style={styles.gridDate}>
                  {formatDate(photo.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhotoGallery;
