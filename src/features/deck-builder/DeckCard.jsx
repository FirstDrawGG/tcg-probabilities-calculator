import React, { useState } from 'react';
import CardDatabaseService from '../../services/CardDatabaseService';
import { Button } from '../../components/ui';
import { XCircle } from '@phosphor-icons/react';

const DeckCard = ({ card, onDragStart, onTouchStart, onTouchMove, onTouchEnd, onRemove, onCardClick, combos, ydkCardCounts, typography }) => {
  const [imageError, setImageError] = useState(false);
  const imageProps = CardDatabaseService.getImageProps(card.name, card.cardId, 'small');

  const getBanlistIcon = (status) => {
    switch (status) {
      case 'forbidden': return '🚫';
      case 'limited': return '①';
      case 'semi-limited': return '②';
      default: return null;
    }
  };

  const getBanlistColor = (status) => {
    switch (status) {
      case 'forbidden': return '#ff4444';
      case 'limited': return '#ffaa00';
      case 'semi-limited': return '#ff8800';
      default: return 'transparent';
    }
  };

  // AC #9, #11: Get combos assigned to this card
  const getCardCombos = (cardName) => {
    if (!combos || !Array.isArray(combos) || !cardName) {
      return [];
    }
    return combos
      .map((combo, index) => ({ ...combo, index }))
      .filter(combo =>
        combo && combo.cards && Array.isArray(combo.cards) &&
        combo.cards.some(card =>
          card && card.starterCard && card.starterCard.toLowerCase() === cardName.toLowerCase()
        )
      );
  };

  const cardCombos = getCardCombos(card.name);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onTouchStart={(e) => onTouchStart(e, card)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={(e) => {
        // AC #1, #2: Handle card click for combo assignment
        if (onCardClick) {
          onCardClick(card, e);
        }
      }}
      className="relative group cursor-pointer hover:opacity-80 transition-opacity touch-none"
      style={{
        width: '60px',
        height: '87px',
        touchAction: 'none'
      }}
    >
      <img
        {...imageProps}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px',
          display: imageError ? 'none' : 'block'
        }}
        onError={() => setImageError(true)}
      />
      {imageError && (
        <div
          className="flex items-center justify-center text-xs text-center"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-action-secondary)',
            color: 'var(--text-secondary)',
            borderRadius: '4px'
          }}
        >
          {card.name.slice(0, 10)}...
        </div>
      )}

      {/* Banlist Status Indicator */}
      {card.banlistStatus && card.banlistStatus !== 'unlimited' && (
        <div
          className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: getBanlistColor(card.banlistStatus),
            color: 'white'
          }}
          title={`${card.banlistStatus} card`}
        >
          {getBanlistIcon(card.banlistStatus)}
        </div>
      )}

      {/* AC #9, #11, #13: Combo icons on cards - positioned bottom-left to avoid X button */}
      {cardCombos.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '4px',
          left: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {cardCombos.slice(0, 3).map((combo, iconIndex) => {
            const comboCard = combo.cards.find(c => c.starterCard.toLowerCase() === card.name.toLowerCase());
            return (
              <div
                key={combo.id}
                title={`${combo.name}: Min ${comboCard?.minCopiesInHand || 1}, Max ${comboCard?.maxCopiesInHand || 1}`}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Geist, sans-serif',
                  border: '1px solid white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {combo.index + 1}
              </div>
            );
          })}

          {/* AC #13: +X more indicator for cards with >3 combos */}
          {cardCombos.length > 3 && (
            <div
              title={`Additional combos: ${cardCombos.slice(3).map(c => `${c.index + 1}. ${c.name}`).join(', ')}`}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#666',
                color: 'white',
                fontSize: '8px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Geist, sans-serif',
                border: '1px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              +{cardCombos.length - 3}
            </div>
          )}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent the card click from triggering
          onRemove();
        }}
        className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          position: 'absolute',
          top: '-4px',
          left: '-4px',
          background: 'white',
          border: 'none',
          padding: '0',
          cursor: 'pointer',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <XCircle size={20} weight="fill" color="#333" />
      </button>
    </div>
  );
};

export default DeckCard;
