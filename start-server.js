import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const productionServer = path.join(process.cwd(), '.output/server/index.mjs');

if (fs.existsSync(productionServer)) {
  console.log('Starting production server...');
  const proc = spawn('node', [productionServer], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  proc.on('error', (err) => {
    console.error('Failed to start production server:', err);
    process.exit(1);
  });
} else {
  console.log('No production build found, starting development server...');
  const proc = spawn('vite', ['dev'], {
    stdio: 'inherit',
    shell: true
  });
  proc.on('error', (err) => {
    console.error('Failed to start dev server:', err);
    process.exit(1);
  });
}
