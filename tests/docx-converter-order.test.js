const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConverterOrder } = require('../qisi-local-server.js');

test('Windows visual supplement prefers Word and treats LibreOffice as an optional fallback', () => {
  assert.deepEqual(buildConverterOrder(undefined, 'win32'), ['word', 'libre']);
  assert.deepEqual(buildConverterOrder('auto', 'win32'), ['word', 'libre']);
  assert.deepEqual(buildConverterOrder('word-first', 'win32'), ['word', 'libre']);
  assert.deepEqual(buildConverterOrder('libreoffice-first', 'win32'), ['libre', 'word']);
});

test('explicit converter modes stay bounded and non-Windows never schedules Word COM', () => {
  assert.deepEqual(buildConverterOrder('word-only', 'win32'), ['word']);
  assert.deepEqual(buildConverterOrder('libreoffice-only', 'win32'), ['libre']);
  assert.deepEqual(buildConverterOrder('word-only', 'linux'), []);
  assert.deepEqual(buildConverterOrder('auto', 'linux'), ['libre']);
});
