const test = require('node:test'); const assert = require('node:assert/strict');
const { renderDraftSummary } = require('../qisi-ui-renderer.js');
test('BM16: render summary', () => { const r = renderDraftSummary({ total: 12, missingAnswer: 2, safePartial: true }); assert.equal(r.total, 12); assert.ok(r.safePartial); });
