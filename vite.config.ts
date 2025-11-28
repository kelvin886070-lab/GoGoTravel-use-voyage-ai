import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
    define: {
      // Polyfill process.env.API_KEY so standard Gemini SDK code works
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
  };
});