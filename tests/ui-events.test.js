const test = require('node:test'); const assert = require('node:assert/strict');
const { bindClick } = require('../qisi-ui-events.js');
test('BM15: bindClick returns false for null element', () => { assert.equal(bindClick(null, () => {}), false); });
