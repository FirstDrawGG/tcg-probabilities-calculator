import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom', // Use jsdom for browser-like environment (window, document, etc.)
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.test.js',
        '**/*.test.jsx',
        '**/*.spec.js',
        '**/*.spec.jsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/scripts/**',
        '**/.{idea,git,cache,output,temp}/**',
        'vite.config.js',
        'vitest.config.js',
        'tailwind.config.js',
        'postcss.config.js'
      ],
      include: ['src/**/*.{js,jsx}']
    },
  },
})