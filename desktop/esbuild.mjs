// Bundle the Electron main + preload TS → CommonJS for the Electron runtime.
// `electron` and node built-ins are provided at runtime, so keep them external.
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' });
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js' });
console.log('✓ built desktop/dist/{main,preload}.js');
