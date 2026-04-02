import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { deckDevApiPlugin } from './scripts/deck-dev-api.mjs'

export default defineConfig({
  // Default is `node_modules/.vite` (a dot-folder — easy to miss). Use a visible folder so
  // stale pre-bundles can be cleared with `rm -rf vite-cache` after dependency changes.
  cacheDir: 'vite-cache',

  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    deckDevApiPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
  },

  optimizeDeps: {
    include: ['buffer', 'html-to-image', 'pdf-lib'],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
