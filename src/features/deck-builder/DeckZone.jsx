import React from 'react';
import { Button } from '../../components/ui';
import DeckCard from './DeckCard';

const DeckZone = ({
  title,
  subtitle,
  cards,
  zone,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveCard,
  onClearZone,
  onCardClick,
  combos,
  ydkCardCounts,
  dragOverZone,
  handleDragStart,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  typography,
  borderColor = 'var(--border-main)',
  maxCards = 10
}) => {
  const isDragOver = dragOverZone === zone;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 style={{...typography.h3, color: 'var(--text-main)'}}>
          {title} {subtitle}
        </h3>
      </div>

      <div
        className="min-h-32 p-4 rounded-lg border-2 border-dashed transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: isDragOver ? 'var(--bg-action)' : borderColor,
          opacity: isDragOver ? 0.8 : 1
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-drop-zone={zone}
      >
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p style={{...typography.body, color: 'var(--text-secondary)'}}>
              Drop cards here or click "Search Cards"
            </p>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${maxCards}, minmax(0, 1fr))`
            }}
          >
            {cards.map((card) => (
              <DeckCard
                key={card.id}
                card={card}
                onDragStart={handleDragStart}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onRemove={() => onRemoveCard(card.id, zone)}
                onCardClick={(card, event) => onCardClick(card, event, zone)}
                combos={combos}
                ydkCardCounts={ydkCardCounts}
                typography={typography}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeckZone;
