import React from 'react';
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
  return (
    <div className={`${cardIndex > 0 ? 'border-t mt-4 pt-4' : ''}`} style={{ borderColor: 'var(--border-secondary)' }}>
      <div className="mb-3">
        <div className="flex items-center justify-between" style={{marginBottom: 'var(--spacing-xs)'}}>
          <label className="flex items-center font-medium" style={{...typography.body, color: 'var(--text-main)'}}>
            Card name:
            <Tooltip text="Search for any Yu-Gi-Oh card or create a custom placeholder (e.g. 'Any Dragon monster' or 'Any Unchained Card')" />
          </label>
          {/* AC #6: [X] remove option for each card except the first */}
          {cardIndex > 0 && (
            <Button
              onClick={() => removeCard(comboId, cardIndex)}
              variant="secondary"
              size="small"
              className="font-medium hover:opacity-80 transition-opacity w-8 h-8 flex items-center justify-center"
              style={{
                borderRadius: '50%',
                fontSize: '18px',
                fontWeight: 'bold',
                width: '32px',
                height: '32px',
                padding: '0'
              }}
              title="Remove this card"
            >
              ×
            </Button>
          )}
        </div>
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

      {/* AND/OR toggle only for 3rd+ cards (cardIndex > 1) */}
      {cardIndex > 1 && (
        <div className="mb-3">
          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
            Logic:
            <Tooltip text="AND = need all cards, OR = need any of these cards" />
          </label>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => updateCombo(comboId, cardIndex, 'logicOperator', 'AND')}
              variant={(card.logicOperator || 'AND') === 'AND' ? 'primary' : 'secondary'}
              size="small"
              className="rounded font-medium transition-colors"
              style={{
                borderRadius: '8px',
                height: '28px',
                minWidth: '60px',
                ...typography.body
              }}
            >
              AND
            </Button>
            <Button
              onClick={() => updateCombo(comboId, cardIndex, 'logicOperator', 'OR')}
              variant={(card.logicOperator || 'AND') === 'OR' ? 'primary' : 'secondary'}
              size="small"
              className="rounded font-medium transition-colors"
              style={{
                borderRadius: '8px',
                height: '28px',
                minWidth: '60px',
                ...typography.body
              }}
            >
              OR
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
            Copies in deck:
            <Tooltip text="Total copies of this card in your deck. Max 3 for most, but remember banlist restrictions" />
          </label>
          <div className="flex items-center space-x-3">
            <Button
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
            <input
              type="number"
              value={card.startersInDeck}
              onChange={(e) => updateCombo(comboId, cardIndex, 'startersInDeck', parseInt(e.target.value) || 0)}
              className={`enhanced-input text-center ${
                errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
              }`}
              style={{
                width: '64px'
              }}
              aria-label="Copies in deck"
            />
            <Button
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
          </div>
          {errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`] && (
            <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${comboId}-card-${cardIndex}-startersInDeck`]}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
          <div className="flex-1">
            <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
              Min in hand:
              <Tooltip text="Minimum copies needed in your opening hand for your combo to work" />
            </label>
            <div className="flex items-center space-x-3">
              <Button
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
              <input
                type="number"
                value={card.minCopiesInHand}
                onChange={(e) => validateAndUpdateCombo(comboId, cardIndex, 'minCopiesInHand', parseInt(e.target.value) || 0)}
                className={`enhanced-input text-center ${
                  errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                }`}
                style={{
                  width: '64px'
                }}
                aria-label="Minimum copies in hand"
              />
              <Button
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
            </div>
            {errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`] && (
              <p className="text-red-500 mt-1" style={{...typography.body, fontSize: '10px'}}>{errors[`combo-${comboId}-card-${cardIndex}-minCopiesInHand`]}</p>
            )}
          </div>

          <div className="flex-1">
            <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
              Max in hand:
              <Tooltip text="Upper limit of copies you want to see. Helps avoid dead multiples" />
            </label>
            <div className="flex items-center space-x-3">
              <Button
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
              <input
                type="number"
                value={card.maxCopiesInHand}
                onChange={(e) => validateAndUpdateCombo(comboId, cardIndex, 'maxCopiesInHand', parseInt(e.target.value) || 0)}
                className={`enhanced-input text-center ${
                  errors[`combo-${comboId}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                }`}
                style={{
                  width: '64px'
                }}
                aria-label="Maximum copies in hand"
              />
              <Button
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
