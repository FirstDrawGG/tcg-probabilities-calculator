import React, { useState } from 'react';
import YdkParser from '../../services/YdkParser';
import HandTrapService from '../../services/HandTrapService';
import Icon from '../../components/Icon';
import DecklistImage from '../../components/DecklistImage';
import CardSearchModal from '../../components/CardSearchModal.jsx';

const YdkImporter = ({
  uploadedYdkFile,
  setUploadedYdkFile,
  ydkCards,
  setYdkCards,
  ydkCardCounts,
  setYdkCardCounts,
  deckSize,
  setDeckSize,
  cardDatabase,
  typography,
  clearPreviousCalculationData,
  combos,
  setCombos,
  showToast,
  setInitialDeckZones,
  deckZones
}) => {
  const [showClipboardField, setShowClipboardField] = useState(false);
  const [clipboardContent, setClipboardContent] = useState('');
  // AC #2: Loading state for deck preview
  const [isLoadingDeck, setIsLoadingDeck] = useState(false);
  // Card search modal state
  const [showCardSearch, setShowCardSearch] = useState(false);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleYdkFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // AC #2: Set loading state
      setIsLoadingDeck(true);
      
      // Close clipboard field if it's open
      if (showClipboardField) {
        setShowClipboardField(false);
        setClipboardContent('');
      }

      const content = await readFileAsText(file);
      const parseResult = YdkParser.parseYdkFile(content, cardDatabase);
      
      const uniqueCards = [];
      const seenNames = new Set();
      
      parseResult.cards.forEach(card => {
        if (!seenNames.has(card.name)) {
          seenNames.add(card.name);
          uniqueCards.push({
            name: card.name,
            id: card.id,
            isCustom: false
          });
        }
      });
      
      const mainDeckCardCount = parseResult.cards.length;
      
      // Set deck size first
      setDeckSize(mainDeckCardCount);
      
      // Clear previous calculation data after setting deck size
      clearPreviousCalculationData(mainDeckCardCount);
      
      setUploadedYdkFile({
        name: file.name,
        content: content
      });
      setYdkCards(uniqueCards);
      setYdkCardCounts(parseResult.cardCounts);

      // Populate the deck builder with parsed deck zones
      if (parseResult.deckZones && setInitialDeckZones) {
        setInitialDeckZones(parseResult.deckZones);
        console.log('🎯 YdkImporter: Populating deck builder with:', parseResult.deckZones);
      }

      if (parseResult.unmatchedIds.length > 0) {
        alert("Some cards from your YDK file weren't matched");
      }
      
    } catch (error) {
      console.error('YDK upload error:', error);
      alert(error.message);
    } finally {
      // AC #2: Clear loading state
      setIsLoadingDeck(false);
    }
  };

  const handleFromClipboard = () => {
    setShowClipboardField(true);
  };

  const handleCardSelect = (card) => {
    // For now, just show a toast that the card was selected
    // This can be expanded later to actually add the card to a deck
    showToast(`Selected: ${card.name}`);
  };

  const processClipboardContent = (content) => {
    try {
      // AC #2: Set loading state
      setIsLoadingDeck(true);
      
      const parseResult = YdkParser.parseYdkFile(content, cardDatabase);
      
      const uniqueCards = [];
      const seenNames = new Set();
      
      parseResult.cards.forEach(card => {
        if (!seenNames.has(card.name)) {
          seenNames.add(card.name);
          uniqueCards.push({
            name: card.name,
            id: card.id,
            isCustom: false
          });
        }
      });
      
      const mainDeckCardCount = parseResult.cards.length;
      
      // Set deck size first
      setDeckSize(mainDeckCardCount);
      
      // Clear previous calculation data after setting deck size
      clearPreviousCalculationData(mainDeckCardCount);
      
      setUploadedYdkFile({
        name: 'Clipboard YDK',
        content: content
      });
      setYdkCards(uniqueCards);
      setYdkCardCounts(parseResult.cardCounts);

      // Populate the deck builder with parsed deck zones
      if (parseResult.deckZones && setInitialDeckZones) {
        setInitialDeckZones(parseResult.deckZones);
        console.log('🎯 YdkImporter (clipboard): Populating deck builder with:', parseResult.deckZones);
      }

      setShowClipboardField(false);
      setClipboardContent('');

      if (parseResult.unmatchedIds.length > 0) {
        alert("Some cards from your YDK file weren't matched");
      }
      
    } catch (error) {
      console.error('Clipboard YDK processing error:', error);
      alert(error.message);
    } finally {
      // AC #2: Clear loading state
      setIsLoadingDeck(false);
    }
  };

  const handleClearClipboard = () => {
    setUploadedYdkFile(null);
    setYdkCards([]);
    setYdkCardCounts({});
    setShowClipboardField(false);
    setClipboardContent('');
    if (setInitialDeckZones) {
      setInitialDeckZones(null);
    }
  };

  const handleRemoveDecklist = () => {
    // Clear all YDK-related data and return to default state
    setUploadedYdkFile(null);
    setYdkCards([]);
    setYdkCardCounts({});

    // Reset deck size to default
    setDeckSize(40);

    // Clear previous calculation data with default deck size
    clearPreviousCalculationData(40);

    // Clear deck builder
    if (setInitialDeckZones) {
      setInitialDeckZones(null);
    }
  };

  return (
    <div>
      <div className="flex items-center mb-4" style={{ gap: '24px' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <Icon name="tray-arrow-up" ariaLabel="Upload YDK file" size={16} />
          <h3 style={{...typography.h3, color: 'var(--text-main)', margin: 0}}>YDK file</h3>
        </div>
        
        {!uploadedYdkFile && (
          <div className="flex items-center" style={{ gap: '8px' }}>
            <button
              onClick={handleFromClipboard}
              disabled={isLoadingDeck}
              className={`inline-flex items-center px-0 py-2 transition-opacity ${isLoadingDeck ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: isLoadingDeck ? 'var(--text-secondary)' : 'var(--text-main)',
                borderRadius: '999px',
                opacity: isLoadingDeck ? 0.5 : 1,
                ...typography.body
              }}
            >
              From clipboard
            </button>
            <div
              style={{
                width: '1px',
                height: '16px',
                backgroundColor: 'var(--text-secondary)',
                opacity: 0.3
              }}
            />
            <input
              type="file"
              accept=".ydk"
              onChange={handleYdkFileUpload}
              disabled={isLoadingDeck}
              style={{ display: 'none' }}
              id="ydk-file-input"
            />
            <label
              htmlFor="ydk-file-input"
              className={`inline-flex items-center px-0 py-2 transition-opacity ${isLoadingDeck ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: isLoadingDeck ? 'var(--text-secondary)' : 'var(--text-main)',
                borderRadius: '999px',
                opacity: isLoadingDeck ? 0.5 : 1,
                ...typography.body
              }}
            >
              Upload
            </label>
            <div
              style={{
                width: '1px',
                height: '16px',
                backgroundColor: 'var(--text-secondary)',
                opacity: 0.3
              }}
            />
            <div className="tooltip" data-tooltip="Coming soon">
              <button
                onClick={() => setShowCardSearch(true)}
                disabled={true}
                className="inline-flex items-center px-0 py-2 cursor-not-allowed transition-opacity"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  borderRadius: '999px',
                  opacity: 0.5,
                  ...typography.body
                }}
              >
                Search Cards
              </button>
            </div>
          </div>
        )}
        
        {uploadedYdkFile && uploadedYdkFile.name === "Clipboard YDK" && (
          <button
            onClick={handleClearClipboard}
            className="inline-flex items-center px-0 py-2 cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              borderRadius: '999px',
              ...typography.body
            }}
          >
            Clear YDK
          </button>
        )}
      </div>
      
      {/* AC #1: Placeholder text when no YDK file is uploaded */}
      {!uploadedYdkFile && !showClipboardField && !isLoadingDeck && (
        <div className="mb-4">
          <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px'}}>
            Upload your decklist to preview it
          </p>
        </div>
      )}
      
      {/* AC #2: Loading message while fetching card images */}
      {isLoadingDeck && (
        <div className="mb-4">
          <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px'}}>
            Loading deck preview...
          </p>
        </div>
      )}
      
      {showClipboardField && (
        <div className="mb-4">
          <textarea
            value={clipboardContent}
            onChange={(e) => {
              const value = e.target.value;
              setClipboardContent(value);
              
              if (window.clipboardProcessTimeout) {
                clearTimeout(window.clipboardProcessTimeout);
              }
              
              window.clipboardProcessTimeout = setTimeout(() => {
                if (value.trim()) {
                  processClipboardContent(value);
                }
              }, 1000);
            }}
            onPaste={(e) => {
              setTimeout(() => {
                const textarea = e.target;
                const value = textarea.value;
                if (value.trim()) {
                  processClipboardContent(value);
                }
              }, 100);
            }}
            placeholder="Paste your YDK file content here..."
            className="w-full p-3 border rounded-lg"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: `1px solid var(--border-main)`,
              borderRadius: '16px',
              color: 'var(--text-main)',
              fontFamily: 'Geist Regular, sans-serif',
              fontSize: '14px',
              lineHeight: '20px',
              resize: 'vertical',
              minHeight: '80px'
            }}
          />
        </div>
      )}
      
      {uploadedYdkFile && (
        <div className="mb-4 p-3 border rounded-lg relative" 
             style={{ 
               backgroundColor: 'var(--bg-secondary)', 
               border: `1px solid var(--border-main)`,
               borderRadius: '16px'
             }}>
          <button
            onClick={handleRemoveDecklist}
            className="absolute top-2 right-2 hover:opacity-80 transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '16px',
              lineHeight: '16px',
              padding: '4px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
          <div style={{...typography.body, color: 'var(--text-main)', fontWeight: 'medium', paddingRight: '24px'}}>
            {uploadedYdkFile.name}
          </div>
          <div style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px'}}>
            {deckSize} Main deck cards loaded ({ydkCards.length} unique)
          </div>
          {(() => {
            // Calculate hand-trap count from YDK cards
            const handTrapCards = ydkCards.filter(card => HandTrapService.isHandTrap(card));
            const handTrapCount = handTrapCards.reduce((total, card) => {
              return total + (ydkCardCounts[card.name] || 0);
            }, 0);
            
            if (handTrapCount > 0) {
              return (
                <div style={{...typography.body, color: 'var(--icon-main)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Icon name="bomb" style={{ fontSize: '14px' }} />
                  Hand-Traps: {handTrapCount}/{deckSize} cards
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
      
      {/* AC #3, #5: Decklist image section - shown after file is uploaded and not loading */}
      {!isLoadingDeck && (
        <DecklistImage
          ydkCards={ydkCards}
          ydkCardCounts={ydkCardCounts}
          uploadedYdkFile={uploadedYdkFile}
          cardDatabase={cardDatabase}
          typography={typography}
          combos={combos}
          setCombos={setCombos}
          showToast={showToast}
          deckZones={deckZones}
        />
      )}

      {/* Card Search Modal */}
      <CardSearchModal
        isOpen={showCardSearch}
        onClose={() => setShowCardSearch(false)}
        onCardSelect={handleCardSelect}
      />
    </div>
  );
};

export default YdkImporter;