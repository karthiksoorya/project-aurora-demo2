// Dev-server proxy: the browser only ever talks to the Angular origin; /api and /health go to the
// local NestJS API (loopback). Override the target with AURORA_API_URL (used by the e2e suite).
const target = process.env.AURORA_API_URL ?? 'http://127.0.0.1:3000';
export default {
  '/api': { target, secure: false },
  '/health': { target, secure: false },
};
