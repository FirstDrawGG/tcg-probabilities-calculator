import React from 'react';

/**
 * Deck Statistics Component
 * Displays deck statistics: total cards and card type breakdown
 */
const DeckStatistics = ({ statistics, typography }) => {
  const { totalCards, cardTypes, deckStatus } = statistics;

  return (
    <div className="mt-6 p-4 rounded-lg" style={{backgroundColor: 'var(--bg-secondary)'}}>
      <h3 className="mb-3" style={{...typography.h3, color: 'var(--text-main)'}}>
        Main Deck Stats
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {totalCards}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Main Deck Cards
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.monsters}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Monsters
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.spells}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Spells
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.traps}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Traps
          </div>
        </div>
      </div>

    </div>
  );
};

export default DeckStatistics;
