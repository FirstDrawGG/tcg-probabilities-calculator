/**
 * TitleGeneratorService - Generates fun, contextual titles for calculation results
 */

const TitleGeneratorService = {
  generateFunTitle: (combos, deckSize, results) => {
    const cardNames = combos.flatMap(combo =>
      combo.cards.map(card => card.starterCard)
    ).filter(name => name.trim() !== '');

    // Calculate average probability for multiple combos
    const avgProbability = results.reduce((sum, r) => sum + r.probability, 0) / results.length;

    // Probability-based emoji selection
    const probEmoji = avgProbability > 80 ? "🔥" :
                     avgProbability > 60 ? "⚡" :
                     avgProbability > 40 ? "🎲" : "💀";

    // Fun suffixes based on card count
    const suffixes = {
      1: ["Hunt", "Check", "Math", "Dreams"],
      2: ["Combo", "Engine", "Pair", "Duo"],
      multi: ["Analysis", "Package", "Study", "Report"]
    };

    const flavorTexts = {
      high: ["Going Off!", "Maximum Consistency", "Trust the Math", "Opening Hand Magic"],
      medium: ["Solid Chances", "Decent Odds", "Making It Work", "The Sweet Spot"],
      low: ["Brick City?", "Pray to RNGesus", "Heart of the Cards", "Bold Strategy"]
    };

    let title = "";

    if (cardNames.length === 0) {
      // Edge case: no cards
      title = `${probEmoji} Mystery Deck Analysis (${deckSize} Cards)`;
    } else if (cardNames.length === 1) {
      const suffix = suffixes[1][Math.floor(Math.random() * suffixes[1].length)];
      title = `${probEmoji} ${cardNames[0]} ${suffix}: `;

      if (avgProbability > 80) {
        title += flavorTexts.high[Math.floor(Math.random() * flavorTexts.high.length)];
      } else if (avgProbability > 40) {
        title += flavorTexts.medium[Math.floor(Math.random() * flavorTexts.medium.length)];
      } else {
        title += flavorTexts.low[Math.floor(Math.random() * flavorTexts.low.length)];
      }

      title += ` (${deckSize} Cards)`;
    } else if (cardNames.length === 2) {
      const suffix = suffixes[2][Math.floor(Math.random() * suffixes[2].length)];
      title = `✨ ${cardNames[0]} + ${cardNames[1]}: The ${suffix}`;
    } else {
      const suffix = suffixes.multi[Math.floor(Math.random() * suffixes.multi.length)];
      title = `🧮 ${cardNames.length}-Card ${suffix}: Tournament Ready?`;
    }

    return title;
  }
};

export default TitleGeneratorService;
