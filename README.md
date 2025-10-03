# TCG Probabilities Calculator

Calculate optimal deck ratios for trading card game combos using Monte Carlo simulation.

## 🚀 Features

- **Multiple Combo Calculations**: Calculate probabilities for multiple combos simultaneously
- **Card Database Integration**: Search and select from the complete Yu-Gi-Oh! card database via Vercel Blob Storage
- **Monte Carlo Simulation**: 100,000 iterations for accurate probability estimates
- **Shareable Links**: Generate URLs to share your calculations
- **Exact Mathematical Formulas**: View the hypergeometric distributions behind calculations
- **Hand Trap Mode**: Identify and calculate interaction probabilities
- **YDK Import**: Import deck lists and test opening hands
- **Interactive Combo Assignment**: Assign cards from opening hands to combos

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components (Button, Input, etc.)
│   ├── CardImage.jsx   # Card image display with Vercel Blob fallback
│   ├── FormulaDisplay.jsx
│   └── Icon.jsx
├── features/           # Feature-specific components
│   └── calculator/
│       ├── ComboForm.jsx
│       ├── DeckConfigInputs.jsx
│       ├── ResultsDisplay.jsx
│       └── YdkImporter.jsx
├── hooks/              # Custom React hooks
│   ├── useCalculations.js
│   ├── useCardSearch.js
│   ├── useCombos.js
│   ├── useDeckConfig.js
│   ├── useErrors.js
│   ├── useOpeningHand.js
│   ├── useShareableUrl.js
│   ├── useToast.js
│   └── useYdkImport.js
├── services/           # Business logic services
│   ├── CardDatabaseService.js
│   ├── HandTrapService.js
│   ├── ProbabilityService.js
│   ├── TitleGeneratorService.js
│   ├── URLService.js
│   └── YdkParser.js
├── utils/              # Utility functions
│   └── validation.js
├── App.jsx             # Main application component
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📚 Architecture

### Services

- **CardDatabaseService**: Manages card metadata from Vercel Blob with YGOPro API fallback and 7-day localStorage cache
- **ProbabilityService**: Monte Carlo simulation engine with result caching
- **TitleGeneratorService**: Generates contextual titles for calculation results
- **URLService**: Encodes/decodes calculation state to/from URL hash for sharing
- **HandTrapService**: Identifies and categorizes hand trap cards
- **YdkParser**: Parses YDK deck files and processes card data

### Custom Hooks

- **useCombos**: Manages combo state and operations (add, update, delete)
- **useDeckConfig**: Handles deck size and hand size with validation
- **useCalculations**: Manages probability calculations with loading state
- **useCardSearch**: Manages card database state
- **useShareableUrl**: Manages shareable URL state
- **useYdkImport**: Manages YDK file import and deck zone state
- **useToast**: Toast notification state management
- **useOpeningHand**: Opening hand state and refresh logic
- **useErrors**: Form validation error state

### Components

- **ComboForm**: Individual combo configuration with card management
- **DeckConfigInputs**: Deck size, hand size, and YDK import controls
- **ResultsDisplay**: Calculation results, opening hand, and sharing UI
- **YdkImporter**: YDK file upload and deck list management
- **CardImage**: Card image display with WebP optimization and fallbacks
- **FormulaDisplay**: Mathematical formula visualization
- **Icon**: SVG icon component with accessibility

## 🎨 Styling

The app uses:
- **Tailwind CSS** for layout and utilities
- **Custom CSS variables** for theming (`--bg-main`, `--text-main`, etc.)
- **Geist font family** throughout
- **Dark theme** with specific color palette
- **Pill-shaped inputs** (40px height, 999px border-radius)

## 🗄️ Data Architecture

### Card Metadata
- **Primary**: Vercel Blob Storage (~26 MB, CDN cached)
- **Fallback**: YGOPro API
- **Cache**: 7-day localStorage

### Card Images
- **Primary**: Vercel Blob Storage (WebP format)
- **Fallback**: YGOPro API
- **Optimization**: Lazy loading, responsive sizing

### Static Database
- **Location**: `/public/cardDatabase.json` (2.1 MB)
- **Purpose**: Offline YDK parsing

## 📊 Performance

- Card search debounced (300ms) and limited to 50 results
- Monte Carlo: 100,000 iterations per calculation
- Results caching prevents redundant calculations
- Card database cached for 7 days
- Full database loads in ~500ms from Vercel CDN
- WebP card images with lazy loading

## 🔗 External Dependencies

- **Vercel Blob Storage**: Card metadata and images
- **YGOPro API**: Fallback for card data
- **Vercel Analytics**: Usage tracking
- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS

## 📝 License

MIT

## 🤝 Contributing

This project has been refactored from a monolithic 3,677-line component into a modular, maintainable architecture. Contributions are welcome!

See [CLAUDE.md](CLAUDE.md) for detailed development guidance.
