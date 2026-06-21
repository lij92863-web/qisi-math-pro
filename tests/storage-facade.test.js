const test = require('node:test'); const assert = require('node:assert/strict');
const { createDraftRecord } = require('../qisi-storage-facade.js');
test('BM14: create draft record', () => { const r = createDraftRecord('batch1', 1, { answer: 'A', solution: 'S' }); assert.equal(r.questionNumber, '1'); assert.equal(r.answer, 'A'); assert.ok(r.updatedAt > 0); });
