# Test Plan: YDK Card Copy Count Fix

## Summary
This test plan validates that when users add cards from their uploaded YDK decklist to combo calculations, the system correctly sets "Copies in deck" to match the actual number of copies in the YDK file.

## Test Environment
- Browser: Chrome/Firefox/Edge
- Application URL: http://localhost:5173
- Test YDK file: `test-deck.ydk` (included in project root)

## Test Data
The `test-deck.ydk` file contains:
- **Blue-Eyes White Dragon**: 3 copies
- **Upstart Goblin**: 2 copies
- **Polymerization**: 1 copy
- **Dark Magician**: 3 copies
- **Multiple other cards**: Various copy counts

## Test Scenarios

### Scenario 1: System sets "Copies in deck" based on actual copies in YDK decklist

**Given:** The user uploaded a YDK decklist
**And:** The decklist contains varying copies of specific cards (1, 2, or 3 copies)
**When:** The user selects a card from the decklist and adds it to any combo
**Then:** The system sets "Copies in deck" value to match the actual copy count from the YDK

#### Test Steps:

1. **Test Case 1.1: Card with 3 copies**
   - [ ] Open the application at http://localhost:5173
   - [ ] Upload the `test-deck.ydk` file using the "Upload YDK" button
   - [ ] Verify the YDK file is uploaded successfully
   - [ ] Click on the card name input field in "Combo 1"
   - [ ] Type "Blue-Eyes" in the search field
   - [ ] Click on "Blue-Eyes White Dragon" from the dropdown (shows "Cards you uploaded" section)
   - [ ] **Expected Result:** "Copies in deck" is automatically set to **3**
   - [ ] **Expected Result:** "Max in hand" is automatically set to **3**
   - [ ] **Expected Result:** "Min in hand" remains at **1** (default)

2. **Test Case 1.2: Card with 2 copies**
   - [ ] Click "Add card" button in Combo 1
   - [ ] Click on the new card name input field
   - [ ] Type "Upstart" in the search field
   - [ ] Click on "Upstart Goblin" from the dropdown
   - [ ] **Expected Result:** "Copies in deck" is automatically set to **2**
   - [ ] **Expected Result:** "Max in hand" is automatically set to **2**
   - [ ] **Expected Result:** "Min in hand" remains at **1** (default)

3. **Test Case 1.3: Card with 1 copy**
   - [ ] Click "Add card" button in Combo 1
   - [ ] Click on the new card name input field
   - [ ] Type "Poly" in the search field
   - [ ] Click on "Polymerization" from the dropdown
   - [ ] **Expected Result:** "Copies in deck" is automatically set to **1**
   - [ ] **Expected Result:** "Max in hand" is automatically set to **1**
   - [ ] **Expected Result:** "Min in hand" remains at **1** (default)

### Scenario 2: User manually adjusts "Max in hand" after adding card from YDK

**Given:** The user uploaded a YDK decklist
**And:** The decklist contains 3 copies of a specific card
**And:** The user added that card to a combo
**And:** The system set "Copies in deck" to 3 and "Max in hand" to 3
**When:** The user manually changes "Max in hand" to 2
**Then:** The system keeps "Max in hand" at 2
**And:** The system keeps "Copies in deck" at 3

#### Test Steps:

1. **Test Case 2.1: Manual adjustment of Max in hand**
   - [ ] Continue from Scenario 1 (Blue-Eyes White Dragon already added with 3 copies)
   - [ ] Verify "Copies in deck" shows **3**
   - [ ] Verify "Max in hand" shows **3**
   - [ ] Click the **minus (-)** button next to "Max in hand" once
   - [ ] **Expected Result:** "Max in hand" changes to **2**
   - [ ] **Expected Result:** "Copies in deck" remains at **3**
   - [ ] Click the **minus (-)** button next to "Max in hand" again
   - [ ] **Expected Result:** "Max in hand" changes to **1**
   - [ ] **Expected Result:** "Copies in deck" remains at **3**

2. **Test Case 2.2: Manual input of Max in hand**
   - [ ] Click directly on the "Max in hand" input field
   - [ ] Delete the current value and type **2**
   - [ ] Click outside the input field
   - [ ] **Expected Result:** "Max in hand" shows **2**
   - [ ] **Expected Result:** "Copies in deck" remains at **3**

