import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('static entry point uses browser-native asset references', async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /href="\.\/src\/style\.css"/);
  assert.match(html, /src="\.\/src\/main\.js"/);
  assert.doesNotMatch(javascript, /import\s+['"]\.\/style\.css['"]/);
});
