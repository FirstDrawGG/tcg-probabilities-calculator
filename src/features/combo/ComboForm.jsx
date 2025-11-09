import React from 'react';
import Icon from '../../components/Icon';
import { Button, Tooltip } from '../../components/ui';
import ComboCard from './ComboCard';
import ComboCardDisplay from './ComboCardDisplay';

const ComboForm = ({
  combo,
  index,
  editingComboId,
  tempComboName,
  handleComboNameChange,
  saveComboName,
  handleComboNameKeyDown,
  startEditingComboName,
  removeCombo,
  updateCombo,
  validateAndUpdateCombo,
  removeCard,
  addCard,
  canAddCard,
  errors,
  typography,
  SearchableCardInput,
  cardDatabase,
  ydkCards,
  ydkCardCounts
}) => {
  return (
    <div key={combo.id} className="border-t pt-4 pb-4" style={{ borderColor: 'var(--border-secondary)' }}>
      {/* Combo Title */}
      <div className="flex items-center mb-2">
        {editingComboId === combo.id ? (
          <div className="flex items-center gap-2">
            <Icon name="asterisk-simple" ariaLabel="Combo" size={16} variant="secondary" />
            <input
              type="text"
              value={tempComboName}
              onChange={handleComboNameChange}
              onBlur={saveComboName}
              onKeyDown={handleComboNameKeyDown}
              className="enhanced-input font-medium"
              style={{
                backgroundColor: 'var(--bg-action-secondary)'
              }}
              autoFocus
              maxLength={50}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="asterisk-simple" ariaLabel="Combo" size={16} variant="secondary" />
            <h3
              className="cursor-pointer hover:opacity-80 py-1 rounded transition-colors"
              style={{...typography.h3, color: 'var(--text-main)'}}
              onClick={() => startEditingComboName(combo)}
            >
              {combo.name}
            </h3>
          </div>
        )}
      </div>

      {errors[`combo-${combo.id}-name`] && (
        <p className="text-red-500 mb-2" style={typography.body}>{errors[`combo-${combo.id}-name`]}</p>
      )}

      {/* Card Display Area - Above card details */}
      <div className="mb-4">
        <ComboCardDisplay cards={combo.cards} cardDatabase={cardDatabase} />
      </div>

      {/* Card Details Section */}
      <div>
        {combo.cards.map((card, cardIndex) => (
          <ComboCard
            key={cardIndex}
            card={card}
            cardIndex={cardIndex}
            comboId={combo.id}
            updateCombo={updateCombo}
            validateAndUpdateCombo={validateAndUpdateCombo}
            removeCard={removeCard}
            errors={errors}
            typography={typography}
            SearchableCardInput={SearchableCardInput}
            cardDatabase={cardDatabase}
            ydkCards={ydkCards}
            ydkCardCounts={ydkCardCounts}
          />
        ))}

        {/* AC #1, #2, #3, #4: Dynamic Add Card button */}
        <div className="flex items-center mt-4">
          <Button
            onClick={() => addCard(combo.id)}
            disabled={!canAddCard(combo)}
            className="enhanced-button enhanced-button-add"
          >
            <Icon name="stack-plus" ariaLabel="Add card" size={14} className="button-icon" style={{ color: '#141414' }} />
            <span className="button-text">Add card</span>
          </Button>
          <Tooltip text={canAddCard(combo)
            ? "Add another card - all cards must be drawn (AND logic)"
            : "Your combo would exceed the defined Hand size"
          } />
        </div>
      </div>
    </div>
  );
};

export default ComboForm;
