// Builds the static demo: API dist (tsc output keeps decorator metadata) bundled for the browser + Angular app.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const out = process.argv[2] ?? path.join(here, 'out');
await build({
  entryPoints: [path.join(here, 'backend.js')],
  bundle: true,
  minify: !process.env.DEMO_DEBUG,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(out, 'demo-backend.js'),
  alias: {
    '@nestjs/common': path.join(here, 'shims/nest-common.js'),
    '@nestjs/platform-express': path.join(here, 'shims/platform-express.js'),
    'node:crypto': path.join(here, 'shims/crypto.js'),
    'node:fs': path.join(here, 'shims/fs.js'),
    fs: path.join(here, 'shims/fs.js'),
    'node:async_hooks': path.join(here, 'shims/async-hooks.js'),
    'node:path': req.resolve('path-browserify'),
    path: req.resolve('path-browserify'),
  },
  define: { 'process.env': '{}', 'process.pid': '1', global: 'globalThis' },
  inject: [path.join(here, 'shims/process.js')],
  logLevel: 'warning',
  legalComments: 'none',
});
console.log('demo-backend.js built');
