import { defineConfig } from 'vite';

// Game art lives in assets/ and is served as-is from the site root.
// raw/, tools/, and prototypes/ stay in the repo but are not deployed.
export default defineConfig({
  publicDir: 'assets',
});
