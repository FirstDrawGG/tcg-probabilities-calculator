import React from 'react';

/**
 * ComboCardDisplay - Displays card images for a combo
 * Only shows cards that have been added (no blank placeholders)
 */
const ComboCardDisplay = ({ cards, cardDatabase }) => {
  const getCardImageUrl = (card) => {
    if (!card || !card.starterCard) return null;

    // If card has a cardId, use it to fetch the image
    if (card.cardId) {
      return `https://images.ygoprodeck.com/images/cards_small/${card.cardId}.jpg`;
    }

    // For custom cards, return null (won't display)
    return null;
  };

  // Filter to only show cards that have valid images
  const cardsWithImages = cards.filter(card => getCardImageUrl(card));

  // Don't render anything if no cards with images
  if (cardsWithImages.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'flex-start'
      }}
    >
      {cardsWithImages.map((card, index) => {
        const imageUrl = getCardImageUrl(card);

        return (
          <div
            key={index}
            style={{
              width: '59px',
              height: '86px',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0
            }}
          >
            <img
              src={imageUrl}
              alt={card?.starterCard || 'Card'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                // If image fails to load, hide the container
                e.target.parentElement.style.display = 'none';
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ComboCardDisplay;
