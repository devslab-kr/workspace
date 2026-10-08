import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../src/style.css', import.meta.url), new URL('../dist/style.css', import.meta.url));
await copyFile(new URL('../src/dds.css', import.meta.url), new URL('../dist/dds.css', import.meta.url));
