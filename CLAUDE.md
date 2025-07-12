# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `npm run dev` - Starts the Vite development server
- **Build**: `npm run build` - Creates production build in `dist/` directory
- **Preview**: `npm run preview` - Preview the production build locally

## Architecture Overview

This is a single-page React application for calculating probabilities in Trading Card Games (specifically Yu-Gi-Oh!), built with Vite, React 18, and Tailwind CSS.

### Core Components Structure

- **App.jsx**: Contains the entire application as a single large component (1,765 lines)
- **main.jsx**: React app entry point with Vercel Analytics integration
- **index.css**: Tailwind CSS imports and base styles

### Key Services (all in App.jsx)

- **URLService**: Handles encoding/decoding calculation data to/from URL hash for shareable links
- **CardDatabaseService**: Manages Yu-Gi-Oh! card database API calls and local caching (7-day cache duration)
- **ProbabilityService**: Monte Carlo simulation engine (100,000 simulations per calculation) with result caching
- **TitleGeneratorService**: Generates fun, contextual titles for calculation results

### Data Flow

1. User defines combos with card names, deck quantities, and hand requirements
2. Card search uses the Yu-Gi-Oh! database API (db.ygoprodeck.com) with local caching
3. Probability calculations use Monte Carlo simulation (not exact math) for real-world accuracy
4. Results are cached to avoid recalculation of identical scenarios
5. Shareable URLs encode the entire calculation state in the hash

### Styling Approach

- Tailwind CSS for layout and utilities
- Custom inline styles with a centralized `typography` object for consistent font sizing
- Dark theme with specific color palette (#000000 background, #333 inputs, etc.)
- Geist font family throughout
- Custom pill-shaped buttons and inputs with specific dimensions (40px height, 999px border-radius)

### State Management

All state is managed locally in the main App component using React hooks:
- `combos`: Array of combo definitions with cards and requirements
- `results`: Probability calculation results (individual and combined)
- `cardDatabase`: Cached card data from API
- `errors`: Form validation state

### External Dependencies

- **Yu-Gi-Oh! API**: https://db.ygoprodeck.com/api/v7/cardinfo.php (no auth required)
- **Vercel Analytics**: Integrated for usage tracking
- **Local Storage**: Used for 7-day card database caching

### Performance Considerations

- Card search is debounced (300ms) and limited to 50 results
- Monte Carlo simulations use 100,000 iterations for accuracy vs speed balance
- Results are cached to avoid redundant calculations
- Card database is cached locally for 7 days to reduce API calls