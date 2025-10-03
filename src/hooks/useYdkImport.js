import { useState, useCallback } from 'react';

/**
 * Custom hook for managing YDK file import state
 * @returns {Object} YDK import state and handlers
 */
const useYdkImport = () => {
  const [uploadedYdkFile, setUploadedYdkFile] = useState(null);
  const [ydkCards, setYdkCards] = useState([]);
  const [ydkCardCounts, setYdkCardCounts] = useState({});
  const [testHandFromDecklist, setTestHandFromDecklist] = useState(true);
  const [initialDeckZones, setInitialDeckZones] = useState(null);
  const [deckZones, setDeckZones] = useState({
    main: [],
    extra: [],
    side: []
  });

  const clearYdkImport = useCallback(() => {
    setUploadedYdkFile(null);
    setYdkCards([]);
    setYdkCardCounts({});
    setTestHandFromDecklist(true);
    setInitialDeckZones(null);
    setDeckZones({
      main: [],
      extra: [],
      side: []
    });
  }, []);

  const updateDeckZones = useCallback((zones) => {
    setDeckZones(zones);
  }, []);

  return {
    uploadedYdkFile,
    setUploadedYdkFile,
    ydkCards,
    setYdkCards,
    ydkCardCounts,
    setYdkCardCounts,
    testHandFromDecklist,
    setTestHandFromDecklist,
    initialDeckZones,
    setInitialDeckZones,
    deckZones,
    setDeckZones,
    updateDeckZones,
    clearYdkImport
  };
};

export default useYdkImport;