3. **Test Case 2.3: Manual adjustment of Copies in deck affects Max in hand**
   - [ ] Verify "Copies in deck" shows **3** and "Max in hand" shows **2**
   - [ ] Click the **plus (+)** button next to "Max in hand" once
   - [ ] Verify "Max in hand" now shows **3** (equal to "Copies in deck")
   - [ ] Click the **minus (-)** button next to "Copies in deck" once
   - [ ] **Expected Result:** "Copies in deck" changes to **2**
   - [ ] **Expected Result:** "Max in hand" automatically adjusts to **2** (can't exceed Copies in deck)

### Scenario 3: Adding the same card multiple times uses same copy count

**Given:** The user uploaded a YDK decklist
**And:** The decklist contains 2 copies of a specific card
**And:** The user already added that card to Combo 1
**When:** The user adds that same card to Combo 2
**Then:** The system sets "Copies in deck" to 2 in Combo 2

#### Test Steps:

1. **Test Case 3.1: Same card in multiple combos**
   - [ ] Continue from previous scenarios
   - [ ] Scroll down and click "Add combo" button
   - [ ] Verify "Combo 2" is created
   - [ ] Click on the card name input field in "Combo 2"
   - [ ] Type "Upstart" in the search field
   - [ ] Click on "Upstart Goblin" from the dropdown
   - [ ] **Expected Result:** "Copies in deck" is automatically set to **2** (same as in Combo 1)
   - [ ] **Expected Result:** "Max in hand" is automatically set to **2**
   - [ ] **Expected Result:** "Min in hand" remains at **1** (default)

2. **Test Case 3.2: Verify consistency across combos**
   - [ ] Scroll up to Combo 1
   - [ ] Find the "Upstart Goblin" card entry in Combo 1
   - [ ] Verify "Copies in deck" still shows **2**
   - [ ] Scroll down to Combo 2
   - [ ] Verify "Copies in deck" for "Upstart Goblin" still shows **2**
   - [ ] **Expected Result:** Both combos show the same copy count for the same card

### Scenario 4: Non-YDK cards maintain default behavior

**When:** The user adds a card that is NOT from the uploaded YDK decklist
**Then:** The system uses default values (Copies in deck: 3, Max in hand: 3, Min in hand: 1)

#### Test Steps:

1. **Test Case 4.1: Card from full database (not in YDK)**
   - [ ] Continue from previous scenarios
   - [ ] Click on a card name input field
   - [ ] Type "Ash Blossom" (assuming this card is NOT in the test YDK)
   - [ ] Wait for search results to load
   - [ ] Click on "Ash Blossom & Joyous Spring" from the dropdown
   - [ ] **Expected Result:** "Copies in deck" is set to **3** (default)
   - [ ] **Expected Result:** "Max in hand" is set to **3** (default)
   - [ ] **Expected Result:** "Min in hand" is set to **1** (default)

2. **Test Case 4.2: Custom card name**
   - [ ] Click on a card name input field
   - [ ] Type "Any Dragon" (custom name)
   - [ ] Click "Use custom name" button
   - [ ] **Expected Result:** "Copies in deck" is set to **3** (default)
   - [ ] **Expected Result:** "Max in hand" is set to **3** (default)
   - [ ] **Expected Result:** "Min in hand" is set to **1** (default)

### Scenario 5: Calculate button uses correct copy counts

**Given:** The user has added multiple cards from their YDK decklist with different copy counts
**When:** The user clicks "Calculate"
**Then:** The probability calculation uses the correct copy counts from the YDK

#### Test Steps:

1. **Test Case 5.1: Calculation with YDK copy counts**
   - [ ] Set up Combo 1 with:
     - Blue-Eyes White Dragon (3 copies in deck, 1 min, 1 max)
     - Dark Magician (3 copies in deck, 1 min, 1 max)
   - [ ] Verify "Deck size" is automatically set to match YDK main deck count
   - [ ] Set "Hand size" to **5**
   - [ ] Click "Calculate" button
   - [ ] **Expected Result:** Calculation completes successfully
   - [ ] **Expected Result:** Results are displayed in "Calculation Dashboard"
   - [ ] **Expected Result:** Probabilities reflect the correct copy counts (3 copies each)

## Bug Verification

### Original Bug:
Before the fix, when users added cards from their YDK decklist, the system incorrectly set "Copies in deck" to 1 regardless of actual copy count.

### Fix Verification:
- [ ] Confirm that all test scenarios pass
- [ ] Confirm that "Copies in deck" matches the actual YDK card count for all cards
- [ ] Confirm that "Max in hand" is set equal to "Copies in deck" when adding YDK cards
- [ ] Confirm that manual adjustments still work as expected
- [ ] Confirm that calculations use the correct copy counts

## Additional Edge Cases

1. **Test Case: Empty YDK upload**
   - [ ] Try uploading an empty or invalid YDK file
   - [ ] **Expected Result:** Error message is displayed
   - [ ] **Expected Result:** Application remains functional

2. **Test Case: YDK with Extra Deck cards**
   - [ ] Upload a YDK with Extra Deck cards (the test deck includes Extra Deck)
   - [ ] Verify that Extra Deck cards are not shown in main deck card selection
   - [ ] **Expected Result:** Only Main Deck cards are available for combo selection

3. **Test Case: Removing and re-adding YDK**
   - [ ] Upload test-deck.ydk
   - [ ] Add a card with specific copy count
   - [ ] Remove the YDK file
   - [ ] Upload the same YDK file again
   - [ ] Add the same card
   - [ ] **Expected Result:** Copy count is correctly set from the re-uploaded YDK

## Success Criteria

✅ All test scenarios pass
✅ "Copies in deck" matches actual YDK card count
✅ "Max in hand" equals "Copies in deck" when adding YDK cards
✅ Manual adjustments work correctly
✅ Same card in multiple combos uses same count
✅ Non-YDK cards maintain default behavior
✅ Calculations use correct copy counts

## Notes for QA
- The fix is implemented in two files:
  - `src/App.jsx` (updateCombo function - handles batch updates)
  - `src/features/shared/SearchableCardInput.jsx` (handleCardSelect function - passes copy count data)
- Console logs are enabled for debugging - check browser console for detailed state updates
- The test YDK file is located at project root: `test-deck.ydk`
