import React, { useState, useRef, useEffect } from 'react';
import CardImage from '../../components/CardImage';

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

  useEffect(() => {
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
            backgroundColor: '#333333',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Geist Regular, sans-serif'
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
            color: '#ffffff',
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

const TypewriterText = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      intervalRef.current = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50);
    } else if (onComplete) {
      onComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [currentIndex, text, onComplete]);

  return <span>{displayedText}</span>;
};

const ResultsDisplay = ({ 
  results,
  dashboardValues,
  openingHand,
  isRefreshing,
  refreshOpeningHand,
  generatedTitle,
  shareableUrl,
  handleCopyLink,
  showToast,
  typography,
  testHandFromDecklist,
  setTestHandFromDecklist,
  ydkCards,
  combos
}) => {
  console.log('📊 ResultsDisplay rendered with openingHand:', openingHand);
  
  // AC#6: Check if toggle should be disabled due to non-decklist cards
  const hasNonDecklistCards = ydkCards && ydkCards.length > 0 && combos.some(combo => 
    combo.cards.some(card => {
      if (!card.starterCard.trim()) return false;
      return !ydkCards.some(ydkCard => 
        ydkCard.name.toLowerCase() === card.starterCard.toLowerCase()
      );
    })
  );
  
  const isToggleDisabled = hasNonDecklistCards;

  const generateResultText = (result) => {
    const cards = result.cards;
    const probability = result.probability;
    
    if (!cards || cards.length === 0) {
      return `Calculation error: ${probability.toFixed(2)}%`;
    }
    
    if (cards.length === 1) {
      const card = cards[0];
      if (card.minCopiesInHand === card.maxCopiesInHand) {
        return `Chances of seeing exactly ${card.minCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      } else {
        return `Chances of seeing between ${card.minCopiesInHand} and ${card.maxCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      }
    } else {
      // Multi-card combo: 1st AND 2nd AND/OR 3rd+ cards
      let resultText = "Chances of seeing ";
      
      // Build the text based on new logic structure
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cardText = card.minCopiesInHand === card.maxCopiesInHand 
          ? `exactly ${card.minCopiesInHand} copies of ${card.starterCard}`
          : `between ${card.minCopiesInHand} and ${card.maxCopiesInHand} copies of ${card.starterCard}`;
        
        if (i === 0) {
          // First card - no logic operator
          resultText += cardText;
        } else if (i === 1) {
          // Second card - always AND with first
          resultText += `, AND ${cardText}`;
        } else {
          // Third+ cards - use their logic operator
          const logicOp = card.logicOperator || 'AND';
          if (logicOp === 'OR') {
            resultText += `, OR ${cardText}`;
          } else {
            resultText += `, AND ${cardText}`;
          }
        }
      }
      
      resultText += ` in your opening hand: ${probability.toFixed(2)}%`;
      return resultText;
    }
  };

  return (
    <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
      <h2 className="mb-4" style={typography.h2}>Calculation Dashboard</h2>
      

      {/* Opening Hand Display */}
      <div className="mt-6">
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <div className="flex items-center gap-2">
            <h3 style={{...typography.h3, color: 'var(--text-main)'}}>Opening hand</h3>
            {ydkCards && ydkCards.length > 0 && (
              <label className={`flex items-center gap-1 ${isToggleDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={testHandFromDecklist}
                  onChange={(e) => !isToggleDisabled && setTestHandFromDecklist(e.target.checked)}
                  disabled={isToggleDisabled}
                  style={{
                    opacity: isToggleDisabled ? 0.5 : 1
                  }}
                />
                <span style={{
                  ...typography.body, 
                  color: isToggleDisabled ? 'var(--text-tertiary)' : 'var(--text-secondary)', 
                  fontSize: '14px',
                  opacity: isToggleDisabled ? 0.5 : 1
                }}>
                  Test hand from decklist
                </span>
              </label>
            )}
          </div>
          <button
            onClick={refreshOpeningHand}
            disabled={isRefreshing}
            className={`px-4 py-2 font-medium transition-colors ${
              isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
            }`}
            style={{ 
              backgroundColor: 'transparent', 
              color: 'var(--text-main)',
              border: 'none',
              borderRadius: '20px',
              fontSize: '14px',
              lineHeight: '20px',
              fontFamily: 'Geist Regular, sans-serif'
            }}
          >
            {isRefreshing ? 'Shuffling...' : 'Refresh'}
          </button>
        </div>
        
        <p className="mb-4" style={{...typography.body, color: 'var(--text-secondary)'}}>
          {testHandFromDecklist && ydkCards && ydkCards.length > 0 && !isToggleDisabled
            ? '*This is a simulated opening hand drawn from your uploaded decklist'
            : '*This is a probabilistic example of your opening hand based on defined combos'
          }
        </p>
        
        <div 
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'flex-start'
          }}
        >
          {/* AC#7: Lazy-load opening hand display */}
          {isRefreshing ? (
            // Show loading placeholders during refresh
            Array(5).fill(null).map((_, index) => (
              <div
                key={`loading-${index}`}
                style={{
                  width: '80px',
                  height: '112px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}
              >
                <span style={{...typography.body, color: 'var(--text-secondary)', fontSize: '12px'}}>
                  ...
                </span>
              </div>
            ))
          ) : (
            openingHand.map((cardData, index) => {
              console.log(`🎴 Rendering card ${index}:`, cardData);
              return <CardImage key={index} cardData={cardData} size="small" />;
            })
          )}
        </div>
      </div>

      {results.individual.length > 0 && (
        <div className="mt-6 space-y-2">
          {/* Combined probability result - only show if multiple combos */}
          {results.combined !== null && (
            <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-action)', border: `1px solid var(--border-main)` }}>
              <div className="flex items-center">
                <p className="font-semibold" style={{...typography.body, color: 'var(--text-action)'}}>
                  Chances of opening any of the desired combos: {results.combined.toFixed(2)}%
                </p>
                <Tooltip text="Chance of opening ANY of your defined combos. Shows overall deck consistency (hitting at least one combo from ones you defined)" />
              </div>
            </div>
          )}
          
          {/* Individual combo results */}
          {results.individual.map((result, index) => (
            <div key={result.id} className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid var(--border-main)` }}>
              <p className="font-semibold" style={typography.body}>
                {generateResultText(result)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sharing Section */}
      {results.individual.length > 0 && generatedTitle && (
        <div className="mt-6">
          <h2 className="mb-4" style={typography.h2}>Deck list link</h2>
          
          <div className="mb-4">
            <h3 className="mb-2" style={typography.h3}>
              <TypewriterText text={generatedTitle} />
            </h3>
          </div>
          
          <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid var(--border-main)` }}>
            <div className="flex items-center mb-2">
              <p style={typography.body}>Shareable link:</p>
              <Tooltip text="Export your calculation as a link to share with your testing group or save your work for later" />
            </div>
            <p style={{...typography.body, color: 'var(--text-secondary)', marginBottom: '8px'}}>Save & share your deck ratios</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareableUrl}
                readOnly
                className="flex-1 px-3 border"
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: `1px solid var(--border-main)`,
                  color: 'var(--text-main)',
                  borderRadius: '999px',
                  height: '40px',
                  cursor: 'text',
                  ...typography.body
                }}
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--bg-action)', 
                  border: 'none',
                  borderRadius: '999px',
                  height: '40px',
                  ...typography.body,
                  color: 'var(--text-black)'
                }}
              >
                Copy
              </button>
            </div>
          </div>
          
          {showToast && (
            <div 
              className="fixed bottom-4 right-4 px-4 py-2 rounded-md"
              style={{
                backgroundColor: 'var(--bg-action)',
                color: 'var(--text-action)',
                zIndex: 1000,
                ...typography.body
              }}
            >
              Link copied!
            </div>
          )}
        </div>
      )}
      
      {/* Dashboard Details */}
      <div className="mt-6 space-y-2">
        <p style={typography.body}>
          <span className="font-medium">Deck size:</span> {dashboardValues.deckSize}
        </p>
        <p style={typography.body}>
          <span className="font-medium">Hand size:</span> {dashboardValues.handSize}
        </p>
        
        <div className="grid grid-cols-3 gap-4">
          {dashboardValues.combos.map((combo, index) => (
            <div key={combo.id} className="pl-4 border-l-2" style={{ borderColor: 'var(--border-secondary)' }}>
              <p className="font-medium mb-2" style={typography.body}>{combo.name}</p>
              {combo.cards.map((card, cardIndex) => (
                <div key={cardIndex} className={cardIndex > 0 ? 'mt-2' : ''}>
                  <p style={typography.body}>
                    <span className="font-medium">{card.starterCard || '-'}</span>
                  </p>
                  <p style={typography.body}>
                    <span className="font-medium">Copies:</span> {card.startersInDeck}
                  </p>
                  <p style={typography.body}>
                    <span className="font-medium">Min:</span> {card.minCopiesInHand}
                  </p>
                  <p style={typography.body}>
                    <span className="font-medium">Max:</span> {card.maxCopiesInHand}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;