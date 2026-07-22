const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('TEX题库 branding is wired to a local transparent PNG asset', () => {
  const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
  const logo = fs.readFileSync(path.join(ROOT, 'assets', 'tex-logo.png'));

  assert.match(html, /<title>TEX题库 \| 本地数学题库系统<\/title>/);
  assert.match(html, /src="\.\/assets\/tex-logo\.png"/);
  assert.match(html, />TEX题库<\/span>/);
  assert.doesNotMatch(html, /奇思数学|奇思妙想/);
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('offline Noto Sans files back the redesigned controls without a web font dependency', () => {
  const css = fs.readFileSync(path.join(ROOT, 'app.css'), 'utf8');
  for (const name of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf']) {
    const fontPath = path.join(ROOT, 'vendor', 'fonts', 'noto-sans', name);
    assert.ok(fs.statSync(fontPath).size > 100_000, `${name} is packaged locally`);
    assert.ok(css.includes(`./vendor/fonts/noto-sans/${name}`));
  }
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});
