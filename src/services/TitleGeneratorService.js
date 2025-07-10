// src/services/TitleGeneratorService.js

export const TitleGeneratorService = {
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
      low: ["Brick City?", "Pray for Luck", "Risk Taker", "Bold Strategy"]
    };

    // Select flavor text based on probability
    const flavorCategory = avgProbability > 70 ? 'high' :
                          avgProbability > 40 ? 'medium' : 'low';
    const flavorText = flavorTexts[flavorCategory][
      Math.floor(Math.random() * flavorTexts[flavorCategory].length)
    ];

    // Select suffix based on unique card count
    const uniqueCardCount = cardNames.length;
    const suffixKey = uniqueCardCount === 1 ? 1 : 
                     uniqueCardCount === 2 ? 2 : 'multi';
    const suffix = suffixes[suffixKey][
      Math.floor(Math.random() * suffixes[suffixKey].length)
    ];

    // Deck size flavor
    const deckFlavor = deckSize === 40 ? "Standard" :
                      deckSize === 60 ? "Big Deck" :
                      deckSize < 40 ? "Compact" : "Massive";

    return `${probEmoji} ${deckFlavor} ${suffix} | ${flavorText}`;
  }
};