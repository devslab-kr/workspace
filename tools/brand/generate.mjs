import { readFile, writeFile, mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assets = resolve(root, 'docs/assets/brand');
const source = {
  repository: 'https://github.com/devslab-kr/oss-brand',
  release: 'v0.4.0',
  commit: '3870b9ea86f5ccc443d06b49d991592591b110da',
  archive: 'https://github.com/devslab-kr/oss-brand/releases/download/v0.4.0/workspace.zip',
  archiveSha256: '76b046d7e89b36b696b3b64a8a966433b7efdef7ef9efebc886ba2a9e619b99a',
  checksumsSha256: 'e1b7b4bc1d5a6a17aa847e5620dab90f4e2a6276309682a71405ab4369959a0d',
};
const aliases = {
  'project-mark.svg': 'glyph-color.svg',
  'project-mark-dark.svg': 'glyph-dark.svg',
  'project-mark-monochrome.svg': 'glyph-monochrome.svg',
  'project-mark-reversed.svg': 'glyph-reversed.svg',
  'project-lockup.svg': 'lockup-endorsed.svg',
  ...Object.fromEntries([16, 32, 180, 192, 512].map(size => [`icon-${size}.png`, `icons/icon-${size}.png`])),
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = name => {
  if (!/^[a-z0-9][a-z0-9./-]*$/i.test(name) || name.split('/').includes('..') || name.includes('//')) throw new Error(`Unsafe canonical asset path: ${name}`);
  return name;
};
async function checksumFiles(directory) {
  if (sha256(await readFile(join(directory, 'checksums.txt'))) !== source.checksumsSha256) throw new Error('Canonical checksum manifest differs from pinned release');
  const checksums = new Map();
  for (const line of (await readFile(join(directory, 'checksums.txt'), 'utf8')).trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || checksums.has(match[2])) throw new Error('Invalid canonical checksum manifest');
    const name = safePath(match[2]);
    if (sha256(await readFile(join(directory, name))) !== match[1]) throw new Error(`Canonical checksum mismatch: ${name}`);
    checksums.set(name, match[1]);
  }
  checksums.set('checksums.txt', sha256(await readFile(join(directory, 'checksums.txt'))));
  return checksums;
}
async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), name + '/'));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected asset entry: ${name}`);
  }
  return files.sort();
}
async function check() {
  const manifest = JSON.parse(await readFile(join(assets, 'oss-brand.json'), 'utf8'));
  if (manifest.registryId !== 'O13' || manifest.project !== 'workspace' || JSON.stringify(manifest.source) !== JSON.stringify(source)) throw new Error('Workspace canonical provenance mismatch');
  const canonical = await checksumFiles(assets);
  for (const [name, original] of Object.entries(aliases)) {
    if (sha256(await readFile(join(assets, name))) !== canonical.get(original)) throw new Error(`Canonical alias mismatch: ${name}`);
  }
  const expected = [...canonical.keys(), ...Object.keys(aliases), 'oss-brand.json'].sort();
  if (JSON.stringify(await listFiles(assets)) !== JSON.stringify(expected)) throw new Error('Unexpected or missing brand assets; import the canonical snapshot again');
  console.log(`Verified canonical Workspace O13 ${source.release}: ${canonical.size - 1} assets and ${Object.keys(aliases).length} exact aliases.`);
}
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === '--check')) await check();
else if (args.length === 2 && args[0] === '--source-dir') {
  const directory = resolve(args[1]);
  if (relative(assets, directory) === '' || !relative(assets, directory).startsWith('..')) throw new Error('Import source must be outside the destination');
  const checksums = await checksumFiles(directory);
  const expected = [...checksums.keys()].sort();
  if (JSON.stringify(await listFiles(directory)) !== JSON.stringify(expected)) throw new Error('Canonical source contains unlisted files');
  const glyph = await readFile(join(directory, 'glyph-color.svg'), 'utf8');
  if (!glyph.includes('data-oss-project="O13"') || !glyph.includes('stroke-width="2.4"')) throw new Error('Canonical source is not Workspace O13');
  if (assets !== resolve(root, 'docs/assets/brand')) throw new Error('Invalid destination');
  await rm(assets, { recursive: true, force: true });
  await mkdir(assets, { recursive: true });
  for (const name of checksums.keys()) {
    await mkdir(dirname(join(assets, name)), { recursive: true });
    await copyFile(join(directory, name), join(assets, name));
  }
  for (const [name, original] of Object.entries(aliases)) await copyFile(join(directory, original), join(assets, name));
  await writeFile(join(assets, 'oss-brand.json'), JSON.stringify({schemaVersion: 1, project: 'workspace', registryId: 'O13', registrationStatus: 'canonical', guide: 'https://devslab.kr/brand/open-source/', source, approvedPair: {light: '#1D4ED8', dark: '#93C5FD'}, route: ['M14 21V15H19V18H24V23H14', 'M14 18H19'], routeStrokeWidth: 2.4, aliases}, null, 2) + '\n');
  await check();
} else throw new Error('Usage: node tools/brand/generate.mjs [--check | --source-dir EXTRACTED_WORKSPACE_DIR]');
