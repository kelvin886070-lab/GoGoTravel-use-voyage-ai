import { createServer } from 'vite';
const mod = process.argv[2] || '/scripts/test_autoroute.ts';
const server = await createServer({
  configFile: false, root: process.cwd(), cacheDir: '/tmp/vite-cache-test', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom',
});
try { await server.ssrLoadModule(mod); }
catch (e) { console.error('LOAD ERROR:', e && e.message ? e.message : e); process.exitCode = 1; }
finally { await server.close(); }
