import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist', 'sn-assistant-extension');
const zipPath = path.join(rootDir, 'dist', 'sn-assistant-extension.zip');

const extensionEntries = [
  'manifest.json',
  'command-palette.js',
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

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimestamp(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f)
  };
}

async function collectFiles(baseDir, currentDir = baseDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(baseDir, absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const metadata = await stat(absolutePath);
    files.push({
      absolutePath,
      relativePath: path.relative(baseDir, absolutePath).split(path.sep).join('/'),
      modifiedAt: metadata.mtime
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function assertValidManifestLayout() {
  const files = await collectFiles(outDir);
  const manifestFiles = files.filter((file) => path.posix.basename(file.relativePath) === 'manifest.json');

  if (manifestFiles.length !== 1 || manifestFiles[0].relativePath !== 'manifest.json') {
    const found = manifestFiles.map((file) => file.relativePath).join(', ') || 'none';
    throw new Error(
      `Submission package must contain exactly one manifest.json at the root. Found: ${found}`
    );
  }

  return files;
}

async function createZipArchive(files, destinationPath) {
  const localFileParts = [];
  const centralDirectoryParts = [];
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.relativePath, 'utf8');
    const rawContent = await readFile(file.absolutePath);
    const compressedContent = deflateRawSync(rawContent);
    const useCompression = compressedContent.length < rawContent.length;
    const payload = useCompression ? compressedContent : rawContent;
    const compressionMethod = useCompression ? 8 : 0;
    const checksum = crc32(rawContent);
    const { time, date } = toDosTimestamp(file.modifiedAt);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawContent.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localFileParts.push(localHeader, fileName, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawContent.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectoryParts.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + payload.length;
  }

  const centralDirectorySize = centralDirectoryParts.reduce((size, part) => size + part.length, 0);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  await writeFile(
    destinationPath,
    Buffer.concat([...localFileParts, ...centralDirectoryParts, endOfCentralDirectory])
  );
}

async function main() {
  await rm(zipPath, { force: true });
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const entry of extensionEntries) {
    await cp(path.join(rootDir, entry), path.join(outDir, entry), { recursive: true });
  }

  const files = await assertValidManifestLayout();
  await createZipArchive(files, zipPath);

  console.log(`SN Assistant package staged in ${path.relative(rootDir, outDir)}`);
  console.log(`Submission zip ready at ${path.relative(rootDir, zipPath)}`);
  console.log('Upload that zip directly to Chrome Web Store or Edge Add-ons.');
}

main().catch((error) => {
  console.error('Failed to stage extension package:', error);
  process.exitCode = 1;
});
