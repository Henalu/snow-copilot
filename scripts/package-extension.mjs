import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist', 'sn-assistant-extension');

const extensionEntries = [
  'manifest.json',
  'content.js',
  'service-worker.js',
  'options.html',
  'options.js',
  'sidebar.css',
  'LICENSE',
  'icons',
  'change-documentation',
  'providers',
  'rag',
  'recommendation',
  'storage'
];

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const entry of extensionEntries) {
    await cp(path.join(rootDir, entry), path.join(outDir, entry), { recursive: true });
  }

  console.log(`SN Assistant package staged in ${path.relative(rootDir, outDir)}`);
  console.log('Zip the contents of that folder for Chrome Web Store or Edge Add-ons submission.');
}

main().catch((error) => {
  console.error('Failed to stage extension package:', error);
  process.exitCode = 1;
});
