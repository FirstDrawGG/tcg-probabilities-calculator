import React, { useState, useEffect, useRef } from 'react';
import { Button } from './';

/**
 * Toast Notification Component
 * Auto-dismissing notification with slide-in animation
 */
const Toast = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after 3 seconds
    timerRef.current = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      onClick={handleClose}
      className="fixed top-4 right-4 z-50 cursor-pointer"
      style={{
        transform: `translateX(${isVisible && !isExiting ? '0' : '120%'})`,
        opacity: isVisible && !isExiting ? '1' : '0',
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out'
      }}
    >
      <div
        className="relative flex items-center px-4 py-3 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: `1px solid var(--border-main)`,
          boxShadow: '0 4px 12px rgba(255, 255, 255, 0.05)',
          minWidth: '200px'
        }}
      >
        <span style={{
          color: 'var(--text-main)',
          fontSize: '14px',
          fontFamily: 'Geist, sans-serif',
          marginRight: '24px'
        }}>
          {message}
        </span>
        <Button
          className="absolute top-2 right-2 hover:opacity-80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          variant="secondary"
          size="small"
          style={{
            fontSize: '16px',
            lineHeight: '16px',
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            height: 'auto'
          }}
        >
          ×
        </Button>
      </div>
    </div>
  );
};

export default Toast;
