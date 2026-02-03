/**
 * WARDA - Photo Notification Overlay (Tablet)
 * =============================================
 * Full-screen overlay when a new photo arrives from family
 * Warda announces: "Sarah shared a photo with you!"
 * Shows the photo with caption
 * Buttons: View Gallery | Say Thank You | Dismiss
 */

import React, { useState, useEffect } from 'react';

interface PhotoNotification {
  id: string;
  photoUrl: string;
  photoKey?: string;
  caption: string;
  senderName: string;
  timestamp: string;
}

interface PhotoOverlayProps {
  photo: PhotoNotification;
  onViewGallery: () => void;
  onReply: (message: string) => void;
  onDismiss: () => void;
  onAnnounce?: (text: string) => void; // Trigger Polly TTS
}

const PhotoOverlay: React.FC<PhotoOverlayProps> = ({
  photo,
  onViewGallery,
  onReply,
  onDismiss,
  onAnnounce,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showThankOptions, setShowThankOptions] = useState(false);

  // Announce when photo arrives
  useEffect(() => {
    if (onAnnounce) {
      const announcement = photo.caption
        ? `${photo.senderName} shared a photo with you! They said: ${photo.caption}`
        : `${photo.senderName} shared a photo with you!`;
      onAnnounce(announcement);
    }
  }, [photo.id]);

  const thankYouMessages = [
    `Thank you ${photo.senderName}, lovely photo! 💕`,
    `That's wonderful, thank you dear! 😊`,
    `How lovely! Thank you for sharing! 💝`,
    `Beautiful! Give everyone my love! ❤️`,
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Warda's announcement */}
      <div
        style={{
          background: 'rgba(94, 234, 212, 0.15)',
          border: '2px solid rgba(94, 234, 212, 0.3)',
          borderRadius: 20,
          padding: '14px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 28 }}>🌹</span>
        <span style={{ color: '#5EEAD4', fontSize: 20, fontWeight: 600 }}>
          {photo.senderName} shared a photo!
        </span>
      </div>

      {/* Photo */}
      <div
        style={{
          position: 'relative',
          maxWidth: '80%',
          maxHeight: '50vh',
        }}
      >
        {!imageLoaded && (
          <div
            style={{
              width: 400,
              height: 300,
              borderRadius: 24,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 60,
            }}
          >
            📸
          </div>
        )}
        <img
          src={photo.photoUrl}
          alt={photo.caption || 'Photo from family'}
          style={{
            maxWidth: '100%',
            maxHeight: '50vh',
            borderRadius: 24,
            objectFit: 'contain',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            display: imageLoaded ? 'block' : 'none',
          }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)} // Show broken state
        />
      </div>

      {/* Caption */}
      {photo.caption && (
        <div
          style={{
            color: 'white',
            fontSize: 22,
            fontWeight: 600,
            textAlign: 'center',
            marginTop: 20,
            maxWidth: 500,
            lineHeight: 1.4,
          }}
        >
          "{photo.caption}"
        </div>
      )}

      <div
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 14,
          marginTop: 8,
        }}
      >
        💝 From {photo.senderName}
      </div>

      {/* Action buttons */}
      {!showThankOptions ? (
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 32,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={onViewGallery}
            style={{
              background: '#0D9488',
              border: '2px solid #14B8A6',
              borderRadius: 20,
              padding: '16px 32px',
              color: 'white',
              fontSize: 20,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            📸 View All Photos
          </button>

          <button
            onClick={() => setShowThankOptions(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: 20,
              padding: '16px 32px',
              color: 'white',
              fontSize: 20,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            💕 Say Thank You
          </button>

          <button
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 20,
              padding: '16px 32px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 18,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✓ Done
          </button>
        </div>
      ) : (
        /* Thank you options */
        <div style={{ marginTop: 28, maxWidth: 600 }}>
          <div
            style={{
              color: '#5EEAD4',
              fontSize: 16,
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            Choose a reply for {photo.senderName}:
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {thankYouMessages.map((msg, i) => (
              <button
                key={i}
                onClick={() => {
                  onReply(msg);
                  setShowThankOptions(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(255,255,255,0.15)',
                  borderRadius: 16,
                  padding: '14px 24px',
                  color: 'white',
                  fontSize: 18,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {msg}
              </button>
            ))}
            <button
              onClick={() => setShowThankOptions(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 16,
                cursor: 'pointer',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoOverlay;
