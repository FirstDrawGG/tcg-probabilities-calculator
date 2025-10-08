import React, { useState, useRef, useEffect } from 'react';
import Icon from '../Icon';

const Tooltip = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, placement: 'right' });
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Default to right positioning
      let x = triggerRect.right + 8;
      let y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      let placement = 'right';

      // Check if tooltip would overflow viewport on the right
      if (x + tooltipRect.width > viewportWidth - 10) {
        // Position above instead
        x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        y = triggerRect.top - tooltipRect.height - 4;
        placement = 'top';

        // Ensure tooltip doesn't go off left edge when centered above
        if (x < 10) x = 10;
        if (x + tooltipRect.width > viewportWidth - 10) {
          x = viewportWidth - tooltipRect.width - 10;
        }
      }

      // Ensure tooltip doesn't go off top edge
      if (y < 10) {
        y = triggerRect.bottom + 4;
        placement = 'bottom';
      }

      // Ensure tooltip doesn't go off bottom edge
      if (y + tooltipRect.height > viewportHeight - 10) {
        y = viewportHeight - tooltipRect.height - 10;
      }

      setPosition({ x, y, placement });
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    setTimeout(updatePosition, 0);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    if (isVisible) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
      setTimeout(updatePosition, 0);
    }
  };

  useEffect(() => {
    if (isVisible) {
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '8px',
          flexShrink: 0,
          userSelect: 'none'
        }}
      >
        <Icon name="info" ariaLabel="More information" size={16} variant="secondary" />
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            backgroundColor: '#000000',
            border: `1px solid #333333`,
            color: '#ffffff',
            padding: 'var(--spacing-sm) 12px',
            borderRadius: '6px',
            fontSize: 'var(--font-body-size)',
            lineHeight: 'var(--font-body-line-height)',
            maxWidth: '240px',
            width: 'max-content',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Geist, sans-serif',
            wordWrap: 'break-word',
            whiteSpace: 'normal'
          }}
        >
          {text}
        </div>
      )}
    </>
  );
};

export default Tooltip;
