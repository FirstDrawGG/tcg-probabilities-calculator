import React from 'react';
import SearchableCardInput from '../shared/SearchableCardInput';

// Typography and styling constants (moved from App.jsx)
const typography = {
  h2: {
    fontFamily: 'Geist Bold, sans-serif',
    fontSize: '24px',
    lineHeight: '30px',
    color: '#ffffff',
    fontWeight: 'bold',
    margin: 0
  },
  h3: {
    fontFamily: 'Geist Bold, sans-serif',
    fontSize: '20px',
    lineHeight: '26px',
    color: '#ffffff',
    fontWeight: 'bold',
    margin: 0
  },
  body: {
    fontFamily: 'Geist Regular, sans-serif',
    fontSize: '16px',
    lineHeight: '22px',
    color: '#ffffff',
    margin: 0
  }
};

// Tooltip component
const Tooltip = ({ text }) => {
  return (
    <div className="relative group ml-2">
      <span className="cursor-help hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
        ⓘ
      </span>
      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {text}
      </div>
    </div>
  );
};


const ComboBuilder = ({
  combos,
  errors,
  editingComboId,
  tempComboName,
  updateCombo,
  removeCombo,
  addSecondCard,
  removeSecondCard,
  addCombo,
  startEditingComboName,
  handleComboNameChange,
  saveComboName,
  handleComboNameKeyDown,
  cardDatabase,
  ydkCards,
  ydkCardCounts
}) => {
  return (
    <div>
      {combos.map((combo, index) => (
        <div key={combo.id} className="border-t pt-4" style={{ borderColor: 'var(--border-secondary)' }}>
          <div className="flex justify-between items-center mb-2">
            {editingComboId === combo.id ? (
              <input
                type="text"
                value={tempComboName}
                onChange={handleComboNameChange}
                onBlur={saveComboName}
                onKeyDown={handleComboNameKeyDown}
                className="font-medium px-2 py-1 border"
                style={{ 
                  backgroundColor: 'var(--bg-action-secondary)', 
                  color: 'var(--text-main)',
                  borderColor: 'var(--border-secondary)',
                  borderRadius: '999px',
                  ...typography.body
                }}
                autoFocus
                maxLength={50}
              />
            ) : (
              <h3 
                className="cursor-pointer hover:opacity-80 py-1 rounded transition-colors"
                style={{...typography.h3, color: 'var(--text-main)'}}
                onClick={() => startEditingComboName(combo)}
              >
                {combo.name}
              </h3>
            )}
            {index > 0 && (
              <button
                onClick={() => removeCombo(combo.id)}
                className="font-medium hover:opacity-80 transition-opacity"
                style={{
                  ...typography.body,
                  color: 'var(--text-main)'
                }}
              >
                Remove
              </button>
            )}
          </div>
          
          {errors[`combo-${combo.id}-name`] && (
            <p className="text-red-500 mb-2" style={typography.body}>{errors[`combo-${combo.id}-name`]}</p>
          )}
          
          {combo.cards.map((card, cardIndex) => (
            <div key={cardIndex} className={`${cardIndex > 0 ? 'border-t mt-4 pt-4' : ''}`} style={{ borderColor: 'var(--border-secondary)' }}>
              <div className="mb-3">
                <div className="flex items-center justify-between" style={{marginBottom: 'var(--spacing-xs)'}}>
                  <label className="flex items-center font-medium" style={{...typography.body, color: 'var(--text-main)'}}>
                    Card name:
                    <Tooltip text="Search for any Yu-Gi-Oh card or create a custom placeholder (e.g. 'Any Dragon monster' or 'Any Unchained Card')" />
                  </label>
                  {cardIndex === 1 && (
                    <button
                      onClick={() => removeSecondCard(combo.id)}
                      className="font-medium hover:opacity-80 transition-opacity"
                      style={{
                        ...typography.body,
                        color: 'var(--text-main)'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <SearchableCardInput
                  value={card.starterCard}
                  onChange={(value) => updateCombo(combo.id, cardIndex, 'starterCard', value)}
                  placeholder="Search card name"
                  errors={errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}
                  comboId={combo.id}
                  cardIndex={cardIndex}
                  cardDatabase={cardDatabase}
                  ydkCards={ydkCards}
                  ydkCardCounts={ydkCardCounts}
                  updateCombo={updateCombo}
                  cardId={card.cardId}
                />
                {errors[`combo-${combo.id}-card-${cardIndex}-starterCard`] && (
                  <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}</p>
                )}
              </div>

              <div className="mb-3">
                <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                  Cards in deck:
                  <Tooltip text="Total copies of this card in your deck. More copies = higher chance to draw" />
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', Math.max(0, card.startersInDeck - 1))}
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      color: 'var(--text-secondary)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '999px',
                      border: '1px solid var(--border-main)',
                      boxSizing: 'border-box'
                    }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={card.startersInDeck}
                    onChange={(e) => updateCombo(combo.id, cardIndex, 'startersInDeck', parseInt(e.target.value) || 0)}
                    className={`text-center border ${
                      errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
                    }`}
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      color: 'var(--text-main)',
                      width: '64px',
                      height: '40px',
                      borderRadius: '999px',
                      border: '1px solid var(--border-main)',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                      ...typography.body
                    }}
                  />
                  <button
                    onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', card.startersInDeck + 1)}
                    className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      color: 'var(--text-secondary)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '999px',
                      border: '1px solid var(--border-main)',
                      boxSizing: 'border-box'
                    }}
                  >
                    +
                  </button>
                </div>
                {errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] && (
                  <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`]}</p>
                )}
              </div>

              {/* AC #1: Add AND/OR toggle for each card except the first */}
              {cardIndex > 0 && (
                <div className="mb-3">
                  <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                    Logic:
                    <Tooltip text="AND = need all cards, OR = need any of these cards" />
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'logicOperator', 'AND')}
                      className="px-4 py-2 rounded font-medium transition-colors"
                      style={{
                        backgroundColor: (card.logicOperator || 'AND') === 'AND' ? 'var(--bg-action)' : 'var(--bg-secondary)',
                        color: (card.logicOperator || 'AND') === 'AND' ? 'var(--text-black)' : 'var(--text-main)',
                        border: '1px solid var(--border-main)',
                        borderRadius: '999px',
                        height: '40px',
                        minWidth: '60px',
                        ...typography.body
                      }}
                    >
                      AND
                    </button>
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'logicOperator', 'OR')}
                      className="px-4 py-2 rounded font-medium transition-colors"
                      style={{
                        backgroundColor: (card.logicOperator || 'AND') === 'OR' ? 'var(--bg-action)' : 'var(--bg-secondary)',
                        color: (card.logicOperator || 'AND') === 'OR' ? 'var(--text-black)' : 'var(--text-main)',
                        border: '1px solid var(--border-main)',
                        borderRadius: '999px',
                        height: '40px',
                        minWidth: '60px',
                        ...typography.body
                      }}
                    >
                      OR
                    </button>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                    Min in hand:
                    <Tooltip text="Minimum copies needed in opening hand for this combo to work" />
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
                      className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-secondary)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box'
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={card.minCopiesInHand}
                      onChange={(e) => updateCombo(combo.id, cardIndex, 'minCopiesInHand', parseInt(e.target.value) || 0)}
                      className={`text-center border ${
                        errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                      }`}
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-main)',
                        width: '64px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        ...typography.body
                      }}
                    />
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
                      className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-secondary)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box'
                      }}
                    >
                      +
                    </button>
                  </div>
                  {errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] && (
                    <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`]}</p>
                  )}
                </div>

                <div className="flex-1">
                  <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                    Max in hand:
                    <Tooltip text="Upper limit of copies you want to see. Helps avoid dead multiples" />
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
                      className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-secondary)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box'
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={card.maxCopiesInHand}
                      onChange={(e) => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', parseInt(e.target.value) || 0)}
                      className={`text-center border ${
                        errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                      }`}
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-main)',
                        width: '64px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        ...typography.body
                      }}
                    />
                    <button
                      onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
                      className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-secondary)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-main)',
                        boxSizing: 'border-box'
                      }}
                    >
                      +
                    </button>
                  </div>
                  {errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] && (
                    <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {combo.cards.length === 1 && (
            <div className="flex items-center mt-4">
              <button
                onClick={() => addSecondCard(combo.id)}
                className="font-medium transition-colors hover:opacity-80"
                style={{ 
                  boxSizing: 'border-box',
                  width: '200px',
                  height: '40px',
                  display: 'block',
                  backgroundColor: 'var(--bg-secondary)',
                  overflow: 'visible',
                  gap: '7px',
                  borderRadius: '999px',
                  color: 'var(--text-main)',
                  border: 'none',
                  ...typography.body
                }}
              >
                + Add 2nd card
              </button>
              <Tooltip text="Test 2-card combos by adding a second required piece to this setup" />
            </div>
          )}
        </div>
      ))}

      {combos.length < 10 && (
        <div>
          <hr className="my-4" style={{ borderColor: 'var(--border-secondary)', borderTop: '1px solid var(--border-secondary)' }} />
          <div className="flex items-center">
            <button
              onClick={addCombo}
              className="font-medium transition-colors hover:opacity-80"
              style={{ 
                boxSizing: 'border-box',
                width: '200px',
                height: '40px',
                display: 'block',
                backgroundColor: 'var(--bg-secondary)',
                overflow: 'visible',
                gap: '7px',
                borderRadius: '999px',
                color: 'var(--text-main)',
                border: 'none',
                ...typography.body
              }}
            >
              + Add another combo
            </button>
            <Tooltip text="Test multiple combo lines to see your deck's overall consistency options" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboBuilder;