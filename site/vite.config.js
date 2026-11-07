import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { checkCounts } from './src/checkCount.mjs';
// The site reads ../level-*/results_*.json and repo docs at build time, so every number on the page is generated, never typed.
// __CHECK_COUNTS__ is derived from the check( call sites in tests/, not typed.
export default defineConfig({
  base: '/ml-platform-lab/',
  plugins: [react()],
  define: { __CHECK_COUNTS__: JSON.stringify(checkCounts()) },
  server: { fs: { allow: ['..'] } },
});
