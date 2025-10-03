import React from 'react';
import YdkImporter from '../deck-import/YdkImporter';
import DeckInputs from './DeckInputs';

const DeckConfigInputs = ({
  // YdkImporter props
  uploadedYdkFile,
  setUploadedYdkFile,
  ydkCards,
  setYdkCards,
  ydkCardCounts,
  setYdkCardCounts,
  deckSize,
  setDeckSize,
  cardDatabase,
  staticCardDatabase,
  clearPreviousCalculationData,
  combos,
  setCombos,
  showToast,
  setInitialDeckZones,
  deckZones,
  setDeckZones,

  // DeckInputs props
  handSize,
  setHandSize,
  errors,
  minHandSize,

  // DeckImageSection component and props
  DeckImageSection,
  initialDeckZones,

  // Shared props
  typography
}) => {
  return (
    <>
      <YdkImporter
        uploadedYdkFile={uploadedYdkFile}
        setUploadedYdkFile={setUploadedYdkFile}
        ydkCards={ydkCards}
        setYdkCards={setYdkCards}
        ydkCardCounts={ydkCardCounts}
        setYdkCardCounts={setYdkCardCounts}
        deckSize={deckSize}
        setDeckSize={setDeckSize}
        cardDatabase={staticCardDatabase}
        typography={typography}
        clearPreviousCalculationData={clearPreviousCalculationData}
        combos={combos}
        setCombos={setCombos}
        showToast={showToast}
        setInitialDeckZones={setInitialDeckZones}
        deckZones={deckZones}
        setDeckZones={setDeckZones}
      />

      {/* Deck Builder Section */}
      <div className="p-0" style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
        <DeckImageSection
          typography={typography}
          cardDatabase={cardDatabase}
          ydkCards={ydkCards}
          ydkCardCounts={ydkCardCounts}
          showToast={showToast}
          initialDeckZones={initialDeckZones}
          deckZones={deckZones}
          setDeckZones={setDeckZones}
          combos={combos}
          setCombos={setCombos}
        />
      </div>

      <div className="mb-4">
        <DeckInputs
          deckSize={deckSize}
          setDeckSize={setDeckSize}
          handSize={handSize}
          setHandSize={setHandSize}
          errors={errors}
          typography={typography}
          minHandSize={minHandSize}
        />
      </div>
    </>
  );
};

export default DeckConfigInputs;
