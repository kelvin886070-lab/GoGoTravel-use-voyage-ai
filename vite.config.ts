import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  // 註：Gemini / Weather 金鑰已移至 Supabase Edge Function，前端不再注入。
  void env;
  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
  };
});