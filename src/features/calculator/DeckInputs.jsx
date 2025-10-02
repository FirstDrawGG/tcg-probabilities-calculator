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
        style={{ marginLeft: '8px' }}
      >
        {children ? children : (
          <span style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-main)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Geist Regular, sans-serif',
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none'
          }}>
            i
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
            backgroundColor: '#000000',
            border: '1px solid #333333',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '20px',
            maxWidth: '240px',
            width: 'max-content',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Geist Regular, sans-serif',
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
  typography,
  minHandSize = 1
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
          className={`enhanced-input w-full ${
            errors.deckSize ? 'border-red-500' : ''
          }`}
        />
        {errors.deckSize && (
          <p className="text-red-500 mt-1" style={typography.body}>{errors.deckSize}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
          Hand size:
          <Tooltip text="Cards you draw to start the game. 5 going first, 6 going second" />
        </label>
        <div className="flex space-x-2">
          <button
            onClick={() => setHandSize(5)}
            disabled={5 < minHandSize}
            style={{
              flex: 1,
              height: '40px',
              padding: '0 16px',
              borderRadius: '999px',
              border: '1px solid var(--border-main)',
              backgroundColor: handSize === 5 ? 'var(--bg-action)' : 'transparent',
              color: handSize === 5 ? 'var(--text-action)' : 'var(--text-main)',
              cursor: 5 < minHandSize ? 'not-allowed' : 'pointer',
              opacity: 5 < minHandSize ? 0.5 : 1,
              fontFamily: 'Geist Regular, sans-serif',
              fontSize: '14px',
              lineHeight: '20px',
              transition: 'opacity 0.2s'
            }}
          >
            5
          </button>
          <button
            onClick={() => setHandSize(6)}
            disabled={6 < minHandSize}
            style={{
              flex: 1,
              height: '40px',
              padding: '0 16px',
              borderRadius: '999px',
              border: '1px solid var(--border-main)',
              backgroundColor: handSize === 6 ? 'var(--bg-action)' : 'transparent',
              color: handSize === 6 ? 'var(--text-action)' : 'var(--text-main)',
              cursor: 6 < minHandSize ? 'not-allowed' : 'pointer',
              opacity: 6 < minHandSize ? 0.5 : 1,
              fontFamily: 'Geist Regular, sans-serif',
              fontSize: '14px',
              lineHeight: '20px',
              transition: 'opacity 0.2s'
            }}
          >
            6
          </button>
          {/* AC #7: Show current minimum if it's higher than 6 */}
          {minHandSize > 6 && (
            <button
              onClick={() => setHandSize(minHandSize)}
              style={{
                flex: 1,
                height: '40px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid var(--border-main)',
                backgroundColor: handSize === minHandSize ? 'var(--bg-action)' : 'transparent',
                color: handSize === minHandSize ? 'var(--text-action)' : 'var(--text-main)',
                cursor: 'pointer',
                fontFamily: 'Geist Regular, sans-serif',
                fontSize: '14px',
                lineHeight: '20px',
                transition: 'opacity 0.2s'
              }}
            >
              {minHandSize}
            </button>
          )}
        </div>
        {minHandSize > handSize && (
          <p className="text-yellow-500 mt-2" style={{...typography.body, fontSize: '14px'}}>
            Hand size must be at least {minHandSize} to accommodate your combo requirements
          </p>
        )}
      </div>
    </div>
  );
};

export default DeckInputs;