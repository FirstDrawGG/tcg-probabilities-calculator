import React, { useState, useRef } from 'react';

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

      let x = triggerRect.right + 8;
      let y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      let placement = 'right';

      if (x + tooltipRect.width > viewportWidth - 10) {
        x = triggerRect.left - tooltipRect.width - 8;
        placement = 'left';
        
        if (x < 10) {
          x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          y = triggerRect.top - tooltipRect.height - 8;
          placement = 'top';
          
          if (y < 10) {
            y = triggerRect.bottom + 8;
            placement = 'bottom';
          }
        }
      }

      if (y < 10) {
        y = 10;
      } else if (y + tooltipRect.height > viewportHeight - 10) {
        y = viewportHeight - tooltipRect.height - 10;
      }

      setPosition({ x, y, placement });
    }
  };

  React.useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-flex items-center cursor-help"
        style={{ marginLeft: '4px' }}
      >
        {children ? children : (
          <span style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Geist Regular, sans-serif'
          }}>
            ?
          </span>
        )}
      </span>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 rounded text-sm max-w-xs"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            backgroundColor: 'var(--bg-tooltip)',
            color: 'var(--text-tooltip)',
            fontSize: '12px',
            lineHeight: '16px',
            fontFamily: 'Geist Regular, sans-serif',
            border: '1px solid var(--border-main)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'normal',
            wordWrap: 'break-word'
          }}
        >
          {text}
        </div>
      )}
    </>
  );
};

const DeckInputs = ({ 
  deckSize,
  setDeckSize,
  handSize,
  setHandSize,
  errors,
  typography
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
          Deck size:
          <Tooltip text="Your total deck size, 40-60 cards" />
        </label>
        <input
          type="number"
          value={deckSize}
          onChange={(e) => setDeckSize(parseInt(e.target.value) || 0)}
          className={`w-full px-3 border ${
            errors.deckSize ? 'border-red-500' : ''
          }`}
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            borderRadius: '999px',
            height: '40px',
            cursor: 'text',
            ...typography.body
          }}
        />
        {errors.deckSize && (
          <p className="text-red-500 mt-1" style={typography.body}>{errors.deckSize}</p>
        )}
      </div>

      <div>
        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
          Hand size:
          <Tooltip text="Cards you draw to start the game. 5 going first, 6 going second" />
        </label>
        <input
          type="number"
          value={handSize}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 0;
            setHandSize(Math.min(value, 6)); // Max hand size is 6
          }}
          max="6"
          className={`w-full px-3 border ${
            errors.handSize ? 'border-red-500' : ''
          }`}
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            borderRadius: '999px',
            height: '40px',
            cursor: 'text',
            ...typography.body
          }}
        />
        {errors.handSize && (
          <p className="text-red-500 mt-1" style={typography.body}>{errors.handSize}</p>
        )}
      </div>
    </div>
  );
};

export default DeckInputs;