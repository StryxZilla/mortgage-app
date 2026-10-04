import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await cp('src', 'dist/src', { recursive: true });
const html = (await readFile('index.html', 'utf8')).replace('/src/main.js', './src/main.js');
await writeFile('dist/index.html', html);
console.log('Built static site in dist/');
