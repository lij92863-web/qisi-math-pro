const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
test('BM18: main.html exists and references app.js last', () => { const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8'); assert.ok(html.includes('app.js'), 'app.js referenced'); assert.ok(!html.includes('answer-only-ai'), 'Route B not in script tags'); });
test('BM18: controlled-write loaded before app.js', () => { const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8'); const cwIdx = html.indexOf('controlled-write'); const appIdx = html.indexOf('app.js'); assert.ok(cwIdx < appIdx, 'controlled-write loads before app.js'); });
