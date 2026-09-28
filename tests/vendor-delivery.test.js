const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('every locally referenced browser dependency is delivered with matching integrity', () => {
  const html = fs.readFileSync(path.join(root, 'main.html'), 'utf8');
  const assetTags = html.match(/<(?:script|link)\b[^>]+(?:src|href)="\.\/vendor\/[^>]+>/g) || [];
  assert.ok(assetTags.length >= 10, 'local browser assets must be declared');
  for (const tag of assetTags) {
    const name = tag.match(/(?:src|href)="\.\/(vendor\/[^\"]+)"/)?.[1];
    const integrity = tag.match(/integrity="sha384-([^\"]+)"/)?.[1];
    assert.ok(name && integrity, `missing asset or integrity: ${tag}`);
    const bytes = fs.readFileSync(path.join(root, name));
    const digest = crypto.createHash('sha384').update(bytes).digest('base64');
    assert.equal(digest, integrity, `${name} failed integrity check`);
    execFileSync('git', ['ls-files', '--error-unmatch', '--', name], { cwd: root, stdio: 'pipe' });
    const attr = execFileSync('git', ['check-attr', 'text', '--', name], { cwd: root, encoding: 'utf8' });
    assert.match(attr, /text: unset/, `${name} must keep its exact bytes after checkout`);
    const deliveredBytes = execFileSync('git', ['show', `:${name}`], { cwd: root });
    assert.deepEqual(deliveredBytes, bytes, `${name} differs from the staged delivery`);
  }
});

test('PDF worker is local, version matched, and included in delivery', () => {
  const source = fs.readFileSync(path.join(root, 'qisi-browser-pdf-renderer.js'), 'utf8');
  assert.match(source, /\.\/vendor\/pdfjs\/pdf\.worker\.min\.js/);
  const name = 'vendor/pdfjs/pdf.worker.min.js';
  const bytes = fs.readFileSync(path.join(root, name));
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b'
  );
  execFileSync('git', ['ls-files', '--error-unmatch', '--', name], { cwd: root, stdio: 'pipe' });
});
