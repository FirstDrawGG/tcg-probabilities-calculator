import React, { useState } from 'react';
import Icon from '../../components/Icon';
import { Button, Tooltip } from '../../components/ui';

const ComboCard = ({
  card,
  cardIndex,
  comboId,
  updateCombo,
  validateAndUpdateCombo,
  removeCard,
  errors,
  typography,
  SearchableCardInput,
  cardDatabase,
  ydkCards,
  ydkCardCounts
}) => {
  // State to track which field is currently focused
  const [focusedField, setFocusedField] = useState(null);
  return (
    <div className={`${cardIndex > 0 ? 'border-t mt-4 pt-4' : ''}`} style={{ borderColor: 'var(--border-secondary)' }}>
      <div className="mb-3" style={{ width: '100%', maxWidth: '520px' }}>
        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
          Card name:
          <Tooltip text={cardIndex === 0 ? "Search for any Yu-Gi-Oh card or create a custom placeholder (e.g. 'Any Dragon monster' or 'Any Unchained Card')" : "All cards in this combo must be drawn (AND logic)"} />
        </label>
        <SearchableCardInput
          value={card.starterCard}
          onChange={(value) => {
            console.log('🔵 ComboCard onChange wrapper called with value:', value);
            console.log('  Calling updateCombo with:', { comboId, cardIndex, field: 'starterCard', value });
            updateCombo(comboId, cardIndex, 'starterCard', value);
            console.log('  updateCombo call completed');
          }}
          placeholder="Search card name"
          errors={errors[`combo-${comboId}-card-${cardIndex}-starterCard`]}
          comboId={comboId}
          cardIndex={cardIndex}
          cardDatabase={cardDatabase}
          ydkCards={ydkCards}
          ydkCardCounts={ydkCardCounts}
          updateCombo={updateCombo}
        />
        {errors[`combo-${comboId}-card-${cardIndex}-starterCard`] && (
          <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${comboId}-card-${cardIndex}-starterCard`]}</p>
        )}
      </div>


      <div className="space-y-4">
        <div style={{ width: '200px' }}>
          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
            Copies in deck:
            <Tooltip text="Total copies of this card in your deck. Max 3 for most, but remember banlist restrictions" />
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={card.startersInDeck}
              onChange={(e) => updateCombo(comboId, cardIndex, 'startersInDeck', parseInt(e.target.value) || 0)}
              onFocus={() => setFocusedField('startersInDeck')}
              onBlur={() => setFocusedField(null)}
              className={`enhanced-input text-center ${
                errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
              }`}
              style={{
                width: '64px'
              }}
              aria-label="Copies in deck"
            />
            {focusedField === 'startersInDeck' && (
              <>
                <Button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateCombo(comboId, cardIndex, 'startersInDeck', Math.max(0, card.startersInDeck - 1))}
                  variant="secondary"
                  className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                  style={{
                    width: '52px',
                    height: '28px',
                    padding: '0',
                    minWidth: '52px',
                    boxShadow: 'none'
                  }}
                >
                  <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                </Button>
                <Button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateCombo(comboId, cardIndex, 'startersInDeck', card.startersInDeck + 1)}
                  variant="secondary"
                  className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                  style={{
                    width: '52px',
                    height: '28px',
                    padding: '0',
                    minWidth: '52px',
                    boxShadow: 'none'
                  }}
                >
                  <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
                </Button>
              </>
            )}
          </div>
          {errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`] && (
            <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`]}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
          <div style={{ width: '200px' }}>
            <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
              Min in hand:
              <Tooltip text="Minimum copies needed in your opening hand for your combo to work" />
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                value={card.minCopiesInHand}
                onChange={(e) => validateAndUpdateCombo(comboId, cardIndex, 'minCopiesInHand', parseInt(e.target.value) || 0)}
                onFocus={() => setFocusedField('minCopiesInHand')}
                onBlur={() => setFocusedField(null)}
                className={`enhanced-input text-center ${
                  errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                }`}
                style={{
                  width: '64px'
                }}
                aria-label="Minimum copies in hand"
              />
              {focusedField === 'minCopiesInHand' && (
                <>
                  <Button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => validateAndUpdateCombo(comboId, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
                    variant="secondary"
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{
                      width: '52px',
                      height: '28px',
                      padding: '0',
                      minWidth: '52px',
                      boxShadow: 'none'
                    }}
                  >
                    <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                  </Button>
                  <Button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => validateAndUpdateCombo(comboId, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
                    variant="secondary"
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{
                      width: '52px',
                      height: '28px',
                      padding: '0',
                      minWidth: '52px',
                      boxShadow: 'none'
                    }}
                  >
                    <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
                  </Button>
                </>
              )}
            </div>
            {errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`] && (
              <p className="text-red-500 mt-1" style={{...typography.body, fontSize: '10px'}}>{errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`]}</p>
            )}
          </div>

          <div style={{ width: '200px' }}>
            <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
              Max in hand:
              <Tooltip text="Upper limit of copies you want to see. Helps avoid dead multiples" />
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                value={card.maxCopiesInHand}
                onChange={(e) => validateAndUpdateCombo(comboId, cardIndex, 'maxCopiesInHand', parseInt(e.target.value) || 0)}
                onFocus={() => setFocusedField('maxCopiesInHand')}
                onBlur={() => setFocusedField(null)}
                className={`enhanced-input text-center ${
                  errors[`combo-${comboId}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                }`}
                style={{
                  width: '64px'
                }}
                aria-label="Maximum copies in hand"
              />
              {focusedField === 'maxCopiesInHand' && (
                <>
                  <Button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => validateAndUpdateCombo(comboId, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
                    variant="secondary"
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{
                      width: '52px',
                      height: '28px',
                      padding: '0',
                      minWidth: '52px',
                      boxShadow: 'none'
                    }}
                  >
                    <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                  </Button>
                  <Button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => validateAndUpdateCombo(comboId, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
                    variant="secondary"
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{
                      width: '52px',
                      height: '28px',
                      padding: '0',
                      minWidth: '52px',
                      boxShadow: 'none'
                    }}
                  >
                    <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
                  </Button>
                </>
              )}
            </div>
            {errors[`combo-${comboId}-card-${cardIndex}-maxCopiesInHand`] && (
              <p className="text-red-500 mt-1" style={{...typography.body, fontSize: '10px'}}>{errors[`combo-${comboId}-card-${cardIndex}-maxCopiesInHand`]}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboCard;
