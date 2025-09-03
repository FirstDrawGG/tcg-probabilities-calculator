import React from 'react';
import CardImage from './CardImage';

const DecklistImage = ({ 
  ydkCards, 
  ydkCardCounts, 
  uploadedYdkFile, 
  typography 
}) => {
  // Don't show anything if no YDK file is uploaded
  if (!uploadedYdkFile || !ydkCards || ydkCards.length === 0) {
    return null;
  }

  // AC #6, #7: Create ordered list of cards respecting quantities from YDK file
  const orderedCards = [];
  
  // Parse YDK file content to get main deck cards in exact order they appear
  if (uploadedYdkFile && uploadedYdkFile.content) {
    const lines = uploadedYdkFile.content.split('\n').map(line => line.trim()).filter(line => line);
    let isMainDeck = false;
    
    // First pass: collect card IDs in order from main deck section
    const mainDeckCardIds = [];
    for (const line of lines) {
      if (line === '#main') {
        isMainDeck = true;
        continue;
      }
      if (line === '#extra' || line === '!side') {
        isMainDeck = false;
        continue;
      }
      
      if (isMainDeck && /^\d+$/.test(line)) {
        mainDeckCardIds.push(line);
      }
    }
    
    // Second pass: convert card IDs to card objects, maintaining order
    for (const cardId of mainDeckCardIds) {
      const card = ydkCards.find(c => c.id?.toString() === cardId);
      if (card) {
        orderedCards.push({
          name: card.name,
          id: card.id,
          isCustom: card.isCustom || false
        });
      } else {
        // If card not found in database, create a placeholder
        orderedCards.push({
          name: `Unknown Card (${cardId})`,
          id: cardId,
          isCustom: true
        });
      }
    }
  }

  // Fallback: if we couldn't parse the order from content, use ydkCardCounts
  if (orderedCards.length === 0) {
    ydkCards.forEach(card => {
      const count = ydkCardCounts[card.name] || 1;
      for (let i = 0; i < count; i++) {
        orderedCards.push({
          name: card.name,
          id: card.id,
          isCustom: card.isCustom || false
        });
      }
    });
  }

  // AC #8, #9: Group cards into rows of max 10 cards each
  const cardsPerRow = 10;
  const rows = [];
  for (let i = 0; i < orderedCards.length; i += cardsPerRow) {
    rows.push(orderedCards.slice(i, i + cardsPerRow));
  }

  return (
    <div className="mb-4">
      {/* AC #3: Decklist image section header */}
      <div className="mb-3">
        <h4 style={{...typography.h3, color: 'var(--text-main)', margin: 0, fontSize: '16px'}}>
          Decklist image
        </h4>
      </div>
      
      {/* AC #5, #8, #9: Display cards with overlapping and row breaking */}
      <div className="space-y-4 w-full">
        {rows.map((row, rowIndex) => (
          <div 
            key={rowIndex} 
            className="flex items-center justify-start w-full"
            style={{
              position: 'relative',
              height: '87px', // AC #10: Match small card height from CardImage
              overflow: 'visible',
              minWidth: '100%'
            }}
          >
            {row.map((card, cardIndex) => {
              // AC #8: Overlay cards horizontally left-to-right with better spacing for full width
              const totalCards = row.length;
              const cardWidth = 60; // AC #10: Match small card width from CardImage
              const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 100, 800) : 700;
              const availableWidth = containerWidth - cardWidth;
              const overlapOffset = totalCards > 1 ? Math.max(8, availableWidth / (totalCards - 1)) : 0;
              const leftPosition = cardIndex * Math.min(overlapOffset, cardWidth * 0.8);
              
              return (
                <div
                  key={`${card.id}-${cardIndex}-${rowIndex}`}
                  style={{
                    position: 'absolute',
                    left: `${leftPosition}px`,
                    zIndex: cardIndex + 1, // Cards later in sequence appear on top
                    transition: 'transform 0.2s ease',
                  }}
                  className="hover:scale-105 hover:z-50"
                >
                  {/* AC #10: Same dimensions as opening hand display */}
                  <CardImage 
                    cardName={card.name}
                    cardId={card.id}
                    cardData={{
                      name: card.name,
                      id: card.id,
                      isCustom: card.isCustom,
                      cardName: card.name,
                      cardId: card.id
                    }}
                    size="small"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="mt-2">
        <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '12px'}}>
          {orderedCards.length} cards displayed in deck order
        </p>
      </div>
    </div>
  );
};

export default DecklistImage;