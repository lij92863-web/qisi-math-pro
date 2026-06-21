const test = require('node:test'); const assert = require('node:assert/strict');
const { summarizeDraftStatus } = require('../qisi-review-draft-state.js');
test('BM08: summarize', () => { const r = summarizeDraftStatus([{ question: '1', answer: 'A', solution: 'S' }, { question: '2' }]); assert.equal(r.total, 2); assert.equal(r.complete, 1); assert.equal(r.missingAnswer, 1); assert.ok(r.safePartial); });
